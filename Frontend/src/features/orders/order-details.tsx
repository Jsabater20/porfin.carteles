import type { GuestOrder } from '@/lib/contracts/orders';
import { formatMoney } from '@/lib/format/money';
import { OrderActions } from './order-actions';

const statuses: Record<GuestOrder['status'], string> = { PENDING_CONFIRMATION: 'Pendiente de confirmación', CONFIRMED: 'Confirmado', IN_PRODUCTION: 'En producción', READY: 'Listo para entregar', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };
export function OrderDetails({ order }: { order: GuestOrder }) {
  return <div className="container order-page order-receipt">
    <header className="page-heading"><p className="eyebrow">Gracias por confiar en nosotros</p><h1>Tu pedido está {order.status === 'PENDING_CONFIRMATION' ? 'pendiente de confirmación' : statuses[order.status]?.toLocaleLowerCase('es-AR') ?? order.status}</h1><p className="order-reference">{order.reference}</p><p className="notice">Estado: <strong>{statuses[order.status] ?? order.status}</strong>. La emprendedora debe confirmar disponibilidad, fecha y presupuesto por WhatsApp.</p><p className="muted">Tu pedido quedó registrado. WhatsApp se abre en otra pestaña; si se cerró o el navegador la bloqueó, podés volver a abrir el mensaje desde este resumen.</p></header>
    <div className="cart-layout"><section aria-label="Productos registrados">
      {order.items.map((item) => <article key={item.id} className="cart-row"><h2>{item.quantity} × {item.productName}</h2><p>{item.variantName}</p>
        <dl className="cart-answers">{item.snapshot.customization.answers.map((answer) => { const component = item.snapshot.components.find((c) => c.key === answer.componentKey); return <div key={answer.fieldKey}><dt>{component ? component.name + ': ' : ''}{answer.label}</dt><dd>{answer.displayValue}</dd></div>; })}</dl>
        <strong>{item.subtotalCents === null ? 'A cotizar' : formatMoney(item.subtotalCents)}</strong>
        {item.snapshot.variant.photoCount > 0 && <p>{item.snapshot.variant.photoCount * item.quantity} fotos para enviar por WhatsApp.</p>}
      </article>)}
      <h2>Contacto y entrega</h2><dl className="cart-answers"><div><dt>Nombre</dt><dd>{order.customerName}</dd></div>{order.customerEmail && <div><dt>Mail</dt><dd>{order.customerEmail}</dd></div>}{order.customerBirthDate && <div><dt>Fecha de nacimiento</dt><dd>{order.customerBirthDate.slice(0, 10).split('-').reverse().join('/')}</dd></div>}{order.customerPhone && <div><dt>Teléfono</dt><dd>{order.customerPhone}</dd></div>}<div><dt>Fecha solicitada</dt><dd>{order.requestedDate.slice(0, 10).split('-').reverse().join('/')} · a coordinar</dd></div><div><dt>Modalidad</dt><dd>{order.deliveryMethod === 'PICKUP' ? 'A coordinar (Santa Fe Capital)' : order.deliveryMethod === 'SHIPPING' ? 'Envío por correo' : 'A coordinar'}</dd></div>{order.deliveryAddress && <div><dt>Dirección</dt><dd>{order.deliveryAddress}</dd></div>}{order.notes && <div><dt>Observaciones</dt><dd>{order.notes}</dd></div>}</dl>
    </section><aside className="cart-summary"><h2>Importes registrados</h2><div className="validated-summary"><dl><div><dt>Subtotal conocido</dt><dd>{formatMoney(order.knownSubtotalCents)}</dd></div><div><dt>Productos a cotizar</dt><dd>{order.pendingQuoteCount}</dd></div><div><dt>Envío</dt><dd>{order.shippingCents === null ? 'A confirmar' : order.deliveryMethod === 'PICKUP' ? 'No requerido' : formatMoney(order.shippingCents)}</dd></div><div><dt>Total final</dt><dd>Acordar con la tienda</dd></div></dl></div>
      <p className="muted form-note">Estos importes corresponden a la solicitud original. El presupuesto final y los pagos se coordinan con la tienda.</p>
      <OrderActions whatsapp={order.whatsapp} />
    </aside></div>
    <p className="muted form-note">Este resumen se consulta con la sesión de este navegador. Guardá la referencia para comunicarte con la tienda si perdés el acceso.</p>
  </div>;
}
