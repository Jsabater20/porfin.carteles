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
export default async function Products({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
 await requireAdminSession();
 const query = catalogQuery(await searchParams);
 const [result,categories,careers] = await Promise.all([serverApi<PublicPage<AdminProduct>>('admin/products',query),allTaxonomy('categories'),allTaxonomy('careers')]);
 if(result.page > Math.max(1,Math.ceil(result.total/result.limit))) { query.set('page','1'); redirect('/admin/productos?'+query); }
 return <><header className="editor-heading"><h1>Productos</h1><Link className="button" href="/admin/productos/nuevo">Nuevo producto</Link></header>
 <AdminCatalogFilters query={query.toString()} occasions={categories.filter(isOccasion)} careers={careers} />
 {!result.items.length ? <p className="notice">No hay productos para estos filtros.</p> : <div className="admin-product-list">{result.items.map(p=><article className="panel-card" key={p.id}><div><h2><Link href={'/admin/productos/'+p.id}>{p.name}</Link></h2><p>{KINDS[productKind(p)]}{productKind(p) === 'CARTEL' ? ' · ' + TYPES[p.type] : ''} · {STATUSES[p.status]}</p><p className="muted">{p.variants.length} variantes · {p.images.length} imágenes</p></div><div className="actions"><Link className="text-link" href={'/admin/productos/'+p.id}>Editar</Link><Link className="text-link" href={'/admin/productos/'+p.id+'/imagenes'}>Imágenes</Link></div></article>)}</div>}
 <Pagination path="/admin/productos" query={query} {...result}/></>;
}
