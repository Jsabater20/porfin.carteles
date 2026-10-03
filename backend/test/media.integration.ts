import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { integrationApp } from './support/integration';
import { hashPassword } from '../src/common/utils/credentials';
import { CloudinaryAsset, CloudinaryService } from '../src/modules/media/cloudinary.service';
import { MediaCleanupService } from '../src/modules/media/media-cleanup.service';
import { MEDIA_MAX_BYTES } from '../src/modules/media/media.constants';

test('Etapa 4: imágenes con PostgreSQL real y proveedor simulado', { timeout: 120000 }, async t => {
  const ctx = await integrationApp({ CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret-only', CLOUDINARY_UPLOAD_PRESET: 'porfin_test' });
  t.after(ctx.cleanup);
  const cloud = ctx.app.get(CloudinaryService);
  const cleaner = ctx.app.get(MediaCleanupService);
  const assets = new Map<string, CloudinaryAsset>();
  const removed: string[] = [];
  let failInspect = false, failDelete = false;
  t.mock.method(cloud, 'validatePreset', async () => {});
  t.mock.method(cloud, 'inspect', async (id: string) => {
    if (failInspect) throw new ServiceUnavailableException('Proveedor no disponible');
    if (!assets.has(id)) throw new ConflictException('Carga no disponible');
    return assets.get(id)!;
  });
  t.mock.method(cloud, 'destroy', async (id: string) => {
    if (failDelete) throw new Error('Falla simulada');
    removed.push(id); assets.delete(id);
  });
  const password = 'Clave-imagenes-segura-123';
  const admin = await ctx.prisma.administrator.create({ data: { name: 'Admin imágenes', email: 'media@example.com', passwordHash: await hashPassword(password), role: 'ADMIN' } });
  let cookie = '', csrf = '';
  const call = async (route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(ctx.url + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-admin', Cookie: cookie, 'X-CSRF-Token': csrf, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, response, body: response.status === 204 ? null : await response.json() as any };
  };
  const login = await call('/auth/login', 'POST', { email: admin.email, password });
  assert.equal(login.status, 200);
  cookie = login.response.headers.get('set-cookie')!.split(';')[0]; csrf = login.body.csrfToken;
  const category = await ctx.prisma.category.create({ data: { name: 'Imágenes', slug: 'imagenes' } });
  const createProduct = async (slug: string) => {
    const result = await call('/admin/products', 'POST', { name: slug, slug, description: 'Prueba de galería', type: 'GENERIC', categoryIds: [category.id], variants: [{ key: 'base', name: 'Base', pricingMode: 'FIXED', priceCents: 100 }] });
    assert.equal(result.status, 201, JSON.stringify(result.body)); return result.body.id as string;
  };
  const productId = await createProduct('galeria');
  const otherId = await createProduct('otra-galeria');
  const gallery = '/admin/products/' + productId + '/images';
  const authorize = async (id = productId) => {
    const result = await call('/admin/media/upload-signature', 'POST', { productId: id });
    assert.equal(result.status, 201, JSON.stringify(result.body)); return result.body;
  };
  const simulateUpload = (signed: any, overrides: Partial<CloudinaryAsset> = {}) => {
    const asset = { asset_id: randomUUID(), public_id: signed.params.public_id, resource_type: 'image', type: 'upload', format: 'jpg', bytes: 15000, width: 800, height: 600, secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/' + signed.params.public_id + '.jpg', ...overrides };
    assets.set(signed.params.public_id, asset); return asset;
  };
  const complete = (signed: any) => call('/admin/media/complete', 'POST', { uploadId: signed.uploadId, altText: ' Cartel de prueba ' });
  const due = (id: string) => ctx.prisma.mediaUpload.update({ where: { id }, data: { expiresAt: new Date(0), cleanupAfter: new Date(0) } });

  await t.test('Sesión, CSRF, origen y DTOs protegen la autorización', async () => {
    assert.equal((await call('/admin/media/upload-signature', 'POST', { productId }, { Cookie: '' })).status, 401);
    assert.equal((await call('/admin/media/upload-signature', 'POST', { productId }, { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await call('/admin/media/upload-signature', 'POST', { productId }, { Origin: 'https://otro.example' })).status, 403);
    assert.equal((await call('/admin/media/upload-signature', 'POST', { productId, publicId: 'asset-ajeno' })).status, 400);
    assert.equal((await call('/admin/media/upload-signature', 'POST', { productId: 'missing' })).status, 404);
    assert.equal((await call(gallery, 'GET', undefined, { Cookie: '' })).status, 401);
    const docs = await call('/docs-json');
    assert.ok(docs.body.paths['/api/v1/admin/media/upload-signature']);
  });

  let first: any, second: any, firstUpload: any;
  await t.test('Verificación remota y confirmaciones simultáneas crean una sola imagen', async () => {
    firstUpload = await authorize();
    assert.equal(firstUpload.params.overwrite, false);
    assert.equal(JSON.stringify(firstUpload).includes('test-secret-only'), false);
    assert.equal((await complete(firstUpload)).status, 409);
    simulateUpload(firstUpload);
    failInspect = true;
    assert.equal((await complete(firstUpload)).status, 503);
    failInspect = false;
    const results = await Promise.all([complete(firstUpload), complete(firstUpload)]);
    assert.deepEqual(results.map(result => result.status), [200, 200]);
    assert.equal(results[0].body.id, results[1].body.id);
    first = results[0].body;
    assert.equal(first.cover, true); assert.equal(first.altText, 'Cartel de prueba');
    assert.equal(await ctx.prisma.productImage.count({ where: { productId } }), 1);
    const signed = await authorize(); simulateUpload(signed);
    const completed = await complete(signed); assert.equal(completed.status, 200); second = completed.body;
    assert.equal(second.cover, false);
    assert.equal((await call('/admin/products/' + productId)).body.images.length, 2);
    assert.equal((await call('/admin/products/' + productId, 'PATCH', { name: 'Galería actualizada' })).body.images.length, 2);
  });

  await t.test('Orden, portada, texto y referencias cruzadas mantienen coherencia', async () => {
    assert.equal((await call(gallery + '/order', 'PATCH', { imageIds: [first.id, first.id] })).status, 400);
    assert.equal((await call(gallery + '/order', 'PATCH', { imageIds: [first.id] })).status, 409);
    assert.equal((await call(gallery + '/order', 'PATCH', { imageIds: [first.id, 'ajena'] })).status, 409);
    assert.equal((await call('/admin/products/' + otherId + '/images/' + first.id, 'DELETE', {})).status, 404);
    const ordered = await call(gallery + '/order', 'PATCH', { imageIds: [second.id, first.id] });
    assert.equal(ordered.status, 200);
    assert.deepEqual(ordered.body.map((image: any) => [image.id, image.position, image.cover]), [[second.id, 0, true], [first.id, 1, false]]);
    const text = await call(gallery + '/' + first.id, 'PATCH', { altText: 'Nuevo texto' });
    assert.equal(text.body.altText, 'Nuevo texto');
    assert.equal((await call(gallery + '/' + first.id, 'PATCH', { url: 'https://externo.example' })).status, 400);
    await assert.rejects(ctx.prisma.productImage.update({ where: { id: first.id }, data: { cover: true } }));
    assert.equal((await call(gallery + '/' + second.id, 'DELETE', {})).status, 204);
    const remaining = await call(gallery); assert.equal(remaining.body[0].cover, true); assert.equal(remaining.body[0].position, 0);
    await due(firstUpload.uploadId);
    await cleaner.runOnce(); assert.equal(removed.length, 0, 'No borrar mientras la firma siga vigente');
  });

  await t.test('Metadatos inválidos, vencimiento, cancelación y carga ajena se rechazan', async () => {
    for (const override of [{ bytes: MEDIA_MAX_BYTES + 1 }, { format: 'svg' }, { resource_type: 'video' }, { public_id: 'otro' }, { width: 100000, height: 100000 }, { secure_url: 'https://otro.example/imagen.jpg' }]) {
      const signed = await authorize(); simulateUpload(signed, override);
      assert.equal((await complete(signed)).status, 400);
      assert.ok((await ctx.prisma.mediaUpload.findUniqueOrThrow({ where: { id: signed.uploadId } })).cancelledAt);
    }
    const expired = await authorize(); await due(expired.uploadId);
    assert.equal((await complete(expired)).status, 410);
    const foreign = await authorize();
    await ctx.prisma.mediaUpload.update({ where: { id: foreign.uploadId }, data: { administratorId: 'otro-administrador' } });
    assert.equal((await complete(foreign)).status, 404);
    const cancelled = await authorize();
    assert.equal((await call('/admin/media/uploads/' + cancelled.uploadId, 'DELETE', {})).status, 204);
    assert.equal((await complete(cancelled)).status, 409);
    assert.equal((await call('/admin/media/complete', 'POST', { uploadId: firstUpload.uploadId, url: 'https://arbitraria.example' })).status, 400);
  });

  await t.test('Reservas concurrentes respetan el máximo de doce y la cuota por administrador', async () => {
    const limitedId = await createProduct('limite');
    const results = await Promise.all(Array.from({ length: 13 }, () => call('/admin/media/upload-signature', 'POST', { productId: limitedId })));
    assert.equal(results.filter(result => result.status === 201).length, 12);
    assert.equal(results.filter(result => result.status === 409).length, 1);
    await ctx.prisma.mediaUpload.createMany({ data: Array.from({ length: 60 }, () => ({ administratorId: admin.id, cloudName: 'test-cloud', publicId: 'porfin/test/' + randomUUID(), expiresAt: new Date(Date.now() + 1000), cleanupAfter: new Date(Date.now() + 3600000) })) });
    assert.equal((await call('/admin/media/upload-signature', 'POST', { productId })).status, 429);
    await ctx.prisma.mediaUpload.deleteMany({ where: { publicId: { startsWith: 'porfin/test/' } } });
  });

  await t.test('Borrado y abandono sobreviven a fallas, reintentos y eliminación del producto', async () => {
    const abandonedId = await createProduct('abandonado');
    const abandoned = await authorize(abandonedId); simulateUpload(abandoned);
    assert.equal((await call('/admin/products/' + abandonedId, 'DELETE', {})).status, 204);
    assert.equal((await ctx.prisma.mediaUpload.findUniqueOrThrow({ where: { id: abandoned.uploadId } })).productId, null);
    assert.equal((await complete(abandoned)).status, 409);
    assert.equal((await call('/admin/products/' + productId, 'DELETE', {})).status, 204);
    assert.equal(await ctx.prisma.productImage.count({ where: { productId } }), 0);
    assert.ok((await ctx.prisma.mediaUpload.findUniqueOrThrow({ where: { id: firstUpload.uploadId } })).cancelledAt);
    assert.equal((await complete(firstUpload)).status, 409, 'No resucitar una imagen eliminada junto con el producto');
    await due(firstUpload.uploadId); await due(abandoned.uploadId);
    failDelete = true; await cleaner.runOnce();
    const failed = await ctx.prisma.mediaUpload.findUniqueOrThrow({ where: { id: firstUpload.uploadId } });
    assert.equal(failed.cleanedAt, null); assert.equal(failed.cleanupAttempts, 1); assert.ok(failed.cleanupAfter > new Date());
    failDelete = false; await due(firstUpload.uploadId); await due(abandoned.uploadId);
    await Promise.all([cleaner.runOnce(), cleaner.runOnce()]);
    assert.ok((await ctx.prisma.mediaUpload.findUniqueOrThrow({ where: { id: firstUpload.uploadId } })).cleanedAt);
    assert.equal(removed.filter(id => id === firstUpload.params.public_id).length, 1);
    assert.ok(removed.includes(abandoned.params.public_id));
  });

  await t.test('Revocar la sesión durante la verificación impide guardar la imagen', async () => {
    const signed = await authorize(otherId);
    const asset = simulateUpload(signed);
    t.mock.method(cloud, 'inspect', async () => {
      await ctx.prisma.adminSession.updateMany({ where: { administratorId: admin.id }, data: { revokedAt: new Date() } });
      return asset;
    });
    assert.equal((await complete(signed)).status, 403);
    assert.equal(await ctx.prisma.productImage.count({ where: { uploadId: signed.uploadId } }), 0);
  });
});
