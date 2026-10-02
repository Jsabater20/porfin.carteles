import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { RecoveryMailer } from '../src/modules/auth/recovery-mailer.service';

const settings = { MAIL_MODE: 'resend', RESEND_API_KEY: 're_test_only', EMAIL_FROM: 'Porfin Carteles <no-reply@example.com>', PASSWORD_RESET_URL: 'https://tienda.example.com/admin/reset-password' };
const mailer = (patch = {}) => new RecoveryMailer(new ConfigService({ ...settings, ...patch }));

test('Resend envía HTTPS con remitente configurado, token en fragmento e idempotencia sin exponer el token en headers', async t => {
  const calls: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://api.resend.com/emails');
    calls.push(options);
    return new Response(JSON.stringify({ id: 'email-test' }), { status: 200 });
  });
  const token = 'a'.repeat(64);
  await mailer().send('admin@example.com', token);
  await mailer().send('admin@example.com', token);
  await mailer().send('admin@example.com', 'b'.repeat(64));
  const request = calls[0];
  const message = JSON.parse(String(request.body));
  assert.equal(request.method, 'POST');
  assert.equal(request.redirect, 'error');
  assert.ok(request.signal instanceof AbortSignal);
  assert.equal(new Headers(request.headers).get('authorization'), 'Bearer re_test_only');
  assert.equal(message.from, settings.EMAIL_FROM);
  assert.deepEqual(message.to, ['admin@example.com']);
  const url = new URL(message.text.match(/https:\/\/\S+/)[0]);
  assert.equal(url.search, '');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), token);
  const keys = calls.map(call => new Headers(call.headers).get('idempotency-key'));
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[0], keys[2]);
  assert.ok(!keys[0]?.includes(token));
  assert.doesNotMatch(String(request.body), /re_test_only/);
});

test('Resend rechaza fallos HTTP, respuesta inválida y fallo de red con error genérico', async t => {
  let result: () => Promise<Response>;
  t.mock.method(globalThis, 'fetch', () => result());
  const cases = [
    ...[401, 403, 429, 500].map(status => async () => new Response('sentinel-secret admin@example.com', { status })),
    async () => new Response('{}'),
    async () => new Response('not-json'),
    async () => new Response('{"id":""}'),
    async () => { throw new Error('sentinel-secret admin@example.com'); },
  ];
  for (const run of cases) {
    result = run;
    await assert.rejects(mailer().send('admin@example.com', 'a'.repeat(64)), error => {
      assert.ok(error instanceof ServiceUnavailableException);
      assert.doesNotMatch(error.message, /sentinel-secret|admin@example.com/);
      return true;
    });
  }
});

test('Correo deshabilitado o Resend incompleto no hace solicitudes externas', async t => {
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debe llamarse'); });
  for (const patch of [{ MAIL_MODE: 'disabled' }, { MAIL_MODE: 'unknown' }, { RESEND_API_KEY: '' }, { EMAIL_FROM: '' }]) {
    await assert.rejects(mailer(patch).send('admin@example.com', 'a'.repeat(64)), ServiceUnavailableException);
  }
  assert.equal(network.mock.callCount(), 0);
});
