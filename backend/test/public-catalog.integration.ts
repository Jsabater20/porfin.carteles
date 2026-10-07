import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { integrationApp } from './support/integration';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { PriceLineDto } from '../src/modules/pricing/dto/price-line.dto';

test('Etapa 5: catálogo público y precios con PostgreSQL real', { timeout: 120000 }, async t => {
  const ctx = await integrationApp();
  t.after(ctx.cleanup);
  const pricing = ctx.app.get(PricingService);
  const read = async (route: string) => {
    const response = await fetch(ctx.url + '/api/v1' + route);
    return { status: response.status, body: await response.json() as any };
  };
  const category = await ctx.prisma.category.create({ data: { name: 'Recibidas', slug: 'recibidas' } });
  const career = await ctx.prisma.career.create({ data: { name: 'Arquitectura', slug: 'arquitectura' } });
  const privateCategory = await ctx.prisma.category.create({ data: { name: 'Privada', slug: 'privada' } });
  const privateCareer = await ctx.prisma.career.create({ data: { name: 'Borrador', slug: 'borrador' } });
  await ctx.prisma.category.create({ data: { name: 'Vacía', slug: 'vacia' } });
  await ctx.prisma.career.create({ data: { name: 'Vacía', slug: 'vacia' } });
  const variant = (key: string, priceCents: number | null, position = 0, active = true) => ({ key, name: key, pricingMode: priceCents === null ? 'QUOTE' as const : 'FIXED' as const, priceCents, position, active, attributes: {}, photoCount: 0 });
  const create = (data: Prisma.ProductCreateInput) => ctx.prisma.product.create({ data, include: { variants: { orderBy: { position: 'asc' } } } });
  const hidden = await create({ name: 'Información privada', slug: 'oculto', description: 'Borrador', type: 'GENERIC', categories: { create: [{ categoryId: privateCategory.id }] }, careers: { create: [{ careerId: privateCareer.id }] }, variants: { create: [variant('base', 100)] } });
  const unavailable = await create({ name: 'Temporalmente no disponible', slug: 'no-disponible', description: 'No disponible', type: 'GENERIC', status: 'UNAVAILABLE', categories: { create: [{ categoryId: privateCategory.id }] }, variants: { create: [variant('base', 100)] } });
  await create({ name: 'Sin variantes activas', slug: 'inactivo', description: 'No vendible', type: 'GENERIC', status: 'PUBLISHED', variants: { create: [variant('inactiva', 10, 0, false)] } });
  const fixed = await create({
    name: 'Alpha cartel', slug: 'alpha-cartel', description: 'Celebración de Arquitectura', type: 'PREDEFINED', status: 'PUBLISHED',
    measurements: '60x40', materials: 'Cartón', includes: 'Cartel', leadTime: 'Una semana',
    categories: { create: [{ categoryId: category.id }] }, careers: { create: [{ careerId: career.id }] },
    variants: { create: [variant('base', 10000), variant('grande', 25000, 1), variant('desactivada', 1, 2, false)] },
    fields: { create: [
      { key: 'nombre', label: 'Nombre', type: 'SHORT_TEXT', required: true, minLength: 1, maxLength: 80, position: 0 },
      { key: 'color', label: 'Color', type: 'SELECT', required: true, position: 1, options: { create: [{ key: 'rojo', label: 'Rojo', additionalCents: 0, position: 0 }, { key: 'dorado', label: 'Dorado', additionalCents: 500, position: 1 }] } },
      { key: 'acabado', label: 'Acabado', type: 'SELECT', position: 2, options: { create: [{ key: 'brillo', label: 'Brillo', additionalCents: 750, position: 0 }] } },
    ] },
  });
  const quote = await create({ name: 'Beta personalizado', slug: 'beta-personalizado', description: 'A medida', type: 'CUSTOM', status: 'PUBLISHED', categories: { create: [{ categoryId: category.id }] }, variants: { create: [variant('a-medida', null)] }, fields: { create: [{ key: 'extra', label: 'Extra', type: 'SELECT', position: 0, options: { create: [{ key: 'logo', label: 'Logo', additionalCents: 1000, position: 0 }] } }] } });
  const mixed = await create({ name: 'Gamma mixto', slug: 'gamma-mixto', description: 'Variantes mixtas', type: 'GENERIC', status: 'PUBLISHED', categories: { create: [{ categoryId: category.id }] }, variants: { create: [variant('gratis', 0), variant('a-medida', null, 1)] } });
  const combo = await create({ name: 'Zeta combo', slug: 'zeta-combo', description: 'Precio independiente', type: 'COMBO', status: 'PUBLISHED', categories: { create: [{ categoryId: category.id }] }, variants: { create: [variant('completo', 30000)] }, components: { create: [{ key: 'cartel', name: 'Cartel del combo', quantity: 3, position: 0, referenceProductId: hidden.id }] } });
  const upload = await ctx.prisma.mediaUpload.create({ data: { productId: fixed.id, administratorId: 'private-administrator', cloudName: 'test-only', publicId: 'private-public-id', expiresAt: new Date(), cleanupAfter: new Date(), confirmedAt: new Date() } });
  await ctx.prisma.productImage.create({ data: { productId: fixed.id, uploadId: upload.id, assetId: randomUUID(), publicId: upload.publicId, url: 'https://res.cloudinary.com/test-only/image/upload/cartel.jpg', format: 'jpg', bytes: 1000, width: 800, height: 600, altText: 'Cartel', position: 0, cover: true } });
  const input = { productId: fixed.id, variantId: fixed.variants[0].id, quantity: 3, selections: [{ fieldKey: 'color', optionKey: 'dorado' }, { fieldKey: 'acabado', optionKey: 'brillo' }] };

  await t.test('Lectura anónima, visibilidad y separación de operaciones privadas', async () => {
    const result = await read('/products');
    assert.equal(result.status, 200); assert.equal(result.body.total, 4);
    assert.deepEqual(new Set(result.body.items.map((item: any) => item.id)), new Set([fixed.id, quote.id, mixed.id, combo.id]));
    assert.deepEqual(result.body.items.filter((item: any) => item.id === fixed.id).map((item: any) => [item.defaultVariantId, item.basePrice.fromCents]), [[fixed.variants[0].id, 10000]]);
    for (const slug of ['oculto', 'no-disponible', 'inactivo', 'inexistente']) assert.equal((await read('/products/' + slug)).status, 404);
    assert.equal((await read('/admin/products')).status, 401);
    const post = await fetch(ctx.url + '/api/v1/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(post.status, 404);
    assert.equal((await read('/orders/preview')).status, 401);
  });

  await t.test('Filtros, búsqueda, orden y paginación se aplican solo al catálogo visible', async () => {
    const filtered = await read('/products?categoryId=' + category.id + '&careerId=' + career.id + '&type=PREDEFINED&q=ARQUITECTURA');
    assert.equal(filtered.body.total, 1); assert.equal(filtered.body.items[0].id, fixed.id);
    assert.equal((await read('/products?categoryId=' + privateCategory.id)).body.total, 0);
    assert.equal((await read('/products?careerId=' + privateCareer.id)).body.total, 0);
    const first = await read('/products?sort=name-asc&page=1&limit=2');
    const second = await read('/products?sort=name-asc&page=2&limit=2');
    assert.equal(first.body.total, 4); assert.equal(first.body.limit, 2);
    assert.deepEqual(first.body.items.map((item: any) => item.slug), ['alpha-cartel', 'beta-personalizado']);
    assert.deepEqual(second.body.items.map((item: any) => item.slug), ['gamma-mixto', 'zeta-combo']);
    assert.equal((await read('/products?sort=name-desc&limit=1')).body.items[0].id, combo.id);
    assert.deepEqual((await read('/products?page=99')).body.items, []);
    for (const query of ['status=HIDDEN', 'limit=51', 'page=0', 'page=1.5', 'sort=price', 'type=OTHER', 'q=' + 'x'.repeat(121), 'q=%00', 'categoryId=%00', 'careerId=%00', 'categoryId=']) assert.equal((await read('/products?' + query)).status, 400, query);
  });

  await t.test('Categorías y carreras solo incluyen relaciones con productos visibles', async () => {
    assert.deepEqual((await read('/categories')).body.items, [{ id: category.id, name: category.name, slug: category.slug }]);
    assert.deepEqual((await read('/careers')).body.items, [{ id: career.id, name: career.name, slug: career.slug }]);
    assert.equal((await read('/categories?page=2&limit=1')).body.total, 1);
    assert.deepEqual((await read('/categories?page=2&limit=1')).body.items, []);
    assert.equal((await read('/careers?status=HIDDEN')).status, 400);
  });

  await t.test('Ficha, galería y formularios públicos excluyen datos internos', async () => {
    const { body } = await read('/products/alpha-cartel');
    assert.equal(body.images.length, 1); assert.equal(body.coverImage.id, body.images[0].id);
    assert.equal(body.images[0].altText, 'Cartel'); assert.equal(body.images[0].cover, true);
    assert.equal(body.variants.length, 2);
    assert.deepEqual(body.variants.map((item: any) => item.key), ['base', 'grande']);
    assert.equal(body.fields.length, 0);
    assert.equal(body.images[0].shape, null);
    const privateKeys = new Set(['uploadId', 'assetId', 'publicId', 'administratorId', 'referenceProductId', 'passwordHash', 'status', 'active', 'createdAt', 'updatedAt']);
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, nested] of Object.entries(value)) { assert.equal(privateKeys.has(key), false, key); visit(nested); }
    };
    visit(body); visit((await read('/products')).body);
    const comboBody = (await read('/products/zeta-combo')).body;
    visit(comboBody); assert.equal(comboBody.components[0].quantity, 3);
    assert.equal(JSON.stringify(comboBody).includes(hidden.id), false);
    assert.equal((await read('/products/beta-personalizado')).body.coverImage, null);
  });

  await t.test('Precios base distinguen FIXED, QUOTE y cero real; Swagger documenta respuestas', async () => {
    assert.deepEqual((await read('/products/alpha-cartel')).body.basePrice, { currency: 'ARS', fromCents: 10000, toCents: 25000, hasQuoteVariants: false });
    assert.deepEqual((await read('/products/beta-personalizado')).body.basePrice, { currency: 'ARS', fromCents: null, toCents: null, hasQuoteVariants: true });
    assert.deepEqual((await read('/products/gamma-mixto')).body.basePrice, { currency: 'ARS', fromCents: 0, toCents: 0, hasQuoteVariants: true });
    const docs = (await read('/docs-json')).body;
    assert.equal(docs.info.version, '0.12.0');
    for (const route of ['/api/v1/products', '/api/v1/products/{slug}', '/api/v1/categories', '/api/v1/careers']) {
      assert.ok(docs.paths[route].get.responses['200'].content['application/json'].schema);
      assert.equal(docs.paths[route].get.security?.length ?? 0, 0);
    }
    assert.ok(docs.components.schemas.PublicProductDetailDto);
  });

  await t.test('Pricing suma adicionales por unidad y multiplica la cantidad, usando precios actuales', async () => {
    const priced = await pricing.calculate(input);
    assert.equal(priced.baseUnitCents, 10000);
    assert.equal(priced.additionalUnitCents, 1250);
    assert.equal(priced.unitPriceCents, 11250);
    assert.equal(priced.subtotalCents, 33750);
    assert.equal(priced.status, 'PRICED'); assert.equal(priced.currency, 'ARS');
    await ctx.prisma.productVariant.update({ where: { id: fixed.variants[0].id }, data: { priceCents: 12000 } });
    await ctx.prisma.personalizationOption.update({ where: { fieldId_key: { fieldId: (await ctx.prisma.personalizationField.findUniqueOrThrow({ where: { productId_key: { productId: fixed.id, key: 'color' } } })).id, key: 'dorado' } }, data: { additionalCents: 600 } });
    const recalculated = await ctx.prisma.$transaction(tx => pricing.calculate(input, tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    assert.equal(recalculated.subtotalCents, (12000 + 600 + 750) * 3);
    const noExtra = await pricing.calculate({ ...input, selections: [{ fieldKey: 'color', optionKey: 'rojo' }], quantity: 1 });
    assert.equal(noExtra.additionalUnitCents, 0); assert.equal(noExtra.subtotalCents, 12000);
  });

  await t.test('Pricing rechaza manipulación, opciones ajenas, duplicadas y cantidades inválidas', async () => {
    for (const patch of [
      { priceCents: 1 }, { unitPriceCents: 1 }, { subtotalCents: 1 },
      { quantity: 0 }, { quantity: -1 }, { quantity: 1.5 }, { quantity: 101 }, { quantity: '2' },
      { variantId: quote.variants[0].id }, { variantId: fixed.variants[2].id },
      { selections: [] },
      { selections: [{ fieldKey: 'color', optionKey: 'dorado' }, { fieldKey: 'color', optionKey: 'rojo' }] },
      { selections: [{ fieldKey: 'color', optionKey: 'logo' }] },
      { selections: [{ fieldKey: 'nombre', optionKey: 'rojo' }] },
      { selections: [{ fieldKey: 'color', optionKey: 'dorado', additionalCents: 0 }] },
      { selections: null },
    ]) await assert.rejects(pricing.calculate({ ...input, ...patch } as PriceLineDto), BadRequestException, JSON.stringify(patch));
    await assert.rejects(pricing.calculate({ ...input, productId: hidden.id }), NotFoundException);
    await assert.rejects(pricing.calculate({ ...input, productId: unavailable.id }), NotFoundException);
  });

  await t.test('A cotizar conserva null incluso con extras, y el combo usa su propio precio', async () => {
    const pending = await pricing.calculate({ productId: quote.id, variantId: quote.variants[0].id, quantity: 2, selections: [{ fieldKey: 'extra', optionKey: 'logo' }] });
    assert.equal(pending.status, 'PENDING_QUOTE'); assert.equal(pending.baseUnitCents, null);
    assert.equal(pending.unitPriceCents, null); assert.equal(pending.subtotalCents, null); assert.equal(pending.additionalUnitCents, 1000);
    const bundle = await pricing.calculate({ productId: combo.id, variantId: combo.variants[0].id, quantity: 2 });
    assert.equal(bundle.subtotalCents, 60000);
    const free = await pricing.calculate({ productId: mixed.id, variantId: mixed.variants[0].id, quantity: 2, selections: [] });
    assert.equal(free.status, 'PRICED'); assert.equal(free.subtotalCents, 0);
  });

  await t.test('Importes grandes mantienen centavos enteros sin redondear', async () => {
    const large = await create({ name: 'Importe grande', slug: 'importe-grande', description: 'Caso límite', type: 'GENERIC', status: 'PUBLISHED', variants: { create: [variant('base', 1000000000)] }, fields: { create: Array.from({ length: 30 }, (_, index) => ({ key: 'extra-' + index, label: 'Extra', type: 'SELECT', position: index, options: { create: [{ key: 'opcion', label: 'Opción', additionalCents: 1000000000, position: 0 }] } })) } });
    const priced = await pricing.calculate({ productId: large.id, variantId: large.variants[0].id, quantity: 100, selections: Array.from({ length: 30 }, (_, index) => ({ fieldKey: 'extra-' + index, optionKey: 'opcion' })) });
    assert.equal(priced.unitPriceCents, 31000000000); assert.equal(priced.subtotalCents, 3100000000000);
    assert.ok(Number.isSafeInteger(priced.subtotalCents));
  });

  await t.test('Ocultar o desactivar después de consultar obliga a revalidar', async () => {
    await ctx.prisma.product.update({ where: { id: fixed.id }, data: { status: 'HIDDEN' } });
    assert.equal((await read('/products/alpha-cartel')).status, 404);
    assert.equal((await read('/careers')).body.total, 0);
    await assert.rejects(pricing.calculate(input), NotFoundException);
    await ctx.prisma.product.update({ where: { id: fixed.id }, data: { status: 'PUBLISHED' } });
    await ctx.prisma.productVariant.update({ where: { id: fixed.variants[0].id }, data: { active: false } });
    await assert.rejects(pricing.calculate(input), BadRequestException);
    assert.deepEqual((await read('/products/alpha-cartel')).body.variants.map((item: any) => item.key), ['grande']);
  });
});
