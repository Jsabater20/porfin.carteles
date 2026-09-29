import 'server-only';
import { serverApi } from '@/lib/api/server';
import type { PublicPage, Taxonomy } from '@/lib/contracts/catalog';
import { TYPES, STATUSES } from './model';
export async function allTaxonomy(kind: 'categories' | 'careers') {
  const items: Taxonomy[] = [];
  for (let page = 1; ; page++) {
    const result = await serverApi<PublicPage<Taxonomy>>('admin/' + kind, new URLSearchParams({ page: String(page), limit: '100' }));
    items.push(...result.items);
    if (page * result.limit >= result.total || !result.items.length) break;
  }
  return items;
}
export function catalogQuery(params: Record<string, string | string[] | undefined>) {
  const result = new URLSearchParams({ page: '1', limit: '12' });
  const value = (key: string) => typeof params[key] === 'string' ? params[key] as string : '';
  const page = Number(value('page'));
  if (Number.isInteger(page) && page >= 1 && page <= 100000) result.set('page', String(page));
  if (value('q').trim()) result.set('q', value('q').trim().slice(0, 120));
  if (Object.hasOwn(TYPES, value('type'))) result.set('type', value('type'));
  if (Object.hasOwn(STATUSES, value('status'))) result.set('status', value('status'));
  for (const key of ['categoryId', 'careerId']) if (/^c[a-z0-9]{24}$/.test(value(key))) result.set(key, value(key));
  return result;
}
