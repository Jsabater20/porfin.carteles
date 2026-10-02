'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import type { Taxonomy } from '@/lib/contracts/catalog';
import { useAdmin } from '@/features/auth/admin-provider';
import { ApiError } from '@/lib/api/errors';
import { Field, Confirm, useEditorReady } from './controls';
import { slugify } from './model';
export function TaxonomyEditor({ kind, items }: { kind: 'categories' | 'careers'; items: Taxonomy[] }) {
  const ready = useEditorReady();
  const { manager } = useAdmin(), router = useRouter(), lock = useRef(false);
  const [editing, setEditing] = useState<string | null>(null), [name, setName] = useState(''), [slug, setSlug] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function act(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage('');
    try { await action(); router.refresh(); } catch (error) { setMessage(error instanceof ApiError ? error.message : 'No pudimos confirmar el cambio. Recargá antes de repetirlo.'); } finally { lock.current = false; setBusy(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || [...name.trim()].length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) { setMessage('Completá un nombre y una dirección válida de hasta 120 caracteres, sin espacios ni acentos.'); return; }
    if (kind === 'categories' && ['carteles', 'props', 'combos'].includes(slug)) { setMessage('Carteles, props y combos se eligen en la categoría del producto. Acá creá una ocasión, como Recibida o Baby Shower.'); return; }
    void act(async () => { await manager.request('admin/' + kind + (editing ? '/' + editing : ''), { method: editing ? 'PATCH' : 'POST', body: { name: name.trim(), slug } }); setEditing(null); setName(''); setSlug(''); setMessage('Cambios guardados.'); });
  }
  return <><h1>{kind === 'categories' ? 'Ocasiones' : 'Carreras'}</h1>
    <form onSubmit={save} method="post" className="taxonomy-form" noValidate><fieldset className="editor-fields" disabled={busy || !ready}><legend>{editing ? 'Editar' : 'Agregar'} {kind === 'categories' ? 'ocasión' : 'carrera'}</legend><div className="editor-grid"><Field id="taxonomy-name" label="Nombre" value={name} onChange={setName} /><Field id="taxonomy-slug" label="Dirección (slug)" value={slug} onChange={setSlug} /></div><div className="actions"><button type="button" className="text-button" onClick={() => setSlug(slugify(name).slice(0, 120).replace(/-$/, ''))}>Generar dirección</button><button className="button" type="submit">{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar'}</button>{editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setName(''); setSlug(''); }}>Cancelar edición</button>}</div></fieldset></form>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><caption>{kind === 'categories' ? 'Ocasiones' : 'Carreras'} de esta página</caption><thead><tr><th>Nombre</th><th>Dirección</th><th>Acciones</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.slug}</td><td><button type="button" className="text-button" disabled={busy} onClick={() => { setEditing(item.id); setName(item.name); setSlug(item.slug); document.getElementById('taxonomy-name')?.focus(); }}>Editar {item.name}</button><Confirm label={'Eliminar ' + item.name} question={'¿Eliminar ' + item.name + '? Si está en uso, se conservará.'} disabled={busy} onConfirm={() => act(async () => { await manager.request('admin/' + kind + '/' + item.id, { method: 'DELETE', body: {} }); if (editing === item.id) { setEditing(null); setName(''); setSlug(''); } setMessage('Elemento eliminado.'); })} /></td></tr>)}</tbody></table></div>
    {!items.length && <p className="notice">Todavía no hay elementos en esta página.</p>}
  </>;
}
