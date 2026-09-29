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
