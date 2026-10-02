import type { Env } from './lib/env';
import { json } from './lib/response';
import { handleAdmin } from './routes/admin';
import { handleAuth } from './routes/auth';
import { handleAI } from './routes/ai';
import { handleEntitlements } from './routes/entitlements';
import { handleProjectContent } from './routes/project-content';
import { handleProjectGeneration } from './routes/project-generation';
import {
  handleProjectImageOptimization,
  optimizeProjectImageForRequest,
} from './routes/project-image-optimization';
import { handleProjects } from './routes/projects';
import { handlePublish } from './routes/publish';
import { handleIntegrations } from './routes/integrations';
import { handleBilling } from './routes/billing';
import { handleProfile } from './routes/profile';
import { handleEmail } from './routes/email';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'dfbk-app',
        api: 'skeleton',
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Methods':
            'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type,Authorization',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const mediaUploadMatch = url.pathname.match(
      /^\/api\/projects\/([^/]+)\/media$/
    );

    if (mediaUploadMatch && request.method === 'POST') {
      const projectId = decodeURIComponent(mediaUploadMatch[1]).trim();
      const uploadResponse = await handleProjects(request, env, url.pathname);

      if (!uploadResponse) {
        return json({ ok: false, error: 'MEDIA_UPLOAD_ROUTE_FAILED' }, 500);
      }

      if (uploadResponse.status === 201 && projectId) {
        try {
          const optimization = await optimizeProjectImageForRequest(
            request,
            env,
            projectId
          );

          if (optimization instanceof Response) {
            console.error(
              'AUTO_IMAGE_OPTIMIZATION_AUTH_ERROR',
              optimization.status
            );
          } else if (!optimization.ok) {
            console.error(
              'AUTO_IMAGE_OPTIMIZATION_RECOVERABLE_ERROR',
              optimization.error
            );
          }
        } catch (error) {
          console.error('AUTO_IMAGE_OPTIMIZATION_UNEXPECTED_ERROR', error);
        }
      }

      return uploadResponse;
    }

    const response =
      (await handleAdmin(request, env, url.pathname)) ||
      (await handleAuth(request, env, url.pathname)) ||
      (await handleEntitlements(request, env, url.pathname)) ||
      handleAI(url.pathname) ||
      (await handleProjectContent(request, env, url.pathname)) ||
      (await handleProjectGeneration(request, env, url.pathname)) ||
      (await handleProjectImageOptimization(request, env, url.pathname)) ||
      (await handleProjects(request, env, url.pathname)) ||
      handlePublish(url.pathname) ||
      handleIntegrations(url.pathname) ||
      handleBilling(url.pathname) ||
      handleProfile(url.pathname) ||
      handleEmail(url.pathname);

    if (response) {
      return response;
    }

    return json(
      {
        ok: false,
        error: 'API route not found',
        path: url.pathname,
      },
      404
    );
  },
};
