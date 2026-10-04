'use client';

import Link from 'next/link';
import { Variants } from '@/features/catalog/variants';
import { useRef, useState, type FormEvent } from 'react';
import type { ProductDetail, PersonalizationField } from '@/lib/contracts/catalog';
import { formatMoney } from '@/lib/format/money';
import { useCart } from '@/features/cart/provider';
import type { CartLine } from '@/features/cart/model';
import { estimateUnit, validateAnswers } from './validate';
import { categoryLabels, displayTypeLabels, getDisplayType } from '@/features/catalog/classification';
import { DepositNotice } from '@/components/deposit-notice';

const IDEA_FIELD: PersonalizationField = {
  key: 'idea', label: 'Contanos tu idea', type: 'LONG_TEXT', required: true, position: 0, componentKey: null,
  minLength: null, maxLength: 2000, minValue: null, maxValue: null, options: [],
};

function InputField({ field, value, error, onChange }: { field: PersonalizationField; value: string; error?: string; onChange: (value: string) => void }) {
  const id = 'personalization-' + field.key;
  const max = Math.min(field.type === 'SHORT_TEXT' ? 240 : 2000, field.maxLength ?? Infinity);
  const common = { id, name: field.key, value, 'aria-required': field.required, 'aria-invalid': Boolean(error), 'aria-describedby': `${id}-hint${error ? ' ' + id + '-error' : ''}`, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value) };
  return <div className="custom-field">
    <label htmlFor={id}>{field.label}{field.required ? ' *' : ' (opcional)'}</label>
    {field.type === 'SELECT' ? <select {...common}><option value="">Elegí una opción</option>{field.options.map((option) => <option key={option.key} value={option.key}>{option.label}{option.additionalCents > 0 ? ` (+${formatMoney(option.additionalCents)})` : ' · sin adicional'}</option>)}</select>
      : field.type === 'LONG_TEXT' ? <textarea {...common} rows={5} placeholder={field.key === 'idea' ? 'Por ejemplo: temática, texto, colores y detalles que te gustaría incluir.' : undefined} />
      : <input {...common} type="text" inputMode={field.type === 'NUMBER' ? 'decimal' : 'text'} />}
    <small id={id + '-hint'} className="muted">{field.key === 'idea' ? 'Describí brevemente lo que imaginás. Los detalles, la disponibilidad y el plazo se coordinan después por WhatsApp.' : field.type === 'NUMBER' ? `${field.minValue !== null ? 'Mínimo: ' + field.minValue + '. ' : ''}${field.maxValue !== null ? 'Máximo: ' + field.maxValue + '.' : ''} Podés usar números decimales.`
      : field.type === 'SELECT' ? 'Los adicionales se aplican por unidad.' : `${field.minLength ? 'Mínimo ' + field.minLength + '. ' : ''}Máximo ${max} caracteres.`}</small>
    {error && <p id={id + '-error'} className="field-error">{error}</p>}
  </div>;
}
export function ProductCustomizer({ product, editLineId, initialVariantId }: { product: ProductDetail; editLineId?: string; initialVariantId?: string }) {
  const { state } = useCart();
  if (!state.ready) return <><Variants variants={product.variants} /><p role="status">Preparando la personalización…</p><noscript>Activá JavaScript para personalizar el producto y usar el carrito.</noscript></>;
  const editing = editLineId ? state.lines.find((line) => line.lineId === editLineId && line.productId === product.id) : undefined;
  if (editLineId && !editing) return <p className="notice">Este renglón ya no está disponible. <Link className="text-link" href="/carrito">Volver al carrito</Link></p>;
  return <CustomizerForm key={editLineId || product.id} product={product} editing={editing} initialVariantId={initialVariantId} />;
}
function CustomizerForm({ product, editing, initialVariantId }: { product: ProductDetail; editing?: CartLine; initialVariantId?: string }) {
  const { store, state } = useCart();
  const formRef = useRef<HTMLFormElement>(null);
  const [variantId, setVariantId] = useState(editing?.variantId ?? product.variants.find(item => item.id === initialVariantId)?.id ?? product.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1));
  const [values, setValues] = useState<Record<string, string>>(() => ({ idea: String(editing?.answers.find((answer) => answer.fieldKey === 'idea')?.value ?? '') }));
  const [errors, setErrors] = useState<Record<string, string>>(() => Object.create(null));
  const [variantError, setVariantError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [message, setMessage] = useState('');
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((item) => item.id === variantId);
  const visibleFields = [IDEA_FIELD];
  const validation = validateAnswers(visibleFields, values);
  const estimate = variant ? estimateUnit(product, variant, validation.answers) : null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateAnswers(visibleFields, values);
    const count = Number(quantity);
    const invalidQuantity = !quantity.trim() || !Number.isInteger(count) || count < 1 || count > 100;
    setVariantError(variant ? '' : 'Elegí una variante disponible.');
    setQuantityError(invalidQuantity ? 'Ingresá una cantidad entera entre 1 y 100.' : '');
    setErrors(result.errors); setMessage(''); setAdded(false);
    if (Object.keys(result.errors).length || invalidQuantity || !variant || !estimate) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const line: CartLine = {
      lineId: editing?.lineId ?? crypto.randomUUID(), productId: product.id, variantId: variant.id, quantity: count, answers: result.answers,
      display: { slug: product.slug, name: product.name, variantName: variant.name, unitEstimateCents: estimate.unit, photoCount: variant.photoCount,
        category: product.category, displayType: getDisplayType(product.category, product.type, variant.photoCount), occasions: product.occasions ?? [], careers: product.careers,
        labels: result.answers.map((answer) => {
          const field = visibleFields.find((item) => item.key === answer.fieldKey)!;
          const component = product.components.find((item) => item.key === field.componentKey);
          const option = field.options.find((item) => item.key === answer.value);
          return { fieldKey: field.key, label: component ? component.name + ': ' + field.label : field.label, ...(option ? { optionLabel: option.label } : {}) };
        }) },
    };
    const error = editing ? store.replace(line) : store.add(line);
    if (error) setMessage(error); else setAdded(true);
  }
  const changed = () => { setAdded(false); setMessage(''); };
  return <form ref={formRef} onSubmit={submit} noValidate className="customizer" onChange={changed}>
    <h2>{editing ? 'Editar tu idea' : 'Armá tu producto'}</h2>
    <DepositNotice />
    <div className="custom-field"><label htmlFor="product-variant">Opción *</label>
      <select id="product-variant" value={variantId} onChange={(event) => setVariantId(event.target.value)} aria-invalid={Boolean(variantError)} aria-describedby={variantError ? 'variant-error' : undefined}>
        {!variant && <option value="">La opción anterior ya no está disponible</option>}
        {product.variants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>{variantError && <p id="variant-error" className="field-error">{variantError}</p>}
    </div>
    {variant && <div className="variant-detail" aria-live="polite">
      {product.category && <p className="muted form-note"><strong>Categoría:</strong> {categoryLabels[product.category]}{product.category === 'CARTEL' ? ` · Tipo: ${displayTypeLabels[getDisplayType(product.category, product.type, variant.photoCount)]}` : ''}</p>}
      <p className="variant-price">{estimate?.unit === null ? 'A cotizar' : estimate ? formatMoney(estimate.unit) : 'A confirmar'}</p>
      <p className="muted form-note">Importe orientativo por unidad{estimate && estimate.additional > 0 ? ` · adicionales elegidos: ${formatMoney(estimate.additional)}` : ''}. Se vuelve a validar en el carrito.</p>
      {Object.keys(variant.attributes).length > 0 && <dl className="attributes">{Object.entries(variant.attributes).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}
      {variant.photoCount > 0 && <p className="notice">Esta opción lleva {variant.photoCount} fotos por unidad. Las fotos se envían por WhatsApp al coordinar el pedido.</p>}
    </div>}
    <InputField field={IDEA_FIELD} value={values.idea} error={errors.idea} onChange={(value) => setValues({ idea: value })} />
    <div className="custom-field quantity-field"><label htmlFor="product-quantity">Cantidad *</label><input id="product-quantity" type="number" inputMode="numeric" min={1} max={100} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-invalid={Boolean(quantityError)} aria-describedby={quantityError ? 'quantity-error' : undefined} />
      {quantityError && <p id="quantity-error" className="field-error">{quantityError}</p>}
    </div>
    <button className="button" type="submit" disabled={added}>{added ? (editing ? 'Cambios guardados' : 'Agregado al carrito') : editing ? 'Guardar cambios' : 'Agregar al carrito'}</button>
    {added && <div className="notice success-notice" role="status"><p>{editing ? 'Actualizamos este renglón.' : 'Tu producto ya está en el carrito.'}</p><Link className="text-link" href="/carrito">Ver carrito</Link>{!editing && <button type="button" className="text-button" onClick={() => { setAdded(false); setValues({ idea: '' }); }}>Agregar otro producto</button>}</div>}
    {message && <p role="alert" className="field-error">{message}</p>}
    {state.storageWarning && <p className="notice">No pudimos guardar en este navegador. El carrito se mantendrá mientras esta página siga abierta.</p>}
  </form>;
}
