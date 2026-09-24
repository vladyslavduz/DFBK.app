import type { Env } from '../lib/env';
import { json } from '../lib/response';
import { hashSessionToken } from '../lib/session';

type SessionRow = {
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
};

type ProjectOwnerRow = {
  id: string;
};

type GeneratedContentRow = {
  content_type: 'google_business' | 'social_media' | 'website_reference';
  content: string;
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

export async function handleProjectContent(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const match = pathname.match(
    /^\/api\/projects\/([^/]+)\/content$/
  );

  if (!match || request.method !== 'GET') {
    return null;
  }

  const projectId = decodeURIComponent(match[1]).trim();

  if (!projectId) {
    return json({ ok: false, error: 'INVALID_PROJECT_ID' }, 400);
  }

  const authenticatedUser = await getAuthenticatedUserId(request, env);

  if (authenticatedUser instanceof Response) {
    return authenticatedUser;
  }

  try {
    const project = await env.DB
      .prepare(
        `
        SELECT id
        FROM projects
        WHERE id = ?1
          AND user_id = ?2
        LIMIT 1
        `
      )
      .bind(projectId, authenticatedUser)
      .first<ProjectOwnerRow>();

    if (!project) {
      return json({ ok: false, error: 'PROJECT_NOT_FOUND' }, 404);
    }

    const result = await env.DB
      .prepare(
        `
        SELECT
          content_type,
          content
        FROM generated_contents
        WHERE project_id = ?1
          AND content_type IN (
            'google_business',
            'social_media',
            'website_reference'
          )
        `
      )
      .bind(projectId)
      .all<GeneratedContentRow>();

    if (result.results.length === 0) {
      return json({ ok: true, content: null }, 200);
    }

    const content = {
      googleBusiness: null as string | null,
      socialMedia: null as string | null,
      websiteReference: null as string | null,
    };

    for (const row of result.results) {
      if (row.content_type === 'google_business') {
        content.googleBusiness = row.content;
      } else if (row.content_type === 'social_media') {
        content.socialMedia = row.content;
      } else if (row.content_type === 'website_reference') {
        content.websiteReference = row.content;
      }
    }

    return json({ ok: true, content }, 200);
  } catch (error) {
    console.error('PROJECT_CONTENT_READ_ERROR', error);

    return json({ ok: false, error: 'PROJECT_CONTENT_READ_FAILED' }, 500);
  }
}
