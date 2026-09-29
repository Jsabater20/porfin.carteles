'use client';
import { useEffect, useState } from 'react';
import { useAdmin } from '@/features/auth/admin-provider';
import type { AdminProduct } from '@/lib/contracts/admin-catalog';
import type { PublicPage } from '@/lib/contracts/catalog';
export function ReferencePicker({ value, selfId, onChange }: { value?: string; selfId?: string; onChange: (id: string | undefined) => void }) {
  const { manager } = useAdmin();
  const [q, setQ] = useState(''), [items, setItems] = useState<AdminProduct[]>([]), [name, setName] = useState('Referencia guardada'), [error, setError] = useState('');
  useEffect(() => { if (!value) return; let current = true; void manager.request<AdminProduct>('admin/products/' + value).then((item) => { if (current) setName(item.name); }).catch(() => { if (current) setName('Producto de referencia no disponible'); }); return () => { current = false; }; }, [value, manager]);
  useEffect(() => {
    if (!q.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void manager.request<PublicPage<AdminProduct>>('admin/products', { query: new URLSearchParams({ q, limit: '10' }), signal: controller.signal })
        .then((result) => { if (!controller.signal.aborted) { setItems(result.items.filter((item) => item.id !== selfId && item.type !== 'COMBO')); setError(''); } })
        .catch(() => { if (!controller.signal.aborted) setError('No pudimos buscar referencias.'); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, manager, selfId]);
  return <div className="reference-picker"><p className="form-note">Producto de referencia (opcional)</p>
    {value ? <p>{name} <button className="text-button" type="button" onClick={() => onChange(undefined)}>Quitar referencia</button></p> : <>
      <input className="reference-search" aria-label="Buscar producto de referencia" placeholder="Buscar por nombre" value={q} onChange={(e) => { setQ(e.target.value); setItems([]); }} />
      {error && <p role="alert">{error}</p>}
      {q.trim() && <ul>{items.map((item) => <li key={item.id}><button type="button" className="text-button" onClick={() => { setName(item.name); onChange(item.id); setQ(''); }}>{item.name}</button></li>)}</ul>}
      <p className="muted form-note">Buscá un producto; los combos no pueden referenciar otros combos. La referencia no suma su precio.</p>
    </>}
  </div>;
}
