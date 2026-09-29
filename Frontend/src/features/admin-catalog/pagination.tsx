import Link from 'next/link';
export function Pagination({ path, query, page, total, limit }: { path: string; query?: URLSearchParams; page: number; total: number; limit: number }) {
 const pages = Math.max(1, Math.ceil(total / limit));
 const href = (n: number) => { const q = new URLSearchParams(query); q.set('page', String(n)); return path + '?' + q; };
 return <nav className="catalog-pagination" aria-label="Páginas del listado">{page > 1 && <Link href={href(page-1)}>Anterior</Link>}<span>Página {page} de {pages} · {total} resultados</span>{page < pages && <Link href={href(page+1)}>Siguiente</Link>}</nav>;
}
