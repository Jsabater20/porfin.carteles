'use client';
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { Field, RowTools, Section } from './controls';
import { blankVariant, moved, newKey, type ProductDraft } from './model';
import { ReferencePicker } from './reference-picker';

export function CollectionsEditor({ draft, setDraft, errors, productId, isNew = false }: { draft: ProductDraft; setDraft: Dispatch<SetStateAction<ProductDraft>>; errors: Record<string, string>; productId?: string; isNew?: boolean }) {
  const simplePrice = isNew && draft.variants.length === 1;
  const priceOptions = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (simplePrice && Object.keys(errors).some(key => /^variants\.0\.(name|photos|attributes)$/.test(key)) && priceOptions.current) priceOptions.current.open = true;
  }, [errors, simplePrice]);
  const variant = (index: number, patch: Partial<ProductDraft['variants'][number]>) => setDraft(d => ({ ...d, variants: d.variants.map((item, n) => n === index ? { ...item, ...patch } : item) }));
  const component = (index: number, patch: Partial<ProductDraft['components'][number]>) => setDraft(d => ({ ...d, components: d.components.map((item, n) => n === index ? { ...item, ...patch } : item) }));
  const setShape = (index: number, shape: string) => setDraft(d => ({ ...d, variants: d.variants.map((item, n) => {
    if (n !== index) return item;
    const shapeNames: Record<string, string> = { rectangular: 'Rectangular', circular: 'Circular', xxl: 'XXL' };
    const previousShape = item.attributes.find(attribute => attribute.key === 'formato')?.value ?? '';
    const automaticName = !item.name || item.name === 'Base' || item.name === shapeNames[previousShape];
    return { ...item, name: isNew && automaticName && shape ? shapeNames[shape] : item.name, attributes: [...item.attributes.filter(attribute => attribute.key !== 'formato'), ...(shape ? [{ key: 'formato', value: shape }] : [])] };
  }) }));
  const priceFields = (i: number, v: ProductDraft['variants'][number]) => <>
    {draft.category === 'CARTEL' && <div className="custom-field"><label htmlFor={'shape-' + i}>Forma del cartel *</label><select id={'shape-' + i} value={v.attributes.find(attribute => attribute.key === 'formato')?.value ?? ''} aria-invalid={Boolean(errors['variants.' + i + '.shape'])} aria-describedby={errors['variants.' + i + '.shape'] ? 'shape-' + i + '-error' : undefined} onChange={e => setShape(i, e.target.value)}><option value="">Elegí una forma</option><option value="rectangular">Rectangular</option><option value="circular">Circular</option><option value="xxl">XXL</option></select>{errors['variants.' + i + '.shape'] && <p id={'shape-' + i + '-error'} className="field-error">{errors['variants.' + i + '.shape']}</p>}</div>}
    <div className="custom-field"><label htmlFor={'pricing-' + i}>¿Cómo vas a cobrarlo?</label><select id={'pricing-' + i} value={v.pricingMode} onChange={e => variant(i, { pricingMode: e.target.value as 'FIXED' | 'QUOTE' })}><option value="FIXED">Tiene un precio fijo</option><option value="QUOTE">A cotizar</option></select></div>
    {v.pricingMode === 'FIXED' && <Field id={'price-' + i} label="Precio en pesos *" value={v.price} onChange={price => variant(i, { price })} hint="Escribí el precio completo, por ejemplo 52000. Sin puntos de miles." error={errors['variants.' + i + '.price']} />}
  </>;
  const attributes = (i: number, v: ProductDraft['variants'][number]) => <details className="editor-optional" open={Boolean(errors["variants." + i + ".attributes"]) || undefined}><summary>Atributos de la opción</summary><p className="form-note">Sólo si necesitás datos adicionales, como tamaño o terminación. Usá claves sin espacios ni acentos.</p>{v.attributes.map((a, n) => draft.category === 'CARTEL' && a.key === 'formato' ? null : <div className="attribute-row" key={n}><Field id={'attr-key-' + i + '-' + n} label="Clave" value={a.key} onChange={key => variant(i, { attributes: v.attributes.map((x, ix) => ix === n ? { ...x, key } : x) })} /><Field id={'attr-value-' + i + '-' + n} label="Valor" value={a.value} onChange={value => variant(i, { attributes: v.attributes.map((x, ix) => ix === n ? { ...x, value } : x) })} /><button type="button" className="text-button" onClick={() => variant(i, { attributes: v.attributes.filter((_, ix) => ix !== n) })}>Quitar atributo</button></div>)}<button type="button" className="text-button" disabled={v.attributes.length >= 20} onClick={() => variant(i, { attributes: [...v.attributes, { key: '', value: '' }] })}>Agregar atributo</button>{errors['variants.' + i + '.attributes'] && <p className="field-error">{errors['variants.' + i + '.attributes']}</p>}</details>;
  const extraFields = (i: number, v: ProductDraft['variants'][number]) => <>
    <div className="editor-grid"><Field id={'variant-name-' + i} label="Nombre de la opción *" value={v.name} onChange={name => variant(i, { name })} error={errors['variants.' + i + '.name']} /><Field id={'photos-' + i} label="Fotos que enviará el cliente (0 a 10)" value={v.photos} onChange={photos => variant(i, { photos })} error={errors['variants.' + i + '.photos']} /></div>
    <label className="check-label"><input type="checkbox" checked={v.active} onChange={e => variant(i, { active: e.target.checked })} />Opción activa</label>
    {attributes(i, v)}
  </>;
  return <>
    <Section title={isNew ? 'Poné el precio' : 'Variantes y precios'}>
      <p className="muted">Elegí un precio fijo o dejalo a cotizar. Si ofrecés el mismo producto en distintas formas o tamaños, podés agregar otra opción de precio.</p>
      {draft.variants.map((v, i) => <fieldset className={'collection-row variant-editor' + (simplePrice ? ' simple-price' : '')} key={v.key}><legend>{simplePrice ? 'Precio del producto' : 'Opción ' + (i + 1)}</legend>
        {simplePrice ? <><div className="editor-grid">{priceFields(i, v)}</div><details className="editor-optional" ref={priceOptions}><summary>Más opciones: nombre, fotos del cliente y detalles</summary>{extraFields(i, v)}</details></> : <><div className="editor-grid"><Field id={'variant-name-' + i} label="Nombre de la opción *" value={v.name} onChange={name => variant(i, { name })} error={errors['variants.' + i + '.name']} />{priceFields(i, v)}</div><div className="editor-grid"><Field id={'photos-' + i} label="Fotos que enviará el cliente (0 a 10)" value={v.photos} onChange={photos => variant(i, { photos })} error={errors['variants.' + i + '.photos']} /></div><label className="check-label"><input type="checkbox" checked={v.active} onChange={e => variant(i, { active: e.target.checked })} />Opción activa</label>{attributes(i, v)}<RowTools index={i} count={draft.variants.length} name={'opción ' + (i + 1)} move={delta => setDraft(d => ({ ...d, variants: moved(d.variants, i, delta) }))} remove={() => setDraft(d => ({ ...d, variants: d.variants.filter((_, n) => n !== i) }))} /></>}
      </fieldset>)}
      {errors.variants && <p className="field-error">{errors.variants}</p>}
      <button type="button" className="button button-secondary add-variant" disabled={draft.variants.length >= 30} onClick={() => setDraft(d => ({ ...d, variants: [...d.variants, blankVariant()] }))}>Agregar otra opción de precio</button>
    </Section>
    {(draft.type === 'COMBO' || draft.components.length > 0) && <Section title="Componentes del combo"><p className="muted">El precio del conjunto se define en sus opciones; las cantidades de componentes no lo multiplican.</p>
      {draft.components.map((c, i) => <fieldset className="collection-row component-editor" key={c.key}><legend>Componente {i + 1}</legend><div className="editor-grid"><Field id={'component-name-' + i} label="Nombre *" value={c.name} onChange={name => component(i, { name })} error={errors['components.' + i + '.name']} /><Field id={'component-quantity-' + i} label="Cantidad (1 a 100)" value={c.quantity} onChange={quantity => component(i, { quantity })} error={errors['components.' + i + '.quantity']} /></div>
        <ReferencePicker value={c.referenceProductId} selfId={productId} onChange={referenceProductId => component(i, { referenceProductId })} />
        <RowTools index={i} count={draft.components.length} name={'componente ' + (i + 1)} move={delta => setDraft(d => ({ ...d, components: moved(d.components, i, delta) }))} remove={() => setDraft(d => ({ ...d, components: d.components.filter((_, n) => n !== i) }))} />
      </fieldset>)}<button type="button" className="button button-secondary add-component" disabled={draft.components.length >= 50} onClick={() => setDraft(d => ({ ...d, components: [...d.components, { key: newKey(), name: '', quantity: '1' }] }))}>Agregar componente</button>
    </Section>}
  </>;
}
