'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney } from '@/lib/format/money';
import type { DeliveryMethod } from '@/lib/contracts/preview';
import type { CartLine } from './model';
import { useCart } from './provider';
import { categoryLabels, displayTypeLabels } from '@/features/catalog/classification';
import { DepositNotice } from '@/components/deposit-notice';
import { PhotoDeliveryNotice } from '@/components/photo-delivery-notice';

function CartRow({ line, index }: { line: CartLine; index: number }) {
  const { store, preview } = useCart();
  const [error, setError] = useState('');
  const messages = preview.lineErrors[line.lineId] ?? [];
  const validated = preview.status === 'ready' ? preview.preview?.items.find((item) => item.lineId === line.lineId) : undefined;
  const category = validated?.category ?? line.display.category;
  const displayType = validated?.displayType ?? line.display.displayType;
  const occasions = validated?.occasions ?? line.display.occasions ?? [];
  const careers = validated?.careers ?? line.display.careers ?? [];
  return <article className="cart-row" aria-labelledby={'cart-title-' + line.lineId}>
    <div className="cart-row-heading"><div><p className="eyebrow">Producto {index + 1}</p><h2 id={'cart-title-' + line.lineId}><Link href={`/productos/${line.display.slug}`}>{validated?.productName ?? line.display.name}</Link></h2>
      <p className="muted">{validated?.variantName ?? line.display.variantName}</p></div><button type="button" className="text-button" onClick={() => store.remove(line.lineId)} aria-label={'Quitar ' + line.display.name + ', producto ' + (index + 1)}>Quitar</button></div>
    {(category || displayType || occasions.length > 0 || careers.length > 0) && <dl className="cart-answers">
      {category && <div><dt>Categoría</dt><dd>{categoryLabels[category]}</dd></div>}
      {displayType && <div><dt>{category === 'CARTEL' ? 'Tipo de cartel' : 'Tipo'}</dt><dd>{displayTypeLabels[displayType]}</dd></div>}
      {occasions.length > 0 && <div><dt>Ocasión</dt><dd>{occasions.map(item => item.name).join(', ')}</dd></div>}
      {careers.length > 0 && <div><dt>Carrera</dt><dd>{careers.map(item => item.name).join(', ')}</dd></div>}
    </dl>}
    {line.answers.length > 0 && <dl className="cart-answers">{line.answers.map((answer) => {
      const serverAnswer = validated?.answers.find((item) => item.fieldKey === answer.fieldKey);
      const component = validated?.components.find((item) => item.key === serverAnswer?.componentKey);
      const label = line.display.labels.find((item) => item.fieldKey === answer.fieldKey);
      const serverLabel = serverAnswer ? (component ? component.name + ': ' : '') + serverAnswer.label : undefined;
      return <div key={answer.fieldKey}><dt>{serverLabel ?? label?.label ?? answer.fieldKey}</dt><dd>{serverAnswer?.displayValue ?? label?.optionLabel ?? answer.value}</dd></div>;
    })}</dl>}
    {(validated?.photoCountTotal ?? line.display.photoCount * line.quantity) > 0 && <PhotoDeliveryNotice count={validated?.photoCountTotal ?? line.display.photoCount * line.quantity} method={validated?.photoDelivery === 'EMAIL' || !validated && category === 'CARTEL' && ['GENERIC', 'PREDEFINED', 'PREDEFINED_THREE_IMAGES'].includes(displayType ?? '') && line.display.photoCount === 3 ? 'EMAIL' : 'WHATSAPP'} className="form-note muted" />}
    <div className="cart-row-controls"><div className="custom-field quantity-field"><label htmlFor={'qty-' + line.lineId}>Cantidad</label><input id={'qty-' + line.lineId} type="number" inputMode="numeric" min={1} max={100} step={1} value={line.quantity}
      onChange={(event) => setError(store.quantity(line.lineId, Number(event.target.value)) ?? '')} aria-invalid={Boolean(error)} aria-describedby={error ? 'qty-error-' + line.lineId : undefined} /></div>
      <Link className="text-link" href={`/productos/${line.display.slug}?variante=${encodeURIComponent(line.variantId)}&editar=${encodeURIComponent(line.lineId)}`}>Editar producto</Link>
      <div className="cart-line-price">{validated ? <><strong>{validated.subtotalCents === null ? 'A cotizar' : formatMoney(validated.subtotalCents)}</strong><small>Subtotal validado</small></> :
        <><strong>{line.display.unitEstimateCents === null ? 'A cotizar' : formatMoney(line.display.unitEstimateCents)}</strong><small>Orientativo por unidad · validar</small></>}</div>
    </div>
    {error && <p id={'qty-error-' + line.lineId} className="field-error">{error}</p>}
    {messages.map((message) => <p key={message} className="field-error" role="alert">{message}</p>)}
  </article>;
}
export function CartPage() {
  const { state, store, preview, previews } = useCart();
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    if (state.ready && state.lines.length && state.deliveryMethod !== 'UNDECIDED' && ['idle', 'expired'].includes(preview.status) && !preview.retryBlocked) void previews.validate();
  }, [preview.retryBlocked, preview.status, previews, state.deliveryMethod, state.lines.length, state.ready, state.revision]);
  if (!state.ready) return <div className="container loading-state" role="status">Recuperando tu carrito…</div>;
  if (!state.lines.length) return <div className="container"><EmptyState title="Tu carrito está vacío" action={<Link className="button" href="/catalogo">Explorar el catálogo</Link>}><p>Elegí un cartel o combo y completá sus opciones para empezar.</p>{state.notice && <p role="status">{state.notice}</p>}</EmptyState></div>;
  const result = preview.status === 'ready' ? preview.preview : null;
  const quantity = state.lines.reduce((sum, line) => sum + line.quantity, 0);
  return <div className="container cart-page">
    <header className="page-heading"><p className="eyebrow">Tu celebración va tomando forma</p><h1>Tu carrito</h1><p className="muted">{quantity} {quantity === 1 ? 'unidad' : 'unidades'} · {state.lines.length} {state.lines.length === 1 ? 'personalización' : 'personalizaciones'}.</p></header>
    {state.storageWarning ? <p role="status" className="notice">No pudimos guardar en este navegador. Conservá esta página abierta para mantener el carrito.</p> : <p className="muted form-note">Guardado en este navegador durante siete días desde el último cambio.</p>}
    <div className="cart-layout"><section aria-label="Productos del carrito" className="cart-lines">
      {state.lines.map((line, index) => <CartRow key={line.lineId} line={line} index={index} />)}
      <div className="actions"><Link href="/catalogo" className="text-link">Seguir eligiendo</Link><button type="button" className="text-button" onClick={() => setConfirmClear(true)}>Vaciar carrito</button></div>
      {confirmClear && <div className="notice" role="group" aria-label="Confirmar vaciado"><p>¿Querés quitar todos los productos del carrito?</p><div className="actions"><button className="button button-secondary" type="button" onClick={() => { store.clear(); setConfirmClear(false); }}>Sí, vaciar</button><button type="button" className="text-button" onClick={() => setConfirmClear(false)}>Conservar carrito</button></div></div>}
    </section><aside className="cart-summary" aria-label="Resumen del carrito">
      <h2>Revisá tu selección</h2>
      <DepositNotice />
      <div className="custom-field"><label htmlFor="cart-delivery">Modalidad de entrega</label><select id="cart-delivery" value={state.deliveryMethod} onChange={(event) => store.delivery(event.target.value as DeliveryMethod)}>
        <option value="UNDECIDED">Elegí una modalidad</option><option value="PICKUP">A coordinar (Santa Fe Capital)</option><option value="SHIPPING">Envío por correo</option>
      </select></div>
      {state.deliveryMethod === 'PICKUP' && <p className="muted form-note">Incluye retiro, Uber u otra opción a coordinar dentro de Santa Fe Capital. El costo de Uber queda a cargo del cliente al solicitarlo.</p>}
      {state.deliveryMethod === 'SHIPPING' && <p className="muted form-note">El envío se realiza por correo y su costo se confirma con la emprendedora.</p>}
      <p className="muted form-note">Las opciones, la disponibilidad y los precios se actualizan automáticamente cuando modificás el carrito.</p>
      {preview.status === 'error' && !preview.retryBlocked && <button type="button" className="text-button" onClick={() => void previews.validate()}>Reintentar carga del resumen</button>}
      {preview.status === 'loading' && <p role="status">Consultando el catálogo actual…</p>}
      {preview.message && <p role="alert" className="notice">{preview.message}</p>}
      {!result && preview.status === 'idle' && state.deliveryMethod === 'UNDECIDED' && <p className="muted form-note" role="status">Elegí una modalidad de entrega para preparar el resumen.</p>}
      {result && <div className="validated-summary" aria-live="polite">
        <p className="summary-status">Resumen validado</p>
        {preview.priceChanges.length > 0 && <div className="notice"><strong>Hay cambios de precio.</strong><p>Revisá los importes actualizados de:</p><ul>{preview.priceChanges.map((lineId) => <li key={lineId}>{result.items.find((item) => item.lineId === lineId)?.productName}</li>)}</ul></div>}
        <dl><div><dt>Subtotal conocido</dt><dd>{formatMoney(result.summary.knownSubtotalCents)}</dd></div>
          {result.summary.pendingQuoteLines > 0 && <div><dt>Pendientes de cotización</dt><dd>{result.summary.pendingQuoteQuantity} {result.summary.pendingQuoteQuantity === 1 ? 'unidad' : 'unidades'}</dd></div>}
          <div><dt>Entrega</dt><dd>{result.summary.shipping.status === 'NOT_REQUIRED' ? 'A coordinar en Santa Fe Capital' : 'Envío por correo · a confirmar'}</dd></div>
          <div><dt>Total final</dt><dd>A confirmar</dd></div></dl>
        <p className="muted form-note">Válido hasta las {new Date(result.expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}. No reserva disponibilidad ni confirma el pedido o el pago.</p>
        <Link className="button checkout-link" href="/pedido">Continuar con la solicitud</Link>
      </div>}
    </aside></div>
  </div>;
}
