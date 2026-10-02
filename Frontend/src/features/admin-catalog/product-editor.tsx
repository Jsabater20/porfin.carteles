'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAdmin } from '@/features/auth/admin-provider';
import { ApiError } from '@/lib/api/errors';
import type { AdminProduct, ProductInput } from '@/lib/contracts/admin-catalog';
import type { Taxonomy } from '@/lib/contracts/catalog';
import { buildProduct, changedProduct, draftProduct, productInput, sameValue, slugify, KINDS, SIGN_TYPES, STATUSES, isOccasion, supportsOccasions, supportsCareers, changeClassification } from './model';
import { Field, Section, Confirm, useEditorReady } from './controls';
import { CollectionsEditor } from './product-parts';

export function ProductEditor({ product, categories, careers }: { product?: AdminProduct; categories: Taxonomy[]; careers: Taxonomy[] }) {
  const ready = useEditorReady();
  const { manager, loggingOut } = useAdmin(); const router = useRouter();
  const [draft, setDraft] = useState(() => draftProduct(product));
  const [baseline, setBaseline] = useState(() => product ? productInput(product) : null);
  const [savedDraft, setSavedDraft] = useState(() => JSON.stringify(draftProduct(product)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState('');
  const lock = useRef(false), alert = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft) !== savedDraft;
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const leave = (event: MouseEvent) => { const a = (event.target as HTMLElement).closest('a'); if (a && a.target !== '_blank' && a.pathname !== window.location.pathname && !window.confirm('Tenés cambios sin guardar. ¿Querés salir?')) event.preventDefault(); };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', leave, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', leave, true); };
  }, [dirty]);
  const run = async (action: () => Promise<void>) => {
    if (lock.current || loggingOut) return; lock.current = true; setBusy(true); setMessage(''); setSuccess('');
    try { await action(); } catch (error) { setMessage(error instanceof ApiError ? error.message : 'No pudimos confirmar el cambio. Consultá el catálogo antes de repetirlo.'); requestAnimationFrame(() => alert.current?.focus()); }
    finally { lock.current = false; setBusy(false); }
  };
  function adopt(saved: AdminProduct) { setBaseline(productInput(saved)); const next = draftProduct(saved); setDraft(next); setSavedDraft(JSON.stringify(next)); setErrors({}); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildProduct(draft, product?.id);
    setErrors(result.errors);
    if (Object.keys(result.errors).length) { requestAnimationFrame(() => { const invalid = document.querySelector<HTMLElement>('.product-editor [aria-invalid="true"]'); (invalid ?? alert.current)?.focus(); }); return; }
    await run(async () => {
      if (product && baseline) {
        const patch = changedProduct(baseline, result.input);
        if (!Object.keys(patch).length) { setSuccess('No hay cambios para guardar.'); return; }
        const current = productInput(await manager.request<AdminProduct>('admin/products/' + product.id));
        if (Object.keys(patch).some((key) => !sameValue(current[key as keyof ProductInput], baseline[key as keyof ProductInput]))) throw new ApiError(409, 'Este producto cambió desde que lo abriste. Recargá sus datos antes de guardar.');
        const saved = await manager.request<AdminProduct>('admin/products/' + product.id, { method: 'PATCH', body: patch });
        adopt(saved); setSuccess('Cambios guardados.');
      } else {
        const saved = await manager.request<AdminProduct>('admin/products', { method: 'POST', body: { ...result.input, status: 'HIDDEN' } });
        setSavedDraft(JSON.stringify(draft)); router.replace('/admin/productos/' + saved.id); router.refresh();
      }
    });
  }
  function classify(category: NonNullable<typeof draft.category>, type = draft.type) {
    if (category !== 'COMBO' && draft.components.length && !window.confirm('Al dejar de ser combo se quitarán sus componentes y las asociaciones de los campos. Las variantes se conservan. ¿Continuar?')) return;
    setDraft(changeClassification(draft, category, type));
  }
  const field = (key: 'name' | 'slug' | 'description' | 'measurements' | 'materials' | 'includes' | 'leadTime', label: string, multiline = false) => <Field id={'product-' + key} label={label} value={draft[key]} onChange={(value) => setDraft({ ...draft, [key]: value })} error={errors[key]} multiline={multiline} />;
  if (product?.consolidatedInto?.length) return <section className="editor-section"><h1>{product.name}</h1><p>Este producto está archivado. Sus variantes se administran en los siguientes productos:</p><ul>{product.consolidatedInto.map(item => <li key={item.id}><Link href={'/admin/productos/' + item.id}>{item.name}</Link></li>)}</ul><Link href="/admin/productos">Volver al listado</Link></section>;
  return <div className="product-editor">
    <header className="editor-heading"><div><p className="eyebrow">Catálogo</p><h1>{product ? 'Editar producto' : 'Nuevo producto'}</h1></div><Link className="text-link" href="/admin/productos">Volver al listado</Link></header>
    <div ref={alert} tabIndex={-1}>{message && <p role="alert" className="notice">{message}</p>}{Object.keys(errors).length > 0 && <div role="alert" className="notice"><strong>Revisá los datos señalados.</strong><ul>{Object.entries(errors).map(([key, text]) => <li key={key}>{text}</li>)}</ul></div>}</div>
    {success && <p className="notice success-notice" role="status">{success}</p>}
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className="editor-fields" disabled={busy || loggingOut || !ready}>
        <Section title="Información del producto">
          <div className="editor-grid">{field('name', 'Nombre *')}{field('slug', 'Dirección del producto (slug) *')}</div>
          <button type="button" className="text-button" onClick={() => setDraft({ ...draft, slug: slugify(draft.name).slice(0, 150).replace(/-$/, '') })}>Generar dirección desde el nombre</button>
          {field('description', 'Descripción *', true)}
          <div className="editor-grid"><div className="custom-field"><label htmlFor="product-category">Categoría</label><select id="product-category" value={draft.category} onChange={e => classify(e.target.value as NonNullable<typeof draft.category>)}>{Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            {draft.category === 'CARTEL' && <div className="custom-field"><label htmlFor="product-type">Tipo de cartel</label><select id="product-type" value={draft.type} onChange={e => classify('CARTEL', e.target.value as typeof draft.type)}>{Object.entries(SIGN_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>}
            {product ? <div className="custom-field"><label htmlFor="product-status">Visibilidad</label><select id="product-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as typeof draft.status })}>{Object.entries(STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div> : <p className="notice">El producto se creará oculto. Después podrás agregar imágenes y publicarlo.</p>}
          </div>
          <div className="editor-grid">{field('measurements', 'Medidas')}{field('materials', 'Materiales')}{field('includes', 'Qué incluye', true)}{field('leadTime', 'Tiempo de preparación')}</div>
        </Section>
        {(supportsOccasions(draft) || supportsCareers(draft)) && <Section title="Ocasiones y carreras"><div className="editor-grid">{(['occasionIds', 'careerIds'] as const).filter(key => key === 'occasionIds' ? supportsOccasions(draft) : supportsCareers(draft)).map(key => <fieldset className="taxonomy-choices" key={key}><legend>{key === 'occasionIds' ? 'Ocasiones (opcional)' : 'Carreras (opcional)'}</legend>{(key === 'occasionIds' ? categories.filter(isOccasion) : careers).map(item => <label key={item.id}><input type="checkbox" checked={(draft[key] ?? []).includes(item.id)} onChange={e => setDraft({ ...draft, [key]: e.target.checked ? [...(draft[key] ?? []), item.id] : (draft[key] ?? []).filter(id => id !== item.id) })} />{item.name}</label>)}{errors[key] && <p className="field-error">{errors[key]}</p>}</fieldset>)}</div><Link href="/admin/categorias" className="text-link">Administrar ocasiones</Link></Section>}
        <CollectionsEditor draft={draft} setDraft={setDraft} errors={errors} productId={product?.id} />
        <div className="editor-save"><button type="submit" className="button">{busy ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto oculto'}</button><span className="muted">{dirty ? 'Hay cambios sin guardar.' : 'Sin cambios pendientes.'}</span></div>
      </fieldset>
    </form>
    {product && <section className="editor-section actions">
      <Confirm label="Recargar datos" question="¿Descartar los cambios locales y cargar el producto actual?" disabled={busy} onConfirm={() => run(async () => { adopt(await manager.request<AdminProduct>('admin/products/' + product.id)); setSuccess('Datos actualizados.'); })} />
      <Link className="text-link" href={'/admin/productos/' + product.id + '/imagenes'}>Administrar imágenes</Link>
      {baseline?.status === 'PUBLISHED' && <Link className="text-link" href={'/productos/' + baseline.slug} target="_blank">Ver en la tienda</Link>}
      <Confirm label="Eliminar producto" question="¿Eliminar este producto definitivamente? Debe estar oculto y sin imágenes ni referencias desde combos." disabled={busy || baseline?.status !== 'HIDDEN'} onConfirm={() => run(async () => { await manager.request('admin/products/' + product.id, { method: 'DELETE', body: {} }); setSavedDraft(JSON.stringify(draft)); router.replace('/admin/productos'); router.refresh(); })} />
    </section>}
  </div>;
}
