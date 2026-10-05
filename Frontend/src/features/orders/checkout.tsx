'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useCart } from '@/features/cart/provider';
import { previewInput } from '@/features/cart/model';
import { formatMoney } from '@/lib/format/money';
import type { PublicSettings } from '@/lib/contracts/settings';
import { argentinaDate, emptyCustomer, validateCustomer, whatsappLink, type CustomerFields } from './validation';
import { fingerprint } from './manager';
import { DepositNotice } from '@/components/deposit-notice';

export function Checkout({ settings }: { settings: PublicSettings | null }) {
  const { state, store, preview, previews, orders, orderState } = useCart();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<CustomerFields>(emptyCustomer);
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerFields, string>>>({});
  const [formMessage, setFormMessage] = useState('');
  const pending = orderState.pending;
  const busy = orderState.status === 'submitting';
  const result = preview.status === 'ready' ? preview.preview : null;
  const methods = useMemo(() => settings?.deliveryMethods.length ? settings.deliveryMethods : ['PICKUP', 'SHIPPING'], [settings?.deliveryMethods]);
  const delivery = pending?.deliveryMethod ?? state.deliveryMethod;
  const canRegister = Boolean(result && delivery !== 'UNDECIDED' && methods.includes(delivery) && settings && Date.parse(result.expiresAt) > Date.now());
  useEffect(() => { if (orderState.status === 'review') previews.invalidate(); }, [orderState.status, previews]);
  useEffect(() => {
    if (orderState.status === 'success' && orderState.orderId) router.replace('/pedido/' + orderState.orderId);
  }, [orderState.orderId, orderState.status, router]);
  useEffect(() => {
    if (!pending && state.ready && state.lines.length && settings && delivery !== 'UNDECIDED' && methods.includes(delivery) && ['idle', 'expired'].includes(preview.status)) void previews.validate();
  }, [delivery, methods, pending, preview.status, previews, settings, state.lines.length, state.ready]);
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
    if (!pending && (!canRegister || !result)) {
      setFormMessage(preview.status === 'loading' ? 'Esperá mientras preparamos la información de tu pedido.' : 'No pudimos preparar la información del pedido. Volvé al carrito y revisá tu selección.'); return;
    }
    if (delivery === 'UNDECIDED') return;
    const validation = validateCustomer(fields, pending?.previewId ?? result!.id, delivery,
      pending ? argentinaDate(new Date(pending.createdAt)) : argentinaDate());
    setErrors(validation.errors);
    if (Object.keys(validation.errors).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    // Se abre durante el clic, antes de esperar la API, para que el navegador no lo bloquee como popup tardío.
    const whatsappWindow = window.open('/pedido/whatsapp', 'porfin-whatsapp');
    // El hash permite recuperar un reintento tras recargar sin guardar datos de contacto.
    const snapshot = store.getSnapshot();
    const cartHash = await fingerprint(previewInput(snapshot));
    if (!pending && (store.getSnapshot().revision !== snapshot.revision || previews.getSnapshot().preview?.id !== validation.input.previewId || Date.parse(result!.expiresAt) <= Date.now())) {
      whatsappWindow?.close();
      setFormMessage('El carrito cambió o venció el resumen. Volvé a revisarlo antes de registrar.'); return;
    }
    const registeredOrder = await orders.submit(validation.input, cartHash);
    if (registeredOrder) {
      const link = whatsappLink(registeredOrder.whatsapp.url);
      if (link && whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.replace(link);
        try { whatsappWindow.opener = null; } catch {}
      } else {
        whatsappWindow?.close();
        if (link) {
          const fallback = window.open(link, '_blank');
          if (fallback) fallback.opener = null;
          else setFormMessage('El navegador bloqueó la pestaña de WhatsApp. Abrila desde el resumen del pedido.');
        }
      }
      router.replace('/pedido/' + registeredOrder.id);
    } else whatsappWindow?.close();
  }
  if (!state.ready || !orderState.ready) return <div className="container loading-state" role="status">Preparando tu solicitud…</div>;
  if (orderState.status === 'success' && orderState.orderId) return <div className="container loading-state" role="status">Abriendo el resumen de tu pedido…</div>;
  if (!state.lines.length && !pending && orderState.status !== 'blocked') return <div className="container order-page"><h1>Primero armá tu carrito</h1><p>Elegí y personalizá tus productos para preparar una solicitud.</p><Link className="button" href="/catalogo">Explorar el catálogo</Link></div>;
  const input = (key: keyof CustomerFields, label: string, type = 'text', hint?: string) => <div className="custom-field">
    <label htmlFor={'order-' + key}>{label}</label>
    {key === 'notes' ? <textarea id={'order-' + key} rows={3} value={fields[key]} onChange={(e) => changeField(key, e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? 'error-' + key : hint ? 'hint-' + key : undefined} autoComplete="off" />
      : <input id={'order-' + key} type={type} value={fields[key]} onChange={(e) => changeField(key, e.target.value)} max={key === 'customerBirthDate' ? argentinaDate() : undefined} min={key === 'requestedDate' ? (pending ? argentinaDate(new Date(pending.createdAt)) : argentinaDate()) : undefined} autoComplete={key === 'customerFirstName' ? 'given-name' : key === 'customerLastName' ? 'family-name' : key === 'customerEmail' ? 'email' : key === 'customerBirthDate' ? 'bday' : key === 'customerPhone' ? 'tel' : 'off'} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? 'error-' + key : hint ? 'hint-' + key : undefined} />}
    {hint && <small className="muted" id={'hint-' + key}>{hint}</small>}
    {errors[key] && <p className="field-error" id={'error-' + key}>{errors[key]}</p>}
  </div>;
  return <div className="container order-page">
    <header className="page-heading"><p className="eyebrow">Un paso más para tu celebración</p><h1>Prepará tu solicitud</h1><p className="muted">Completá tus datos antes de ir a WhatsApp. Hacer este proceso no confirma el pedido: la emprendedora debe confirmar disponibilidad, fecha y presupuesto por ese chat.</p><DepositNotice /></header>
    {orderState.message && <p className="notice" role="alert">{orderState.message}</p>}
    {orderState.status === 'blocked' ? <Link className="button" href="/contacto">Contactar a la tienda</Link> : <div className="cart-layout">
      <form ref={form} onSubmit={submit} noValidate className="order-form">
        <fieldset disabled={busy} className="order-fields"><legend>Datos de contacto y entrega</legend>
          {!pending ? <div className="custom-field"><label htmlFor="order-delivery">Modalidad de entrega *</label><select id="order-delivery" value={delivery} onChange={(e) => store.delivery(e.target.value as 'UNDECIDED' | 'PICKUP' | 'SHIPPING')}>
            <option value="UNDECIDED">Elegí una modalidad</option>{methods.map((method) => <option key={method} value={method}>{method === 'PICKUP' ? 'A coordinar (Santa Fe Capital)' : 'Envío por correo'}</option>)}
          </select>{delivery !== 'UNDECIDED' && !methods.includes(delivery) && <p className="field-error">Esta modalidad ya no está disponible. Elegí otra.</p>}</div>
            : <p>Entrega de la solicitud original: <strong>{delivery === 'PICKUP' ? 'A coordinar (Santa Fe Capital)' : 'Envío por correo'}</strong>.</p>}
          {delivery === 'PICKUP' && <p className="muted form-note">Podés coordinar retiro, Uber u otra opción dentro de Santa Fe Capital. Si elegís Uber, el costo queda a tu cargo al solicitarlo.</p>}
          {delivery === 'SHIPPING' && <p className="muted form-note">El envío se realiza por correo y sus datos se coordinan con la emprendedora por WhatsApp.</p>}
          {delivery === 'PICKUP' && settings?.pickupAddress && <p className="notice">{settings.pickupAddress}</p>}
          {settings?.deliveryNotes && <p className="muted preserve-lines">{settings.deliveryNotes}</p>}
          {input('customerFirstName', 'Nombre *')}
          {input('customerLastName', 'Apellido *')}
          {input('customerPhone', 'Teléfono *', 'tel', 'Podés escribirlo con espacios o guiones.')}
          {input('customerEmail', 'Mail *', 'email')}
          {input('customerBirthDate', 'Fecha de nacimiento *', 'date')}
          {input('requestedDate', '¿Para cuándo lo necesitarías? *', 'date', 'La fecha queda pendiente hasta que la emprendedora la confirme por WhatsApp.')}
          {input('notes', 'Observaciones (opcional)', 'text', 'Hasta 1000 caracteres. Las fotos se envían por WhatsApp.')}
        </fieldset>
        {formMessage && <p role="alert" className="field-error">{formMessage}</p>}
        {orderState.storageWarning && <p className="notice">Este navegador no permite guardar el registro de reintento. Mantené la página abierta hasta recibir la confirmación.</p>}
        <button className="button order-submit" type="submit" disabled={busy || orderState.retryBlocked || !pending && !canRegister}>{busy ? 'Registrando…' : pending ? 'Reintentar la misma solicitud' : 'Hacer pedido y abrir WhatsApp'}</button>
        {busy && <p role="status">Guardando tu solicitud…</p>}
        <p className="muted form-note">Los datos de contacto no se guardan en el navegador. El mail y la fecha de nacimiento quedan registrados para la administración, pero no se incluyen en el mensaje de WhatsApp.</p>
      </form>
      <aside className="cart-summary" aria-label="Revisión de la solicitud">
        <h2>{pending ? 'Recuperar solicitud' : 'Tu pedido'}</h2>
        {pending ? <><p>Usaremos la misma solicitud original, aunque su resumen haya vencido. Un reintento recupera el pedido si ya se registró.</p><p className="muted">Si recargaste, completá los mismos datos que enviaste antes. Los cambios actuales del carrito no se incluyen en este reintento.</p><Link className="text-link" href="/contacto">Necesito ayuda de la tienda</Link></> : <>
          {!settings && <p role="alert" className="notice">No pudimos consultar las modalidades de entrega. <button type="button" className="text-button" onClick={() => router.refresh()}>Volver a consultar</button></p>}
          {preview.status === 'loading' && <p role="status">Preparando la información de tu pedido…</p>}
          {preview.status === 'error' && !preview.retryBlocked && <button type="button" className="text-button" onClick={() => void previews.validate()}>Reintentar carga del pedido</button>}
          {preview.message && <p role="alert" className="notice">{preview.message}</p>}
          {!result && <div className="validated-summary">{state.lines.map((line) => <div className="order-review-item" key={line.lineId}><h3>{line.quantity} × {line.display.name}</h3><p>{line.display.variantName} · {line.display.unitEstimateCents === null ? 'A cotizar' : formatMoney(line.display.unitEstimateCents * line.quantity)}</p></div>)}</div>}
          {result && <div className="validated-summary">
            {preview.priceChanges.length > 0 && <p className="notice">Hay cambios de precio. Revisá los importes actualizados antes de continuar.</p>}
            {result.items.map((item) => <div className="order-review-item" key={item.lineId}><h3>{item.quantity} × {item.productName}</h3><p>{item.variantName} · {item.subtotalCents === null ? 'A cotizar' : formatMoney(item.subtotalCents)}</p>
              <dl className="cart-answers">{item.answers.map((answer) => <div key={answer.fieldKey}><dt>{item.components.find((c) => c.key === answer.componentKey)?.name ? item.components.find((c) => c.key === answer.componentKey)!.name + ': ' : ''}{answer.label}</dt><dd>{answer.displayValue}</dd></div>)}</dl>
              {item.photoCountTotal > 0 && <p className="muted form-note">{item.photoCountTotal} fotos por WhatsApp.</p>}
            </div>)}
            <dl><div><dt>Subtotal conocido</dt><dd>{formatMoney(result.summary.knownSubtotalCents)}</dd></div><div><dt>A cotizar</dt><dd>{result.summary.pendingQuoteQuantity} unidades</dd></div><div><dt>Entrega</dt><dd>{delivery === 'PICKUP' ? 'A coordinar' : 'Envío por correo a confirmar'}</dd></div><div><dt>Total final</dt><dd>A confirmar</dd></div></dl>
          </div>}
          <Link className="text-link" href="/carrito">Editar productos y opciones</Link>
        </>}
      </aside>
    </div>}
  </div>;
}
