import type { Env } from '../lib/env';
import {
  ImageOptimizationError,
  optimizeImage,
} from '../lib/image-optimization';
import { json } from '../lib/response';
import { hashSessionToken } from '../lib/session';

type SessionRow = {
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
};

type ProjectRow = {
  id: string;
};

type MediaRow = {
  id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
};

type MediaSummaryRow = {
  id: string;
  mime_type: string;
};

export type ProjectImageOptimizationResult =
  | {
      ok: true;
      media: {
        id: string;
        mimeType: string;
      };
    }
  | {
      ok: false;
      error:
        | 'PROJECT_NOT_FOUND'
        | 'PROJECT_IMAGE_REQUIRED'
        | 'PROJECT_IMAGE_READ_FAILED'
        | 'PROJECT_IMAGE_UNAVAILABLE'
        | 'IMAGE_OPTIMIZATION_NOT_CONFIGURED'
        | 'IMAGE_OPTIMIZATION_FAILED'
        | 'IMAGE_OPTIMIZATION_INVALID_RESPONSE'
        | 'OPTIMIZED_IMAGE_STORAGE_FAILED';
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
      SELECT user_id, expires_at, revoked_at
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

export async function optimizeProjectImageForUser(
  env: Env,
  userId: string,
  projectId: string
): Promise<ProjectImageOptimizationResult> {
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
    .bind(projectId, userId)
    .first<ProjectRow>();

  if (!project) {
    return { ok: false, error: 'PROJECT_NOT_FOUND' };
  }

  const original = await env.DB
    .prepare(
      `
      SELECT id, storage_key, mime_type, size_bytes
      FROM project_media
      WHERE project_id = ?1
        AND media_type = 'image'
        AND role = 'original'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `
    )
    .bind(projectId)
    .first<MediaRow>();

  if (!original) {
    return { ok: false, error: 'PROJECT_IMAGE_REQUIRED' };
  }

  let originalObject: R2ObjectBody | null;

  try {
    originalObject = await env.MEDIA.get(original.storage_key);
  } catch (error) {
    console.error('IMAGE_OPTIMIZATION_ORIGINAL_R2_READ_ERROR', error);
    return { ok: false, error: 'PROJECT_IMAGE_READ_FAILED' };
  }

  if (!originalObject) {
    console.error('IMAGE_OPTIMIZATION_ORIGINAL_R2_OBJECT_MISSING');
    return { ok: false, error: 'PROJECT_IMAGE_UNAVAILABLE' };
  }

  const originalBytes = new Uint8Array(await originalObject.arrayBuffer());

  let optimized;

  try {
    optimized = await optimizeImage(env, {
      imageBytes: originalBytes,
      imageMimeType: original.mime_type,
    });
  } catch (error) {
    if (error instanceof ImageOptimizationError) {
      console.error('PROJECT_IMAGE_OPTIMIZATION_ERROR', error.code);
      return { ok: false, error: error.code };
    }

    console.error('PROJECT_IMAGE_OPTIMIZATION_UNEXPECTED_ERROR', error);
    return { ok: false, error: 'IMAGE_OPTIMIZATION_FAILED' };
  }

  const oldOptimized = await env.DB
    .prepare(
      `
      SELECT id, storage_key, mime_type, size_bytes
      FROM project_media
      WHERE project_id = ?1
        AND media_type = 'image'
        AND role = 'optimized'
      ORDER BY created_at DESC, id DESC
      `
    )
    .bind(projectId)
    .all<MediaRow>();

  const mediaId = crypto.randomUUID();
  const storageKey = [
    'users',
    userId,
    'projects',
    projectId,
    'optimized',
    `${mediaId}.${optimized.extension}`,
  ].join('/');

  try {
    await env.MEDIA.put(storageKey, optimized.bytes, {
      httpMetadata: {
        contentType: optimized.mimeType,
      },
      customMetadata: {
        projectId,
        mediaId,
        role: 'optimized',
        sourceMediaId: original.id,
      },
    });
  } catch (error) {
    console.error('OPTIMIZED_IMAGE_R2_PUT_ERROR', error);
    return { ok: false, error: 'OPTIMIZED_IMAGE_STORAGE_FAILED' };
  }

  try {
    await env.DB.batch([
      env.DB
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
          VALUES (?1, ?2, ?3, 'image', 'optimized', ?4, ?5)
          `
        )
        .bind(
          mediaId,
          projectId,
          storageKey,
          optimized.mimeType,
          optimized.bytes.byteLength
        ),
      env.DB
        .prepare(
          `
          DELETE FROM project_media
          WHERE project_id = ?1
            AND media_type = 'image'
            AND role = 'optimized'
            AND id != ?2
          `
        )
        .bind(projectId, mediaId),
    ]);
  } catch (error) {
    console.error('OPTIMIZED_IMAGE_DB_WRITE_ERROR', error);

    try {
      await env.MEDIA.delete(storageKey);
    } catch (cleanupError) {
      console.error('OPTIMIZED_IMAGE_NEW_R2_CLEANUP_ERROR', cleanupError);
    }

    return { ok: false, error: 'OPTIMIZED_IMAGE_STORAGE_FAILED' };
  }

  for (const oldMedia of oldOptimized.results) {
    if (oldMedia.storage_key === storageKey) {
      continue;
    }

    try {
      await env.MEDIA.delete(oldMedia.storage_key);
    } catch (error) {
      console.error('OPTIMIZED_IMAGE_OLD_R2_CLEANUP_ERROR', error);
    }
  }

  return {
    ok: true,
    media: {
      id: mediaId,
      mimeType: optimized.mimeType,
    },
  };
}

export async function optimizeProjectImageForRequest(
  request: Request,
  env: Env,
  projectId: string
): Promise<ProjectImageOptimizationResult | Response> {
  const authenticatedUser = await getAuthenticatedUserId(request, env);

  if (authenticatedUser instanceof Response) {
    return authenticatedUser;
  }

  return optimizeProjectImageForUser(env, authenticatedUser, projectId);
}

async function getProjectMediaState(
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
      SELECT id
      FROM projects
      WHERE id = ?1
        AND user_id = ?2
      LIMIT 1
      `
    )
    .bind(projectId, authenticatedUser)
    .first<ProjectRow>();

  if (!project) {
    return json({ ok: false, error: 'PROJECT_NOT_FOUND' }, 404);
  }

  const [original, optimized] = await Promise.all([
    env.DB
      .prepare(
        `
        SELECT id, mime_type
        FROM project_media
        WHERE project_id = ?1
          AND media_type = 'image'
          AND role = 'original'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        `
      )
      .bind(projectId)
      .first<MediaSummaryRow>(),
    env.DB
      .prepare(
        `
        SELECT id, mime_type
        FROM project_media
        WHERE project_id = ?1
          AND media_type = 'image'
          AND role = 'optimized'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        `
      )
      .bind(projectId)
      .first<MediaSummaryRow>(),
  ]);

  return json(
    {
      ok: true,
      media: {
        original: original
          ? { id: original.id, mimeType: original.mime_type }
          : null,
        optimized: optimized
          ? { id: optimized.id, mimeType: optimized.mime_type }
          : null,
      },
    },
    200
  );
}

export async function handleProjectImageOptimization(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const mediaMatch = pathname.match(/^\/api\/projects\/([^/]+)\/media$/);

  if (mediaMatch && request.method === 'GET') {
    const projectId = decodeURIComponent(mediaMatch[1]).trim();

    if (!projectId) {
      return json({ ok: false, error: 'INVALID_PROJECT_ID' }, 400);
    }

    return getProjectMediaState(request, env, projectId);
  }

  const optimizeMatch = pathname.match(
    /^\/api\/projects\/([^/]+)\/optimize$/
  );

  if (!optimizeMatch || request.method !== 'POST') {
    return null;
  }

  const projectId = decodeURIComponent(optimizeMatch[1]).trim();

  if (!projectId) {
    return json({ ok: false, error: 'INVALID_PROJECT_ID' }, 400);
  }

  const result = await optimizeProjectImageForRequest(request, env, projectId);

  if (result instanceof Response) {
    return result;
  }

  if (result.ok) {
    return json({ ok: true, optimized: result.media }, 200);
  }

  if (result.error === 'PROJECT_NOT_FOUND') {
    return json({ ok: false, error: result.error }, 404);
  }

  if (result.error === 'PROJECT_IMAGE_REQUIRED') {
    return json({ ok: false, error: result.error }, 400);
  }

  if (result.error === 'IMAGE_OPTIMIZATION_NOT_CONFIGURED') {
    return json({ ok: false, error: result.error }, 500);
  }

  if (result.error === 'IMAGE_OPTIMIZATION_INVALID_RESPONSE') {
    return json({ ok: false, error: result.error }, 502);
  }

  if (result.error === 'IMAGE_OPTIMIZATION_FAILED') {
    return json({ ok: false, error: result.error }, 502);
  }

  return json({ ok: false, error: result.error }, 500);
}
