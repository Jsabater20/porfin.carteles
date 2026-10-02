import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/seo';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { EmptyState } from '@/components/ui/empty-state';
import { RetryButton } from '@/components/ui/retry-button';
import { FilterForm } from '@/features/catalog/filter-form';
import type { SearchValues } from '@/features/catalog/filters';
import { parseStoreFilters, storeParams, storeHref, hasOccasion, hasCareer } from '@/features/catalog/store-filters';
import { getCatalogProducts, getCatalogTaxonomy, getTaxonomy } from '@/features/catalog/queries';
import { ProductCard } from '@/features/catalog/product-card';

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchValues> }): Promise<Metadata> {
  const filters = parseStoreFilters(await searchParams);
  const filtered = Boolean(filters.q || filters.category || filters.type || filters.occasion || filters.career || filters.legacy);
  return publicMetadata('Catálogo', 'Explorá carteles, props y combos por categoría, ocasión y carrera.', storeHref(filters), !filtered);
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const values = await searchParams;
  let filters = parseStoreFilters(values);
  if (filters.legacy?.categoryId) {
    // Taxonomy failure must not prevent reading a valid legacy link.
    try { filters = parseStoreFilters(values, await getTaxonomy('categories')); }
    catch (error) { if (!(error instanceof ApiError)) throw error; }
  }
  if (!filters.legacy) {
    const raw = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value !== undefined) raw.set(key, Array.isArray(value) ? value[0] : value);
    raw.sort(); const normalized = storeParams(filters); normalized.sort();
    if (raw.toString() !== normalized.toString()) redirect(storeHref(filters));
  }
  const [productsResult, occasionsResult, careersResult] = await Promise.allSettled([
    getCatalogProducts(filters),
    hasOccasion(filters) ? getCatalogTaxonomy('occasions', filters) : Promise.resolve([]),
    hasCareer(filters) ? getCatalogTaxonomy('careers', filters) : Promise.resolve([]),
  ]);
  const occasions = occasionsResult.status === 'fulfilled' ? occasionsResult.value : [];
  const careers = careersResult.status === 'fulfilled' ? careersResult.value : [];
  if (!filters.legacy) {
    if (filters.occasion && occasionsResult.status === 'fulfilled' && !occasions.some(item => item.id === filters.occasion)) {
      redirect(storeHref({ ...filters, occasion: '', career: '', page: 1 }));
    }
    if (filters.career && careersResult.status === 'fulfilled' && !careers.some(item => item.id === filters.career)) {
      redirect(storeHref({ ...filters, career: '', page: 1 }));
    }
  }
  if (productsResult.status === 'rejected') {
    if (!(productsResult.reason instanceof ApiError)) throw productsResult.reason;
    return <div className="container"><EmptyState title="No pudimos cargar el catálogo" action={<RetryButton />}><p>{productsResult.reason.status === 429 ? 'Recibimos muchas consultas. Esperá un momento antes de volver a intentar.' : 'Intentá nuevamente en unos minutos.'}</p></EmptyState></div>;
  }
  const products = productsResult.value;
  const pages = Math.max(1, Math.ceil(products.total / products.limit));
  if (filters.page > pages) redirect(storeHref({ ...filters, page: pages }));
  const filtering = Boolean(filters.q || filters.category || filters.type || filters.occasion || filters.career || filters.legacy);
  return <div className="container catalog-page">
    <header className="page-heading"><p className="eyebrow">Carteles · Props · Combos</p><h1>Carteles, props y combos</h1><p className="muted">Elegí la propuesta para tu celebración. Personalizamos cada detalle con vos.</p></header>
    {filters.legacy && <p className="notice">Estás viendo la selección de un enlace anterior. Al aplicar filtros se actualizará a las nuevas categorías. <Link href="/catalogo">Ver todo el catálogo</Link></p>}
    <FilterForm key={storeParams(filters).toString()} filters={filters} occasions={occasions} careers={careers} />
    {(occasionsResult.status === 'rejected' || careersResult.status === 'rejected') && <p className="notice" role="status">Algunos filtros no pudieron cargarse. Podés seguir buscando por nombre o categoría.</p>}
    <div className="results-heading"><p role="status">{products.total} {products.total === 1 ? 'producto' : 'productos'}{filters.q && <> para <strong>“{filters.q}”</strong></>}</p><span className="muted">Importes en ARS · Opciones a cotizar</span></div>
    {products.items.length ? <div className="product-grid">{products.items.map(product => <ProductCard key={product.id} product={product} catalogClassification />)}</div> :
      <section className="catalog-empty" aria-label="Sin resultados"><h2>{filtering ? 'No encontramos productos con esos filtros' : 'Todavía no hay productos publicados'}</h2><p className="muted">{filtering ? 'Probá con otra búsqueda o quitá algunos filtros.' : 'Estamos preparando nuevas propuestas. Volvé a visitarnos pronto.'}</p>{filtering && <Link className="button button-secondary" href="/catalogo">Ver todo el catálogo</Link>}</section>}
    {pages > 1 && <nav className="pagination" aria-label="Paginación del catálogo">
      {filters.page > 1 ? <Link className="button button-secondary" href={storeHref({ ...filters, page: filters.page - 1 })} rel="prev">Anterior</Link> : <span />}
      <span>Página {filters.page} de {pages}</span>
      {filters.page < pages ? <Link className="button button-secondary" href={storeHref({ ...filters, page: filters.page + 1 })} rel="next">Siguiente</Link> : <span />}
    </nav>}
  </div>;
}
