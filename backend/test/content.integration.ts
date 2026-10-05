import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrationApp } from './support/integration';
import { hashPassword, tokenHash } from '../src/common/utils/credentials';
import { ContentService } from '../src/modules/content/content.service';
import { SettingsService } from '../src/modules/settings/settings.service';

test('Etapa 11: contenido, destacados y configuración pública segura', { timeout: 180000 }, async t => {
  const ctx = await integrationApp(); t.after(ctx.cleanup);
  let cookie = '', csrf = '';
  const req = async (route: string, method = 'GET', body?: unknown, privateRequest = false, extra: Record<string, string> = {}) => {
    const response = await fetch(ctx.url + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-admin', ...(privateRequest ? { Cookie: cookie, 'X-CSRF-Token': csrf } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() as any, response };
  };
  const admin = await ctx.prisma.administrator.create({ data: { name: 'Editor', email: 'content@example.com', passwordHash: await hashPassword('Clave-content-123!'), role: 'ADMIN' } });
  const login = await req('/auth/login', 'POST', { email: admin.email, password: 'Clave-content-123!' }); assert.equal(login.status, 200);
  cookie = login.response.headers.get('set-cookie')!.split(';')[0]; csrf = login.body.csrfToken;
  const patchContent = (body: unknown) => req('/admin/content', 'PATCH', body, true);
  const patchSettings = (body: unknown) => req('/admin/settings', 'PATCH', body, true);
  const product = async (slug: string, status: 'PUBLISHED' | 'HIDDEN' = 'PUBLISHED') => ctx.prisma.product.create({ data: { name: slug, slug, description: 'Prueba', type: 'PREDEFINED', status, variants: { create: { key: 'base', name: 'Base', pricingMode: 'FIXED', priceCents: 100, attributes: {}, position: 0 } } }, include: { variants: true } });
  const a = await product('uno'), b = await product('dos'), hidden = await product('oculto', 'HIDDEN');
  await t.test('Defaults públicos sin secretos; páginas no publicadas y rutas privadas protegidas', async () => {
    const settings = await req('/settings/public'); assert.equal(settings.status, 200); assert.equal(settings.body.whatsappNumber, null); assert.equal(settings.body.whatsappUrl, null);
    assert.equal(await ctx.prisma.storeSettings.count(), 0);
    assert.equal((await req('/content/home')).status, 404); assert.equal((await req('/content/inexistente')).status, 400);
    for (const route of ['/admin/content', '/admin/settings']) {
      assert.equal((await req(route)).status, 401);
      assert.equal((await req(route, 'PATCH', {}, true, { 'X-CSRF-Token': '' })).status, 403);
      assert.equal((await req(route, 'PATCH', {}, true, { Origin: 'https://ajeno.example' })).status, 403);
    }
  });
  await t.test('Borradores, publicación, parches parciales y texto plano', async () => {
    assert.equal((await patchContent({ page: 'home', title: ' Bienvenidos ', body: 'Texto <b>literal</b>', sections: [{ key: 'intro', heading: 'Hola', text: 'Carteles personalizados' }] })).status, 200);
    assert.equal((await req('/content/home')).status, 404);
    assert.equal((await patchContent({ page: 'home', published: true })).status, 200);
    const home = await req('/content/home'); assert.equal(home.body.title, 'Bienvenidos'); assert.equal(home.body.body, 'Texto <b>literal</b>'); assert.equal(home.body.sections.length, 1); assert.equal('updatedAt' in home.body, false);
    assert.equal((await patchContent({ page: 'faq', title: 'Preguntas', published: true })).status, 400);
    assert.equal((await patchContent({ page: 'faq', title: 'Preguntas', published: true, faqItems: [{ key: 'fotos', question: '¿Cómo envío las fotos?', answer: 'Por WhatsApp.' }] })).status, 200);
    assert.equal((await req('/content/faq')).body.faqItems.length, 1);
    for (const page of ['about', 'contact']) { assert.equal((await patchContent({ page, title: page, published: true })).status, 200); assert.equal((await req('/content/' + page)).status, 200); }
    assert.equal((await req('/admin/content', 'GET', undefined, true)).body.pages.length, 4);
  });
  await t.test('Destacados ordenados y visibles; rollback al rechazar una lista inválida', async () => {
    assert.equal((await patchContent({ page: 'home', featuredProductIds: [b.id, a.id] })).status, 200);
    let home = await req('/content/home'); assert.deepEqual(home.body.featuredProducts.map((p: any) => p.id), [b.id, a.id]);
    assert.equal((await patchContent({ page: 'home', title: 'No guardar', featuredProductIds: [hidden.id] })).status, 400);
    assert.equal((await req('/content/home')).body.title, 'Bienvenidos');
    await ctx.prisma.product.update({ where: { id: b.id }, data: { status: 'UNAVAILABLE' } });
    home = await req('/content/home'); assert.deepEqual(home.body.featuredProducts.map((p: any) => p.id), [a.id]);
    assert.equal(JSON.stringify(home.body).includes('assetId'), false);
    await ctx.prisma.productVariant.update({ where: { id: a.variants[0].id }, data: { active: false } });
    assert.deepEqual((await req('/content/home')).body.featuredProducts, []);
    assert.equal((await patchContent({ page: 'home', featuredProductIds: [] })).status, 200);
    assert.equal((await patchContent({ page: 'home', published: false })).status, 200); assert.equal((await req('/content/home')).status, 404);
  });
  await t.test('Configuración de contacto, entrega y plazos; enlaces seguros y secretos rechazados', async () => {
    const patch = { storeName: 'Por fin Carteles', whatsappNumber: '5491199999999', contactEmail: 'contacto@example.com', instagramUrl: 'https://www.instagram.com/porfin', deliveryMethods: ['PICKUP', 'SHIPPING'], pickupAddress: 'Dirección a confirmar', leadTimeText: 'Consultar plazo', businessHours: 'Lunes a viernes' };
    assert.equal((await patchSettings(patch)).status, 200);
    assert.equal((await patchSettings({ description: 'Carteles y combos' })).status, 200);
    const publicSettings = (await req('/settings/public')).body; assert.equal(publicSettings.whatsappUrl, 'https://wa.me/5491199999999'); assert.equal(publicSettings.leadTimeText, patch.leadTimeText);
    assert.equal('id' in publicSettings, false); assert.equal('updatedAt' in publicSettings, false);
    for (const bad of [{ whatsappNumber: '+5491199999999' }, { instagramUrl: 'javascript:alert(1)' }, { instagramUrl: 'https://user:pass@example.com' }, { instagramUrl: 'http://example.com' }, { storeName: null }, { description: '\u0000' }, { deliveryMethods: ['PICKUP', 'PICKUP'] }, { deliveryMethods: ['OTHER'] }, { SMTP_PASSWORD: 'secret' }, {}]) assert.equal((await patchSettings(bad)).status, 400, JSON.stringify(bad));
    assert.equal((await patchSettings({ whatsappNumber: null, instagramUrl: null })).status, 200); assert.equal((await req('/settings/public')).body.whatsappUrl, null);
  });
  await t.test('Validaciones profundas y revocación de sesión dentro de la escritura', async () => {
    for (const bad of [{ page: 'home' }, { page: 'home', title: null }, { page: 'home', body: '\u0000' }, { page: 'home', featuredProductIds: [a.id, a.id] }, { page: 'about', featuredProductIds: [] }, { page: 'home', sections: [null] }, { page: 'home', sections: [{ key: 'x', heading: 'X', text: 'Y', injected: true }] }]) assert.equal((await patchContent(bad)).status, 400, JSON.stringify(bad));
    const session = await ctx.prisma.adminSession.findUniqueOrThrow({ where: { tokenHash: tokenHash(cookie.split('=')[1]) } });
    await ctx.prisma.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await assert.rejects(ctx.app.get(ContentService).update({ page: 'home', title: 'No autorizado' }, session.id), (error: any) => error.getStatus() === 403);
    await assert.rejects(ctx.app.get(SettingsService).update({ storeName: 'No autorizado' }, session.id), (error: any) => error.getStatus() === 403);
    assert.equal((await patchSettings({ storeName: 'No autorizado' })).status, 401);
    const docs = await req('/docs-json'); for (const route of ['/content/{page}', '/settings/public', '/admin/content', '/admin/settings', '/admin/orders/{id}/quotes/{quoteId}/status', '/admin/payments']) assert.ok(docs.body.paths['/api/v1' + route]);
  });
});
