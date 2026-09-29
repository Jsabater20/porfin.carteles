import type { ApiConfig } from './config';
import { routePolicy, selectCookies, sessionCookieNames } from './policy';

const MAX_BODY_BYTES = 1024 * 1024;
const responseHeaders = ['content-type', 'x-request-id', 'retry-after'];

function failure(status: number, message: string): Response {
  return Response.json({ statusCode: status, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readBody(request: Request): Promise<Uint8Array | null> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.byteLength; }
  return body;
}

export async function forwardToBackend(
  request: Request,
  segments: string[],
  config: ApiConfig,
  send: typeof fetch = fetch,
): Promise<Response> {
  // Rechaza segmentos codificados, separadores y traversal antes de construir la URL.
  if (!segments.length || segments.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    return failure(404, 'Ruta no disponible.');
  }
  const path = segments.join('/');
  const scope = routePolicy(path, request.method);
  if (!scope) return failure(404, 'Operación no disponible.');
  const headers = new Headers({ Accept: 'application/json' });
  const cookie = selectCookies(request.headers.get('cookie'), scope);
  if (cookie) headers.set('Cookie', cookie);
  let body: string | undefined;
  if (request.method !== 'GET') {
    if (request.headers.get('origin') !== config.webOrigin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return failure(403, 'Origen no permitido.');
    }
    const expectedClient = scope === 'guest' ? 'porfin-storefront' : 'porfin-admin';
    if (request.headers.get('x-requested-with') !== expectedClient) return failure(403, 'Cliente no permitido.');
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '') ||
        !['identity', null].includes(request.headers.get('content-encoding'))) {
      return failure(415, 'Usá contenido JSON sin compresión.');
    }
    const bytes = await readBody(request);
    if (bytes === null) return failure(413, 'La solicitud es demasiado grande.');
    try {
      body = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      JSON.parse(body);
    } catch { return failure(400, 'El contenido JSON no es válido.'); }
    headers.set('Content-Type', 'application/json');
    headers.set('Origin', config.webOrigin);
    headers.set('X-Requested-With', expectedClient);
    for (const name of ['x-csrf-token', 'idempotency-key']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
  }
  // No reenviar Authorization, Host, X-Forwarded-* ni cookies ajenas a esta operación.
  const url = new URL(`${config.backendUrl}/${path}`);
  url.search = new URL(request.url).search;
  try {
    const upstream = await send(url, {
      method: request.method, headers, body, cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) return failure(502, 'Respuesta inesperada de la tienda.');
    const outgoing = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    const allowedCookies = sessionCookieNames(scope);
    for (const value of upstream.headers.getSetCookie()) {
      if (allowedCookies.includes(value.slice(0, value.indexOf('=')))) outgoing.append('Set-Cookie', value);
    }
    const content = upstream.status === 204 ? null : await upstream.arrayBuffer();
    return new Response(content, { status: upstream.status, headers: outgoing });
  } catch {
    return failure(503, 'No pudimos conectar con la tienda. Intentá nuevamente.');
  }
}
