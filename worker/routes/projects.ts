import { normalizeProjectTitle, TEMPORARY_PROJECT_TITLE, TRIAL_PROJECT_LIMIT, type TitleSource, type PhotoOptimizationState } from '../lib/project-management';
import { readBoundedJson, requireSameOriginMutation } from '../lib/request-security';
import type { Env } from '../lib/env';
import { json, notImplemented } from '../lib/response';
import { hashSessionToken } from '../lib/session';


const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};


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
  title_source: TitleSource;
  photo_optimization_state: PhotoOptimizationState;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  media_id: string | null;
  media_mime_type: string | null;
};

type ProjectOwnerRow = {
  id: string;
};

type ProjectMediaRow = {
  id: string;
  project_id: string;
  storage_key: string;
  media_type: string;
  role: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};


type MediaReadRow = {
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  role: string;
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
    titleSource: project.title_source,
    photoOptimization: { state: project.photo_optimization_state },
    description: project.description,
    status: project.status,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    media: project.media_id && project.media_mime_type
      ? {
          id: project.media_id,
          mimeType: project.media_mime_type,
        }
      : null,
  };
}


function serializeProjectMedia(media: ProjectMediaRow) {
  return {
    id: media.id,
    projectId: media.project_id,
    mediaType: media.media_type,
    role: media.role,
    mimeType: media.mime_type,
    sizeBytes: media.size_bytes,
    createdAt: media.created_at,
    updatedAt: media.updated_at,
  };
}


function hasValidImageSignature(
  bytes: Uint8Array,
  mimeType: string
): boolean {
  if (mimeType === 'image/jpeg') {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (mimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }

  return false;
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

  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'INVALID_JSON' }, 400);
  const title = TEMPORARY_PROJECT_TITLE;

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
    const created = await env.DB
      .prepare(
        `
        INSERT INTO projects (
          id,
          user_id,
          title,
          description
        )
        SELECT ?1, ?2, ?3, ?4 FROM users u WHERE u.id = ?2
          AND (u.plan = 'business' OR (SELECT COUNT(*) FROM projects WHERE user_id = ?2) < ?5)
        `
      )
      .bind(
        projectId,
        authenticatedUser,
        title,
        description,
        TRIAL_PROJECT_LIMIT
      )
      .run();

    if (created.meta.changes === 0) return json({ ok: false, error: 'TRIAL_PROJECT_LIMIT_REACHED', limit: TRIAL_PROJECT_LIMIT }, 403);

    const project = await env.DB
      .prepare(
        `
        SELECT
          p.id,
          p.title,
          p.title_source,
          p.photo_optimization_state,
          p.description,
          p.status,
          p.created_at,
          p.updated_at,
          NULL AS media_id,
          NULL AS media_mime_type
        FROM projects p
        WHERE p.id = ?1
          AND p.user_id = ?2
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
          p.id,
          p.title,
          p.title_source,
          p.photo_optimization_state,
          p.description,
          p.status,
          p.created_at,
          p.updated_at,
          pm.id AS media_id,
          pm.mime_type AS media_mime_type
        FROM projects p
        LEFT JOIN project_media pm
          ON pm.id = (
            SELECT pm2.id
            FROM project_media pm2
            WHERE pm2.project_id = p.id
              AND pm2.role = 'original'
              AND pm2.media_type = 'image'
            ORDER BY pm2.created_at DESC, pm2.id DESC
            LIMIT 1
          )
        WHERE p.user_id = ?1
        ORDER BY p.created_at DESC
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


async function getProjectById(
  request: Request,
  env: Env,
  projectId: string
): Promise<Response> {
  const authenticatedUser = await getAuthenticatedUserId(
    request,
    env
  );

  if (authenticatedUser instanceof Response) {
    return authenticatedUser;
  }

  try {
    const project = await getSerializedProject(env, authenticatedUser, projectId);

    if (!project) {
      return json(
        { ok: false, error: 'PROJECT_NOT_FOUND' },
        404
      );
    }

    return json(
      {
        ok: true,
        project,
      },
      200
    );
  } catch (error) {
    console.error(
      'PROJECT_GET_DB_ERROR',
      error
    );

    return json(
      { ok: false, error: 'PROJECT_FETCH_FAILED' },
      500
    );
  }
}


async function readProjectMedia(
  request: Request,
  env: Env,
  projectId: string,
  mediaId: string
): Promise<Response> {
  const authenticatedUser = await getAuthenticatedUserId(
    request,
    env
  );

  if (authenticatedUser instanceof Response) {
    return authenticatedUser;
  }

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
    return json(
      { ok: false, error: 'PROJECT_NOT_FOUND' },
      404
    );
  }

  const media = await env.DB
    .prepare(
      `
      SELECT
        storage_key,
        mime_type,
        size_bytes,
        role
      FROM project_media
      WHERE id = ?1
        AND project_id = ?2
        AND media_type = 'image'
      LIMIT 1
      `
    )
    .bind(mediaId, projectId)
    .first<MediaReadRow>();

  if (!media) {
    return json(
      { ok: false, error: 'MEDIA_NOT_FOUND' },
      404
    );
  }

  let object: R2ObjectBody | null;

  try {
    object = await env.MEDIA.get(media.storage_key);
  } catch (error) {
    console.error('PROJECT_MEDIA_R2_GET_ERROR', error);

    return json(
      { ok: false, error: 'MEDIA_READ_FAILED' },
      500
    );
  }

  if (!object) {
    return json(
      { ok: false, error: 'MEDIA_OBJECT_NOT_FOUND' },
      404
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', media.mime_type);
  headers.set('Content-Length', String(object.size ?? media.size_bytes));
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(object.body, {
    status: 200,
    headers,
  });
}


async function uploadProjectMedia(
  request: Request,
  env: Env,
  projectId: string
): Promise<Response> {
  const authenticatedUser = await getAuthenticatedUserId(
    request,
    env
  );

  if (authenticatedUser instanceof Response) {
    return authenticatedUser;
  }

  const project = await env.DB
    .prepare(
      `
      SELECT id, photo_optimization_state
      FROM projects
      WHERE id = ?1
        AND user_id = ?2
      LIMIT 1
      `
    )
    .bind(projectId, authenticatedUser)
    .first<{ id: string; photo_optimization_state: PhotoOptimizationState }>();

  if (!project) {
    return json(
      { ok: false, error: 'PROJECT_NOT_FOUND' },
      404
    );
  }

  if (project.photo_optimization_state !== 'available') {
    return json({ ok: false, error: project.photo_optimization_state === 'completed' ? 'PHOTO_ALREADY_OPTIMIZED' : 'PHOTO_OPTIMIZATION_IN_PROGRESS' }, 409);
  }

  const contentType = request.headers.get('Content-Type') ?? '';

  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return json(
      { ok: false, error: 'MULTIPART_FORM_DATA_REQUIRED' },
      415
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return json(
      { ok: false, error: 'INVALID_MULTIPART_FORM_DATA' },
      400
    );
  }

  const fileValue = formData.get('file');

  if (!(fileValue instanceof File)) {
    return json(
      { ok: false, error: 'IMAGE_FILE_REQUIRED' },
      400
    );
  }

  if (!ALLOWED_IMAGE_TYPES.has(fileValue.type)) {
    return json(
      {
        ok: false,
        error: 'UNSUPPORTED_IMAGE_TYPE',
        allowedTypes: Array.from(ALLOWED_IMAGE_TYPES),
      },
      415
    );
  }

  if (fileValue.size <= 0) {
    return json(
      { ok: false, error: 'EMPTY_IMAGE_FILE' },
      400
    );
  }

  if (fileValue.size > MAX_IMAGE_BYTES) {
    return json(
      {
        ok: false,
        error: 'IMAGE_TOO_LARGE',
        maxBytes: MAX_IMAGE_BYTES,
      },
      413
    );
  }

  const fileBytes = new Uint8Array(
    await fileValue.arrayBuffer()
  );

  if (!hasValidImageSignature(fileBytes, fileValue.type)) {
    return json(
      { ok: false, error: 'INVALID_IMAGE_SIGNATURE' },
      415
    );
  }

  const mediaId = crypto.randomUUID();
  const extension = IMAGE_EXTENSIONS[fileValue.type];
  const storageKey = [
    'users',
    authenticatedUser,
    'projects',
    projectId,
    'original',
    `${mediaId}.${extension}`,
  ].join('/');

  try {
    await env.MEDIA.put(
      storageKey,
      fileBytes,
      {
        httpMetadata: {
          contentType: fileValue.type,
        },
        customMetadata: {
          projectId,
          mediaId,
          role: 'original',
        },
      }
    );
  } catch (error) {
    console.error('PROJECT_MEDIA_R2_PUT_ERROR', error);

    return json(
      { ok: false, error: 'MEDIA_STORAGE_FAILED' },
      500
    );
  }

  try {
    const inserted = await env.DB
      .prepare(
        `
        INSERT INTO project_media (
          id,
          project_id,
          storage_key,
          media_type,
          role,
          mime_type,
          size_bytes
        )
        SELECT ?1, ?2, ?3, 'image', 'original', ?4, ?5 FROM projects p
        WHERE p.id = ?2 AND p.user_id = ?6 AND p.photo_optimization_state = 'available'
          AND NOT EXISTS (SELECT 1 FROM project_media WHERE project_id = ?2 AND role = 'optimized')
        `
      )
      .bind(
        mediaId,
        projectId,
        storageKey,
        fileValue.type,
        fileValue.size,
        authenticatedUser
      )
      .run();

    if (inserted.meta.changes === 0) {
      await env.MEDIA.delete(storageKey);
      const current = await env.DB.prepare('SELECT photo_optimization_state FROM projects WHERE id = ?1').bind(projectId).first<{ photo_optimization_state: PhotoOptimizationState }>();
      return json({ ok: false, error: current?.photo_optimization_state === 'completed' ? 'PHOTO_ALREADY_OPTIMIZED' : 'PHOTO_OPTIMIZATION_IN_PROGRESS' }, 409);
    }

    const media = await env.DB
      .prepare(
        `
        SELECT
          id,
          project_id,
          storage_key,
          media_type,
          role,
          mime_type,
          size_bytes,
          created_at,
          updated_at
        FROM project_media
        WHERE id = ?1
          AND project_id = ?2
        LIMIT 1
        `
      )
      .bind(mediaId, projectId)
      .first<ProjectMediaRow>();

    if (!media) {
      throw new Error('Created media record could not be read back');
    }

    return json(
      {
        ok: true,
        media: serializeProjectMedia(media),
      },
      201
    );
  } catch (error) {
    console.error('PROJECT_MEDIA_DB_ERROR', error);

    try {
      await env.MEDIA.delete(storageKey);
    } catch (cleanupError) {
      console.error(
        'PROJECT_MEDIA_R2_CLEANUP_ERROR',
        cleanupError
      );
    }

    return json(
      { ok: false, error: 'MEDIA_RECORD_CREATION_FAILED' },
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

  const mediaReadMatch = pathname.match(
    /^\/api\/projects\/([^/]+)\/media\/([^/]+)$/
  );

  if (
    mediaReadMatch &&
    request.method === 'GET'
  ) {
    const projectId = decodeURIComponent(mediaReadMatch[1]).trim();
    const mediaId = decodeURIComponent(mediaReadMatch[2]).trim();

    if (!projectId || !mediaId) {
      return json(
        { ok: false, error: 'INVALID_MEDIA_PATH' },
        400
      );
    }

    return readProjectMedia(
      request,
      env,
      projectId,
      mediaId
    );
  }

  const mediaUploadMatch = pathname.match(
    /^\/api\/projects\/([^/]+)\/media$/
  );

  if (
    mediaUploadMatch &&
    request.method === 'POST'
  ) {
    const projectId = decodeURIComponent(mediaUploadMatch[1]).trim();

    if (!projectId) {
      return json(
        { ok: false, error: 'INVALID_PROJECT_ID' },
        400
      );
    }

    return uploadProjectMedia(
      request,
      env,
      projectId
    );
  }

  const renameMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (renameMatch && request.method === 'PATCH') {
    let projectId: string;
    try { projectId = decodeURIComponent(renameMatch[1]).trim(); } catch { return json({ ok: false, error: 'INVALID_PROJECT_ID' }, 400); }
    return renameProject(request, env, projectId);
  }

  if (
    request.method === 'GET' &&
    pathname.startsWith('/api/projects/')
  ) {
    const projectId = decodeURIComponent(
      pathname.slice('/api/projects/'.length)
    ).trim();

    if (!projectId || projectId.includes('/')) {
      return json(
        { ok: false, error: 'INVALID_PROJECT_ID' },
        400
      );
    }

    return getProjectById(
      request,
      env,
      projectId
    );
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
      []
    );
  }

  return null;
}

export async function getSerializedProject(env: Env, userId: string, projectId: string) {
  const project = await env.DB
      .prepare(
        `
        SELECT
          p.id,
          p.title,
          p.title_source,
          p.photo_optimization_state,
          p.description,
          p.status,
          p.created_at,
          p.updated_at,
          pm.id AS media_id,
          pm.mime_type AS media_mime_type
        FROM projects p
        LEFT JOIN project_media pm
          ON pm.id = (
            SELECT pm2.id
            FROM project_media pm2
            WHERE pm2.project_id = p.id
              AND pm2.role = 'original'
              AND pm2.media_type = 'image'
            ORDER BY pm2.created_at DESC, pm2.id DESC
            LIMIT 1
          )
        WHERE p.id = ?1
          AND p.user_id = ?2
        LIMIT 1
        `
      )
      .bind(
        projectId,
        userId
      )
      .first<ProjectRow>();

  return project ? serializeProject(project) : null;
}

async function renameProject(request: Request, env: Env, projectId: string): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (userId instanceof Response) return userId;
  const originError = requireSameOriginMutation(request);
  if (originError) return originError;
  const existing = await getSerializedProject(env, userId, projectId);
  if (!existing) return json({ ok: false, error: 'PROJECT_NOT_FOUND' }, 404);
  const body = await readBoundedJson(request);
  if (body instanceof Response) return body;
  if (Object.keys(body).length !== 1 || !Object.hasOwn(body, 'title')) return json({ ok: false, error: 'INVALID_PROJECT_UPDATE' }, 400);
  const title = normalizeProjectTitle(body.title);
  if (!title) return json({ ok: false, error: 'INVALID_PROJECT_TITLE' }, 400);
  try {
    const result = await env.DB.batch([
      env.DB.prepare(`UPDATE projects SET title = ?1, title_source = 'manual', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2 AND user_id = ?3`).bind(title, projectId, userId),
      env.DB.prepare(`SELECT p.id, p.title, p.title_source, p.photo_optimization_state, p.description,
        p.status, p.created_at, p.updated_at,
        (SELECT id FROM project_media WHERE project_id = p.id AND role = 'original' ORDER BY created_at DESC, id DESC LIMIT 1) AS media_id,
        (SELECT mime_type FROM project_media WHERE project_id = p.id AND role = 'original' ORDER BY created_at DESC, id DESC LIMIT 1) AS media_mime_type
        FROM projects p WHERE p.id = ?1 AND p.user_id = ?2`).bind(projectId, userId),
    ]);
    const actual = result[1].results[0] as ProjectRow | undefined;
    return actual ? json({ ok: true, project: serializeProject(actual) }) : json({ ok: false, error: 'PROJECT_NOT_FOUND' }, 404);
  } catch {
    console.error('PROJECT_RENAME_FAILED');
    return json({ ok: false, error: 'PROJECT_UPDATE_FAILED' }, 500);
  }
}
