import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { integrationApp } from './support/integration';
import { tokenHash } from '../src/common/utils/credentials';

test('Etapa 2: autenticación y administradores con PostgreSQL real', { timeout: 120000 }, async t => {
  const ctx = await integrationApp();
  t.after(ctx.cleanup);
  const password = 'Clave-de-prueba-123!';
  const ownerEmail = 'owner@example.com';
  const bootstrap = () => spawnSync(process.execPath, ['node_modules/ts-node/dist/bin.js', 'scripts/create-owner.ts'], { env: { ...process.env, BOOTSTRAP_OWNER_NAME: 'Propietaria', BOOTSTRAP_OWNER_EMAIL: ownerEmail, BOOTSTRAP_OWNER_PASSWORD: password }, encoding: 'utf8', timeout: 20000 });
  assert.equal(bootstrap().status, 0, 'Bootstrap del OWNER');
  assert.notEqual(bootstrap().status, 0, 'No recrear ni sobrescribir OWNER');
  const owner = await ctx.prisma.administrator.findUniqueOrThrow({ where: { email: ownerEmail } });
  type Session = { cookie: string; csrf: string };
  const call = async (route: string, method = 'GET', body?: unknown, session?: Session, extra: Record<string, string> = {}) => {
    const response = await fetch(`${ctx.url}/api/v1${route}`, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-admin', ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { response, body: await response.json() as any };
  };
  const login = async (email: string, pass = password) => {
    const result = await call('/auth/login', 'POST', { email, password: pass });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    const cookie = result.response.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i); assert.match(cookie, /Path=\//i);
    assert.equal(result.body.token, undefined);
    return { cookie: cookie.split(';')[0], csrf: result.body.csrfToken };
  };

  await t.test('Anónimo 401 y login protegido contra CSRF', async () => {
    assert.equal((await call('/auth/me')).response.status, 401);
    assert.equal((await call('/admin/admins')).response.status, 401);
    assert.equal((await call('/auth/login', 'POST', { email: ownerEmail, password }, undefined, { 'X-Requested-With': '' })).response.status, 403);
    assert.equal((await call('/auth/login', 'POST', { email: ownerEmail, password }, undefined, { Origin: 'https://evil.example' })).response.status, 403);
    const bad = await call('/auth/login', 'POST', { email: ownerEmail, password: 'incorrecta' });
    const absent = await call('/auth/login', 'POST', { email: 'unknown@example.com', password });
    assert.equal(bad.response.status, 401); assert.equal(bad.body.message, absent.body.message);
  });
  const ownerSession = await login(ownerEmail.toUpperCase());
  const ownerRawToken = ownerSession.cookie.split('=')[1];
  const persisted = await ctx.prisma.adminSession.findUniqueOrThrow({ where: { tokenHash: tokenHash(ownerRawToken) } });
  assert.notEqual(persisted.tokenHash, ownerRawToken);
  const admin = (await call('/admin/admins', 'POST', { email: 'admin@example.com', name: 'Administradora', password }, ownerSession)).body;
  const adminSession = await login(admin.email);

  await t.test('Roles, DTOs, CSRF y respuestas sin hashes', async () => {
    assert.equal((await call('/auth/me', 'GET', undefined, adminSession)).body.admin.role, 'ADMIN');
    assert.equal((await call('/admin/admins', 'GET', undefined, adminSession)).response.status, 403);
    assert.equal((await call('/admin/admins', 'POST', { name: 'Otra', email: 'otro@example.com', password, role: 'OWNER' }, adminSession)).response.status, 403);
    assert.equal((await call(`/admin/admins/${owner.id}`, 'PATCH', { name: 'Cambio' }, ownerSession, { 'X-CSRF-Token': '0'.repeat(64) })).response.status, 403);
    assert.equal((await call(`/admin/admins/${admin.id}`, 'PATCH', { active: null }, ownerSession)).response.status, 400);
    assert.equal((await call('/admin/admins', 'POST', { name: 'Otro', email: admin.email, password }, ownerSession)).response.status, 409);
    const list = await call('/admin/admins', 'GET', undefined, ownerSession);
    assert.equal(list.response.status, 200);
    assert.doesNotMatch(JSON.stringify(list.body), /passwordHash|tokenHash/);
  });

  await t.test('Último OWNER protegido y desactivación revoca sesiones', async () => {
    assert.equal((await call(`/admin/admins/${owner.id}`, 'PATCH', { active: false }, ownerSession)).response.status, 409);
    assert.equal((await call(`/admin/admins/${owner.id}`, 'PATCH', { role: 'ADMIN' }, ownerSession)).response.status, 409);
    assert.equal((await call(`/admin/admins/${admin.id}`, 'PATCH', { active: false }, ownerSession)).response.status, 200);
    assert.equal((await call('/auth/me', 'GET', undefined, adminSession)).response.status, 401);
    assert.equal((await call('/auth/login', 'POST', { email: admin.email, password })).response.status, 401);
    await call(`/admin/admins/${admin.id}`, 'PATCH', { active: true }, ownerSession);
    assert.equal((await call('/auth/me', 'GET', undefined, adminSession)).response.status, 401);
  });

  await t.test('Expiración y logout', async () => {
    const session = await login(admin.email);
    await ctx.prisma.adminSession.update({ where: { tokenHash: tokenHash(session.cookie.split('=')[1]) }, data: { expiresAt: new Date(0) } });
    assert.equal((await call('/auth/me', 'GET', undefined, session)).response.status, 401);
    const second = await login(admin.email);
    const logout = await call('/auth/logout', 'POST', {}, second);
    assert.equal(logout.response.status, 200);
    assert.match(logout.response.headers.get('set-cookie')!, /Expires=Thu, 01 Jan 1970/);
    assert.equal((await call('/auth/me', 'GET', undefined, second)).response.status, 401);
  });

  await t.test('Recuperación privada, token de un uso y revocación de sesiones', async () => {
    const beforeReset = await login(admin.email);
    const requested = await call('/auth/recovery', 'POST', { email: admin.email });
    const nonexistent = await call('/auth/recovery', 'POST', { email: 'absent@example.com' });
    assert.equal(requested.response.status, 202); assert.deepEqual(requested.body, nonexistent.body);
    const files = await readdir(ctx.outbox);
    assert.equal(files.length, 1);
    const mail = JSON.parse(await readFile(path.join(ctx.outbox, files[0]), 'utf8'));
    const token = /token=([a-f0-9]{64})/.exec(mail.text)![1];
    assert.doesNotMatch(JSON.stringify(requested.body), new RegExp(token));
    const saved = await ctx.prisma.accessToken.findUniqueOrThrow({ where: { tokenHash: tokenHash(token) } });
    assert.notEqual(saved.tokenHash, token);
    const newPassword = 'Nueva-clave-segura-456!';
    const responses = await Promise.all([call('/auth/reset', 'POST', { token, password: newPassword }), call('/auth/reset', 'POST', { token, password: newPassword })]);
    assert.deepEqual(responses.map(result => result.response.status).sort(), [200, 400]);
    assert.equal((await call('/auth/me', 'GET', undefined, beforeReset)).response.status, 401);
    assert.equal((await call('/auth/login', 'POST', { email: admin.email, password })).response.status, 401);
    await login(admin.email, newPassword);
    // Un enlace nuevo invalida el anterior, y un enlace vencido no cambia la clave.
    await call('/auth/recovery', 'POST', { email: admin.email });
    const previous = await ctx.prisma.accessToken.findFirstOrThrow({ where: { administratorId: admin.id, usedAt: null } });
    await call('/auth/recovery', 'POST', { email: admin.email });
    const current = await ctx.prisma.accessToken.findFirstOrThrow({ where: { administratorId: admin.id, usedAt: null } });
    const tokens: string[] = [];
    for (const file of await readdir(ctx.outbox)) {
      const savedMail = JSON.parse(await readFile(path.join(ctx.outbox, file), 'utf8'));
      tokens.push(/token=([a-f0-9]{64})/.exec(savedMail.text)![1]);
    }
    const previousToken = tokens.find(value => tokenHash(value) === previous.tokenHash)!;
    const currentToken = tokens.find(value => tokenHash(value) === current.tokenHash)!;
    assert.equal((await call('/auth/reset', 'POST', { token: previousToken, password: newPassword })).response.status, 400);
    await ctx.prisma.accessToken.update({ where: { id: current.id }, data: { expiresAt: new Date(0) } });
    assert.equal((await call('/auth/reset', 'POST', { token: currentToken, password: newPassword })).response.status, 400);
  });

  await t.test('Límite de intentos persistente', async () => {
    for (let i = 0; i < 10; i++) assert.equal((await call('/auth/login', 'POST', { email: 'rate@example.com', password })).response.status, 401);
    assert.equal((await call('/auth/login', 'POST', { email: 'rate@example.com', password })).response.status, 429);
  });

  await t.test('Resend entrega recuperación y un fallo del proveedor invalida el token sin revelar la cuenta', async t => {
    const config = ctx.app.get(ConfigService);
    const previous = Object.fromEntries(['MAIL_MODE', 'RESEND_API_KEY', 'EMAIL_FROM'].map(key => [key, config.get(key)]));
    config.set('MAIL_MODE', 'resend');
    config.set('RESEND_API_KEY', 're_test_only');
    config.set('EMAIL_FROM', 'Porfin Carteles <no-reply@example.com>');
    const account = await ctx.prisma.administrator.create({ data: { name: 'Prueba Resend', email: 'resend@example.com', passwordHash: owner.passwordHash } });
    const realFetch = globalThis.fetch;
    let fail = false;
    const messages: any[] = [];
    t.mock.method(globalThis, 'fetch', async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
      if (String(url) !== 'https://api.resend.com/emails') return realFetch(url, options);
      assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer re_test_only');
      messages.push(JSON.parse(String(options?.body)));
      return new Response(JSON.stringify(fail ? { message: 'private-provider-error' } : { id: 'email-test' }), { status: fail ? 500 : 200 });
    });
    try {
      const success = await call('/auth/recovery', 'POST', { email: account.email });
      const absent = await call('/auth/recovery', 'POST', { email: 'absent-resend@example.com' });
      assert.equal(success.response.status, 202);
      assert.deepEqual(success.body, absent.body);
      assert.equal(messages.length, 1);
      assert.equal(messages[0].from, 'Porfin Carteles <no-reply@example.com>');
      const rawToken = /#token=([a-f0-9]{64})/.exec(messages[0].text)![1];
      assert.equal((await ctx.prisma.accessToken.findUniqueOrThrow({ where: { tokenHash: tokenHash(rawToken) } })).usedAt, null);
      fail = true;
      const failure = await call('/auth/recovery', 'POST', { email: account.email });
      assert.equal(failure.response.status, 202);
      assert.deepEqual(failure.body, absent.body);
      assert.equal(messages.length, 2);
      assert.equal(await ctx.prisma.accessToken.count({ where: { administratorId: account.id, usedAt: null } }), 0);
      assert.doesNotMatch(JSON.stringify(failure.body), /private-provider-error|resend@example.com/);
    } finally {
      for (const [key, value] of Object.entries(previous)) config.set(key, value);
    }
  });

  await t.test('Dos OWNER no pueden eliminarse concurrentemente', async () => {
    const second = await call('/admin/admins', 'POST', { email: 'second-owner@example.com', name: 'Segunda propietaria', password, role: 'OWNER' }, ownerSession);
    assert.equal(second.response.status, 201);
    const secondSession = await login(second.body.email);
    const changes = await Promise.all([call(`/admin/admins/${owner.id}`, 'PATCH', { role: 'ADMIN' }, ownerSession), call(`/admin/admins/${second.body.id}`, 'PATCH', { role: 'ADMIN' }, secondSession)]);
    assert.deepEqual(changes.map(result => result.response.status).sort(), [200, 409]);
    assert.equal(await ctx.prisma.administrator.count({ where: { role: 'OWNER', active: true } }), 1);
  });
});
