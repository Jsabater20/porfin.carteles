import Link from 'next/link';
import { catalogHref, type CatalogFilters } from './filters';

export function Pagination({ filters, total, limit }: { filters: CatalogFilters; total: number; limit: number }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Páginas del catálogo">
    {filters.page > 1 ? <Link className="button button-secondary" href={catalogHref({ ...filters, page: filters.page - 1 })} rel="prev">Anterior</Link> : <span />}
    <span>Página {filters.page} de {pages}</span>
    {filters.page < pages ? <Link className="button button-secondary" href={catalogHref({ ...filters, page: filters.page + 1 })} rel="next">Siguiente</Link> : <span />}
  </nav>;
}
