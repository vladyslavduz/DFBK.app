import type { Env } from '../lib/env';
import { json, notImplemented } from '../lib/response';
import { hashSessionToken } from '../lib/session';


type CreateProjectBody = {
  title?: unknown;
  description?: unknown;
};

type SessionRow = {
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
};

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};


function getCookie(
  request: Request,
  name: string
): string | null {
  const cookieHeader = request.headers.get('Cookie');

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [cookieName, ...cookieValueParts] =
      cookie.trim().split('=');

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
  const sessionToken = getCookie(
    request,
    'dfbk_session'
  );

  if (!sessionToken) {
    return json(
      { ok: false, error: 'NOT_AUTHENTICATED' },
      401
    );
  }

  const tokenHash = await hashSessionToken(
    sessionToken
  );

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
    return json(
      { ok: false, error: 'INVALID_SESSION' },
      401
    );
  }

  if (session.revoked_at !== null) {
    return json(
      { ok: false, error: 'SESSION_REVOKED' },
      401
    );
  }

  const expiresAt = new Date(session.expires_at);

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return json(
      { ok: false, error: 'SESSION_EXPIRED' },
      401
    );
  }

  return session.user_id;
}


function serializeProject(project: ProjectRow) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}


async function createProject(
  request: Request,
  env: Env
): Promise<Response> {
  const authenticatedUser = await getAuthenticatedUserId(
    request,
    env
  );

  if (authenticatedUser instanceof Response) {
    return authenticatedUser;
  }

  let body: CreateProjectBody;

  try {
    body = await request.json<CreateProjectBody>();
  } catch {
    return json(
      { ok: false, error: 'INVALID_JSON' },
      400
    );
  }

  if (typeof body.title !== 'string') {
    return json(
      { ok: false, error: 'PROJECT_TITLE_REQUIRED' },
      400
    );
  }

  const title = body.title.trim();

  if (!title) {
    return json(
      { ok: false, error: 'PROJECT_TITLE_REQUIRED' },
      400
    );
  }

  let description: string | null = null;

  if (
    body.description !== undefined &&
    body.description !== null
  ) {
    if (typeof body.description !== 'string') {
      return json(
        { ok: false, error: 'INVALID_PROJECT_DESCRIPTION' },
        400
      );
    }

    const normalizedDescription = body.description.trim();
    description = normalizedDescription || null;
  }

  const projectId = crypto.randomUUID();

  try {
    await env.DB
      .prepare(
        `
        INSERT INTO projects (
          id,
          user_id,
          title,
          description
        )
        VALUES (?1, ?2, ?3, ?4)
        `
      )
      .bind(
        projectId,
        authenticatedUser,
        title,
        description
      )
      .run();

    const project = await env.DB
      .prepare(
        `
        SELECT
          id,
          title,
          description,
          status,
          created_at,
          updated_at
        FROM projects
        WHERE id = ?1
          AND user_id = ?2
        LIMIT 1
        `
      )
      .bind(
        projectId,
        authenticatedUser
      )
      .first<ProjectRow>();

    if (!project) {
      throw new Error('Created project could not be read back');
    }

    return json(
      {
        ok: true,
        project: serializeProject(project),
      },
      201
    );
  } catch (error) {
    console.error(
      'PROJECT_CREATE_DB_ERROR',
      error
    );

    return json(
      { ok: false, error: 'PROJECT_CREATION_FAILED' },
      500
    );
  }
}


async function listProjects(
  request: Request,
  env: Env
): Promise<Response> {
  const authenticatedUser = await getAuthenticatedUserId(
    request,
    env
  );

  if (authenticatedUser instanceof Response) {
    return authenticatedUser;
  }

  try {
    const result = await env.DB
      .prepare(
        `
        SELECT
          id,
          title,
          description,
          status,
          created_at,
          updated_at
        FROM projects
        WHERE user_id = ?1
        ORDER BY created_at DESC
        `
      )
      .bind(authenticatedUser)
      .all<ProjectRow>();

    return json(
      {
        ok: true,
        projects: result.results.map(serializeProject),
      },
      200
    );
  } catch (error) {
    console.error(
      'PROJECT_LIST_DB_ERROR',
      error
    );

    return json(
      { ok: false, error: 'PROJECT_LIST_FAILED' },
      500
    );
  }
}


export async function handleProjects(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  if (
    pathname === '/api/projects' &&
    request.method === 'POST'
  ) {
    return createProject(request, env);
  }

  if (
    pathname === '/api/projects' &&
    request.method === 'GET'
  ) {
    return listProjects(request, env);
  }

  if (
    pathname === '/api/projects' ||
    pathname.startsWith('/api/projects/')
  ) {
    return notImplemented(
      'projects.api',
      []
    );
  }

  if (
    pathname === '/api/upload' ||
    pathname === '/api/upload/sign'
  ) {
    return notImplemented(
      'media.upload',
      ['R2_BINDING_TBD']
    );
  }

  return null;
}
