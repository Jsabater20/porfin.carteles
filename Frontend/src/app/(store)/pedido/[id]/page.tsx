import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api/server';
import { ApiError } from '@/lib/api/errors';
import type { GuestOrder } from '@/lib/contracts/orders';
import { ORDER_ID } from '@/features/orders/validation';
import { OrderDetails } from '@/features/orders/order-details';
export const metadata: Metadata = { title: 'Tu solicitud', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ORDER_ID.test(id)) notFound();
  let order: GuestOrder;
  try { order = await serverApi<GuestOrder>('orders/' + id); }
  catch (error) {
    const unavailable = error instanceof ApiError && [401, 403, 404].includes(error.status);
    return <div className="container order-page"><h1>{unavailable ? 'No pudimos acceder a esta solicitud' : 'No pudimos cargar el resumen'}</h1><p>{unavailable ? 'El enlace necesita la sesión del navegador que registró el pedido. Puede haber vencido o no corresponder a esta solicitud. Contactá a la tienda con tu referencia.' : 'La tienda no respondió. Podés volver a consultar sin registrar otro pedido.'}</p>{!unavailable && <Link className="button" href={'/pedido/' + id}>Volver a consultar</Link>}<Link className="text-link" href="/contacto">Contactar a la tienda</Link></div>;
  }
  return <OrderDetails order={order} />;
}
