'use client';

import Link from 'next/link';
import { useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Taxonomy } from '@/lib/contracts/catalog';
import { categories, signTypes, hasOccasion, hasCareer, normalizeStoreFilters, storeHref, type StoreFilters } from './store-filters';

export function FilterForm({ filters, occasions, careers }: { filters: StoreFilters; occasions: Taxonomy[]; careers: Taxonomy[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  function apply(change: Partial<StoreFilters> = {}) {
    const data = new FormData(form.current!);
    const next = normalizeStoreFilters({ ...filters, q: String(data.get('q') ?? '').trim(), ...change, page: 1, legacy: undefined });
    startTransition(() => router.push(storeHref(next), { scroll: false }));
  }
  return <form ref={form} action="/catalogo" method="get" className="catalog-filters" aria-label="Filtrar catálogo" aria-busy={pending}
    onSubmit={event => { event.preventDefault(); apply(); }}>
    <fieldset disabled={pending} className="catalog-filter-fields">
      <div className="search-field"><label htmlFor="catalog-search">Buscar</label><input id="catalog-search" name="q" type="search" defaultValue={filters.q} maxLength={120} placeholder="Buscar carteles, props y combos…" /></div>
      <div><label htmlFor="catalog-category">Categoría</label><select id="catalog-category" name="category" value={filters.category} onChange={event => apply({ category: event.target.value as StoreFilters['category'], type: '', occasion: '', career: '' })}>
        <option value="">Todos</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></div>
      {filters.category === 'CARTEL' && <div><label htmlFor="catalog-type">Tipo de cartel</label><select id="catalog-type" name="type" value={filters.type} onChange={event => apply({ type: event.target.value as StoreFilters['type'], career: '' })}>
        <option value="">Todos</option>{Object.entries(signTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></div>}
      {hasOccasion(filters) && <div><label htmlFor="catalog-occasion">Ocasión</label><select id="catalog-occasion" name="occasion" value={filters.occasion} onChange={event => apply({ occasion: event.target.value, career: '' })}>
        <option value="">Todas las ocasiones</option>
        {filters.occasion && !occasions.some(item => item.id === filters.occasion) && <option value={filters.occasion}>Ocasión seleccionada no disponible</option>}
        {occasions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></div>}
      {hasCareer(filters) && <div><label htmlFor="catalog-career">Carrera</label><select id="catalog-career" name="career" value={filters.career} onChange={event => apply({ career: event.target.value })}>
        <option value="">Todas las carreras</option>
        {filters.career && !careers.some(item => item.id === filters.career) && <option value={filters.career}>Carrera seleccionada no disponible</option>}
        {careers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></div>}
      <div className="filter-actions"><button className="button" type="submit">{pending ? 'Buscando…' : 'Aplicar filtros'}</button><Link href="/catalogo" className="text-link">Limpiar</Link></div>
    </fieldset>
  </form>;
}
