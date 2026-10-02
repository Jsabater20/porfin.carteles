// Requiere las dependencias de backend/web, un build de web y PostgreSQL.
// Toda escritura vive en el esquema temporal del soporte de integración.
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const loadBackend = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(webRoot, '../backend');
process.chdir(backendRoot);
loadBackend(path.join(backendRoot, 'node_modules/ts-node')).register({ project: path.join(backendRoot, 'tsconfig.json') });
const { integrationApp } = loadBackend(path.join(backendRoot, 'test/support/integration.ts'));

(async () => {
  const origin = 'http://localhost:3102';
  const ctx = await integrationApp({ ALLOWED_ORIGINS: origin });
  let next;
  try {
    const product = await ctx.prisma.product.create({ data: {
      name: 'Producto prueba F4', slug: 'prueba-f4', description: 'Prueba aislada', type: 'PREDEFINED', status: 'PUBLISHED',
      variants: { create: { key: 'base', name: 'Base', pricingMode: 'FIXED', priceCents: 15000, position: 0, attributes: {}, photoCount: 2 } },
      fields: { create: { key: 'nombre', label: 'Nombre', type: 'SHORT_TEXT', required: true, position: 0 } },
    }, include: { variants: true } });
    await ctx.prisma.storeSettings.create({ data: { id: 1, deliveryMethods: ['PICKUP', 'SHIPPING'] } });
    next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3102'], {
      cwd: webRoot, windowsHide: true, stdio: 'ignore',
      env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', BACKEND_API_URL: ctx.url + '/api/v1', WEB_ORIGIN: origin },
    });
    let started = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(origin + '/api/backend/health')).ok) { started = true; break; } } catch {}
      await delay(200);
    }
    assert.ok(started, 'Next no inició en 3102.');
    let cookie = '', csrf = '';
    const req = async (route, method = 'GET', body, key) => {
      const response = await fetch(origin + '/api/backend/' + route, {
        method, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-storefront', Cookie: cookie, 'X-CSRF-Token': csrf, ...(key ? { 'Idempotency-Key': key } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { response, body: await response.json() };
    };
    const guest = await req('guest-session', 'POST', {});
    assert.equal(guest.response.status, 200);
    cookie = guest.response.headers.get('set-cookie').split(';')[0]; csrf = guest.body.csrfToken;
    const previewInput = { deliveryMethod: 'SHIPPING', items: [{ lineId: 'f4', productId: product.id, variantId: product.variants[0].id, quantity: 2, answers: [{ fieldKey: 'nombre', value: 'Prueba aislada' }] }] };
    const preview = await req('orders/preview', 'POST', previewInput, randomUUID());
    assert.equal(preview.response.status, 200);
    const input = { previewId: preview.body.id, customerFirstName: 'Cliente único', customerLastName: 'F4', customerEmail: 'cliente@example.com', customerPhone: '5491123456789',
      requestedDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), deliveryMethod: 'SHIPPING', deliveryAddress: 'Dirección única F4' };
    const key = randomUUID();
    const created = await req('orders', 'POST', input, key);
    assert.equal(created.response.status, 200, JSON.stringify(created.body));
    assert.equal(created.body.knownSubtotalCents, 30000); assert.equal(created.body.whatsapp.url, null);
    // La recuperación idempotente funciona aunque el preview haya vencido después de registrar.
    await ctx.prisma.orderPreview.update({ where: { id: preview.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const retry = await req('orders', 'POST', input, key);
    assert.equal(retry.response.status, 200); assert.equal(retry.body.id, created.body.id);
    assert.equal(await ctx.prisma.order.count(), 1);
    assert.equal((await req('orders', 'POST', { ...input, customerFirstName: 'Distinto' }, key)).response.status, 409);
    const own = await req('orders/' + created.body.id);
    assert.equal(own.response.status, 200);
    assert.equal(own.response.headers.get('cache-control'), 'no-store');
    const receipt = await fetch(origin + '/pedido/' + created.body.id, { headers: { Cookie: cookie } });
    const html = await receipt.text();
    assert.equal(receipt.status, 200); assert.match(html, /Cliente único F4/); assert.match(html, /Dirección única F4/);
    assert.match(html, /noindex/); assert.match(html, /enlace de WhatsApp no está disponible/);
    const other = await fetch(origin + '/api/backend/guest-session', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Requested-With': 'porfin-storefront' }, body: '{}' });
    const privateResponse = await fetch(origin + '/api/backend/orders/' + created.body.id, { headers: { Cookie: other.headers.get('set-cookie').split(';')[0] } });
    assert.equal(privateResponse.status, 404);
    const anonymous = await fetch(origin + '/pedido/' + created.body.id);
    const anonymousHtml = await anonymous.text();
    assert.doesNotMatch(anonymousHtml, /Cliente único F4|Dirección única F4/);
    assert.match(anonymousHtml, /No pudimos acceder/);
    console.log('OK Next → NestJS → PostgreSQL: sesión, CSRF, preview, pedido, reintento tras vencimiento, recibo privado y WhatsApp sin configurar.');
  } finally {
    if (next && next.exitCode === null && next.signalCode === null) { const stopped = once(next, 'exit'); next.kill(); await stopped; }
    await ctx.cleanup();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
