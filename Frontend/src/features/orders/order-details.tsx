'use client';
import { useEffect, useState } from 'react';
import type { GuestOrder } from '@/lib/contracts/orders';
import { browserApi } from '@/lib/api/browser';
import { formatMoney } from '@/lib/format/money';
import { OrderActions } from './order-actions';
import { PhotoDeliveryNotice } from '@/components/photo-delivery-notice';
import { DepositNotice } from '@/components/deposit-notice';

const statuses: Record<GuestOrder['status'], string> = { PENDING_CONFIRMATION: 'Pendiente de confirmación', CONFIRMED: 'Confirmado', IN_PRODUCTION: 'En producción', READY: 'Listo para entregar', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };
const statusMessages: Record<GuestOrder['status'], string> = {
  PENDING_CONFIRMATION: 'La emprendedora todavía debe confirmar disponibilidad, fecha y presupuesto por WhatsApp.',
  CONFIRMED: 'La emprendedora confirmó el pedido.',
  IN_PRODUCTION: 'El pedido está siendo preparado.',
  READY: 'El pedido está listo para coordinar la entrega.',
  DELIVERED: 'El pedido fue entregado.',
  CANCELLED: 'El pedido fue cancelado.',
};

export function OrderDetails({ order }: { order: GuestOrder }) {
  const [current, setCurrent] = useState(order), [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try { setCurrent(await browserApi<GuestOrder>('orders/' + order.id)); } catch { /* Conserva el último estado visible si la consulta falla. */ }
    finally { setRefreshing(false); }
  }
  useEffect(() => {
    let active = true;
    const check = async () => { try { const updated = await browserApi<GuestOrder>('orders/' + order.id); if (active) setCurrent(updated); } catch {} };
    const visible = () => { if (document.visibilityState === 'visible') void check(); };
    const timer = window.setInterval(() => void check(), 15_000);
    window.addEventListener('focus', check); document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', visible); };
  }, [order.id]);
  return <div className="container order-page order-receipt">
    <header className="page-heading"><p className="eyebrow">Gracias por confiar en nosotros</p><h1>Tu pedido está {statuses[current.status].toLocaleLowerCase('es-AR')}</h1><p className="order-reference">{current.reference}</p><p className="notice" aria-live="polite">Estado: <strong>{statuses[current.status]}</strong>. {statusMessages[current.status]}</p><button className="text-button order-status-refresh" type="button" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Consultando…' : 'Actualizar estado'}</button><p className="muted">Tu pedido quedó registrado. Para enviárselo a la emprendedora, usá el botón de WhatsApp de este resumen.</p></header>
    <div className="cart-layout"><section aria-label="Productos registrados">
      {current.items.map((item) => <article key={item.id} className="cart-row"><h2>{item.quantity} × {item.productName}</h2><p>{item.variantName}</p>
        <dl className="cart-answers">{item.snapshot.customization.answers.map((answer) => { const component = item.snapshot.components.find((c) => c.key === answer.componentKey); return <div key={answer.fieldKey}><dt>{component ? component.name + ': ' : ''}{answer.label}</dt><dd>{answer.displayValue}</dd></div>; })}</dl>
        <strong>{item.subtotalCents === null ? 'A cotizar' : formatMoney(item.subtotalCents)}</strong>
        {item.snapshot.variant.photoCount > 0 && <PhotoDeliveryNotice count={item.snapshot.variant.photoCount * item.quantity} method={item.snapshot.variant.photoDelivery === 'EMAIL' ? 'EMAIL' : 'WHATSAPP'} />}
      </article>)}
      <h2>Contacto y entrega</h2><dl className="cart-answers"><div><dt>Nombre</dt><dd>{current.customerName}</dd></div>{current.customerEmail && <div><dt>Mail</dt><dd>{current.customerEmail}</dd></div>}{current.customerBirthDate && <div><dt>Fecha de nacimiento</dt><dd>{current.customerBirthDate.slice(0, 10).split('-').reverse().join('/')}</dd></div>}{current.customerPhone && <div><dt>Teléfono</dt><dd>{current.customerPhone}</dd></div>}<div><dt>Fecha solicitada</dt><dd>{current.requestedDate.slice(0, 10).split('-').reverse().join('/')} · a coordinar</dd></div><div><dt>Modalidad</dt><dd>{current.deliveryMethod === 'PICKUP' ? 'A coordinar (Santa Fe Capital)' : current.deliveryMethod === 'SHIPPING' ? 'Envío por correo' : 'A coordinar'}</dd></div>{current.deliveryAddress && <div><dt>Dirección</dt><dd>{current.deliveryAddress}</dd></div>}{current.notes && <div><dt>Observaciones</dt><dd>{current.notes}</dd></div>}</dl>
    </section><aside className="cart-summary"><h2>Importes registrados</h2><div className="validated-summary"><dl><div><dt>Subtotal conocido</dt><dd>{formatMoney(current.knownSubtotalCents)}</dd></div><div><dt>Productos a cotizar</dt><dd>{current.pendingQuoteCount}</dd></div><div><dt>Envío</dt><dd>{current.shippingCents === null ? 'A confirmar' : current.deliveryMethod === 'PICKUP' ? 'No requerido' : formatMoney(current.shippingCents)}</dd></div><div><dt>Total final</dt><dd>Acordar con la tienda</dd></div></dl></div>
      <p className="muted form-note">Estos importes corresponden a la solicitud original. El presupuesto final y los pagos se coordinan con la tienda.</p>
      <DepositNotice />
      <OrderActions whatsapp={current.whatsapp} />
    </aside></div>
    <p className="muted form-note">Este resumen se consulta con la sesión de este navegador. Guardá la referencia para comunicarte con la tienda si perdés el acceso.</p>
  </div>;
}
