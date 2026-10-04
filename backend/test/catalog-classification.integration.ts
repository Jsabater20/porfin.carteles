import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { integrationApp } from './support/integration';
import { hashPassword } from '../src/common/utils/credentials';

test('Clasificación del catálogo: escritura compatible y filtros públicos', { timeout: 180000 }, async t => {
  const ctx = await integrationApp();
  t.after(ctx.cleanup);
  const password = 'Catalog-classification-123';
  await ctx.prisma.administrator.create({ data: { name: 'Catálogo', email: 'classification@example.com', passwordHash: await hashPassword(password), role: 'ADMIN' } });
  const login = await fetch(ctx.url + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-admin' }, body: JSON.stringify({ email: 'classification@example.com', password }) });
  assert.equal(login.status, 200);
  const session = await login.json() as any;
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const call = async (route: string, method = 'GET', body?: unknown) => {
    const response = await fetch(ctx.url + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-admin', Cookie: cookie, 'X-CSRF-Token': session.csrfToken }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() as any };
  };
  const family = (await call('/admin/categories', 'POST', { name: 'Props', slug: 'props' })).body;
  const cartelFamily = (await call('/admin/categories', 'POST', { name: 'Carteles', slug: 'carteles' })).body;
  const occasion = (await call('/admin/categories', 'POST', { name: 'Recibida', slug: 'recibida' })).body;
  const career = (await call('/admin/careers', 'POST', { name: 'Medicina', slug: 'medicina' })).body;
  const base = { name: 'Producto', description: 'Prueba', status: 'PUBLISHED', variants: [{ key: 'base', name: 'Base', pricingMode: 'QUOTE', priceCents: null }] };
  let prop: any, sign: any;
  await t.test('Clientes anteriores clasifican props y carteles', async () => {
    const result = await call('/admin/products', 'POST', { ...base, slug: 'props', type: 'CUSTOM', categoryIds: [family.id] });
    assert.equal(result.status, 201, JSON.stringify(result.body)); prop = result.body;
    assert.equal(prop.category, 'PROP'); assert.equal(family.isOccasion, false); assert.equal(occasion.isOccasion, true);
    const result2 = await call('/admin/products', 'POST', { ...base, slug: 'predeterminado', type: 'PREDEFINED', categoryIds: [cartelFamily.id, occasion.id], careerIds: [career.id], variants: [
      { key: 'base', name: 'Base', pricingMode: 'FIXED', priceCents: 4800000, photoCount: 0, attributes: { formato: 'rectangular' } },
      { key: 'tres-imagenes', name: 'Tres imágenes', pricingMode: 'FIXED', priceCents: 5400000, photoCount: 3, attributes: { formato: 'circular' } },
    ] });
    assert.equal(result2.status, 201); sign = result2.body; assert.equal(sign.category, 'CARTEL');
    for (const [position, shape] of ['RECTANGULAR', 'CIRCULAR'].entries()) {
      const publicId = `test/catalog-shape/${shape.toLowerCase()}/${randomUUID()}`;
      const upload = await ctx.prisma.mediaUpload.create({ data: { productId: sign.id, administratorId: 'catalog-test', cloudName: 'test', publicId, expiresAt: new Date(), cleanupAfter: new Date(), confirmedAt: new Date() } });
      await ctx.prisma.productImage.create({ data: { productId: sign.id, uploadId: upload.id, assetId: randomUUID(), publicId, url: `https://res.cloudinary.com/test/image/upload/${shape.toLowerCase()}.jpg`, format: 'jpg', bytes: 100, width: 800, height: 600, altText: shape, shape: shape as 'RECTANGULAR' | 'CIRCULAR', position, cover: position === 0 } });
    }
  });
  await t.test('PATCH conserva IDs, relaciones e información histórica', async () => {
    const order = await ctx.prisma.order.create({ data: { reference: 'CLASSIFICATION-HISTORY', customerName: 'Cliente de prueba', customerPhone: '', requestedDate: new Date('2026-12-01'), scheduledDate: new Date('2026-12-01'), deliveryMethod: 'pickup', knownSubtotalCents: 0, items: { create: { productId: sign.id, productName: 'Nombre histórico', variantSnapshot: { id: sign.variants[0].id }, customizationSnapshot: {}, pricingMode: 'QUOTE', quantity: 1 } } }, include: { items: true } });
    const result = await call('/admin/products/' + sign.id, 'PATCH', { name: 'Nombre nuevo' });
    assert.equal(result.status, 200); assert.equal(result.body.category, 'CARTEL'); assert.equal(result.body.variants[0].id, sign.variants[0].id);
    assert.deepEqual(result.body.categories, sign.categories); assert.deepEqual(result.body.careers, sign.careers);
    assert.deepEqual(await ctx.prisma.order.findUnique({ where: { id: order.id }, include: { items: true } }), order);
  });
  await t.test('Nuevas ocasiones conservan familia y rechazan IDs inválidos', async () => {
    assert.equal((await call('/admin/products/' + sign.id, 'PATCH', { occasionIds: [family.id] })).status, 400);
    const changed = await call('/admin/products/' + sign.id, 'PATCH', { occasionIds: [] });
    assert.equal(changed.status, 200); assert.deepEqual(changed.body.categories.map((c: any) => c.categoryId), [cartelFamily.id]);
    assert.equal((await call('/admin/products/' + sign.id, 'PATCH', { occasionIds: [occasion.id] })).status, 200);
    assert.equal((await call('/admin/products/' + prop.id, 'PATCH', { occasionIds: [occasion.id] })).status, 400);
    assert.equal((await call('/admin/products/' + prop.id, 'PATCH', { category: 'PROP', careerIds: [career.id] })).status, 400);
  });
  await t.test('Clasificación explícita sin ocasiones y compatibilidad de edición antigua', async () => {
    const created = await call('/admin/products', 'POST', { ...base, slug: 'prop-sin-familia', type: 'CUSTOM', category: 'PROP' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const changed = await call('/admin/products/' + created.body.id, 'PATCH', { type: 'CUSTOM', categoryIds: [] });
    assert.equal(changed.status, 200); assert.equal(changed.body.category, 'PROP');
    const generic = await call('/admin/products', 'POST', { ...base, slug: 'generico', type: 'GENERIC', category: 'CARTEL', occasionIds: [occasion.id] });
    assert.equal(generic.status, 201);
    assert.equal((await call('/admin/products', 'POST', { ...base, slug: 'invalido', type: 'PREDEFINED', category: 'PROP' })).status, 400);
    assert.equal((await call('/admin/products/' + prop.id, 'PATCH', { categoryIds: [family.id, cartelFamily.id] })).status, 400);
    assert.equal((await call('/admin/categories/' + family.id, 'PATCH', { slug: 'renombrada' })).status, 400);
  });
  await t.test('Filtros nuevos, dependientes inválidos y URLs anteriores', async () => {
    assert.equal((await call('/products?category=PROP&type=PREDEFINED&occasion=missing&career=missing')).body.total, 2);
    assert.equal((await call('/products?category=CARTEL&type=GENERIC&occasion=' + occasion.id + '&career=missing')).body.total, 1);
    assert.equal((await call('/products?category=CARTEL&type=PREDEFINED&occasion=' + occasion.id + '&career=' + career.id)).body.total, 1);
    assert.equal((await call('/products?category=CARTEL&type=PREDEFINED_THREE_IMAGES&occasion=' + occasion.id + '&career=' + career.id)).body.total, 1);
    const rectangular = (await call('/products?category=CARTEL&type=PREDEFINED&shape=RECTANGULAR')).body;
    assert.equal(rectangular.total, 1); assert.equal(rectangular.items[0].basePrice.fromCents, 4800000); assert.equal(rectangular.items[0].defaultVariantId, sign.variants[0].id);
    assert.equal(rectangular.items[0].coverImage.shape, 'RECTANGULAR'); assert.equal(rectangular.items[0].displayShape, 'RECTANGULAR');
    assert.equal((await call('/products?category=CARTEL&type=PREDEFINED&shape=CIRCULAR')).body.total, 0);
    const circularPhotos = (await call('/products?category=CARTEL&type=PREDEFINED_THREE_IMAGES&shape=CIRCULAR')).body;
    assert.equal(circularPhotos.total, 1); assert.equal(circularPhotos.items[0].basePrice.fromCents, 5400000); assert.equal(circularPhotos.items[0].defaultVariantId, sign.variants[1].id);
    assert.equal(circularPhotos.items[0].coverImage.shape, 'CIRCULAR'); assert.equal(circularPhotos.items[0].displayShape, 'CIRCULAR');
    assert.equal((await call('/products?category=CARTEL&type=PREDEFINED_THREE_IMAGES&shape=RECTANGULAR')).body.total, 0);
    assert.equal((await call('/products?type=CUSTOM')).body.total, 2);
    assert.equal((await call('/products?categoryId=' + family.id)).body.total, 1);
    assert.equal((await call('/products?type=PREDEFINED&careerId=' + career.id)).body.items[0].id, sign.id);
    assert.equal((await call('/products/predeterminado')).body.id, sign.id);
    const a = (await call('/products?category=PROP&sort=name-asc&limit=1')).body;
    const b = (await call('/products?category=PROP&sort=name-asc&limit=1&page=2')).body;
    assert.equal(a.total, 2); assert.notEqual(a.items[0].id, b.items[0].id);
  });
  await t.test('Ocasiones y carreras visibles, sin exponer familias como ocasiones', async () => {
    assert.deepEqual((await call('/occasions')).body.items.map((c: any) => c.id), [occasion.id]);
    assert.equal((await call('/categories')).body.total, 3);
    assert.equal((await call('/careers?category=CARTEL&type=PREDEFINED&occasion=' + occasion.id)).body.total, 1);
    assert.equal((await call('/careers?category=CARTEL&type=PREDEFINED_THREE_IMAGES&occasion=' + occasion.id)).body.total, 1);
    assert.equal((await call('/careers?category=CARTEL&type=GENERIC')).body.total, 0);
    await call('/admin/products/' + sign.id, 'PATCH', { status: 'HIDDEN' });
    assert.equal((await call('/careers?category=CARTEL&type=PREDEFINED')).body.total, 0);
    assert.equal((await call('/products/predeterminado')).status, 404);
    assert.equal((await call('/products?category=INVALID')).status, 400);
    assert.equal((await call('/products?category=CARTEL&shape=INVALID')).status, 400);
  });
});
