import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { integrationApp } from './support/integration';
import { hashPassword, tokenHash } from '../src/common/utils/credentials';
import { GuestCleanupService } from '../src/modules/guest-sessions/guest-cleanup.service';

test('Etapa 6: invitados y preview con PostgreSQL real', { timeout: 180000 }, async t => {
  const ctx = await integrationApp();
  t.after(ctx.cleanup);
  type Guest = { cookie: string; csrf: string; expiresAt: string };
  const request = async (route: string, method = 'POST', body?: unknown, guest?: Guest, key?: string, extra: Record<string, string> = {}) => {
    const response = await fetch(ctx.url + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-storefront', ...(guest ? { Cookie: guest.cookie, 'X-CSRF-Token': guest.csrf } : {}), ...(key ? { 'Idempotency-Key': key } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() as any, response };
  };
  const start = async (previous?: Guest): Promise<Guest> => {
    const result = await request('/guest-session', 'POST', {}, previous);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return { cookie: result.response.headers.get('set-cookie')!.split(';')[0], csrf: result.body.csrfToken, expiresAt: result.body.expiresAt };
  };
  const guest = await start(), other = await start();
  const guestToken = guest.cookie.split('=')[1];
  const session = await ctx.prisma.guestSession.findUniqueOrThrow({ where: { tokenHash: tokenHash(guestToken) } });
  const otherSession = await ctx.prisma.guestSession.findUniqueOrThrow({ where: { tokenHash: tokenHash(other.cookie.split('=')[1]) } });
  const occasion = await ctx.prisma.category.create({ data: { name: 'Recibida preview', slug: 'recibida-preview', isOccasion: true } });
  const career = await ctx.prisma.career.create({ data: { name: 'Medicina preview', slug: 'medicina-preview' } });
  const product = await ctx.prisma.product.create({
    data: { name: 'Cartel', slug: 'cartel-preview', description: 'Cartel con fotos', category: 'CARTEL', type: 'PREDEFINED', status: 'PUBLISHED',
      categories: { create: { categoryId: occasion.id } }, careers: { create: { careerId: career.id } },
      variants: { create: [
        { key: 'base', name: 'Tres fotos', pricingMode: 'FIXED', priceCents: 10000, attributes: {}, photoCount: 3, position: 0 },
        { key: 'inactiva', name: 'Inactiva', pricingMode: 'FIXED', priceCents: 1, attributes: {}, active: false, position: 1 },
      ] },
      fields: { create: [
        { key: 'nombre', label: 'Nombre', type: 'SHORT_TEXT', required: true, minLength: 2, maxLength: 20, position: 0 },
        { key: 'frase', label: 'Frase', type: 'LONG_TEXT', maxLength: 100, position: 1 },
        { key: 'edad', label: 'Edad', type: 'NUMBER', required: true, minValue: 0, maxValue: 120, position: 2 },
        { key: 'color', label: 'Color', type: 'SELECT', required: true, position: 3, options: { create: [{ key: 'rojo', label: 'Rojo', position: 0 }, { key: 'dorado', label: 'Dorado', additionalCents: 500, position: 1 }] } },
      ] },
    }, include: { variants: { orderBy: { position: 'asc' } } },
  });
  const quoted = await ctx.prisma.product.create({ data: { name: 'A medida', slug: 'a-medida-preview', description: 'Cotización', type: 'CUSTOM', status: 'PUBLISHED', variants: { create: [{ key: 'base', name: 'A medida', pricingMode: 'QUOTE', priceCents: null, attributes: {}, position: 0 }] } }, include: { variants: true } });
  const combo = await ctx.prisma.product.create({ data: { name: 'Combo', slug: 'combo-preview', description: 'Combo independiente', type: 'COMBO', status: 'PUBLISHED', variants: { create: [{ key: 'base', name: 'Completo', pricingMode: 'FIXED', priceCents: 30000, attributes: {}, position: 0 }] }, components: { create: [{ key: 'cartel', name: 'Cartel', quantity: 2, position: 0, referenceProductId: product.id }] }, fields: { create: [{ key: 'frase-cartel', label: 'Frase del cartel', type: 'SHORT_TEXT', required: true, componentKey: 'cartel', position: 0 }] } }, include: { variants: true } });
  const line = { lineId: 'cartel-1', productId: product.id, variantId: product.variants[0].id, quantity: 2, answers: [{ fieldKey: 'nombre', value: ' Ana ' }, { fieldKey: 'edad', value: 0 }, { fieldKey: 'color', value: 'dorado' }] };
  const quoteLine = { lineId: 'personalizado', productId: quoted.id, variantId: quoted.variants[0].id, quantity: 3 };
  const body = { items: [line, quoteLine], deliveryMethod: 'SHIPPING' };
  const preview = (input: unknown = body, owner = guest, key = randomUUID()) => request('/orders/preview', 'POST', input, owner, key);
  let saved: any, savedKey = randomUUID();

  await t.test('Cookie opaca, reutilización, cabeceras y separación administrativa', async () => {
    assert.equal(session.tokenHash, tokenHash(guestToken)); assert.notEqual(session.tokenHash, guestToken);
    const reuse = await start(guest); assert.equal(reuse.cookie, guest.cookie); assert.equal(reuse.expiresAt, guest.expiresAt);
    const result = await request('/guest-session', 'POST', {}, guest);
    const cookieHeader = result.response.headers.get('set-cookie')!;
    assert.match(cookieHeader, /HttpOnly/); assert.match(cookieHeader, /SameSite=Lax/i); assert.match(cookieHeader, /Path=\//);
    assert.deepEqual(Object.keys(result.body).sort(), ['csrfToken', 'expiresAt']);
    assert.equal((await request('/guest-session', 'POST', { token: 'elegido' })).status, 400);
    assert.equal((await request('/guest-session', 'POST', {}, undefined, undefined, { Origin: 'https://ajeno.example' })).status, 403);
    assert.equal((await request('/guest-session', 'POST', {}, undefined, undefined, { 'X-Requested-With': 'porfin-admin' })).status, 403);
    assert.equal((await request('/admin/products', 'GET', undefined, guest)).status, 401);
    assert.equal((await request('/auth/login', 'POST', { email: 'a@example.com', password: 'irrelevante' }, guest)).status, 403);
    const password = 'Clave-admin-invitado-123';
    await ctx.prisma.administrator.create({ data: { name: 'Admin', email: 'guest-admin@example.com', passwordHash: await hashPassword(password) } });
    const adminLogin = await request('/auth/login', 'POST', { email: 'guest-admin@example.com', password }, undefined, undefined, { 'X-Requested-With': 'porfin-admin' });
    assert.equal(adminLogin.status, 200);
    const admin: Guest = { cookie: adminLogin.response.headers.get('set-cookie')!.split(';')[0], csrf: adminLogin.body.csrfToken, expiresAt: '' };
    assert.equal((await preview(body, admin)).status, 401);
    assert.equal((await request('/orders/preview', 'POST', body, guest, randomUUID(), { 'X-CSRF-Token': admin.csrf })).status, 403);
  });

  await t.test('Preview exige sesión y CSRF; datos de la tienda no alteran permisos', async () => {
    assert.equal((await request('/orders/preview', 'POST', body, undefined, randomUUID())).status, 401);
    assert.equal((await request('/orders/preview', 'POST', body, guest, randomUUID(), { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await request('/orders/preview', 'POST', body, guest, randomUUID(), { 'X-Requested-With': 'porfin-admin' })).status, 403);
    assert.equal((await request('/orders/preview', 'POST', body, guest, randomUUID(), { Origin: 'https://ajeno.example' })).status, 403);
    assert.equal((await request('/orders/preview', 'POST', body, guest)).status, 400);
    assert.equal((await request('/orders/preview', 'POST', body, guest, 'no-uuid')).status, 400);
    assert.equal((await request('/orders/preview', 'POST', body, guest, randomUUID(), { Cookie: guest.cookie + '; ' + guest.cookie })).status, 401);
    assert.equal((await request('/orders', 'POST', body, guest, randomUUID())).status, 400);
  });

  await t.test('Resumen mixto, cotización pendiente y fotos por WhatsApp; sin pedido', async () => {
    const result = await preview(body, guest, savedKey);
    assert.equal(result.status, 200, JSON.stringify(result.body)); saved = result.body;
    assert.equal(saved.summary.knownSubtotalCents, 21000);
    assert.equal(saved.summary.pendingQuoteLines, 1); assert.equal(saved.summary.pendingQuoteQuantity, 3);
    assert.equal(saved.summary.totalQuantity, 5); assert.equal(saved.summary.finalTotalCents, null);
    assert.deepEqual(saved.summary.shipping, { method: 'SHIPPING', status: 'TO_CONFIRM', amountCents: null });
    assert.equal(saved.items[0].unitPriceCents, 10500); assert.equal(saved.items[1].subtotalCents, null);
    assert.equal(saved.items[0].photoCountPerUnit, 3); assert.equal(saved.items[0].photoCountTotal, 6); assert.equal(saved.items[0].photoDelivery, 'WHATSAPP');
    assert.equal(saved.items[0].category, 'CARTEL'); assert.equal(saved.items[0].displayType, 'PREDEFINED_THREE_IMAGES');
    assert.deepEqual(saved.items[0].occasions, [{ id: occasion.id, name: occasion.name, slug: occasion.slug }]);
    assert.deepEqual(saved.items[0].careers, [{ id: career.id, name: career.name, slug: career.slug }]);
    assert.equal(saved.items[0].answers[0].value, 'Ana'); assert.equal(saved.items[0].answers[1].value, 0);
    assert.equal(saved.items[0].answers[2].displayValue, 'Dorado');
    assert.ok(new Date(saved.expiresAt).getTime() <= Date.now() + 15 * 60000);
    const stored = await ctx.prisma.orderPreview.findUniqueOrThrow({ where: { id: saved.id } });
    assert.deepEqual(stored.result, saved);
    assert.equal(JSON.stringify(stored).includes(guestToken), false);
    assert.equal('orderId' in saved, false); assert.equal('orderNumber' in saved, false);
    const docs = await request('/docs-json', 'GET');
    assert.ok(docs.body.paths['/api/v1/orders/preview'].post.responses['200'].content['application/json'].schema);
    assert.ok(docs.body.components.securitySchemes['guest-session']);
  });

  await t.test('Personalizaciones distintas permanecen separadas; retiro y combo', async () => {
    const secondLine = { ...line, lineId: 'cartel-2', quantity: 1, answers: line.answers.map(answer => answer.fieldKey === 'nombre' ? { ...answer, value: 'Luis' } : answer) };
    const result = await preview({ items: [line, secondLine], deliveryMethod: 'PICKUP' });
    assert.equal(result.status, 200); assert.equal(result.body.items.length, 2);
    assert.equal(result.body.summary.knownSubtotalCents, 31500); assert.equal(result.body.summary.shipping.amountCents, 0);
    assert.equal(result.body.summary.finalTotalCents, null);
    assert.equal(result.body.items[1].answers[0].value, 'Luis');
    const bundle = await preview({ items: [{ lineId: 'combo', productId: combo.id, variantId: combo.variants[0].id, quantity: 2, answers: [{ fieldKey: 'frase-cartel', value: 'Lo logré' }] }] });
    assert.equal(bundle.status, 200); assert.equal(bundle.body.summary.knownSubtotalCents, 60000);
    assert.equal(bundle.body.items[0].answers[0].componentKey, 'cartel');
    assert.equal(bundle.body.items[0].components[0].quantity, 2);
    const onlyQuote = await preview({ items: [quoteLine] });
    assert.equal(onlyQuote.status, 200); assert.equal(onlyQuote.body.summary.knownSubtotalCents, 0);
    assert.equal(onlyQuote.body.summary.pendingQuoteLines, 1); assert.equal(onlyQuote.body.summary.finalTotalCents, null);
  });

  await t.test('DTOs rechazan precios, fotos, cantidades inválidas y renglones duplicados', async () => {
    const initialCount = await ctx.prisma.orderPreview.count();
    for (const invalid of [
      {}, [], { items: [] }, { items: [line, line] }, { items: [null] },
      { items: [{ ...line, quantity: 0 }] }, { items: [{ ...line, quantity: 101 }] }, { items: [{ ...line, quantity: 1.5 }] },
      { items: [{ ...line, quantity: '2' }] }, { items: [{ ...line, priceCents: 1 }] },
      { items: [{ ...line, answers: [{ fieldKey: 'nombre', value: '\u0000' }] }] },
      { items: [{ ...line, answers: [{ fieldKey: 'nombre', value: '\ud800' }] }] },
      { items: [{ ...line, photos: ['https://arbitrario.example/a.jpg'] }] },
      { items: [{ ...line, answers: [{ fieldKey: 'nombre', value: null }] }] },
      { items: [{ ...line, answers: [{ fieldKey: 'nombre', value: {} }] }] },
      { items: [{ ...line, answers: [{ fieldKey: 'nombre', value: 'x'.repeat(2001) }] }] },
      { items: [{ ...line, answers: [line.answers[0], line.answers[0]] }] },
      { ...body, totalCents: 0 }, { ...body, deliveryMethod: 'OTRO' },
      { items: Array.from({ length: 31 }, (_, index) => ({ ...line, lineId: 'line-' + index })) },
    ]) assert.equal((await preview(invalid)).status, 400, JSON.stringify(invalid).slice(0, 150));
    assert.equal(await ctx.prisma.orderPreview.count(), initialCount);
  });

  await t.test('Campos dinámicos y disponibilidad se revalidan sin persistir resultados parciales', async () => {
    const initialCount = await ctx.prisma.orderPreview.count();
    for (const patch of [
      { answers: [] },
      { answers: line.answers.map(answer => answer.fieldKey === 'nombre' ? { ...answer, value: ' ' } : answer) },
      { answers: line.answers.map(answer => answer.fieldKey === 'nombre' ? { ...answer, value: 'A' } : answer) },
      { answers: line.answers.map(answer => answer.fieldKey === 'nombre' ? { ...answer, value: 'x'.repeat(21) } : answer) },
      { answers: line.answers.map(answer => answer.fieldKey === 'edad' ? { ...answer, value: '18' } : answer) },
      { answers: line.answers.map(answer => answer.fieldKey === 'edad' ? { ...answer, value: 121 } : answer) },
      { answers: line.answers.map(answer => answer.fieldKey === 'color' ? { ...answer, value: 'inexistente' } : answer) },
      { answers: [...line.answers, { fieldKey: 'desconocido', value: 'hola' }] },
      { variantId: quoted.variants[0].id }, { variantId: product.variants[1].id }, { productId: 'missing' },
    ]) {
      const result = await preview({ items: [{ ...line, ...patch }, quoteLine] });
      assert.equal(result.status, 422, JSON.stringify(patch)); assert.match(result.body.message[0], /cartel-1/);
    }
    assert.equal(await ctx.prisma.orderPreview.count(), initialCount);
    await ctx.prisma.product.update({ where: { id: product.id }, data: { status: 'UNAVAILABLE' } });
    assert.equal((await preview()).status, 422);
    await ctx.prisma.product.update({ where: { id: product.id }, data: { status: 'PUBLISHED' } });
  });

  await t.test('Idempotencia simultánea, normalización y cambios de precio', async () => {
    const key = randomUUID();
    const results = await Promise.all([preview(body, guest, key), preview(body, guest, key), preview(body, guest, key)]);
    assert.deepEqual(results.map(result => result.status), [200, 200, 200]);
    assert.equal(new Set(results.map(result => result.body.id)).size, 1);
    const normalized = { ...body, items: [{ ...line, answers: [...line.answers].reverse().map(answer => typeof answer.value === 'string' ? { ...answer, value: answer.value.trim() } : answer) }, quoteLine] };
    assert.deepEqual((await preview(normalized, guest, key)).body, results[0].body);
    assert.equal((await preview({ ...body, deliveryMethod: 'PICKUP' }, guest, key)).status, 409);
    await ctx.prisma.productVariant.update({ where: { id: product.variants[0].id }, data: { priceCents: 12000 } });
    assert.deepEqual((await preview(body, guest, savedKey)).body, saved, 'Un reintento devuelve el resultado original');
    const current = await preview(); assert.equal(current.status, 200); assert.equal(current.body.summary.knownSubtotalCents, 25000);
    const otherResult = await preview(body, other, key);
    assert.equal(otherResult.status, 200); assert.notEqual(otherResult.body.id, results[0].body.id);
  });

  await t.test('Una validación solo puede consultarse desde su sesión; expiración y nueva clave', async () => {
    assert.deepEqual((await request('/orders/previews/' + saved.id, 'GET', undefined, guest)).body, saved);
    assert.equal((await request('/orders/previews/' + saved.id, 'GET', undefined, other)).status, 404);
    assert.equal((await request('/orders/previews/' + saved.id, 'GET')).status, 401);
    await ctx.prisma.orderPreview.update({ where: { id: saved.id }, data: { expiresAt: new Date(0) } });
    assert.equal((await request('/orders/previews/' + saved.id, 'GET', undefined, guest)).status, 410);
    assert.equal((await preview(body, guest, savedKey)).status, 410);
    const expiry = new Date(Date.now() + 5 * 60000);
    await ctx.prisma.guestSession.update({ where: { id: session.id }, data: { expiresAt: expiry } });
    const current = await preview(); assert.equal(current.status, 200);
    assert.equal(new Date(current.body.expiresAt).getTime(), expiry.getTime());
    const cleanup = ctx.app.get(GuestCleanupService);
    await cleanup.runOnce();
    assert.equal(await ctx.prisma.orderPreview.findUnique({ where: { id: saved.id } }), null);
    assert.equal(await ctx.prisma.idempotentRequest.count({ where: { previewId: saved.id } }), 0);
  });

  await t.test('Cerrar una sesión durante un preview no deja validaciones utilizables', async () => {
    const racing = await start();
    const current = await ctx.prisma.guestSession.findUniqueOrThrow({ where: { tokenHash: tokenHash(racing.cookie.split('=')[1]) } });
    const [result, closed] = await Promise.all([preview(body, racing), request('/guest-session', 'DELETE', {}, racing)]);
    assert.ok([200, 401].includes(result.status), JSON.stringify(result.body));
    assert.equal(closed.status, 204);
    assert.ok((await ctx.prisma.guestSession.findUniqueOrThrow({ where: { id: current.id } })).revokedAt);
    assert.equal(await ctx.prisma.orderPreview.count({ where: { guestSessionId: current.id } }), 0);
  });
  await t.test('Rate limits persistentes, cierre y expiración de sesión', async () => {
    await ctx.prisma.guestRateLimit.upsert({ where: { key: tokenHash('guest:preview:session:' + otherSession.id) }, create: { key: tokenHash('guest:preview:session:' + otherSession.id), attempts: 60, expiresAt: new Date(Date.now() + 60000) }, update: { attempts: 60 } });
    const limited = await preview(body, other);
    const counter = await ctx.prisma.guestRateLimit.findUnique({ where: { key: tokenHash('guest:preview:session:' + otherSession.id) } });
    assert.equal(limited.status, 429, JSON.stringify({ attempts: counter?.attempts, expiresAt: counter?.expiresAt, now: new Date() }));
    assert.equal((await request('/guest-session', 'DELETE', {}, guest)).status, 204);
    assert.equal(await ctx.prisma.orderPreview.count({ where: { guestSessionId: session.id } }), 0);
    assert.equal((await preview()).status, 401);
    const renewed = await start(guest); assert.notEqual(renewed.cookie, guest.cookie);
    await ctx.prisma.guestSession.update({ where: { id: otherSession.id }, data: { expiresAt: new Date(0) } });
    assert.equal((await preview(body, other)).status, 401);
    await ctx.prisma.guestRateLimit.upsert({ where: { key: tokenHash('guest:start:ip:127.0.0.1') }, create: { key: tokenHash('guest:start:ip:127.0.0.1'), attempts: 30, expiresAt: new Date(Date.now() + 60000) }, update: { attempts: 30 } });
    assert.equal((await request('/guest-session', 'POST', {})).status, 429);
    await ctx.app.get(GuestCleanupService).runOnce();
    assert.equal(await ctx.prisma.guestSession.findUnique({ where: { id: otherSession.id } }), null);
  });
});
