import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { PersonalizationField, ProductDetail } from '../src/lib/contracts/catalog';
import type { OrderPreview } from '../src/lib/contracts/preview';
import { validateAnswers, estimateUnit } from '../src/features/personalization/validate';
import { CART_KEY, CART_TTL, previewInput, restoreCart, type CartLine } from '../src/features/cart/model';
import { createCartStore } from '../src/features/cart/store';
import { createPreviewManager, type PreviewTransport } from '../src/features/cart/preview-manager';
import { ApiError } from '../src/lib/api/errors';
import { forwardToBackend } from '../src/lib/api/gateway';

const field = (patch: Partial<PersonalizationField> = {}): PersonalizationField => ({
  key: 'name', label: 'Nombre', type: 'SHORT_TEXT', required: true, position: 0, componentKey: null,
  minLength: 1, maxLength: 80, minValue: null, maxValue: null, options: [], ...patch,
});
const line = (lineId = 'line-1', name = 'Ana'): CartLine => ({
  lineId, productId: 'product-1', variantId: 'variant-1', quantity: 1, answers: [{ fieldKey: 'name', value: name }],
  display: { slug: 'cartel', name: 'Cartel', variantName: 'Clásico', unitEstimateCents: 1000, photoCount: 3, category: 'CARTEL', displayType: 'PREDEFINED_THREE_IMAGES',
    occasions: [{ id: 'occasion-1', name: 'Recibida', slug: 'recibida' }], careers: [{ id: 'career-1', name: 'Medicina', slug: 'medicina' }], labels: [{ fieldKey: 'name', label: 'Nombre' }] },
});
function setup() {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
  const store = createCartStore();
  const stop = store.connect(storage);
  return { store, memory, stop };
}
function result(expiresAt = new Date(Date.now() + 60_000).toISOString()): OrderPreview {
  return {
    id: 'preview-1', currency: 'ARS', expiresAt,
    items: [{ lineId: 'line-1', productId: 'product-1', productName: 'Cartel', slug: 'cartel', type: 'CUSTOM', variantId: 'variant-1', variantName: 'Clásico', variantAttributes: {},
      quantity: 1, currency: 'ARS', pricingMode: 'FIXED', status: 'PRICED', baseUnitCents: 1200, additionalUnitCents: 0, unitPriceCents: 1200, subtotalCents: 1200,
      selectedOptions: [], answers: [], components: [], photoCountPerUnit: 3, photoCountTotal: 3, photoDelivery: 'WHATSAPP' }],
    summary: { knownSubtotalCents: 1200, pendingQuoteLines: 0, pendingQuoteQuantity: 0, totalQuantity: 1, shipping: { method: 'UNDECIDED', status: 'TO_CONFIRM', amountCents: null }, finalTotalCents: null, status: 'PENDING_CONFIRMATION' },
  };
}
const session = { csrfToken: 'csrf', expiresAt: new Date(Date.now() + 3600_000).toISOString() };

test('personalización normaliza Unicode, respeta límites por caracteres y rechaza texto inválido', () => {
  assert.deepEqual(validateAnswers([field({ maxLength: 1 })], { name: ' e\u0301 ' }).answers, [{ fieldKey: 'name', value: 'é' }]);
  assert.equal(Object.keys(validateAnswers([field({ maxLength: 1 })], { name: '🎉' }).errors).length, 0);
  for (const value of [' ', 'ab', String.fromCharCode(0), String.fromCharCode(0xd800)]) assert.ok(validateAnswers([field({ maxLength: 1 })], { name: value }).errors.name);
  assert.equal(validateAnswers([field({ required: false })], { name: '  ' }).answers.length, 0);
});

test('números conservan cero, aceptan decimales y rechazan vacío obligatorio, hexadecimal y fuera de rango', () => {
  const fields = [field({ type: 'NUMBER', minValue: 0, maxValue: 10 })];
  assert.equal(validateAnswers(fields, { name: '0' }).answers[0].value, 0);
  assert.equal(validateAnswers(fields, { name: '1,5' }).answers[0].value, 1.5);
  for (const value of ['', '-1', '11', 'Infinity', '0x5']) assert.ok(validateAnswers(fields, { name: value }).errors.name);
});

test('selecciones envían claves del catálogo y los combos mantienen el precio de su variante', () => {
  const fields = [field({ key: 'color', type: 'SELECT', componentKey: 'cartel', options: [{ key: 'gold', label: 'Dorado', additionalCents: 250, position: 0 }] })];
  const validated = validateAnswers(fields, { color: 'gold' });
  assert.deepEqual(validated.answers, [{ fieldKey: 'color', value: 'gold' }]);
  assert.ok(validateAnswers(fields, { color: 'Dorado' }).errors.color);
  const product = { fields, components: [{ key: 'cartel', name: 'Cartel', quantity: 3, position: 0 }] } as ProductDetail;
  const variant = { id: 'v', key: 'v', name: 'Combo', pricingMode: 'FIXED' as const, priceCents: 1000, attributes: {}, photoCount: 0 };
  assert.deepEqual(estimateUnit(product, variant, validated.answers), { unit: 1250, additional: 250 });
  assert.deepEqual(estimateUnit(product, { ...variant, pricingMode: 'QUOTE', priceCents: null }, validated.answers), { unit: null, additional: 250 });
});

test('campos que coinciden con propiedades de Object no heredan valores ni errores', () => {
  const validated = validateAnswers([field({ key: 'constructor' })], {});
  assert.equal(validated.errors.constructor, 'Completá este campo.');
});

test('carrito conserva personalizaciones distintas y persiste solo datos de compra durante siete días', (t) => {
  const { store, memory, stop } = setup(); t.after(stop);
  store.add(line()); store.add(line('line-2', 'Sol'));
  store.quantity('line-2', 2);
  assert.equal(store.getSnapshot().lines.length, 2);
  const saved = JSON.parse(memory.get(CART_KEY)!);
  assert.ok(saved.expiresAt > Date.now() + CART_TTL - 1000);
  assert.deepEqual(Object.keys(saved).sort(), ['deliveryMethod', 'expiresAt', 'lines', 'version']);
  assert.equal(restoreCart(memory.get(CART_KEY)!).data.lines[1].answers[0].value, 'Sol');
  assert.equal(restoreCart(memory.get(CART_KEY)!).data.lines[1].answers[0].fieldKey, 'idea');
  assert.equal(restoreCart(memory.get(CART_KEY)!).data.lines[0].display.displayType, 'PREDEFINED_THREE_IMAGES');
});

test('edición conserva lineId; cantidades, renglones y duplicados se limitan', (t) => {
  const { store, stop } = setup(); t.after(stop);
  store.add(line()); store.replace(line('line-1', 'Nuevo nombre'));
  assert.equal(store.getSnapshot().lines[0].answers[0].value, 'Nuevo nombre');
  for (const quantity of [0, 101, 1.5]) assert.ok(store.quantity('line-1', quantity));
  for (let i = 2; i <= 30; i++) store.add(line('line-' + i));
  assert.ok(store.add(line('line-31')));
  assert.ok(store.add(line()));
  store.remove('line-1');
  assert.equal(store.getSnapshot().lines.length, 29);
});

test('datos vencidos, corruptos o con versión desconocida se descartan sin fallar', () => {
  for (const raw of ['{bad', JSON.stringify({ version: 9 }), JSON.stringify({ version: 1, expiresAt: 1, lines: [], deliveryMethod: 'UNDECIDED' })]) {
    const restored = restoreCart(raw);
    assert.equal(restored.data.lines.length, 0);
    assert.ok(restored.notice);
  }
});

test('los datos manipulados del navegador nunca envían precios, etiquetas ni credenciales al preview', () => {
  const input = previewInput({ lines: [line()], deliveryMethod: 'SHIPPING' });
  assert.deepEqual(Object.keys(input.items[0]).sort(), ['answers', 'lineId', 'productId', 'quantity', 'variantId']);
  assert.doesNotMatch(JSON.stringify(input), /display|Estimate|price|csrf|session/);
});

test('almacenamiento bloqueado conserva el carrito en memoria; sincronización externa y vaciado invalidan datos', (t) => {
  const store = createCartStore();
  const stop = store.connect(); t.after(stop);
  store.add(line());
  assert.equal(store.getSnapshot().storageWarning, true);
  assert.equal(store.getSnapshot().lines.length, 1);
  store.receive(JSON.stringify({ version: 1, expiresAt: Date.now() + CART_TTL, lines: [line('other')], deliveryMethod: 'PICKUP' }));
  assert.equal(store.getSnapshot().lines[0].lineId, 'other');
  store.clear();
  assert.equal(store.getSnapshot().lines.length, 0);
});

test('preview reintenta con la misma clave tras error de red y registra cambios de precio', async (t) => {
  const { store, stop } = setup(); t.after(stop); store.add(line());
  const keys: string[] = []; let count = 0;
  const transport: PreviewTransport = async <T>(path: string, options: { idempotencyKey?: string }) => {
    if (path === 'guest-session') return session as T;
    keys.push(options.idempotencyKey!);
    if (++count === 1) throw new ApiError(503, 'Sin conexión');
    return result() as T;
  };
  const manager = createPreviewManager(store, transport); const off = manager.connect(); t.after(off);
  await manager.validate(); assert.equal(manager.getSnapshot().status, 'error');
  await manager.validate(); assert.equal(manager.getSnapshot().status, 'ready');
  assert.equal(keys[0], keys[1]);
  assert.deepEqual(manager.getSnapshot().priceChanges, ['line-1']);
  store.quantity('line-1', 2);
  assert.equal(manager.getSnapshot().status, 'idle');
  await manager.validate(); assert.notEqual(keys[1], keys[2]);
});

test('una respuesta atrasada se descarta si cambió la entrega durante la consulta', async (t) => {
  const { store, stop } = setup(); t.after(stop); store.add(line());
  let resolve!: (value: OrderPreview) => void;
  const pending = new Promise<OrderPreview>((done) => { resolve = done; });
  const transport: PreviewTransport = async <T>(path: string) => (path === 'guest-session' ? session : await pending) as T;
  const manager = createPreviewManager(store, transport); const off = manager.connect(); t.after(off);
  const running = manager.validate();
  await Promise.resolve(); store.delivery('SHIPPING'); resolve(result()); await running;
  assert.equal(manager.getSnapshot().status, 'idle');
  assert.equal(manager.getSnapshot().preview, null);
});

test('sesión vencida se recupera una vez sin borrar el carrito ni cambiar la clave de reintento', async (t) => {
  const { store, stop } = setup(); t.after(stop); store.add(line());
  let bootstraps = 0; const keys: string[] = [];
  const transport: PreviewTransport = async <T>(path: string, options: { idempotencyKey?: string }) => {
    if (path === 'guest-session') { bootstraps++; return session as T; }
    keys.push(options.idempotencyKey!);
    if (keys.length === 1) throw new ApiError(401, 'Venció');
    return result() as T;
  };
  const manager = createPreviewManager(store, transport); const off = manager.connect(); t.after(off);
  await manager.validate();
  assert.equal(bootstraps, 2); assert.equal(keys[0], keys[1]);
  assert.equal(manager.getSnapshot().status, 'ready'); assert.equal(store.getSnapshot().lines.length, 1);
});

test('errores 422 se asignan al renglón y 410 fuerza una nueva clave', async (t) => {
  const { store, stop } = setup(); t.after(stop); store.add(line());
  const keys: string[] = [];
  const transport: PreviewTransport = async <T>(path: string, options: { idempotencyKey?: string }) => {
    if (path === 'guest-session') return session as T;
    keys.push(options.idempotencyKey!);
    if (keys.length === 1) throw new ApiError(422, 'Inválido', undefined, undefined, ['Línea line-1: Variante no disponible.']);
    if (keys.length === 2) throw new ApiError(410, 'Venció');
    return result() as T;
  };
  const manager = createPreviewManager(store, transport); const off = manager.connect(); t.after(off);
  await manager.validate(); assert.deepEqual(manager.getSnapshot().lineErrors['line-1'], ['Variante no disponible.']);
  await manager.validate(); assert.equal(manager.getSnapshot().status, 'expired');
  await manager.validate(); assert.notEqual(keys[1], keys[2]);
});

test('la vigencia del resumen vence en pantalla sin modificar el carrito', async (t) => {
  const { store, stop } = setup(); t.after(stop); store.add(line());
  const transport: PreviewTransport = async <T>(path: string) => (path === 'guest-session' ? session : result(new Date(Date.now() + 200).toISOString())) as T;
  const manager = createPreviewManager(store, transport); const off = manager.connect(); t.after(off);
  await manager.validate(); assert.equal(manager.getSnapshot().status, 'ready');
  await delay(250);
  assert.equal(manager.getSnapshot().status, 'expired'); assert.equal(store.getSnapshot().lines.length, 1);
});

test('el gateway de preview reenvía exclusivamente la sesión invitada y conserva errores por renglón', async () => {
  const response = await forwardToBackend(new Request('http://localhost:3000/api/backend/orders/preview', {
    method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', 'x-requested-with': 'porfin-storefront', 'x-csrf-token': 'csrf', 'idempotency-key': 'retry', cookie: 'porfin_guest=guest; porfin_session=admin' },
    body: JSON.stringify(previewInput({ lines: [line()], deliveryMethod: 'UNDECIDED' })),
  }), ['orders', 'preview'], { backendUrl: 'http://127.0.0.1:3001/api/v1', webOrigin: 'http://localhost:3000' }, async (_url, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('cookie'), 'porfin_guest=guest');
    assert.equal(headers.get('x-csrf-token'), 'csrf');
    assert.equal(headers.get('idempotency-key'), 'retry');
    return Response.json({ message: ['Línea line-1: Producto no disponible.'] }, { status: 422 });
  });
  assert.equal(response.status, 422);
  assert.deepEqual((await response.json()).message, ['Línea line-1: Producto no disponible.']);
});
