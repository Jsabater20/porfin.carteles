import assert from 'node:assert/strict';
import test from 'node:test';
import { forwardToBackend } from '../src/lib/api/gateway';
import { readApiConfig } from '../src/lib/api/config';
import { ApiError, parseApiResponse } from '../src/lib/api/errors';

const config = { backendUrl: 'http://127.0.0.1:3001/api/v1', webOrigin: 'http://localhost:3000' };
const request = (path: string, init?: RequestInit) => new Request(`http://localhost:3000/api/backend/${path}`, init);
const writeHeaders = { origin: config.webOrigin, 'content-type': 'application/json', 'x-requested-with': 'porfin-storefront' };
const forbiddenFetch: typeof fetch = async () => { throw new Error('No debe consultar el backend.'); };

test('rechaza traversal, destinos externos y rutas fuera de la lista permitida', async () => {
  for (const segments of [['..', 'auth'], ['https:', 'example.com'], ['settings%2fpublic'], ['admin', 'unknown'], ['constructor']]) {
    let called = false;
    const response = await forwardToBackend(request('health'), segments, config, async () => { called = true; return Response.json({}); });
    assert.equal(response.status, 404);
    assert.equal(called, false);
  }
});

test('rechaza métodos no habilitados sin invocar al backend', async () => {
  const response = await forwardToBackend(request('settings/public', { method: 'POST' }), ['settings', 'public'], config, forbiddenFetch);
  assert.equal(response.status, 404);
});

test('no envía cookies ni cabeceras sensibles en consultas públicas', async () => {
  const response = await forwardToBackend(request('settings/public?sample=1', {
    headers: { cookie: 'porfin_session=private; porfin_guest=guest', authorization: 'Bearer private', 'x-forwarded-for': '8.8.8.8' },
  }), ['settings', 'public'], config, async (url, init) => {
    assert.equal(String(url), config.backendUrl + '/settings/public?sample=1');
    const headers = new Headers(init?.headers);
    for (const name of ['cookie', 'authorization', 'x-forwarded-for', 'host']) assert.equal(headers.get(name), null);
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'manual');
    return Response.json({ storeName: 'Tienda real' }, { headers: { 'set-cookie': 'unrelated=secret', 'access-control-allow-origin': '*' } });
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal((await response.json()).storeName, 'Tienda real');
});

test('auth/me envía solo cookies administrativas y conserva duplicados para validación de NestJS', async () => {
  const response = await forwardToBackend(request('auth/me', {
    headers: { cookie: 'porfin_guest=g; porfin_session=a; porfin_session=b; __Host-porfin_session=c; other=d' },
  }), ['auth', 'me'], config, async (_url, init) => {
    assert.equal(new Headers(init?.headers).get('cookie'), 'porfin_session=a; porfin_session=b; __Host-porfin_session=c');
    return Response.json({ message: 'Sesión inválida.' }, { status: 401, headers: { 'x-request-id': 'request-1' } });
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('x-request-id'), 'request-1');
});

test('las escrituras requieren el origen exacto, incluso si el atacante falsifica Host', async () => {
  for (const origin of [null, 'https://otro.example', 'http://localhost:3000.evil.example', 'null']) {
    const headers = new Headers(writeHeaders);
    if (origin) headers.set('origin', origin); else headers.delete('origin');
    headers.set('host', 'localhost:3000');
    const response = await forwardToBackend(request('guest-session', { method: 'POST', headers, body: '{}' }), ['guest-session'], config, forbiddenFetch);
    assert.equal(response.status, 403);
  }
});

test('rechaza solicitudes marcadas cross-site y el cliente equivocado', async () => {
  for (const extra of [{ 'sec-fetch-site': 'cross-site' }, { 'x-requested-with': 'porfin-admin' }] as Record<string, string>[]) {
    const response = await forwardToBackend(request('guest-session', { method: 'POST', headers: { ...writeHeaders, ...extra }, body: '{}' }), ['guest-session'], config, forbiddenFetch);
    assert.equal(response.status, 403);
  }
});

test('rechaza formularios y cuerpos comprimidos', async () => {
  for (const extra of [{ 'content-type': 'text/plain' }, { 'content-encoding': 'gzip' }] as Record<string, string>[]) {
    const response = await forwardToBackend(request('guest-session', { method: 'POST', headers: { ...writeHeaders, ...extra }, body: '{}' }), ['guest-session'], config, forbiddenFetch);
    assert.equal(response.status, 415);
  }
});

test('rechaza JSON inválido antes de enviar al backend', async () => {
  const response = await forwardToBackend(request('guest-session', { method: 'POST', headers: writeHeaders, body: '{bad' }), ['guest-session'], config, forbiddenFetch);
  assert.equal(response.status, 400);
});

test('limita el cuerpo real aunque no haya Content-Length', async () => {
  const response = await forwardToBackend(request('guest-session', { method: 'POST', headers: writeHeaders, body: JSON.stringify('a'.repeat(1024 * 1024)) }), ['guest-session'], config, forbiddenFetch);
  assert.equal(response.status, 413);
});

test('conserva el cuerpo, CSRF, idempotencia y cada Set-Cookie de la sesión correcta', async () => {
  const headers = { ...writeHeaders, cookie: 'porfin_guest=guest; porfin_session=admin; unrelated=no', 'x-csrf-token': 'csrf-value', 'idempotency-key': 'retry-key' };
  const response = await forwardToBackend(request('guest-session', { method: 'POST', headers, body: '{}' }), ['guest-session'], config, async (_url, init) => {
    const forwarded = new Headers(init?.headers);
    assert.equal(forwarded.get('cookie'), 'porfin_guest=guest');
    assert.equal(forwarded.get('x-csrf-token'), 'csrf-value');
    assert.equal(forwarded.get('idempotency-key'), 'retry-key');
    assert.equal(forwarded.get('origin'), config.webOrigin);
    assert.equal(init?.body, '{}');
    const outgoing = new Headers({ 'content-type': 'application/json' });
    outgoing.append('set-cookie', 'porfin_guest=guest; Path=/; HttpOnly; SameSite=Lax');
    outgoing.append('set-cookie', '__Host-porfin_guest=secure; Path=/; HttpOnly; Secure; SameSite=Lax');
    outgoing.append('set-cookie', 'porfin_session=not-for-this-operation; Path=/');
    return new Response('{"csrfToken":"value"}', { headers: outgoing });
  });
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.ok(response.headers.getSetCookie().every((value) => value.includes('HttpOnly')));
});

test('logout conserva 204 y la eliminación de la cookie', async () => {
  const response = await forwardToBackend(request('auth/logout', {
    method: 'POST', headers: { ...writeHeaders, 'x-requested-with': 'porfin-admin', 'x-csrf-token': 'value' }, body: '{}',
  }), ['auth', 'logout'], config, async () => new Response(null, { status: 204, headers: { 'set-cookie': 'porfin_session=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT' } }));
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.match(response.headers.getSetCookie()[0], /Expires=/);
});

test('conserva errores, request-id y tiempo de reintento del backend', async () => {
  const response = await forwardToBackend(request('health'), ['health'], config, async () => Response.json({ message: 'Demasiadas solicitudes.' }, { status: 429, headers: { 'retry-after': '60', 'x-request-id': 'trace-1' } }));
  await assert.rejects(parseApiResponse(response), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 429);
    assert.equal(error.retryAfter, '60');
    assert.equal(error.requestId, 'trace-1');
    return true;
  });
});

test('no sigue redirecciones ni devuelve su ubicación al navegador', async () => {
  const response = await forwardToBackend(request('auth/me'), ['auth', 'me'], config, async () => new Response(null, { status: 302, headers: { location: 'https://otro.example' } }));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('location'), null);
});

test('los fallos de conexión devuelven 503 sin filtrar direcciones ni secretos', async () => {
  const response = await forwardToBackend(request('health'), ['health'], config, async () => { throw new Error('http://private:secret@internal'); });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private|secret|internal/);
});

test('los clientes reconocen listas de validaciones y respuestas 204', async () => {
  await assert.rejects(parseApiResponse(Response.json({ message: ['Falta nombre.', 'Falta teléfono.'] }, { status: 400 })), /Falta nombre. Falta teléfono./);
  assert.equal(await parseApiResponse(new Response(null, { status: 204 })), undefined);
});

test('la configuración rechaza destinos con credenciales, rutas ambiguas y HTTP remoto', () => {
  for (const backend of ['http://user:secret@localhost:3001/api/v1', 'https://example.com/api/v1?redirect=evil', 'http://remote.example/api/v1', 'https://example.com/otro']) {
    assert.throws(() => readApiConfig({ BACKEND_API_URL: backend }));
  }
  assert.deepEqual(readApiConfig({}), config);
});
