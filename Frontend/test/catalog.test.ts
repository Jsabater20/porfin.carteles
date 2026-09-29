import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFilters, catalogHref } from '../src/features/catalog/filters';
import { formatMoney } from '../src/lib/format/money';
import { isCatalogImageUrl } from '../src/features/catalog/image-url';
import { safeContactLink } from '../src/features/content/safe-link';
import { forwardToBackend } from '../src/lib/api/gateway';

test('normaliza filtros compartidos sin propagar valores inválidos al backend', () => {
  const filters = parseFilters({ q: ['  Cartel 🎉  ', 'otro'], type: 'admin', sort: 'price', page: '-3', categoryId: 'cat\u0000one' });
  assert.deepEqual(filters, { q: 'Cartel 🎉', type: '', sort: 'newest', page: 1, categoryId: 'catone', careerId: '' });
  assert.equal(parseFilters({ q: 'x'.repeat(200) }).q.length, 120);
  for (const page of ['Infinity', '1.5', '100001', '0']) assert.equal(parseFilters({ page }).page, 1);
});

test('la paginación conserva búsqueda, ocasión, carrera, tipo y orden', () => {
  const filters = parseFilters({ q: 'medicina & festejo', categoryId: 'cat-1', careerId: 'car-1', type: 'COMBO', sort: 'name-desc', page: '2' });
  const url = new URL(catalogHref(filters), 'http://localhost');
  assert.equal(url.pathname, '/catalogo');
  assert.equal(url.searchParams.get('q'), 'medicina & festejo');
  assert.equal(url.searchParams.get('type'), 'COMBO');
  assert.equal(url.searchParams.get('categoryId'), 'cat-1');
  assert.equal(url.searchParams.get('careerId'), 'car-1');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('sort'), 'name-desc');
});

test('los centavos no pierden decimales ni convierten cero en un importe desconocido', () => {
  assert.match(formatMoney(12345), /123,45/);
  assert.match(formatMoney(0), /0,00/);
  assert.throws(() => formatMoney(1.5));
  assert.throws(() => formatMoney(-1));
});

test('solo acepta imágenes HTTPS de carga Cloudinary, sin destinos arbitrarios', () => {
  assert.equal(isCatalogImageUrl('https://res.cloudinary.com/porfin/image/upload/v1/catalog/cartel.jpg'), true);
  for (const url of ['http://res.cloudinary.com/porfin/image/upload/a.jpg', 'https://res.cloudinary.com.evil.test/a.jpg', 'https://res.cloudinary.com/porfin/image/fetch/https://private.test/a.jpg', 'https://user:secret@res.cloudinary.com/porfin/image/upload/a.jpg', 'https://res.cloudinary.com/porfin/image/upload/a.jpg?redirect=x', 'javascript:alert(1)']) {
    assert.equal(isCatalogImageUrl(url), false);
  }
});

test('contacto no convierte javascript, HTTP ni credenciales en enlaces', () => {
  assert.equal(safeContactLink('https://wa.me/5491112345678'), 'https://wa.me/5491112345678');
  for (const value of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com', null]) assert.equal(safeContactLink(value), undefined);
});

test('el gateway expone consultas de catálogo y contenido sin abrir operaciones fuera de la lista permitida', async () => {
  const config = { backendUrl: 'http://127.0.0.1:3001/api/v1', webOrigin: 'http://localhost:3000' };
  for (const path of ['products', 'products/cartel-de-recibida', 'categories', 'careers', 'content/home', 'content/faq']) {
    let called = false;
    const response = await forwardToBackend(new Request('http://localhost:3000/api/backend/' + path + '?q=fiesta&page=2', { headers: { cookie: 'porfin_session=private' } }), path.split('/'), config, async (url, init) => {
      called = true;
      assert.equal(new URL(String(url)).searchParams.get('page'), '2');
      assert.equal(new Headers(init?.headers).get('cookie'), null);
      return Response.json({});
    });
    assert.equal(called, true);
    assert.equal(response.status, 200);
  }
  for (const path of ['products/../auth/me', 'products/' + 'a'.repeat(151), 'products/cartel/admin', 'content/draft', 'admin/unknown']) {
    const response = await forwardToBackend(new Request('http://localhost:3000'), path.split('/'), config, async () => { throw new Error('No debe consultar.'); });
    assert.equal(response.status, 404);
  }
  const write = await forwardToBackend(new Request('http://localhost:3000', { method: 'POST' }), ['products'], config);
  assert.equal(write.status, 404);
});
