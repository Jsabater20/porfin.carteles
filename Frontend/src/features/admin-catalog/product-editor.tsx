'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAdmin } from '@/features/auth/admin-provider';
import { ApiError } from '@/lib/api/errors';
import type { AdminProduct, ProductInput, UploadAuthorization } from '@/lib/contracts/admin-catalog';
import type { CatalogShape, Taxonomy } from '@/lib/contracts/catalog';
import { buildProduct, changedProduct, draftProduct, productInput, sameValue, slugify, KINDS, SIGN_TYPES, STATUSES, isOccasion, supportsOccasions, supportsCareers, changeClassification } from './model';
import { Field, Section, Confirm, useEditorReady } from './controls';
import { CollectionsEditor } from './product-parts';
import { ImagePicker } from './image-picker';
import { MediaGallery } from './media-gallery';
import { checkImageFile, uploadImage, validateImage } from './upload';

const IMAGE_SHAPES: Record<CatalogShape, string> = { RECTANGULAR: 'Rectangular', CIRCULAR: 'Circular', XXL: 'XXL' };

export function ProductEditor({ product, categories, careers }: { product?: AdminProduct; categories: Taxonomy[]; careers: Taxonomy[] }) {
  const ready = useEditorReady();
  const { manager, loggingOut } = useAdmin(); const router = useRouter();
  const [draft, setDraft] = useState(() => draftProduct(product));
  const [availableCategories, setAvailableCategories] = useState(categories);
  const [availableCareers, setAvailableCareers] = useState(careers);
  const [baseline, setBaseline] = useState(() => product ? productInput(product) : null);
  const [savedDraft, setSavedDraft] = useState(() => JSON.stringify(draftProduct(product)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [photoShape, setPhotoShape] = useState<CatalogShape | null>(null);
  const [progress, setProgress] = useState('');
  const [imageRecovery, setImageRecovery] = useState<{ product: AdminProduct; file: File; authorization: UploadAuthorization | null; shape: CatalogShape | null; alt: string; message: string } | null>(null);
  const lock = useRef(false), alert = useRef<HTMLDivElement>(null);
  const extraDetails = useRef<HTMLDetailsElement>(null);
  const dirty = !imageRecovery && (JSON.stringify(draft) !== savedDraft || Boolean(imageFile));
  const imageShapes = [...new Set(draft.variants.map(variant => variant.attributes.find(attribute => attribute.key === 'formato')?.value.toUpperCase()).filter((value): value is CatalogShape => Boolean(value && Object.hasOwn(IMAGE_SHAPES, value))))];
  const imageShape = draft.category !== 'CARTEL' ? null : imageShapes.length === 1 ? imageShapes[0] : photoShape && imageShapes.includes(photoShape) ? photoShape : null;
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const leave = (event: MouseEvent) => { const a = (event.target as HTMLElement).closest('a'); if (a && a.target !== '_blank' && a.pathname !== window.location.pathname && !window.confirm('Tenés cambios sin guardar. ¿Querés salir?')) event.preventDefault(); };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', leave, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', leave, true); };
  }, [dirty]);
  useEffect(() => {
    if (errors.slug && extraDetails.current) extraDetails.current.open = true;
  }, [errors]);
  const run = async (action: () => Promise<void>) => {
    if (lock.current || loggingOut) return; lock.current = true; setBusy(true); setMessage(''); setSuccess('');
    try { await action(); } catch (error) { setMessage(error instanceof ApiError ? error.message : 'No pudimos confirmar el cambio. Consultá el catálogo antes de repetirlo.'); requestAnimationFrame(() => alert.current?.focus()); }
    finally { lock.current = false; setBusy(false); setProgress(''); }
  };
  function adopt(saved: AdminProduct) { setBaseline(productInput(saved)); const next = draftProduct(saved); setDraft(next); setSavedDraft(JSON.stringify(next)); setErrors({}); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildProduct(draft, product?.id);
    if (!product && imageFile) {
      const imageError = validateImage(imageFile);
      if (imageError) result.errors.image = imageError;
      if (draft.category === 'CARTEL' && !imageShape) result.errors.imageShape = 'Elegí qué forma de cartel muestra la foto.';
    }
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
        if (imageFile) {
          try { await checkImageFile(imageFile); }
          catch (error) { setErrors({ image: error instanceof Error ? error.message : 'Revisá el archivo de la imagen.' }); requestAnimationFrame(() => document.getElementById('product-image-file')?.focus()); return; }
        }
        setProgress('Guardando producto…');
        const saved = await manager.request<AdminProduct>('admin/products', { method: 'POST', body: { ...result.input, status: 'HIDDEN' } });
        if (imageFile) {
          let authorization: UploadAuthorization | null = null;
          const alt = result.input.name;
          try {
            setProgress('Subiendo la foto del producto…');
            authorization = await manager.request<UploadAuthorization>('admin/media/upload-signature', { method: 'POST', body: { productId: saved.id } });
            await uploadImage(authorization, imageFile);
            setProgress('Confirmando la imagen…');
            await manager.request('admin/media/complete', { method: 'POST', body: { uploadId: authorization.uploadId, altText: alt, shape: imageShape } });
          } catch (error) {
            setImageRecovery({ product: saved, file: imageFile, authorization, shape: imageShape, alt, message: error instanceof Error ? error.message : 'No pudimos confirmar la foto.' });
            return;
          }
          setImageFile(null);
        }
        setSavedDraft(JSON.stringify(draft)); router.replace('/admin/productos/' + saved.id); router.refresh();
      }
    });
  }
  function classify(category: NonNullable<typeof draft.category>, type = draft.type) {
    if (category !== 'COMBO' && draft.components.length && !window.confirm('Al dejar de ser combo se quitarán sus componentes. Las variantes se conservan. ¿Continuar?')) return;
    setDraft(changeClassification(draft, category, type));
  }
  function addTaxonomy(key: 'occasionIds' | 'careerIds', item: Taxonomy) {
    if (key === 'occasionIds') setAvailableCategories(current => current.some(entry => entry.id === item.id) ? current : [...current, item].sort((a, b) => a.name.localeCompare(b.name, 'es')));
    else setAvailableCareers(current => current.some(entry => entry.id === item.id) ? current : [...current, item].sort((a, b) => a.name.localeCompare(b.name, 'es')));
    setDraft(current => ({ ...current, [key]: (current[key] ?? []).includes(item.id) ? current[key] : [...(current[key] ?? []), item.id] }));
  }
  const field = (key: 'name' | 'slug' | 'description' | 'measurements' | 'includes', label: string, multiline = false) => <Field id={'product-' + key} label={label} value={draft[key]} onChange={(value) => setDraft(current => ({ ...current, [key]: value, ...(key === 'name' && !product && current.slug === slugify(current.name).slice(0, 150).replace(/-$/, '') ? { slug: slugify(value).slice(0, 150).replace(/-$/, '') } : {}) }))} error={errors[key]} multiline={multiline} />;
  if (imageRecovery) return <div className="product-editor">
    <p className="notice" role="status">El producto «{imageRecovery.product.name}» ya está guardado y sigue oculto. Falta terminar de cargar la foto; podés hacerlo acá sin crear otro producto.</p>
    <p className="field-error" role="alert">{imageRecovery.message}</p>
    <MediaGallery productId={imageRecovery.product.id} name={imageRecovery.product.name} initialImages={imageRecovery.product.images} initialFile={imageRecovery.file} initialPending={imageRecovery.authorization} initialAlt={imageRecovery.alt} initialShape={imageRecovery.shape} onImageSaved={() => { router.replace('/admin/productos/' + imageRecovery.product.id); router.refresh(); }} />
  </div>;
  if (product?.consolidatedInto?.length) return <section className="editor-section"><h1>{product.name}</h1><p>Este producto está archivado. Sus variantes se administran en los siguientes productos:</p><ul>{product.consolidatedInto.map(item => <li key={item.id}><Link href={'/admin/productos/' + item.id}>{item.name}</Link></li>)}</ul><Link href="/admin/productos">Volver al listado</Link></section>;
  return <div className="product-editor">
    <header className="editor-heading"><div><p className="eyebrow">Catálogo</p><h1>{product ? 'Editar producto' : 'Nuevo producto'}</h1></div><Link className="text-link" href="/admin/productos">Volver al listado</Link></header>
    <div ref={alert} tabIndex={-1}>{message && <p role="alert" className="notice">{message}</p>}{Object.keys(errors).length > 0 && <div role="alert" className="notice"><strong>Revisá los datos señalados.</strong><ul>{Object.entries(errors).map(([key, text]) => <li key={key}>{text}</li>)}</ul></div>}</div>
    {success && <p className="notice success-notice" role="status">{success}</p>}
    {progress && <p role="status" className="notice">{progress}</p>}
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className="editor-fields" disabled={busy || loggingOut || !ready}>
        <Section title={product ? 'Información del producto' : 'Contá qué vas a vender'}>
          {field('name', 'Nombre del producto *')}
          {product && <div className="editor-grid">{field('slug', 'Dirección del producto (slug) *')}</div>}
          {product && <button type="button" className="text-button" onClick={() => setDraft({ ...draft, slug: slugify(draft.name).slice(0, 150).replace(/-$/, '') })}>Generar dirección desde el nombre</button>}
          {field('description', 'Descripción *', true)}
          <div className="editor-grid"><div className="custom-field"><label htmlFor="product-category">Categoría</label><select id="product-category" value={draft.category} onChange={e => classify(e.target.value as NonNullable<typeof draft.category>)}>{Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            {draft.category === 'CARTEL' && <div className="custom-field"><label htmlFor="product-type">Tipo de cartel</label><select id="product-type" value={draft.type} onChange={e => classify('CARTEL', e.target.value as typeof draft.type)}>{Object.entries(SIGN_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>}
            {product ? <div className="custom-field"><label htmlFor="product-status">Visibilidad</label><select id="product-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as typeof draft.status })}>{Object.entries(STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div> : <p className="notice">El producto se guardará oculto para que puedas revisarlo antes de publicarlo.</p>}
          </div>
          {product ? <div className="editor-grid">{field('measurements', 'Medidas')}{field('includes', 'Qué incluye', true)}</div> : <details className="editor-optional" ref={extraDetails}><summary>Más información (opcional)</summary><div className="editor-grid">{field('measurements', 'Medidas')}{field('includes', 'Qué incluye', true)}</div>{field('slug', 'Dirección web del producto *')}<p className="form-note">Se crea sola a partir del nombre. Cambiala sólo si necesitás una dirección distinta.</p></details>}
        </Section>
        {(supportsOccasions(draft) || supportsCareers(draft)) && <Section title={product ? 'Ocasiones y carreras' : 'Ayudá a encontrarlo'}>{!product && <p className="muted">Si es un cartel predeterminado, elegí la carrera para que puedan encontrarlo en el catálogo.</p>}<div className="editor-grid">{(['occasionIds', 'careerIds'] as const).filter(key => key === 'occasionIds' ? supportsOccasions(draft) : supportsCareers(draft)).map(key => <fieldset className="taxonomy-choices" key={key}><legend>{key === 'occasionIds' ? 'Ocasiones (opcional)' : 'Carreras (opcional)'}</legend>{(key === 'occasionIds' ? availableCategories.filter(isOccasion) : availableCareers).map(item => <label key={item.id}><input type="checkbox" checked={(draft[key] ?? []).includes(item.id)} onChange={e => setDraft({ ...draft, [key]: e.target.checked ? [...(draft[key] ?? []), item.id] : (draft[key] ?? []).filter(id => id !== item.id) })} />{item.name}</label>)}<details className="editor-optional"><summary>Agregar {key === 'occasionIds' ? 'otra ocasión' : 'otra carrera'}</summary><InlineTaxonomyCreator kind={key === 'occasionIds' ? 'categories' : 'careers'} disabled={busy || loggingOut} onCreated={item => addTaxonomy(key, item)} /></details>{errors[key] && <p className="field-error">{errors[key]}</p>}</fieldset>)}</div></Section>}
        <CollectionsEditor draft={draft} setDraft={setDraft} errors={errors} productId={product?.id} isNew={!product} />
        {!product && <Section title="Agregá la imagen del producto">
          <p className="muted">Elegí una foto del cartel o producto. Se guardará como portada al crear el producto; después podés agregar más imágenes.</p>
          <ImagePicker id="product-image-file" file={imageFile} onChange={file => { setImageFile(file); setErrors(current => { const next = { ...current }; delete next.image; return next; }); }} error={errors.image} />
          {draft.category === 'CARTEL' && (imageShapes.length > 1 ? <div className="custom-field"><label htmlFor="product-image-shape">Forma que muestra la foto *</label><select id="product-image-shape" value={imageShape ?? ''} onChange={event => setPhotoShape(event.target.value as CatalogShape || null)} aria-invalid={Boolean(errors.imageShape)} aria-describedby={errors.imageShape ? 'product-image-shape-error' : undefined}><option value="">Elegí una forma</option>{imageShapes.map(shape => <option key={shape} value={shape}>{IMAGE_SHAPES[shape]}</option>)}</select></div> : <p className="form-note muted">{imageShape ? `La foto se asociará al cartel ${IMAGE_SHAPES[imageShape].toLocaleLowerCase('es-AR')}.` : 'Elegí la forma del cartel en el precio para asociarla a esta foto.'}</p>)}
          {errors.imageShape && <p id="product-image-shape-error" className="field-error">{errors.imageShape}</p>}
        </Section>}
        <div className="editor-save"><button type="submit" className="button">{busy ? 'Guardando…' : product ? 'Guardar cambios' : imageFile ? 'Crear producto con imagen' : 'Crear producto'}</button><span className="muted">{product ? dirty ? 'Hay cambios sin guardar.' : 'Sin cambios pendientes.' : 'Se guardará oculto para que lo revises y publiques cuando esté listo.'}</span></div>
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

function InlineTaxonomyCreator({ kind, disabled, onCreated }: { kind: 'categories' | 'careers'; disabled: boolean; onCreated: (item: Taxonomy) => void }) {
  const { manager } = useAdmin();
  const [name, setName] = useState(''), [message, setMessage] = useState(''), [saving, setSaving] = useState(false);
  const label = kind === 'categories' ? 'ocasión' : 'carrera';
  async function create() {
    const clean = name.trim(), slug = slugify(clean).slice(0, 120).replace(/-$/, '');
    if (!clean || [...clean].length > 120 || !slug) { setMessage(`Escribí un nombre válido para la ${label}.`); return; }
    setSaving(true); setMessage('');
    try {
      const item = await manager.request<Taxonomy>('admin/' + kind, { method: 'POST', body: { name: clean, slug } });
      onCreated(item); setName(''); setMessage(`${kind === 'categories' ? 'Ocasión' : 'Carrera'} agregada y seleccionada.`);
    } catch (error) { setMessage(error instanceof ApiError ? error.message : `No pudimos agregar la ${label}.`); }
    finally { setSaving(false); }
  }
  return <div className="inline-taxonomy-create"><Field id={'new-' + kind} label={`Agregar otra ${label}`} hint="Escribí el nombre; se seleccionará automáticamente." value={name} onChange={setName} /><button type="button" className="text-button" disabled={disabled || saving} onClick={() => void create()}>{saving ? 'Agregando…' : `Agregar ${label}`}</button>{message && <p className={message.includes('agregada') ? 'muted' : 'field-error'} role="status">{message}</p>}</div>;
}
