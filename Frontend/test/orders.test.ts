import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { argentinaDate, validateCustomer, whatsappLink, ORDER_ID } from '../src/features/orders/validation';
import { ATTEMPT_KEY, createOrderManager, fingerprint } from '../src/features/orders/manager';
import type { CreateOrderInput, GuestOrder } from '../src/lib/contracts/orders';
import type { PreviewTransport } from '../src/features/cart/preview-manager';
import { ApiError } from '../src/lib/api/errors';
import { routePolicy } from '../src/lib/api/policy';
import { forwardToBackend } from '../src/lib/api/gateway';

const input: CreateOrderInput = { previewId: randomUUID(), customerName: 'Ana Pérez', customerPhone: '5491123456789', requestedDate: '2030-12-01', deliveryMethod: 'SHIPPING', deliveryAddress: 'Calle 123', notes: 'Una observación' };
const order = { id: 'c' + 'a'.repeat(24) } as GuestOrder;
const cartHash = 'a'.repeat(64);
function memory() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
const request = (callback: (options: Parameters<PreviewTransport>[1]) => Promise<unknown>): PreviewTransport =>
  async <T>(path: string, options: Parameters<PreviewTransport>[1]) => (path === 'guest-session' ? { csrfToken: 'test-csrf' } : await callback(options)) as T;

test('datos del pedido: normalización, teléfono internacional, fecha real y dirección solo para envío', () => {
  const fields = { customerName: '  Ana Pe\u0301rez ', customerPhone: '+54 (9) 11-2345 6789', requestedDate: '2030-02-28', deliveryAddress: ' Calle 123 ', notes: '   ' };
  const result = validateCustomer(fields, input.previewId, 'SHIPPING', '2030-01-01');
  assert.deepEqual(result.errors, {});
  assert.equal(result.input.customerName, 'Ana Pérez');
  assert.equal(result.input.customerPhone, '5491123456789');
  assert.equal(result.input.deliveryAddress, 'Calle 123');
  assert.equal('notes' in result.input, false);
  assert.equal('deliveryAddress' in validateCustomer(fields, input.previewId, 'PICKUP', '2030-01-01').input, false);
  for (const date of ['2030-02-29', '2029-12-31', 'invalid']) assert.ok(validateCustomer({ ...fields, requestedDate: date }, input.previewId, 'PICKUP', '2030-01-01').errors.requestedDate);
  for (const phone of ['12345', '0001234567', '+54abc1123456789']) assert.ok(validateCustomer({ ...fields, customerPhone: phone }, input.previewId, 'PICKUP', '2030-01-01').errors.customerPhone);
  assert.ok(validateCustomer({ ...fields, deliveryAddress: '' }, input.previewId, 'SHIPPING', '2030-01-01').errors.deliveryAddress);
  assert.ok(validateCustomer({ ...fields, notes: 'x'.repeat(1001) }, input.previewId, 'PICKUP', '2030-01-01').errors.notes);
  assert.equal(argentinaDate(new Date('2030-01-01T01:30:00Z')), '2029-12-31');
});

test('WhatsApp acepta únicamente HTTPS del destinatario wa.me y rechaza enlaces arbitrarios', () => {
  const good = 'https://wa.me/5491123456789?text=Hola';
  assert.equal(whatsappLink(good), good);
  for (const bad of [null, 'javascript:alert(1)', 'https://evil.test/5491123456789', 'http://wa.me/5491123456789', 'https://user:pass@wa.me/5491123456789', 'https://wa.me/abc', 'https://wa.me:8080/5491123456789']) assert.equal(whatsappLink(bad), null);
});

test('doble clic y pérdida de respuesta conservan una sola clave y solo limpian tras confirmación', async () => {
  const keys: string[] = []; let failures = 1, cleared = 0;
  const storage = memory();
  const manager = createOrderManager(request(async (options) => { keys.push(options.idempotencyKey!); if (failures--) throw new ApiError(503, 'timeout'); return order; }), async (hash) => { assert.equal(hash, cartHash); cleared++; });
  manager.connect(storage);
  await Promise.all([manager.submit(input, cartHash), manager.submit(input, cartHash)]);
  assert.equal(keys.length, 1); assert.equal(cleared, 0);
  const persisted = storage.getItem(ATTEMPT_KEY)!;
  assert.doesNotMatch(persisted, /Ana|5491123456789|Calle|observación|csrf/);
  await manager.submit(input, cartHash);
  assert.equal(keys[0], keys[1]); assert.equal(cleared, 1); assert.equal(manager.getSnapshot().orderId, order.id);
  await manager.submit(input, cartHash); assert.equal(keys.length, 2);
});

test('recargar recupera el mismo preview y clave; modificar datos no dispara otro pedido', async () => {
  const storage = memory(), keys: string[] = [];
  const first = createOrderManager(request(async (options) => { keys.push(options.idempotencyKey!); throw new ApiError(503, 'perdida'); }), async () => {});
  first.connect(storage); await first.submit(input, cartHash);
  const second = createOrderManager(request(async (options) => { keys.push(options.idempotencyKey!); assert.deepEqual(options.body, input); return order; }), async () => {});
  second.connect(storage);
  assert.equal(second.getSnapshot().pending?.previewId, input.previewId);
  await second.submit({ ...input, customerName: 'Otro nombre' }, cartHash);
  assert.equal(keys.length, 1); assert.match(second.getSnapshot().message, /exactamente/);
  await second.submit(input, 'b'.repeat(64));
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
});

test('conflicto de catálogo o preview vencido requieren revisión; conflictos transitorios conservan la clave', async () => {
  for (const error of [new ApiError(409, 'El catálogo cambió. Volvé a validar el carrito.'), new ApiError(410, 'Venció')]) {
    const storage = memory();
    const manager = createOrderManager(request(async () => { throw error; }), async () => {});
    manager.connect(storage); await manager.submit(input, cartHash);
    assert.equal(manager.getSnapshot().status, 'review'); assert.equal(manager.getSnapshot().pending, null); assert.equal(storage.getItem(ATTEMPT_KEY), null);
  }
  const storage = memory(), keys: string[] = [];
  const manager = createOrderManager(request(async (options) => { keys.push(options.idempotencyKey!); throw new ApiError(409, 'Reintentá con la misma clave de idempotencia.'); }), async () => {});
  manager.connect(storage); await manager.submit(input, cartHash); await manager.submit(input, cartHash);
  assert.equal(keys[0], keys[1]); assert.equal(manager.getSnapshot().status, 'uncertain');
});

test('sesión perdida no recrea pedidos; corrupción del registro bloquea un nuevo envío', async () => {
  for (const status of [401, 404]) {
    let calls = 0;
    const manager = createOrderManager(request(async () => { calls++; throw new ApiError(status, 'No disponible'); }), async () => {});
    manager.connect(memory()); await manager.submit(input, cartHash); await manager.submit(input, cartHash);
    assert.equal(calls, 1); assert.equal(manager.getSnapshot().status, 'blocked'); assert.ok(manager.getSnapshot().pending);
  }
  const storage = memory(); storage.setItem(ATTEMPT_KEY, '{bad');
  const manager = createOrderManager(request(async () => { throw new Error('No debe enviar'); }), async () => {});
  manager.connect(storage); assert.equal(manager.getSnapshot().status, 'blocked');
});

test('429 bloquea el reintento inmediato y almacenamiento deshabilitado mantiene la clave en memoria', async () => {
  let calls = 0;
  const manager = createOrderManager(request(async () => { calls++; throw new ApiError(429, 'Límite', undefined, '1'); }), async () => {});
  const disconnect = manager.connect(); await manager.submit(input, cartHash); await manager.submit(input, cartHash);
  assert.equal(calls, 1); assert.equal(manager.getSnapshot().storageWarning, true); assert.equal(manager.getSnapshot().retryBlocked, true); disconnect();
});

test('recibo persistido recupera su acceso sin reenviar ni almacenar información del cliente', async () => {
  const storage = memory(); storage.setItem(ATTEMPT_KEY, JSON.stringify({ kind: 'complete', orderId: order.id, cartFingerprint: cartHash }));
  let cleaned = '';
  const manager = createOrderManager(request(async () => { throw new Error('No debe enviar'); }), async (hash) => { cleaned = hash; });
  manager.connect(storage); await manager.submit(input, cartHash);
  assert.equal(manager.getSnapshot().orderId, order.id); assert.equal(cleaned, cartHash);
  manager.newRequest(); assert.equal(manager.getSnapshot().status, 'idle'); assert.equal(storage.getItem(ATTEMPT_KEY), null);
  assert.equal((await fingerprint(input)).length, 64);
});

test('pasarela de pedidos filtra cookies, conserva idempotencia y limita la consulta al ID exacto', async () => {
  assert.ok(ORDER_ID.test(order.id));
  assert.equal(routePolicy('orders', 'POST'), 'guest');
  assert.equal(routePolicy('orders/' + order.id, 'GET'), 'guest');
  for (const path of ['orders', 'orders/preview', 'orders/' + order.id + '/payments', 'orders/not-an-id', 'admin/unknown']) assert.equal(routePolicy(path, 'GET'), undefined);
  const config = { backendUrl: 'http://127.0.0.1:3001/api/v1', webOrigin: 'http://localhost:3000' };
  const key = randomUUID();
  const response = await forwardToBackend(new Request('http://localhost:3000/api/backend/orders', { method: 'POST', headers: { Origin: config.webOrigin, 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-storefront', 'X-CSRF-Token': 'csrf', 'Idempotency-Key': key, Cookie: 'porfin_guest=guest; porfin_session=admin' }, body: JSON.stringify(input) }), ['orders'], config, async (_url, options) => {
    const headers = new Headers(options?.headers);
    assert.equal(headers.get('cookie'), 'porfin_guest=guest'); assert.equal(headers.get('idempotency-key'), key);
    assert.deepEqual(JSON.parse(options!.body as string), input);
    return Response.json(order);
  });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
});
