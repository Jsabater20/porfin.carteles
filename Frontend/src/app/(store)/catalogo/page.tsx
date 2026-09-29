import type { Metadata } from 'next';
import {publicMetadata} from '@/lib/seo';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { EmptyState } from '@/components/ui/empty-state';
import { RetryButton } from '@/components/ui/retry-button';
import { FilterForm } from '@/features/catalog/filter-form';
import { catalogHref, filterParams, parseFilters, type SearchValues } from '@/features/catalog/filters';
import { getProducts, getTaxonomy } from '@/features/catalog/queries';
import { ProductCard } from '@/features/catalog/product-card';
import { Pagination } from '@/features/catalog/pagination';

export async function generateMetadata({searchParams}:{searchParams:Promise<SearchValues>}):Promise<Metadata> {
 const filters=parseFilters(await searchParams),filtered=Boolean(filters.q||filters.type||filters.categoryId||filters.careerId||filters.sort!=='newest');
 return publicMetadata('Catálogo','Explorá carteles y combos por ocasión, carrera y tipo de producto.',catalogHref(filters),!filtered);
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const filters = parseFilters(await searchParams);
  const [productsResult, categoriesResult, careersResult] = await Promise.allSettled([
    getProducts(filters), getTaxonomy('categories'), getTaxonomy('careers'),
  ]);
  if (productsResult.status === 'rejected') {
    if (!(productsResult.reason instanceof ApiError)) throw productsResult.reason;
    return <div className="container"><EmptyState title="No pudimos cargar el catálogo" action={<RetryButton />}>
      <p>{productsResult.reason.status === 429 ? 'Recibimos muchas consultas. Esperá un momento antes de volver a intentar.' : 'Intentá nuevamente en unos minutos.'}</p>
    </EmptyState></div>;
  }
  const products = productsResult.value;
  const lastPage = Math.max(1, Math.ceil(products.total / products.limit));
  if (filters.page > lastPage) redirect(catalogHref({ ...filters, page: lastPage }));
  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
  const careers = careersResult.status === 'fulfilled' ? careersResult.value : [];
  const filtering = Boolean(filters.q || filters.type || filters.categoryId || filters.careerId);
  return <div className="container catalog-page">
    <header className="page-heading"><p className="eyebrow">Un detalle para tu momento</p><h1>Carteles y combos</h1><p className="muted">Explorá las propuestas y encontrá la que va con tu celebración.</p></header>
    <FilterForm key={filterParams(filters).toString()} filters={filters} categories={categories} careers={careers} />
    {(categoriesResult.status === 'rejected' || careersResult.status === 'rejected') && <p className="notice" role="status">Algunos filtros no pudieron cargarse. Podés seguir buscando por nombre o tipo de producto.</p>}
    <div className="results-heading"><p>{products.total} {products.total === 1 ? 'producto' : 'productos'}{filters.q && <> para <strong>“{filters.q}”</strong></>}</p><span className="muted">Precios base en ARS</span></div>
    {products.items.length ? <div className="product-grid">{products.items.map((product) => <ProductCard key={product.id} product={product} />)}</div> :
      <section className="catalog-empty" aria-label="Sin resultados"><h2>{filtering ? 'No encontramos productos con esos filtros' : 'Todavía no hay productos publicados'}</h2>
        <p className="muted">{filtering ? 'Probá con otra búsqueda o quitá algunos filtros.' : 'Estamos preparando nuevas propuestas. Volvé a visitarnos pronto.'}</p>
        {filtering && <Link className="button button-secondary" href="/catalogo">Ver todo el catálogo</Link>}
      </section>}
    <Pagination filters={filters} total={products.total} limit={products.limit} />
  </div>;
}
