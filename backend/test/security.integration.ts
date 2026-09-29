import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { ConfigService } from '@nestjs/config';
import { integrationApp } from './support/integration';
import { hashPassword, tokenHash } from '../src/common/utils/credentials';
import { ADMIN_LOCK } from '../src/modules/auth/auth.types';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthCleanupService } from '../src/modules/auth/auth-cleanup.service';
import { adminTransaction } from '../src/common/utils/admin-transaction';

test('Etapa 12: seguridad HTTP de producción y persistencia con PostgreSQL local', { timeout: 180000 }, async t => {
  // La conexión de pruebas sigue local. Se prueban las opciones HTTP de producción;
  // TLS hacia Neon y el proxy real se verificarán al configurar los proveedores.
  const ctx = await integrationApp({ MAIL_MODE: 'disabled', SWAGGER_ENABLED: 'false' }, app => {
    const config = app.get(ConfigService);
    config.set('NODE_ENV', 'production'); config.set('API_ORIGIN', 'https://api.example.com');
    config.set('ALLOWED_ORIGINS', 'https://tienda.example.com'); config.set('SESSION_SAME_SITE', 'none');
  }); t.after(ctx.cleanup);
  const password = 'Clave-seguridad-123!';
  const admin = await ctx.prisma.administrator.create({ data: { name: 'Admin', email: 'security@example.com', passwordHash: await hashPassword(password), role: 'ADMIN' } });
  const req = async (route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(ctx.url + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-admin', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text(); return { response, status: response.status, body: text ? JSON.parse(text) as any : null };
  };
  const login = await req('/auth/login', 'POST', { email: admin.email, password }); assert.equal(login.status, 200);
  const rawCookie = login.response.headers.get('set-cookie')!, cookie = rawCookie.split(';')[0];
  const privateHeaders = { Cookie: cookie, 'X-CSRF-Token': login.body.csrfToken };
  const session = await ctx.prisma.adminSession.findUniqueOrThrow({ where: { tokenHash: tokenHash(cookie.split('=')[1]) } });

  await t.test('Cookies seguras, Swagger cerrado y cabeceras en respuestas correctas y errores', async () => {
    assert.match(rawCookie, /^__Host-porfin_session=/); assert.match(rawCookie, /HttpOnly/); assert.match(rawCookie, /Secure/); assert.match(rawCookie, /SameSite=None/); assert.match(rawCookie, /Path=\//); assert.doesNotMatch(rawCookie, /Domain=/);
    for (const route of ['/health', '/missing?token=sentinel-secret', '/docs', '/docs-json', '/admin/orders']) {
      const result = await req(route, 'GET', undefined, { 'X-Request-Id': 'client-controlled-secret' });
      assert.equal(result.response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(result.response.headers.get('x-frame-options'), 'DENY');
      assert.equal(result.response.headers.get('strict-transport-security'), 'max-age=31536000'); assert.equal(result.response.headers.get('cache-control'), 'no-store');
      assert.equal(result.response.headers.get('referrer-policy'), 'no-referrer'); assert.match(result.response.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
      assert.equal(result.response.headers.get('x-powered-by'), null); assert.match(result.response.headers.get('x-request-id')!, /^[0-9a-f-]{36}$/);
      assert.doesNotMatch(JSON.stringify(result.body), /sentinel-secret|client-controlled-secret|passwordHash|tokenHash/);
      if (route.startsWith('/docs')) assert.equal(result.status, 404);
      if (result.status >= 400) assert.equal(result.body.requestId, result.response.headers.get('x-request-id'));
    }
    const guest = await req('/guest-session', 'POST', {}, { 'X-Requested-With': 'porfin-storefront' });
    const guestCookie = guest.response.headers.get('set-cookie')!; assert.match(guestCookie, /^__Host-porfin_guest=/); assert.match(guestCookie, /Secure/); assert.doesNotMatch(guestCookie, /Domain=/);
    assert.equal((await req('/auth/me', 'GET', undefined, { Cookie: guestCookie.split(';')[0] })).status, 401);
  });
  await t.test('CORS, CSRF, permisos y aislamiento de operaciones administrativas', async () => {
    const preflight = await req('/admin/settings', 'OPTIONS', undefined, { Origin: 'https://tienda.example.com', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'content-type,x-csrf-token,x-requested-with' });
    assert.equal(preflight.status, 204); assert.equal(preflight.response.headers.get('access-control-allow-origin'), 'https://tienda.example.com');
    assert.equal(preflight.response.headers.get('access-control-allow-credentials'), 'true');
    const denied = await req('/settings/public', 'GET', undefined, { Origin: 'https://attacker.example' }); assert.equal(denied.response.headers.get('access-control-allow-origin'), null);
    for (const route of ['/admin/admins', '/admin/products', '/admin/content', '/admin/settings', '/admin/orders', '/admin/payments/orders/missing']) assert.equal((await req(route)).status, 401, route);
    for (const headers of [{ ...privateHeaders, Origin: 'https://attacker.example' }, { ...privateHeaders, 'X-CSRF-Token': '' }, { ...privateHeaders, 'X-Requested-With': 'porfin-storefront' }]) assert.equal((await req('/admin/settings', 'PATCH', { storeName: 'No guardar' }, headers)).status, 403);
    assert.equal((await req('/admin/admins', 'POST', {}, privateHeaders)).status, 403);
    assert.equal(await ctx.prisma.storeSettings.count(), 0);
    assert.equal((await req('/auth/me', 'GET', undefined, { Cookie: cookie + '; ' + cookie })).status, 401);
    assert.equal((await req('/auth/recovery', 'POST', { email: admin.email })).status, 503);
  });
  await t.test('Payloads comprimidos y excesivos se rechazan sin filtrar cuerpos', async () => {
    const compressed = await fetch(ctx.url + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'X-Requested-With': 'porfin-admin' }, body: gzipSync(JSON.stringify({ secret: 'sentinel-body' })) });
    assert.equal(compressed.status, 415); assert.doesNotMatch(await compressed.text(), /sentinel-body|stack/);
    const oversized = await req('/auth/login', 'POST', { email: 'x'.repeat(1024 * 1024 + 1), password }); assert.equal(oversized.status, 413);
    assert.equal(oversized.response.headers.get('x-frame-options'), 'DENY');
  });
  await t.test('Límites persistentes no se eluden con X-Forwarded-For; health sigue disponible', async () => {
    const key = tokenHash('public:read:ip:127.0.0.1');
    await ctx.prisma.guestRateLimit.upsert({ where: { key }, create: { key, attempts: 300, expiresAt: new Date(Date.now() + 60000) }, update: { attempts: 300, expiresAt: new Date(Date.now() + 60000) } });
    for (const ip of ['192.0.2.1', '198.51.100.5']) {
      const response = await req('/products', 'GET', undefined, { 'X-Forwarded-For': ip }); assert.equal(response.status, 429); assert.equal(response.response.headers.get('retry-after'), '60');
    }
    assert.equal((await req('/health/ready')).status, 200); assert.equal((await ctx.prisma.guestRateLimit.findUniqueOrThrow({ where: { key } })).attempts, 301);
    await ctx.prisma.guestRateLimit.update({ where: { key }, data: { expiresAt: new Date(0) } }); assert.equal((await req('/products')).status, 200);
    const authKey = tokenHash('login:email:' + admin.email);
    await ctx.prisma.authRateLimit.update({ where: { key: authKey }, data: { attempts: 2147483646, expiresAt: new Date(Date.now() + 60000) } });
    const limited = await req('/auth/login', 'POST', { email: admin.email, password }); assert.equal(limited.status, 429); assert.equal(limited.response.headers.get('retry-after'), '900');
    assert.equal((await ctx.prisma.authRateLimit.findUniqueOrThrow({ where: { key: authKey } })).attempts, 11);
  });
  await t.test('Logout participa del bloqueo de escrituras y la sesión revocada no escribe', async () => {
    let release!: () => void, acquired!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }); const locked = new Promise<void>(resolve => { acquired = resolve; });
    const holder = ctx.prisma.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`; acquired(); await gate; }, { timeout: 5000 });
    await locked;
    const logout = ctx.app.get(AuthService).logout(session.id);
    try { assert.equal(await Promise.race([logout.then(() => 'finished'), new Promise<string>(resolve => setTimeout(() => resolve('waiting'), 100))]), 'waiting'); }
    finally { release(); await holder; await logout; }
    assert.equal((await req('/auth/me', 'GET', undefined, privateHeaders)).status, 401);
    await assert.rejects(adminTransaction(ctx.prisma, session.id, tx => tx.storeSettings.create({ data: { storeName: 'No autorizado' } })), (error: any) => error.getStatus() === 403);
  });
  await t.test('Limpieza elimina tokens y sesiones antiguos, conservando cuentas y sesiones vigentes', async () => {
    const expired = new Date(Date.now() - 2 * 86400000);
    await ctx.prisma.adminSession.create({ data: { administratorId: admin.id, tokenHash: tokenHash('expired-session'), expiresAt: expired } });
    await ctx.prisma.accessToken.create({ data: { administratorId: admin.id, tokenHash: tokenHash('expired-reset'), expiresAt: expired } });
    const active = await ctx.prisma.adminSession.create({ data: { administratorId: admin.id, tokenHash: tokenHash('valid-session'), expiresAt: new Date(Date.now() + 3600000) } });
    await ctx.app.get(AuthCleanupService).runOnce();
    assert.equal(await ctx.prisma.adminSession.count({ where: { tokenHash: tokenHash('expired-session') } }), 0);
    assert.equal(await ctx.prisma.accessToken.count({ where: { tokenHash: tokenHash('expired-reset') } }), 0);
    assert.ok(await ctx.prisma.adminSession.findUnique({ where: { id: active.id } })); assert.ok(await ctx.prisma.administrator.findUnique({ where: { id: admin.id } }));
  });
});