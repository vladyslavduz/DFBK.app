import { json } from './response';

export function requireSameOriginMutation(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
  }
  return null;
}

export async function readBoundedJson(request: Request, maxBytes = 4096): Promise<Record<string, unknown> | Response> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ ok: false, error: 'INVALID_CONTENT_TYPE' }, 415);
  }
  const reader = request.body?.getReader();
  if (!reader) return json({ ok: false, error: 'INVALID_JSON' }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxBytes) { await reader.cancel(); return json({ ok: false, error: 'REQUEST_TOO_LARGE' }, 413); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { return json({ ok: false, error: 'INVALID_JSON' }, 400); }
}
