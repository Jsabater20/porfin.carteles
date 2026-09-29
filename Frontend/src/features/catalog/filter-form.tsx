import Link from 'next/link';
import type { Taxonomy } from '@/lib/contracts/catalog';
import { productTypes, sorts, type CatalogFilters } from './filters';

export function FilterForm({ filters, categories, careers }: { filters: CatalogFilters; categories: Taxonomy[]; careers: Taxonomy[] }) {
  return (
    <form action="/catalogo" method="get" className="catalog-filters" aria-label="Filtrar catálogo">
      <div className="search-field"><label htmlFor="catalog-search">Buscar</label><input id="catalog-search" name="q" type="search" defaultValue={filters.q} maxLength={120} placeholder="Carteles, combos, celebraciones…" /></div>
      <div><label htmlFor="catalog-category">Ocasión</label><select id="catalog-category" name="categoryId" defaultValue={filters.categoryId}>
        <option value="">Todas las ocasiones</option>
        {filters.categoryId && !categories.some((item) => item.id === filters.categoryId) && <option value={filters.categoryId}>Ocasión seleccionada no disponible</option>}
        {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></div>
      <div><label htmlFor="catalog-career">Carrera</label><select id="catalog-career" name="careerId" defaultValue={filters.careerId}>
        <option value="">Todas las carreras</option>
        {filters.careerId && !careers.some((item) => item.id === filters.careerId) && <option value={filters.careerId}>Carrera seleccionada no disponible</option>}
        {careers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></div>
      <div><label htmlFor="catalog-type">Tipo de producto</label><select id="catalog-type" name="type" defaultValue={filters.type}>
        <option value="">Todos los tipos</option>{Object.entries(productTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></div>
      <div><label htmlFor="catalog-sort">Ordenar por</label><select id="catalog-sort" name="sort" defaultValue={filters.sort}>
        {Object.entries(sorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></div>
      <div className="filter-actions"><button className="button" type="submit">Aplicar filtros</button><Link href="/catalogo" className="text-link">Limpiar</Link></div>
    </form>
  );
}
