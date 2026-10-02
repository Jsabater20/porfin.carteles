'use client';
import Link from 'next/link';
import type { Taxonomy } from '@/lib/contracts/catalog';
import { KINDS, SIGN_TYPES, STATUSES } from './model';
export function AdminCatalogFilters({ query, occasions, careers }: { query: string; occasions: Taxonomy[]; careers: Taxonomy[] }) {
  const params = new URLSearchParams(query);
  const category = params.get('category') ?? (params.get('type') === 'COMBO' ? 'COMBO' : params.has('type') ? 'CARTEL' : '');
  const type = params.get('type') ?? '';
  return <form className="admin-filters" action="/admin/productos" key={query}>
    <label>Buscar<input name="q" defaultValue={params.get('q') ?? ''} maxLength={120} /></label>
    <label>Categoría<select name="category" defaultValue={category} onChange={e => { const form = e.currentTarget.form!; for (const name of ['type','categoryId','careerId']) { const child = form.elements.namedItem(name) as HTMLSelectElement | null; if (child) child.value = ''; } form.requestSubmit(); }}><option value="">Todas</option>{Object.entries(KINDS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    {category === 'CARTEL' && <label>Tipo de cartel<select name="type" defaultValue={type} onChange={e => { const form = e.currentTarget.form!; const career = form.elements.namedItem('careerId') as HTMLSelectElement | null; if (career) career.value = ''; form.requestSubmit(); }}><option value="">Todos</option>{Object.entries(SIGN_TYPES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
    <label>Visibilidad<select name="status" defaultValue={params.get('status') ?? ''}><option value="">Todas</option>{Object.entries(STATUSES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    {category === 'CARTEL' && ['GENERIC','PREDEFINED'].includes(type) && <label>Ocasión<select name="categoryId" defaultValue={params.get('categoryId') ?? ''}><option value="">Todas</option>{occasions.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
    {category === 'CARTEL' && type === 'PREDEFINED' && <label>Carrera<select name="careerId" defaultValue={params.get('careerId') ?? ''}><option value="">Todas</option>{careers.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
    <button className="button">Filtrar</button><Link href="/admin/productos" className="text-link">Limpiar</Link>
  </form>;
}
