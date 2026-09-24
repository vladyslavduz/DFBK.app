import type { Env } from '../lib/env';
import { json } from '../lib/response';
import { hashSessionToken } from '../lib/session';
import {
  ContentGenerationError,
  generateMarketingContent,
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

async function markProjectFailed(
  env: Env,
  projectId: string,
  userId: string
): Promise<void> {
  try {
    await env.DB
      .prepare(
        `
        UPDATE projects
        SET
          status = 'failed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
          AND user_id = ?2
          AND status = 'processing'
        `
      )
      .bind(projectId, userId)
      .run();
  } catch (error) {
    console.error('PROJECT_GENERATION_MARK_FAILED_ERROR', error);
  }
}

async function generateProjectContent(
  request: Request,
  env: Env,
  projectId: string
): Promise<Response> {
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

  const lockResult = await env.DB
    .prepare(
      `
      UPDATE projects
      SET
        status = 'processing',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
        AND user_id = ?2
        AND status != 'processing'
      `
    )
    .bind(projectId, authenticatedUser)
    .run();

  if ((lockResult.meta.changes ?? 0) === 0) {
    return json(
      { ok: false, error: 'GENERATION_ALREADY_RUNNING' },
      409
    );
  }

  const imageBytes = new Uint8Array(await object.arrayBuffer());

  let content;

  try {
    content = await generateMarketingContent(env, {
      title: project.title,
      description,
      imageBytes,
      imageMimeType: media.mime_type,
    });
  } catch (error) {
    await markProjectFailed(env, projectId, authenticatedUser);

    if (error instanceof ContentGenerationError) {
      if (error.code === 'AI_NOT_CONFIGURED') {
        console.error('PROJECT_GENERATION_AI_NOT_CONFIGURED');
        return json({ ok: false, error: 'AI_NOT_CONFIGURED' }, 500);
      }

      if (error.code === 'AI_INVALID_RESPONSE') {
        console.error('PROJECT_GENERATION_AI_INVALID_RESPONSE');
        return json({ ok: false, error: 'AI_INVALID_RESPONSE' }, 502);
      }

      console.error('PROJECT_GENERATION_AI_REQUEST_FAILED');
      return json({ ok: false, error: 'AI_GENERATION_FAILED' }, 502);
    }

    console.error('PROJECT_GENERATION_UNEXPECTED_ERROR', error);
    return json({ ok: false, error: 'AI_GENERATION_FAILED' }, 500);
  }

  const upsert = `
    INSERT INTO generated_contents (
      id,
      project_id,
      content_type,
      content
    )
    VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(project_id, content_type)
    DO UPDATE SET
      content = excluded.content,
      updated_at = CURRENT_TIMESTAMP
  `;

  try {
    await env.DB.batch([
      env.DB
        .prepare(upsert)
        .bind(
          crypto.randomUUID(),
          projectId,
          'google_business',
          content.googleBusiness
        ),
      env.DB
        .prepare(upsert)
        .bind(
          crypto.randomUUID(),
          projectId,
          'social_media',
          content.socialMedia
        ),
      env.DB
        .prepare(upsert)
        .bind(
          crypto.randomUUID(),
          projectId,
          'website_reference',
          content.websiteReference
        ),
      env.DB
        .prepare(
          `
          UPDATE projects
          SET
            status = 'ready',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?1
            AND user_id = ?2
            AND status = 'processing'
          `
        )
        .bind(projectId, authenticatedUser),
    ]);
  } catch (error) {
    console.error('PROJECT_GENERATION_SAVE_ERROR', error);
    await markProjectFailed(env, projectId, authenticatedUser);

    return json(
      { ok: false, error: 'GENERATED_CONTENT_SAVE_FAILED' },
      500
    );
  }

  return json(
    {
      ok: true,
      content: {
        googleBusiness: content.googleBusiness,
        socialMedia: content.socialMedia,
        websiteReference: content.websiteReference,
      },
    },
    200
  );
}

export async function handleProjectGeneration(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const match = pathname.match(
    /^\/api\/projects\/([^/]+)\/generate$/
  );

  if (!match || request.method !== 'POST') {
    return null;
  }

  const projectId = decodeURIComponent(match[1]).trim();

  if (!projectId) {
    return json({ ok: false, error: 'INVALID_PROJECT_ID' }, 400);
  }

  return generateProjectContent(request, env, projectId);
}
