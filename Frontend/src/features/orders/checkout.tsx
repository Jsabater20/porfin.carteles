'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useCart } from '@/features/cart/provider';
import { previewInput } from '@/features/cart/model';
import { formatMoney } from '@/lib/format/money';
import type { PublicSettings } from '@/lib/contracts/settings';
import { argentinaDate, emptyCustomer, validateCustomer, type CustomerFields } from './validation';
import { fingerprint } from './manager';

export function Checkout({ settings }: { settings: PublicSettings | null }) {
  const { state, store, preview, previews, orders, orderState } = useCart();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<CustomerFields>(emptyCustomer);
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerFields, string>>>({});
  const [acceptedPreview, setAcceptedPreview] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const pending = orderState.pending;
  const busy = orderState.status === 'submitting';
  const result = preview.status === 'ready' ? preview.preview : null;
  const methods = settings?.deliveryMethods.length ? settings.deliveryMethods : ['PICKUP', 'SHIPPING'];
  const delivery = pending?.deliveryMethod ?? state.deliveryMethod;
  const canRegister = Boolean(result && delivery !== 'UNDECIDED' && methods.includes(delivery) && settings && Date.parse(result.expiresAt) > Date.now());
  useEffect(() => { if (orderState.status === 'review') previews.invalidate(); }, [orderState.status, previews]);
  useEffect(() => {
    if (!pending) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [pending]);
  function changeField(key: keyof CustomerFields, value: string) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setFormMessage('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage('');
    if (busy || orderState.retryBlocked || orderState.status === 'blocked') return;
    if (!pending && (!canRegister || !result || acceptedPreview !== result.id)) {
      setFormMessage('Elegí la entrega, validá el carrito y confirmá que revisaste el resumen.'); return;
    }
    if (delivery === 'UNDECIDED') return;
    const validation = validateCustomer(fields, pending?.previewId ?? result!.id, delivery,
      pending ? argentinaDate(new Date(pending.createdAt)) : argentinaDate());
    setErrors(validation.errors);
    if (Object.keys(validation.errors).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    // El hash permite recuperar un reintento tras recargar sin guardar datos de contacto.
    const snapshot = store.getSnapshot();
    const cartHash = await fingerprint(previewInput(snapshot));
    if (!pending && (store.getSnapshot().revision !== snapshot.revision || previews.getSnapshot().preview?.id !== validation.input.previewId || Date.parse(result!.expiresAt) <= Date.now())) {
      setFormMessage('El carrito cambió o venció el resumen. Volvé a revisarlo antes de registrar.'); return;
    }
    await orders.submit(validation.input, cartHash);
    const registered = orders.getSnapshot();
    if (registered.status === 'success' && registered.orderId && window.location.pathname === '/pedido') router.replace('/pedido/' + registered.orderId + '?whatsapp=1');
  }
  if (!state.ready || !orderState.ready) return <div className="container loading-state" role="status">Preparando tu solicitud…</div>;
  if (orderState.status === 'success' && orderState.orderId) return <div className="container order-page"><h1>Tu solicitud quedó registrada</h1><p>Podés consultar el resumen y continuar a WhatsApp.</p><Link className="button" href={'/pedido/' + orderState.orderId}>Ver solicitud registrada</Link><button className="text-button" onClick={() => orders.newRequest()}>Preparar otra solicitud</button></div>;
  if (!state.lines.length && !pending && orderState.status !== 'blocked') return <div className="container order-page"><h1>Primero armá tu carrito</h1><p>Elegí y personalizá tus productos para preparar una solicitud.</p><Link className="button" href="/catalogo">Explorar el catálogo</Link></div>;
  const input = (key: keyof CustomerFields, label: string, type = 'text', hint?: string) => <div className="custom-field">
    <label htmlFor={'order-' + key}>{label}</label>
    {key === 'notes' || key === 'deliveryAddress' ? <textarea id={'order-' + key} rows={key === 'notes' ? 3 : 2} value={fields[key]} onChange={(e) => changeField(key, e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? 'error-' + key : hint ? 'hint-' + key : undefined} autoComplete={key === 'deliveryAddress' ? 'street-address' : 'off'} />
      : <input id={'order-' + key} type={type} value={fields[key]} onChange={(e) => changeField(key, e.target.value)} max={key === 'customerBirthDate' ? argentinaDate() : undefined} min={key === 'requestedDate' ? (pending ? argentinaDate(new Date(pending.createdAt)) : argentinaDate()) : undefined} autoComplete={key === 'customerFirstName' ? 'given-name' : key === 'customerLastName' ? 'family-name' : key === 'customerEmail' ? 'email' : key === 'customerBirthDate' ? 'bday' : key === 'customerPhone' ? 'tel' : 'off'} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? 'error-' + key : hint ? 'hint-' + key : undefined} />}
    {hint && <small className="muted" id={'hint-' + key}>{hint}</small>}
    {errors[key] && <p className="field-error" id={'error-' + key}>{errors[key]}</p>}
  </div>;
  return <div className="container order-page">
    <header className="page-heading"><p className="eyebrow">Un paso más para tu celebración</p><h1>Prepará tu solicitud</h1><p className="muted">Completá tus datos antes de ir a WhatsApp. Hacer este proceso no confirma el pedido: la emprendedora debe confirmar disponibilidad, fecha y presupuesto por ese chat.</p></header>
    {orderState.message && <p className="notice" role="alert">{orderState.message}</p>}
    {orderState.status === 'blocked' ? <Link className="button" href="/contacto">Contactar a la tienda</Link> : <div className="cart-layout">
      <form ref={form} onSubmit={submit} noValidate className="order-form">
        <fieldset disabled={busy} className="order-fields"><legend>Datos de contacto y entrega</legend>
          {!pending ? <div className="custom-field"><label htmlFor="order-delivery">Modalidad de entrega *</label><select id="order-delivery" value={delivery} onChange={(e) => { store.delivery(e.target.value as 'PICKUP' | 'SHIPPING'); setAcceptedPreview(''); }}>
            <option value="UNDECIDED">Elegí una modalidad</option>{methods.map((method) => <option key={method} value={method}>{method === 'PICKUP' ? 'Retiro' : 'Envío'}</option>)}
          </select>{delivery !== 'UNDECIDED' && !methods.includes(delivery) && <p className="field-error">Esta modalidad ya no está disponible. Elegí otra.</p>}</div>
            : <p>Entrega de la solicitud original: <strong>{delivery === 'PICKUP' ? 'Retiro' : 'Envío'}</strong>.</p>}
          {delivery === 'PICKUP' && settings?.pickupAddress && <p className="notice">{settings.pickupAddress}</p>}
          {settings?.deliveryNotes && <p className="muted preserve-lines">{settings.deliveryNotes}</p>}
          {input('customerFirstName', 'Nombre *')}
          {input('customerLastName', 'Apellido *')}
          {input('customerBirthDate', 'Fecha de nacimiento (opcional)', 'date')}
          {input('customerEmail', 'Mail *', 'email')}
          {input('customerPhone', 'Teléfono con código de país (opcional)', 'tel', 'Por ejemplo: +54 9 11 2345 6789.')}
          {input('requestedDate', '¿Para cuándo lo necesitarías? *', 'date', 'La fecha queda pendiente hasta que la emprendedora la confirme por WhatsApp.')}
          {delivery === 'SHIPPING' && input('deliveryAddress', 'Dirección de envío *', 'text', 'Incluí calle, número, localidad y provincia.')}
          {input('notes', 'Observaciones (opcional)', 'text', 'Hasta 1000 caracteres. Las fotos se envían por WhatsApp.')}
        </fieldset>
        {!pending && result && <label className="order-consent"><input type="checkbox" checked={acceptedPreview === result.id} onChange={(e) => setAcceptedPreview(e.target.checked ? result.id : '')} disabled={busy} />Revisé los productos, la entrega y los importes conocidos. Entiendo que el pedido, el total final y la fecha necesitan la confirmación de la emprendedora por WhatsApp.</label>}
        {formMessage && <p role="alert" className="field-error">{formMessage}</p>}
        {orderState.storageWarning && <p className="notice">Este navegador no permite guardar el registro de reintento. Mantené la página abierta hasta recibir la confirmación.</p>}
        <button className="button order-submit" type="submit" disabled={busy || orderState.retryBlocked || !pending && (!canRegister || acceptedPreview !== result?.id)}>{busy ? 'Registrando…' : pending ? 'Reintentar la misma solicitud' : 'Continuar a WhatsApp'}</button>
        {busy && <p role="status">Guardando tu solicitud…</p>}
        <p className="muted form-note">Los datos de contacto y dirección no se guardan en el navegador. Se envían a la tienda al registrar la solicitud.</p>
      </form>
      <aside className="cart-summary" aria-label="Revisión de la solicitud">
        <h2>{pending ? 'Recuperar solicitud' : 'Revisá tu carrito'}</h2>
        {pending ? <><p>Usaremos la misma solicitud original, aunque su resumen haya vencido. Un reintento recupera el pedido si ya se registró.</p><p className="muted">Si recargaste, completá los mismos datos que enviaste antes. Los cambios actuales del carrito no se incluyen en este reintento.</p><Link className="text-link" href="/contacto">Necesito ayuda de la tienda</Link></> : <>
          {!settings && <p role="alert" className="notice">No pudimos consultar las modalidades de entrega. <button type="button" className="text-button" onClick={() => router.refresh()}>Volver a consultar</button></p>}
          <button type="button" className="button" disabled={!settings || delivery === 'UNDECIDED' || !methods.includes(delivery) || preview.status === 'loading' || preview.retryBlocked} onClick={() => void previews.validate(true)}>{preview.status === 'loading' ? 'Validando…' : result ? 'Actualizar resumen' : 'Validar carrito'}</button>
          {preview.message && <p role="alert" className="notice">{preview.message}</p>}
          {result && <div className="validated-summary">
            {preview.priceChanges.length > 0 && <p className="notice">Hay cambios de precio. Revisá los importes actualizados antes de continuar.</p>}
            {result.items.map((item) => <div className="order-review-item" key={item.lineId}><h3>{item.quantity} × {item.productName}</h3><p>{item.variantName} · {item.subtotalCents === null ? 'A cotizar' : formatMoney(item.subtotalCents)}</p>
              <dl className="cart-answers">{item.answers.map((answer) => <div key={answer.fieldKey}><dt>{item.components.find((c) => c.key === answer.componentKey)?.name ? item.components.find((c) => c.key === answer.componentKey)!.name + ': ' : ''}{answer.label}</dt><dd>{answer.displayValue}</dd></div>)}</dl>
              {item.photoCountTotal > 0 && <p className="muted form-note">{item.photoCountTotal} fotos por WhatsApp.</p>}
            </div>)}
            <dl><div><dt>Subtotal conocido</dt><dd>{formatMoney(result.summary.knownSubtotalCents)}</dd></div><div><dt>A cotizar</dt><dd>{result.summary.pendingQuoteQuantity} unidades</dd></div><div><dt>Entrega</dt><dd>{delivery === 'PICKUP' ? 'Retiro' : 'Envío a confirmar'}</dd></div><div><dt>Total final</dt><dd>A confirmar</dd></div></dl>
          </div>}
          <Link className="text-link" href="/carrito">Editar productos y opciones</Link>
        </>}
      </aside>
    </div>}
  </div>;
}
