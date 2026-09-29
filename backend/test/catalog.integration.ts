import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrationApp } from './support/integration';
import { hashPassword } from '../src/common/utils/credentials';

test('Etapa 3: catálogo privado con PostgreSQL real', { timeout: 120000 }, async t => {
  const ctx = await integrationApp();
  t.after(ctx.cleanup);
  const password = 'Clave-catalogo-segura-123';
  await ctx.prisma.administrator.create({ data: { name: 'Admin catálogo', email: 'catalog@example.com', passwordHash: await hashPassword(password), role: 'ADMIN' } });
  let cookie = '', csrf = '';
  const call = async (route: string, method = 'GET', body?: unknown, authenticated = true) => {
    const response = await fetch(`${ctx.url}/api/v1${route}`, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-admin', ...(authenticated ? { Cookie: cookie, 'X-CSRF-Token': csrf } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { response, body: response.status === 204 ? null : await response.json() as any };
  };
  const login = await call('/auth/login', 'POST', { email: 'catalog@example.com', password }, false);
  assert.equal(login.response.status, 200);
  cookie = login.response.headers.get('set-cookie')!.split(';')[0]; csrf = login.body.csrfToken;

  await t.test('Catálogo privado accesible a ADMIN; gestión de cuentas reservada', async () => {
    assert.equal((await call('/admin/products', 'GET', undefined, false)).response.status, 401);
    assert.equal((await call('/admin/products')).response.status, 200);
    assert.equal((await call('/admin/admins')).response.status, 403);
    assert.equal((await call('/products', 'GET', undefined, false)).response.status, 200);
  });
  const category = await call('/admin/categories', 'POST', { name: 'Recibida', slug: 'recibida' });
  const career = await call('/admin/careers', 'POST', { name: 'Arquitectura', slug: 'arquitectura' });
  assert.equal(category.response.status, 201); assert.equal(career.response.status, 201);
  const input = { name: 'Cartel arquitectura', slug: 'cartel-arquitectura', description: 'Cartel para celebrar', type: 'PREDEFINED', categoryIds: [category.body.id], careerIds: [career.body.id], variants: [{ key: 'base', name: 'Sin fotos', pricingMode: 'FIXED', priceCents: 1800000 }] };
  const created = await call('/admin/products', 'POST', input);
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const productId = created.body.id, variantId = created.body.variants[0].id;

  await t.test('Texto inválido en rutas, formularios y JSON anidado devuelve 400 sin modificar el catálogo', async () => {
    assert.equal((await call('/admin/products/%00')).response.status, 400);
    for (const text of ['\u0000', '\ud800', '\udfff']) {
      assert.equal((await call('/admin/categories', 'POST', { name: text, slug: 'invalid-text' })).response.status, 400);
      const invalid = { variants: [{ ...input.variants[0], attributes: { size: text } }] };
      assert.equal((await call('/admin/products/' + productId, 'PATCH', invalid)).response.status, 400);
    }
    const stored = await call('/admin/products/' + productId);
    assert.equal(stored.body.name, input.name); assert.deepEqual(stored.body.variants[0].attributes, {});
    assert.equal(await ctx.prisma.category.count({ where: { slug: 'invalid-text' } }), 0);
  });

  await t.test('Precio exclusivo de variantes y restricciones de publicación', async () => {
    assert.equal(created.body.priceCents, undefined);
    assert.equal(created.body.status, 'HIDDEN');
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { priceCents: 1 })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { variants: [] })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { variants: [{ ...input.variants[0], pricingMode: 'QUOTE', priceCents: 0 }] })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { variants: [{ ...input.variants[0], priceCents: -10 }] })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { status: 'PUBLISHED', variants: [{ ...input.variants[0], active: false }] })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { status: 'PUBLISHED' })).response.status, 200);
    const changed = await call(`/admin/products/${productId}`, 'PATCH', { name: 'Cartel actualizado' });
    assert.equal(changed.response.status, 200, JSON.stringify(changed.body));
    assert.equal(changed.body.status, 'PUBLISHED', 'PATCH de nombre no oculta el producto');
    assert.equal(changed.body.variants[0].id, variantId, 'Conserva el identificador de variante');
    assert.equal(changed.body.careers[0].careerId, career.body.id);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', {})).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { name: null })).response.status, 400);
  });

  await t.test('Taxonomías, búsqueda, filtros y referencias protegidas', async () => {
    assert.equal((await call(`/admin/categories/${category.body.id}`, 'DELETE', {})).response.status, 409);
    assert.equal((await call(`/admin/careers/${career.body.id}`, 'DELETE', {})).response.status, 409);
    assert.equal((await call('/admin/categories', 'POST', { name: 'Otra', slug: 'recibida' })).response.status, 409);
    assert.equal((await call(`/admin/careers/${career.body.id}`, 'PATCH', { name: 'Arquitectura y diseño' })).response.status, 200);
    const filtered = await call(`/admin/products?categoryId=${category.body.id}&careerId=${career.body.id}&status=PUBLISHED&q=actualizado`);
    assert.equal(filtered.body.total, 1);
    assert.equal((await call('/admin/products?limit=101')).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { categoryIds: ['missing-category'] })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`)).body.categories[0].categoryId, category.body.id);
    const unused = await call('/admin/categories', 'POST', { name: 'Temporal', slug: 'temporal' });
    assert.equal((await call(`/admin/categories/${unused.body.id}`, 'DELETE', {})).response.status, 204);
  });

  await t.test('Formularios dinámicos, opciones, adicionales y actualización atómica', async () => {
    const fields = [
      { key: 'nombre', label: 'Nombre', type: 'SHORT_TEXT', required: true, minLength: 1, maxLength: 80 },
      { key: 'frase', label: 'Frase', type: 'LONG_TEXT', maxLength: 500 },
      { key: 'edad', label: 'Edad', type: 'NUMBER', minValue: 1, maxValue: 120 },
      { key: 'color', label: 'Color', type: 'SELECT', options: [{ key: 'rosa', label: 'Rosa', additionalCents: 0 }, { key: 'dorado', label: 'Dorado', additionalCents: 30000 }] },
    ];
    const result = await call(`/admin/products/${productId}`, 'PATCH', { fields });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.fields.length, 4);
    assert.equal(result.body.fields[3].options[1].additionalCents, 30000);
    const fieldId = result.body.fields[0].id;
    const bad = await call(`/admin/products/${productId}`, 'PATCH', { name: 'No debe guardarse', fields: [{ key: 'color', label: 'Color', type: 'SELECT', options: [] }] });
    assert.equal(bad.response.status, 400);
    const unchanged = await call(`/admin/products/${productId}`);
    assert.equal(unchanged.body.name, 'Cartel actualizado');
    assert.equal(unchanged.body.fields[0].id, fieldId);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { fields: [fields[0], fields[0]] })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { fields: [{ ...fields[0], minLength: 100, maxLength: 5 }] })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { fields: [{ ...fields[0], componentKey: 'inexistente' }] })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'DELETE', {})).response.status, 409);
  });

  await t.test('A cotizar conserva null y la base impide precios inconsistentes', async () => {
    const quote = await call('/admin/products', 'POST', { ...input, slug: 'a-cotizar', type: 'CUSTOM', variants: [{ key: 'personalizado', name: 'A medida', pricingMode: 'QUOTE', priceCents: null }] });
    assert.equal(quote.response.status, 201);
    assert.equal(quote.body.variants[0].priceCents, null);
    await assert.rejects(ctx.prisma.productVariant.update({ where: { id: quote.body.variants[0].id }, data: { priceCents: 0 } }));
    assert.equal((await call(`/admin/products/${quote.body.id}`, 'DELETE', {})).response.status, 204);
  });

  await t.test('Combos con precio independiente y sin anidación directa o indirecta', async () => {
    const comboInput = { ...input, slug: 'combo', name: 'Combo completo', type: 'COMBO', variants: [{ key: 'combo', name: 'Combo base', pricingMode: 'FIXED', priceCents: 3200000 }], components: [{ key: 'cartel', name: 'Cartel', quantity: 1, referenceProductId: productId }, { key: 'props', name: 'Props', quantity: 6 }], fields: [{ key: 'frase-cartel', label: 'Frase del cartel', type: 'SHORT_TEXT', required: true, componentKey: 'cartel' }] };
    const combo = await call('/admin/products', 'POST', comboInput);
    assert.equal(combo.response.status, 201, JSON.stringify(combo.body));
    assert.equal(combo.body.variants[0].priceCents, 3200000);
    assert.equal(combo.body.components[1].quantity, 6);
    assert.equal((await call('/admin/products', 'POST', { ...comboInput, slug: 'anidado', components: [{ key: 'combo', name: 'Combo', quantity: 1, referenceProductId: combo.body.id }] })).response.status, 400);
    assert.equal((await call(`/admin/products/${combo.body.id}`, 'PATCH', { components: [{ key: 'cartel', name: 'Sí mismo', quantity: 1, referenceProductId: combo.body.id }] })).response.status, 400);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { type: 'COMBO', components: [{ key: 'nuevo', name: 'Nuevo', quantity: 1 }] })).response.status, 409);
    assert.equal((await call(`/admin/products/${productId}`, 'PATCH', { status: 'HIDDEN' })).response.status, 200);
    assert.equal((await call(`/admin/products/${productId}`, 'DELETE', {})).response.status, 409);
    assert.equal((await call(`/admin/products/${combo.body.id}`, 'DELETE', {})).response.status, 204);
    assert.equal((await call(`/admin/products/${productId}`, 'DELETE', {})).response.status, 204);
    assert.equal(await ctx.prisma.productVariant.count({ where: { productId } }), 0);
  });
});
