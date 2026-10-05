import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { OrderNotificationMailer } from '../src/modules/orders/order-notification-mailer.service';

const order = {
  id: 'cm12345678901234567890123', reference: 'CAR-TEST', customerName: 'Ana Pérez', customerEmail: 'ana@example.com', customerPhone: '3425556789',
  requestedDate: new Date('2030-12-01T00:00:00.000Z'), deliveryMethod: 'PICKUP', notes: 'Entregar por la tarde', knownSubtotalCents: 5200000, pendingQuoteCount: 0,
  items: [{ productName: 'Cartel genérico', variantName: 'Rectangular', quantity: 1, subtotalCents: 5200000 }],
};

test('avisa un pedido por Resend al correo de contacto sin incluir fecha de nacimiento', async t => {
  const calls: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => { calls.push(options); return new Response(JSON.stringify({ id: 'mail-id' }), { status: 200 }); });
  const mailer = new OrderNotificationMailer(new ConfigService({ MAIL_MODE: 'resend', RESEND_API_KEY: 're_test', EMAIL_FROM: 'Por fin Carteles <no-reply@example.com>', ALLOWED_ORIGINS: 'https://tienda.example.com' }));
  assert.equal(await mailer.send('porfincarteles@gmail.com', order), true);
  const request = calls[0], message = JSON.parse(String(request.body));
  assert.deepEqual(message.to, ['porfincarteles@gmail.com']);
  assert.match(message.subject, /CAR-TEST/);
  for (const value of ['Ana Pérez', '3425556789', 'Cartel genérico', '52.000', 'A coordinar en Santa Fe Capital', 'https://tienda.example.com/admin/pedidos/']) assert.ok(message.text.includes(value), value);
  assert.doesNotMatch(message.text, /Fecha de nacimiento/);
  assert.match(new Headers(request.headers).get('idempotency-key') ?? '', /^order-[a-f0-9]{64}$/);
});

test('sin correo de contacto o con correo deshabilitado no intenta enviar', async t => {
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debe llamarse'); });
  const mailer = new OrderNotificationMailer(new ConfigService({ MAIL_MODE: 'disabled' }));
  assert.equal(await mailer.send('porfincarteles@gmail.com', order), false);
  assert.equal(await mailer.send(null, order), false);
  assert.equal(await mailer.send('correo-invalido', order), false);
  assert.equal(network.mock.callCount(), 0);
});
