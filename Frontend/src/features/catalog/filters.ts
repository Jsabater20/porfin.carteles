import type { ProductType } from '@/lib/contracts/catalog';

export const isProductSlug = (slug: string) => slug.length <= 150 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

export const productTypes: Record<ProductType, string> = {
  GENERIC: 'Genéricos', PREDEFINED: 'Predeterminados', CUSTOM: 'Personalizados', COMBO: 'Combos',
};
export const sorts = { newest: 'Más recientes', 'name-asc': 'Nombre: A a Z', 'name-desc': 'Nombre: Z a A' } as const;
export interface CatalogFilters { q: string; type: ProductType | ''; categoryId: string; careerId: string; sort: keyof typeof sorts; page: number }
export type SearchValues = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';
const clean = (value: string, max: number) => value.toWellFormed().replace(/\u0000/g, '').trim().slice(0, max).toWellFormed();

export function parseFilters(values: SearchValues): CatalogFilters {
  const type = first(values.type);
  const sort = first(values.sort);
  const page = Number(first(values.page));
  return {
    q: clean(first(values.q), 120),
    type: Object.hasOwn(productTypes, type) ? type as ProductType : '',
    categoryId: clean(first(values.categoryId), 100),
    careerId: clean(first(values.careerId), 100),
    sort: Object.hasOwn(sorts, sort) ? sort as CatalogFilters['sort'] : 'newest',
    page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1,
  };
}
export function filterParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const name of ['q', 'type', 'categoryId', 'careerId'] as const) if (filters[name]) params.set(name, filters[name]);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}
export function catalogHref(filters: CatalogFilters): string {
  const query = filterParams(filters).toString();
  return '/catalogo' + (query ? '?' + query : '');
}
