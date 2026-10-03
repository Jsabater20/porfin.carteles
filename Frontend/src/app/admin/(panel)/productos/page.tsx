import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdminSession } from '@/features/auth/session';
import { serverApi } from '@/lib/api/server';
import type { AdminProduct } from '@/lib/contracts/admin-catalog';
import type { PublicPage } from '@/lib/contracts/catalog';
import { allTaxonomy, catalogQuery } from '@/features/admin-catalog/queries';
import { Pagination } from '@/features/admin-catalog/pagination';
import { AdminCatalogFilters } from '@/features/admin-catalog/catalog-filters';
import { TYPES, STATUSES, KINDS, productKind, isOccasion } from '@/features/admin-catalog/model';
import { ProductImage } from '@/features/catalog/product-image';

const quantity = (amount: number, singular: string, plural: string) => `${amount} ${amount === 1 ? singular : plural}`;

export default async function Products({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
 await requireAdminSession();
 const query = catalogQuery(await searchParams);
 const [result,categories,careers] = await Promise.all([serverApi<PublicPage<AdminProduct>>('admin/products',query),allTaxonomy('categories'),allTaxonomy('careers')]);
 if(result.page > Math.max(1,Math.ceil(result.total/result.limit))) { query.set('page','1'); redirect('/admin/productos?'+query); }
 return <><header className="editor-heading"><h1>Productos</h1><Link className="button" href="/admin/productos/nuevo">Nuevo producto</Link></header>
 <AdminCatalogFilters query={query.toString()} occasions={categories.filter(isOccasion)} careers={careers} />
 {!result.items.length ? <p className="notice">No hay productos para estos filtros.</p> : <div className="admin-product-grid">{result.items.map(product => {
   const kind = productKind(product);
   const coverImage = product.images.find(image => image.cover) ?? product.images[0] ?? null;
   const editHref = '/admin/productos/' + product.id;
   return <article className="admin-product-card" key={product.id}>
     <Link className="admin-product-card-media" href={editHref} aria-label={`Editar ${product.name}`}>
       <ProductImage image={coverImage} name={product.name} referenceSlug={product.slug} sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 28vw" />
       <span className="admin-product-status" data-status={product.status}>{STATUSES[product.status]}</span>
     </Link>
     <div className="admin-product-card-copy">
       <p className="eyebrow">{KINDS[kind]}{kind === 'CARTEL' ? ' · ' + TYPES[product.type] : ''}</p>
       <h2><Link href={editHref}>{product.name}</Link></h2>
       <p className="admin-product-card-meta">{quantity(product.variants.length, 'variante', 'variantes')} · {quantity(product.images.length, 'imagen', 'imágenes')}</p>
       <nav className="admin-product-card-actions" aria-label={`Administrar ${product.name}`}>
         <Link href={editHref}>Editar ficha <span aria-hidden="true">→</span></Link>
         <Link href={editHref + '/imagenes'}>Imágenes <span aria-hidden="true">→</span></Link>
       </nav>
     </div>
   </article>;
 })}</div>}
 <Pagination path="/admin/productos" query={query} {...result}/></>;
}
