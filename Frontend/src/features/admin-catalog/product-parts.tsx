'use client';
import type { Dispatch, SetStateAction } from 'react';
import { Field, RowTools, Section } from './controls';
import { blankVariant, moved, newKey, type ProductDraft } from './model';
import { ReferencePicker } from './reference-picker';
export function CollectionsEditor({ draft, setDraft, errors, productId }: { draft: ProductDraft; setDraft: Dispatch<SetStateAction<ProductDraft>>; errors: Record<string, string>; productId?: string }) {
  const variant = (index: number, patch: Partial<ProductDraft['variants'][number]>) => setDraft((d) => ({ ...d, variants: d.variants.map((item, n) => n === index ? { ...item, ...patch } : item) }));
  const component = (index: number, patch: Partial<ProductDraft['components'][number]>) => setDraft((d) => ({ ...d, components: d.components.map((item, n) => n === index ? { ...item, ...patch } : item) }));
  return <>
    <Section title="Variantes y precios">
      <p className="muted">Cada variante tiene su precio completo en pesos argentinos. “A cotizar” deja el importe pendiente.</p>
      {draft.variants.map((v, i) => <fieldset className="collection-row variant-editor" key={v.key}><legend>Variante {i + 1}</legend>
        <div className="editor-grid"><Field id={'variant-name-' + i} label="Nombre *" value={v.name} onChange={(name) => variant(i, { name })} error={errors['variants.' + i + '.name']} /><div className="custom-field"><label htmlFor={'pricing-' + i}>Precio</label><select id={'pricing-' + i} value={v.pricingMode} onChange={(e) => variant(i, { pricingMode: e.target.value as 'FIXED' | 'QUOTE' })}><option value="FIXED">Precio fijo</option><option value="QUOTE">A cotizar</option></select></div>
          {v.pricingMode === 'FIXED' && <Field id={'price-' + i} label="Precio en ARS *" value={v.price} onChange={(price) => variant(i, { price })} hint="Por ejemplo: 18000,50. Sin separador de miles." error={errors['variants.' + i + '.price']} />}
          <Field id={'photos-' + i} label="Fotos que enviará el cliente (0 a 10)" value={v.photos} onChange={(photos) => variant(i, { photos })} error={errors['variants.' + i + '.photos']} />
        </div>
        <label className="check-label"><input type="checkbox" checked={v.active} onChange={(e) => variant(i, { active: e.target.checked })} />Variante activa</label>
        <details><summary>Atributos de la variante</summary><p className="form-note">Ejemplos: tamaño, material o terminación. Claves sin espacios ni acentos; valores de hasta 200 caracteres.</p>{v.attributes.map((a, n) => <div className="attribute-row" key={n}><Field id={'attr-key-' + i + '-' + n} label="Clave" value={a.key} onChange={(key) => variant(i, { attributes: v.attributes.map((x, ix) => ix === n ? { ...x, key } : x) })} /><Field id={'attr-value-' + i + '-' + n} label="Valor" value={a.value} onChange={(value) => variant(i, { attributes: v.attributes.map((x, ix) => ix === n ? { ...x, value } : x) })} /><button type="button" className="text-button" onClick={() => variant(i, { attributes: v.attributes.filter((_, ix) => ix !== n) })}>Quitar atributo</button></div>)}<button type="button" className="text-button" disabled={v.attributes.length >= 20} onClick={() => variant(i, { attributes: [...v.attributes, { key: '', value: '' }] })}>Agregar atributo</button>{errors['variants.' + i + '.attributes'] && <p className="field-error">{errors['variants.' + i + '.attributes']}</p>}</details>
        <RowTools index={i} count={draft.variants.length} name={'variante ' + (i + 1)} move={(delta) => setDraft({ ...draft, variants: moved(draft.variants, i, delta) })} remove={() => setDraft({ ...draft, variants: draft.variants.filter((_, n) => n !== i) })} />
      </fieldset>)}
      <button type="button" className="button button-secondary add-variant" disabled={draft.variants.length >= 30} onClick={() => setDraft({ ...draft, variants: [...draft.variants, blankVariant()] })}>Agregar variante</button>
    </Section>
    {(draft.type === 'COMBO' || draft.components.length > 0) && <Section title="Componentes del combo"><p className="muted">El precio del conjunto se define en sus variantes; las cantidades de componentes no lo multiplican.</p>
      {draft.components.map((c, i) => <fieldset className="collection-row component-editor" key={c.key}><legend>Componente {i + 1}</legend><div className="editor-grid"><Field id={'component-name-' + i} label="Nombre *" value={c.name} onChange={(name) => component(i, { name })} error={errors['components.' + i + '.name']} /><Field id={'component-quantity-' + i} label="Cantidad (1 a 100)" value={c.quantity} onChange={(quantity) => component(i, { quantity })} error={errors['components.' + i + '.quantity']} /></div>
        <ReferencePicker value={c.referenceProductId} selfId={productId} onChange={(referenceProductId) => component(i, { referenceProductId })} />
        <RowTools index={i} count={draft.components.length} name={'componente ' + (i + 1)} move={(delta) => setDraft({ ...draft, components: moved(draft.components, i, delta) })} remove={() => setDraft({ ...draft, components: draft.components.filter((_, n) => n !== i) })} />
      </fieldset>)}<button type="button" className="button button-secondary add-component" disabled={draft.components.length >= 50} onClick={() => setDraft({ ...draft, components: [...draft.components, { key: newKey(), name: '', quantity: '1' }] })}>Agregar componente</button>
    </Section>}
  </>;
}
