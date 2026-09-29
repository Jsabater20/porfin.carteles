import assert from 'node:assert/strict';

const base = process.env.WEB_TEST_ORIGIN ?? 'http://localhost:3000';
const run = async (name, check) => {
  await check();
  console.log('OK ' + name);
};
const get = (path, options) => fetch(base + path, { signal: AbortSignal.timeout(20000), ...options });

await run('inicio y configuración pública real', async () => {
  const response = await get('/');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Explorar el catálogo/);
  const settings = await get('/api/backend/settings/public');
  assert.equal(settings.status, 200);
  assert.equal(typeof (await settings.json()).storeName, 'string');
});
await run('catálogo, acceso y 404', async () => {
  for (const [path, text] of [['/catalogo', 'Carteles y combos'], ['/admin/login', 'Administración']]) {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(text));
  }
  assert.equal((await get('/pagina-inexistente')).status, 404);
});
await run('panel protegido y sesión administrativa ausente', async () => {
  const page = await get('/admin', { redirect: 'manual' });
  // Next puede entregar una redirección HTTP o una redirección dentro del stream RSC.
  assert.ok([200, 307].includes(page.status));
  if (page.status === 307) assert.equal(page.headers.get('location'), '/admin/login');
  else {
    const html = await page.text();
    assert.match(html, /NEXT_REDIRECT/);
    assert.doesNotMatch(html, /Hola,/);
  }
  assert.equal((await get('/api/backend/auth/me')).status, 401);
});
await run('salud real de NestJS y PostgreSQL', async () => {
  const response = await get('/api/backend/health/ready');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
await run('rutas fuera de alcance y orígenes externos bloqueados', async () => {
  assert.equal((await get('/api/backend/admin/unknown')).status, 404);
  const response = await get('/api/backend/guest-session', {
    method: 'POST', headers: { origin: 'https://otro.example', 'content-type': 'application/json', 'x-requested-with': 'porfin-storefront' }, body: '{}',
  });
  assert.equal(response.status, 403);
});
await run('cookie invitada, CSRF real y revocación sin datos comerciales', async () => {
  const headers = { origin: base, 'content-type': 'application/json', 'x-requested-with': 'porfin-storefront' };
  const response = await get('/api/backend/guest-session', { method: 'POST', headers, body: '{}' });
  assert.equal(response.status, 200);
  const session = await response.json();
  const cookieHeader = response.headers.getSetCookie().find((value) => /^(?:__Host-)?porfin_guest=/.test(value));
  assert.ok(cookieHeader);
  assert.match(cookieHeader, /HttpOnly/i);
  const cookie = cookieHeader.split(';')[0];
  try {
    const denied = await get('/api/backend/guest-session', { method: 'DELETE', headers: { ...headers, cookie }, body: '{}' });
    assert.equal(denied.status, 403);
  } finally {
    const revoked = await get('/api/backend/guest-session', { method: 'DELETE', headers: { ...headers, cookie, 'x-csrf-token': session.csrfToken }, body: '{}' });
    assert.equal(revoked.status, 204);
  }
});
console.log('Verificación del backend y frontend completada.');
