export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

export function notImplemented(feature: string, requiredSecrets: string[] = []) {
  return json({
    ok: false,
    code: 'NOT_IMPLEMENTED',
    feature,
    message: 'Der API-Endpunkt ist im Karcass vorbereitet, aber noch nicht aktiviert.',
    requiredSecrets
  }, 501);
}
