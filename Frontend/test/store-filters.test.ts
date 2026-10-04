import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStoreFilters, normalizeStoreFilters, storeHref, hasOccasion, hasCareer } from '../src/features/catalog/store-filters';

test('filtros nuevos respetan sus padres y limpian página', () => {
  const selected = parseStoreFilters({ category: 'CARTEL', type: 'PREDEFINED', shape: 'CIRCULAR', occasion: 'recibida', career: 'medicina', page: '3' });
  assert.equal(hasOccasion(selected), true); assert.equal(hasCareer(selected), true);
  const prop = normalizeStoreFilters({ ...selected, category: 'PROP' });
  assert.equal(prop.shape, ''); assert.equal(storeHref(prop), '/catalogo?category=PROP');
  const generic = normalizeStoreFilters({ ...selected, type: 'GENERIC' });
  assert.equal(generic.occasion, 'recibida'); assert.equal(generic.career, ''); assert.equal(generic.page, 1);
  assert.equal(storeHref(normalizeStoreFilters({ ...selected, type: 'CUSTOM' })), '/catalogo?category=CARTEL&type=CUSTOM&shape=CIRCULAR');
  assert.equal(storeHref(parseStoreFilters({ category: '', type: 'PREDEFINED', occasion: 'x', page: '8' })), '/catalogo');
  const photos = parseStoreFilters({ category: 'CARTEL', type: 'PREDEFINED_THREE_IMAGES', shape: 'RECTANGULAR', occasion: 'recibida', career: 'arquitectura' });
  assert.equal(hasOccasion(photos), true); assert.equal(hasCareer(photos), true);
  assert.equal(storeHref(photos), '/catalogo?category=CARTEL&type=PREDEFINED_THREE_IMAGES&shape=RECTANGULAR&occasion=recibida&career=arquitectura');
  assert.equal(parseStoreFilters({ category: 'CARTEL', shape: 'INVALID' }).shape, '');
});
test('URLs nuevas omiten sort y conservan filtros en paginación', () => {
  const filters = parseStoreFilters({ category: 'CARTEL', type: 'PREDEFINED', shape: 'XXL', occasion: 'o', career: 'c', q: '  fiesta & más  ', page: '2', sort: 'name-desc' });
  const url = new URL(storeHref(filters), 'http://localhost');
  assert.equal(url.searchParams.get('page'), '2'); assert.equal(url.searchParams.get('occasion'), 'o'); assert.equal(url.searchParams.get('career'), 'c');
  assert.equal(url.searchParams.get('shape'), 'XXL');
  assert.equal(url.searchParams.has('sort'), false); assert.equal(url.searchParams.get('q'), 'fiesta & más');
  assert.equal(parseStoreFilters({ category: 'BAD', type: 'COMBO', page: '-1' }).category, '');
});
test('enlaces anteriores conservan la consulta y muestran la familia correcta', () => {
  const filters = parseStoreFilters({ type: 'CUSTOM', categoryId: 'props-id', sort: 'name-asc', page: '2' }, [{ id: 'props-id', slug: 'props', name: 'Props' }]);
  assert.equal(filters.category, 'PROP'); assert.equal(filters.type, '');
  const url = new URL(storeHref(filters), 'http://localhost');
  assert.equal(url.searchParams.get('type'), 'CUSTOM'); assert.equal(url.searchParams.get('categoryId'), 'props-id'); assert.equal(url.searchParams.get('sort'), 'name-asc');
  assert.equal(storeHref({ ...filters, legacy: undefined, page: 1 }), '/catalogo?category=PROP');
  assert.equal(parseStoreFilters({ type: 'COMBO' }).category, 'COMBO');
});
