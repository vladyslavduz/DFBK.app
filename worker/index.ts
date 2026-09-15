import type { Env } from './lib/env';
import { json } from './lib/response';
import { handleAuth } from './routes/auth';
import { handleAI } from './routes/ai';
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
      return json({ ok: true, service: 'dfbk-app', api: 'skeleton', timestamp: new Date().toISOString() });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
    }

const response =
  await handleAuth(request, env, url.pathname) ||
  handleAI(url.pathname) ||
  handleProjects(url.pathname) ||
  handlePublish(url.pathname) ||
  handleIntegrations(url.pathname) ||
  handleBilling(url.pathname) ||
  handleProfile(url.pathname) ||
  handleEmail(url.pathname);

    if (response) return response;
    return json({ ok: false, error: 'API route not found', path: url.pathname }, 404);
  }
};
