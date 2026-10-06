import type { Env } from '../lib/env';
import {
  ImageOptimizationError,
  optimizeImage,
} from '../lib/image-optimization';
import { json } from '../lib/response';
import { requireUser } from '../lib/user';
import { requireSameOriginMutation } from '../lib/request-security';
import type { PhotoOptimizationState } from '../lib/project-management';

type ProjectRow = { id: string; photo_optimization_state: PhotoOptimizationState };

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
        | 'PHOTO_ALREADY_OPTIMIZED'
        | 'PHOTO_OPTIMIZATION_IN_PROGRESS'
        | 'PROJECT_NOT_FOUND'
        | 'PROJECT_IMAGE_REQUIRED'
        | 'PROJECT_IMAGE_READ_FAILED'
        | 'PROJECT_IMAGE_UNAVAILABLE'
        | 'IMAGE_OPTIMIZATION_NOT_CONFIGURED'
        | 'IMAGE_OPTIMIZATION_FAILED'
        | 'IMAGE_OPTIMIZATION_INVALID_RESPONSE'
        | 'OPTIMIZED_IMAGE_STORAGE_FAILED';
    };

async function getAuthenticatedUserId(request: Request, env: Env): Promise<string | Response> {
  const user = await requireUser(request, env);
  return user instanceof Response ? user : user.id;
}

export async function optimizeProjectImageForUser(
  env: Env, userId: string, projectId: string
): Promise<ProjectImageOptimizationResult> {
  const project = await env.DB.prepare(`SELECT id, photo_optimization_state FROM projects
    WHERE id = ?1 AND user_id = ?2`).bind(projectId, userId).first<ProjectRow>();
  if (!project) return { ok: false, error: 'PROJECT_NOT_FOUND' };
  const token = crypto.randomUUID();
  // Atomic claim before reading original or contacting the paid provider.
  const claim = await env.DB.prepare(`UPDATE projects SET photo_optimization_state = 'processing',
    photo_optimization_token = ?1, photo_optimization_started_at = CURRENT_TIMESTAMP
    WHERE id = ?2 AND user_id = ?3 AND photo_optimization_state = 'available'
      AND EXISTS (SELECT 1 FROM project_media WHERE project_id = ?2 AND role = 'original')
      AND NOT EXISTS (SELECT 1 FROM project_media WHERE project_id = ?2 AND role = 'optimized')`)
    .bind(token, projectId, userId).run();
  if (claim.meta.changes === 0) {
    const actual = await env.DB.prepare(`SELECT photo_optimization_state,
      EXISTS (SELECT 1 FROM project_media WHERE project_id = ?1 AND role = 'optimized') AS has_optimized,
      EXISTS (SELECT 1 FROM project_media WHERE project_id = ?1 AND role = 'original') AS has_original
      FROM projects WHERE id = ?1 AND user_id = ?2`).bind(projectId, userId)
      .first<{ photo_optimization_state: PhotoOptimizationState; has_optimized: number; has_original: number }>();
    if (!actual) return { ok: false, error: 'PROJECT_NOT_FOUND' };
    if (actual.has_optimized || actual.photo_optimization_state === 'completed') return { ok: false, error: 'PHOTO_ALREADY_OPTIMIZED' };
    if (actual.photo_optimization_state === 'processing') return { ok: false, error: 'PHOTO_OPTIMIZATION_IN_PROGRESS' };
    return { ok: false, error: 'PROJECT_IMAGE_REQUIRED' };
  }

  let preserveProcessing = false;
  try {
    const original = await env.DB.prepare(`SELECT id, storage_key, mime_type, size_bytes FROM project_media
      WHERE project_id = ?1 AND role = 'original' AND media_type = 'image'
      ORDER BY created_at DESC, id DESC LIMIT 1`).bind(projectId).first<MediaRow>();
    if (!original) return { ok: false, error: 'PROJECT_IMAGE_REQUIRED' };
    let originalBytes: Uint8Array;
    try {
      const object = await env.MEDIA.get(original.storage_key);
      if (!object) return { ok: false, error: 'PROJECT_IMAGE_UNAVAILABLE' };
      originalBytes = new Uint8Array(await object.arrayBuffer());
    } catch {
      return { ok: false, error: 'PROJECT_IMAGE_READ_FAILED' };
    }
    let optimized;
    try {
      optimized = await optimizeImage(env, { imageBytes: originalBytes, imageMimeType: original.mime_type });
    } catch (error) {
      return { ok: false, error: error instanceof ImageOptimizationError ? error.code : 'IMAGE_OPTIMIZATION_FAILED' };
    }
    const mediaId = crypto.randomUUID();
    const storageKey = `users/${userId}/projects/${projectId}/optimized/${mediaId}.${optimized.extension}`;
    try {
      await env.MEDIA.put(storageKey, optimized.bytes, {
        httpMetadata: { contentType: optimized.mimeType },
        customMetadata: { projectId, mediaId, role: 'optimized', sourceMediaId: original.id },
      });
    } catch {
      return { ok: false, error: 'OPTIMIZED_IMAGE_STORAGE_FAILED' };
    }
    const success: ProjectImageOptimizationResult = { ok: true, media: { id: mediaId, mimeType: optimized.mimeType } };
    try {
      const results = await env.DB.batch([
        env.DB.prepare(`INSERT INTO project_media (id, project_id, storage_key, media_type, role, mime_type, size_bytes)
          SELECT ?1, ?2, ?3, 'image', 'optimized', ?4, ?5 FROM projects p
          WHERE p.id = ?2 AND p.user_id = ?6 AND p.photo_optimization_state = 'processing'
            AND p.photo_optimization_token = ?7
            AND NOT EXISTS (SELECT 1 FROM project_media WHERE project_id = ?2 AND role = 'optimized')`)
          .bind(mediaId, projectId, storageKey, optimized.mimeType, optimized.bytes.byteLength, userId, token),
        env.DB.prepare(`UPDATE projects SET photo_optimization_state = 'completed',
          photo_optimization_token = NULL, photo_optimization_started_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?1 AND user_id = ?2 AND photo_optimization_token = ?3
            AND EXISTS (SELECT 1 FROM project_media WHERE id = ?4 AND project_id = ?1)`)
          .bind(projectId, userId, token, mediaId),
      ]);
      if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) throw new Error('OPTIMIZATION_COMMIT_NOT_CONFIRMED');
      return success;
    } catch {
      // D1 may have committed even if its response was lost. Never delete a working image.
      let saved: { id: string } | null = null;
      try {
        saved = await env.DB.prepare(`SELECT id FROM project_media WHERE id = ?1 AND project_id = ?2`)
          .bind(mediaId, projectId).first<{ id: string }>();
      } catch {
        preserveProcessing = true;
        console.error('OPTIMIZATION_COMMIT_STATUS_UNKNOWN');
      }
      if (saved) return success;
      if (!preserveProcessing) {
        try { await env.MEDIA.delete(storageKey); }
        catch { console.error('OPTIMIZATION_ORPHAN_CLEANUP_FAILED'); }
      }
      return { ok: false, error: 'OPTIMIZED_IMAGE_STORAGE_FAILED' };
    }
  } catch {
    console.error('PROJECT_IMAGE_OPTIMIZATION_FAILED');
    return { ok: false, error: 'IMAGE_OPTIMIZATION_FAILED' };
  } finally {
    if (!preserveProcessing) {
      try {
        await env.DB.prepare(`UPDATE projects SET photo_optimization_state = 'available',
          photo_optimization_token = NULL, photo_optimization_started_at = NULL
          WHERE id = ?1 AND user_id = ?2 AND photo_optimization_token = ?3
            AND photo_optimization_state = 'processing'
            AND NOT EXISTS (SELECT 1 FROM project_media WHERE project_id = ?1 AND role = 'optimized')`)
          .bind(projectId, userId, token).run();
      } catch { console.error('PHOTO_OPTIMIZATION_RELEASE_FAILED'); }
    }
  }
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
      SELECT id, photo_optimization_state
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
      photoOptimization: { state: project.photo_optimization_state },
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

  const userId = await getAuthenticatedUserId(request, env);
  if (userId instanceof Response) return userId;
  const originError = requireSameOriginMutation(request);
  if (originError) return originError;
  let result: ProjectImageOptimizationResult;
  try { result = await optimizeProjectImageForUser(env, userId, projectId); }
  catch {
    console.error('PHOTO_OPTIMIZATION_REQUEST_FAILED');
    return json({ ok: false, error: 'IMAGE_OPTIMIZATION_FAILED' }, 500);
  }

  if (result instanceof Response) {
    return result;
  }

  if (result.ok) {
    return json({ ok: true, optimized: result.media }, 200);
  }

  if (result.error === 'PHOTO_ALREADY_OPTIMIZED' || result.error === 'PHOTO_OPTIMIZATION_IN_PROGRESS') {
    return json({ ok: false, error: result.error }, 409);
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
