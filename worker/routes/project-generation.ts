import type { Env } from '../lib/env';
import { json } from '../lib/response';
import { hashSessionToken } from '../lib/session';
import {
  ContentGenerationError,
  generateMarketingContent,
  type GeneratedMarketingContent,
} from '../lib/content-generation';

type SessionRow = {
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
};

type GenerationProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
};

type OriginalMediaRow = {
  storage_key: string;
  mime_type: string;
};

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [cookieName, ...cookieValueParts] = cookie.trim().split('=');

    if (cookieName === name) {
      return cookieValueParts.join('=') || null;
    }
  }

  return null;
}

async function getAuthenticatedUserId(
  request: Request,
  env: Env
): Promise<string | Response> {
  const sessionToken = getCookie(request, 'dfbk_session');

  if (!sessionToken) {
    return json({ ok: false, error: 'NOT_AUTHENTICATED' }, 401);
  }

  const tokenHash = await hashSessionToken(sessionToken);

  const session = await env.DB
    .prepare(
      `
      SELECT
        user_id,
        expires_at,
        revoked_at
      FROM sessions
      WHERE token_hash = ?1
      LIMIT 1
      `
    )
    .bind(tokenHash)
    .first<SessionRow>();

  if (!session) {
    return json({ ok: false, error: 'INVALID_SESSION' }, 401);
  }

  if (session.revoked_at !== null) {
    return json({ ok: false, error: 'SESSION_REVOKED' }, 401);
  }

  const expiresAt = new Date(session.expires_at);

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return json({ ok: false, error: 'SESSION_EXPIRED' }, 401);
  }

  return session.user_id;
}

export type ProjectGenerationPreparation = {
  project: {
    id: string;
    title: string;
    description: string;
    status: string;
  };
  content: GeneratedMarketingContent;
};

export async function prepareProjectGeneration(
  request: Request,
  env: Env,
  projectId: string
): Promise<ProjectGenerationPreparation | Response> {
  const authenticatedUser = await getAuthenticatedUserId(request, env);

  if (authenticatedUser instanceof Response) {
    return authenticatedUser;
  }

  const project = await env.DB
    .prepare(
      `
      SELECT
        id,
        title,
        description,
        status
      FROM projects
      WHERE id = ?1
        AND user_id = ?2
      LIMIT 1
      `
    )
    .bind(projectId, authenticatedUser)
    .first<GenerationProjectRow>();

  if (!project) {
    return json({ ok: false, error: 'PROJECT_NOT_FOUND' }, 404);
  }

  const description = project.description?.trim() ?? '';

  if (!description) {
    return json(
      { ok: false, error: 'PROJECT_DESCRIPTION_REQUIRED' },
      400
    );
  }

  const media = await env.DB
    .prepare(
      `
      SELECT
        storage_key,
        mime_type
      FROM project_media
      WHERE project_id = ?1
        AND media_type = 'image'
        AND role = 'original'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `
    )
    .bind(projectId)
    .first<OriginalMediaRow>();

  if (!media) {
    return json({ ok: false, error: 'PROJECT_IMAGE_REQUIRED' }, 400);
  }

  let object: R2ObjectBody | null;

  try {
    object = await env.MEDIA.get(media.storage_key);
  } catch (error) {
    console.error('PROJECT_GENERATION_R2_GET_ERROR', error);

    return json(
      { ok: false, error: 'PROJECT_IMAGE_READ_FAILED' },
      500
    );
  }

  if (!object) {
    console.error('PROJECT_GENERATION_R2_OBJECT_MISSING');

    return json(
      { ok: false, error: 'PROJECT_IMAGE_UNAVAILABLE' },
      500
    );
  }

  const imageBytes = new Uint8Array(await object.arrayBuffer());

  try {
    const content = await generateMarketingContent(env, {
      title: project.title,
      description,
      imageBytes,
      imageMimeType: media.mime_type,
    });

    return {
      project: {
        id: project.id,
        title: project.title,
        description,
        status: project.status,
      },
      content,
    };
  } catch (error) {
    if (error instanceof ContentGenerationError) {
      if (error.code === 'AI_NOT_CONFIGURED') {
        console.error('PROJECT_GENERATION_AI_NOT_CONFIGURED');

        return json(
          { ok: false, error: 'AI_NOT_CONFIGURED' },
          500
        );
      }

      if (error.code === 'AI_INVALID_RESPONSE') {
        console.error('PROJECT_GENERATION_AI_INVALID_RESPONSE');

        return json(
          { ok: false, error: 'AI_INVALID_RESPONSE' },
          502
        );
      }

      console.error('PROJECT_GENERATION_AI_REQUEST_FAILED');

      return json(
        { ok: false, error: 'AI_GENERATION_FAILED' },
        502
      );
    }

    console.error('PROJECT_GENERATION_UNEXPECTED_ERROR', error);

    return json(
      { ok: false, error: 'AI_GENERATION_FAILED' },
      500
    );
  }
}
