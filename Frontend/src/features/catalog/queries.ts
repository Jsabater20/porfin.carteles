import 'server-only';

import { cache } from 'react';
import { serverApi } from '@/lib/api/server';
import type { ProductCard, ProductDetail, PublicPage, Taxonomy } from '@/lib/contracts/catalog';
import { filterParams, type CatalogFilters } from './filters';

export async function getProducts(filters: CatalogFilters) {
  const query = filterParams(filters);
  query.set('limit', '12');
  return serverApi<PublicPage<ProductCard>>('products', query);
}
export const getProduct = cache((slug: string) => serverApi<ProductDetail>(`products/${slug}`));
export const getTaxonomy = cache(async (kind: 'categories' | 'careers'): Promise<Taxonomy[]> => {
  const items: Taxonomy[] = [];
  for (let page = 1; ; page++) {
    const result = await serverApi<PublicPage<Taxonomy>>(kind, new URLSearchParams({ page: String(page), limit: '50' }));
    items.push(...result.items);
    if (!result.items.length || page * result.limit >= result.total) return items;
  }
});

export async function getCatalogProducts(filters: import('./store-filters').StoreFilters) {
  const { storeParams } = await import('./store-filters');
  const query = storeParams(filters);
  query.set('limit', '12');
  return serverApi<PublicPage<ProductCard>>('products', query);
}
export async function getCatalogTaxonomy(kind: 'occasions' | 'careers', filters: import('./store-filters').StoreFilters): Promise<Taxonomy[]> {
  const params = new URLSearchParams({ category: 'CARTEL', type: filters.type, limit: '50' });
  if (filters.shape) params.set('shape', filters.shape);
  if (kind === 'careers' && filters.occasion) params.set('occasion', filters.occasion);
  const items: Taxonomy[] = [];
  for (let page = 1; ; page++) {
    params.set('page', String(page));
    const result = await serverApi<PublicPage<Taxonomy>>(kind, params);
    items.push(...result.items);
    if (!result.items.length || page * result.limit >= result.total) return items;
  }
}
