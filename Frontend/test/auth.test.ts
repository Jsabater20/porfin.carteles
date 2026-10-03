import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { validateAuth, resetToken, retryDelay, authMessage, adminNavigation } from '../src/features/auth/validation';
import { createAdminManager, type AdminTransport } from '../src/features/auth/admin-manager';
import { ApiError } from '../src/lib/api/errors';
import type { AdminSession } from '../src/lib/contracts/auth';
const session = (): AdminSession => ({ admin: { id: 'admin-1', name: 'Owner', email: 'owner@example.test', role: 'OWNER', active: true }, csrfToken: 'csrf', expiresAt: new Date(Date.now() + 60000).toISOString() });
const transport = (fn: (path: string, options?: Parameters<AdminTransport>[1]) => Promise<unknown>): AdminTransport => async <T>(path: string, options?: Parameters<AdminTransport>[1]) => await fn(path, options) as T;

test('validación separa login de contraseña nueva, no recorta la clave y normaliza email', () => {
  assert.deepEqual(validateAuth('login', ' Owner@Example.test ', ' corta ', '').errors, {});
  assert.equal(validateAuth('login', ' Owner@Example.test ', ' corta ', '').email, 'owner@example.test');
  assert.ok(validateAuth('login', 'sin-correo', '', '').errors.email);
  assert.ok(validateAuth('reset', '', 'x'.repeat(11), 'x'.repeat(11)).errors.password);
  assert.deepEqual(validateAuth('reset', '', '🎉'.repeat(12), '🎉'.repeat(12)).errors, {});
  assert.ok(validateAuth('reset', '', 'x'.repeat(129), '').errors.password);
  assert.ok(validateAuth('reset', '', 'Clave de prueba', 'Clave diferente').errors.confirmation);
  assert.deepEqual(validateAuth('recovery', 'a@example.test', '', '').errors, {});
});
test('el reset acepta exactamente un token hexadecimal en fragmento y rechaza duplicados', () => {
  const token = 'a'.repeat(64);
  assert.equal(resetToken('#token=' + token), token);
  for (const bad of ['', '#token=short', '#token=' + token + '&token=' + token, '#token=' + 'G'.repeat(64), '#otro=' + token]) assert.equal(resetToken(bad), '');
});
test('errores no enumeran cuentas, y 429 respeta segundos o fecha HTTP', () => {
  assert.equal(authMessage('login', new ApiError(401, 'Cuenta inexistente')), authMessage('login', new ApiError(401, 'Contraseña inválida')));
  assert.equal(retryDelay(new ApiError(429, 'Límite', undefined, '5')), 5);
  assert.equal(retryDelay(new ApiError(429, 'Límite', undefined, new Date(5000).toUTCString()), 0), 5);
  assert.equal(retryDelay(new ApiError(429, 'Límite')), 60);
  assert.equal(retryDelay(new ApiError(503, 'Caída')), 0);
});
test('el panel muestra únicamente las cuatro tareas principales', () => {
  const expected = ['Inicio', 'Productos', 'Pedidos', 'Editar inicio'];
  assert.deepEqual(adminNavigation().map(item => item.label), expected);
});
test('logout obtiene CSRF actual; doble clic hace una sola escritura y respuesta tardía no restaura sesión', async () => {
  const current = session(), calls: string[] = [], exits: string[] = [];
  let release!: (value: AdminSession) => void;
  const late = new Promise<AdminSession>((resolve) => { release = resolve; });
  const manager = createAdminManager(current, transport(async (path, options) => {
    calls.push(path);
    if (calls.length === 1) return late;
    if (path === 'auth/me') return { ...current, csrfToken: 'fresh' };
    assert.equal(options?.csrfToken, 'fresh'); assert.deepEqual(options?.body, {}); return {};
  }), (reason) => exits.push(reason));
  const pending = manager.refresh();
  await Promise.all([manager.logout(), manager.logout()]);
  release(current); await pending;
  assert.equal(calls.filter((path) => path === 'auth/logout').length, 1);
  assert.deepEqual(exits, ['logout']); assert.equal(manager.getSnapshot().session, null);
});
test('un cierre fallido no se presenta como exitoso; puede reintentarse', async () => {
  const current = session(), exits: string[] = []; let fail = true;
  const manager = createAdminManager(current, transport(async (path) => {
    if (path === 'auth/me') return current;
    if (fail) { fail = false; throw new ApiError(503, 'Conexión'); } return {};
  }), (reason) => exits.push(reason));
  await manager.logout(); assert.equal(exits.length, 0); assert.match(manager.getSnapshot().message, /No pudimos confirmar/);
  await manager.logout(); assert.deepEqual(exits, ['logout']);
});
test('401 elimina contenido, cambios de rol requieren otra lectura del servidor y caída temporal conserva la sesión', async () => {
  for (const response of [new ApiError(401, 'Vencida'), { ...session(), admin: { ...session().admin, role: 'ADMIN' as const } }, new ApiError(503, 'Caída')]) {
    const exits: string[] = [];
    const manager = createAdminManager(session(), transport(async () => { if (response instanceof ApiError) throw response; return response; }), (reason) => exits.push(reason));
    await manager.refresh();
    if (response instanceof ApiError && response.status === 503) { assert.ok(manager.getSnapshot().session); assert.equal(exits.length, 0); }
    else { assert.equal(manager.getSnapshot().session, null); assert.equal(exits[0], response instanceof ApiError ? 'expired' : 'changed'); }
  }
});
test('vencimiento absoluto oculta panel aun sin interacción', async () => {
  const current = { ...session(), expiresAt: new Date(Date.now() + 80).toISOString() }, exits: string[] = [];
  const manager = createAdminManager(current, transport(async () => current), (reason) => exits.push(reason));
  const stop = manager.connect(); await delay(120); stop();
  assert.deepEqual(exits, ['expired']); assert.equal(manager.getSnapshot().session, null);
});
test('403 no repite escrituras; el cliente vuelve a consultar permisos', async () => {
  const calls: string[] = [];
  const manager = createAdminManager(session(), transport(async (path) => { calls.push(path); if (path === 'auth/me') return session(); throw new ApiError(403, 'Sin permiso'); }), () => {});
  await assert.rejects(manager.request('private', { method: 'POST', body: {} }), ApiError);
  assert.deepEqual(calls, ['private', 'auth/me']);
});
