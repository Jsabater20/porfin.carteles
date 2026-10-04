import { parseFilters as parseLegacy, filterParams as legacyParams, type CatalogFilters, type SearchValues } from './filters';
import type { Taxonomy } from '../../lib/contracts/catalog';

export const categories = { CARTEL: 'Carteles', PROP: 'Props', COMBO: 'Combos' } as const;
export const signTypes = { GENERIC: 'Genérico', PREDEFINED: 'Predeterminado', PREDEFINED_THREE_IMAGES: 'Predeterminado con 3 imágenes a elección', CUSTOM: 'Personalizado' } as const;
export const shapes = { RECTANGULAR: 'Rectangular', CIRCULAR: 'Circular', XXL: 'XXL' } as const;
export interface StoreFilters {
  q: string; category: keyof typeof categories | ''; type: keyof typeof signTypes | '';
  shape: keyof typeof shapes | ''; occasion: string; career: string; page: number; legacy?: CatalogFilters;
}
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';
const clean = (value: string, max: number) => value.toWellFormed().replace(/\u0000/g, '').trim().slice(0, max).toWellFormed();
export const hasOccasion = (f: StoreFilters) => f.category === 'CARTEL' && (f.type === 'GENERIC' || f.type === 'PREDEFINED' || f.type === 'PREDEFINED_THREE_IMAGES');
export const hasCareer = (f: StoreFilters) => f.category === 'CARTEL' && (f.type === 'PREDEFINED' || f.type === 'PREDEFINED_THREE_IMAGES');

export function normalizeStoreFilters(filters: StoreFilters): StoreFilters {
  const next = { ...filters };
  if (next.category !== 'CARTEL') { next.type = ''; next.shape = ''; }
  if (!hasOccasion(next)) next.occasion = '';
  if (!hasCareer(next)) next.career = '';
  if (next.type !== filters.type || next.shape !== filters.shape || next.occasion !== filters.occasion || next.career !== filters.career) next.page = 1;
  return next;
}
export function parseStoreFilters(values: SearchValues, taxonomy: Taxonomy[] = []): StoreFilters {
  const category = first(values.category), type = first(values.type), shape = first(values.shape), page = Number(first(values.page));
  const filters: StoreFilters = {
    q: clean(first(values.q), 120), category: Object.hasOwn(categories, category) ? category as StoreFilters['category'] : '',
    type: Object.hasOwn(signTypes, type) ? type as StoreFilters['type'] : '',
    shape: Object.hasOwn(shapes, shape) ? shape as StoreFilters['shape'] : '',
    occasion: clean(first(values.occasion), 100), career: clean(first(values.career), 100),
    page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1,
  };
  // Legacy links keep their exact API semantics until the visitor changes a filter.
  if (values.category === undefined && values.shape === undefined && values.occasion === undefined && values.career === undefined && (values.type !== undefined || values.categoryId !== undefined || values.careerId !== undefined || values.sort !== undefined)) {
    const legacy = parseLegacy(values);
    const slug = taxonomy.find(item => item.id === legacy.categoryId)?.slug;
    filters.category = slug === 'props' ? 'PROP' : slug === 'combos' || legacy.type === 'COMBO' ? 'COMBO' : slug === 'carteles' || filters.type ? 'CARTEL' : '';
    filters.occasion = taxonomy.some(item => item.id === legacy.categoryId && !['props', 'combos', 'carteles'].includes(item.slug)) ? legacy.categoryId : '';
    filters.career = legacy.careerId;
    return { ...normalizeStoreFilters(filters), page: legacy.page, legacy };
  }
  return normalizeStoreFilters(filters);
}
export function storeParams(filters: StoreFilters): URLSearchParams {
  if (filters.legacy) return legacyParams({ ...filters.legacy, page: filters.page });
  const params = new URLSearchParams();
  const cleaned = normalizeStoreFilters(filters);
  for (const key of ['q', 'category', 'type', 'shape', 'occasion', 'career'] as const) if (cleaned[key]) params.set(key, cleaned[key]);
  if (cleaned.page > 1) params.set('page', String(cleaned.page));
  return params;
}
export function storeHref(filters: StoreFilters) {
  const query = storeParams(filters).toString();
  return '/catalogo' + (query ? '?' + query : '');
}
