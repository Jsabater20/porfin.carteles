'use client';
import Link from 'next/link';
import { whatsappLink } from './validation';
import { useCart } from '@/features/cart/provider';

export function OrderActions({ whatsapp }: { whatsapp: { url: string | null; message: string } }) {
  const { orders } = useCart();
  const link = whatsappLink(whatsapp.url);
  return <div className="order-actions">
    <h2>Enviá tu pedido a la emprendedora</h2>
    {link ? <a className="button whatsapp-link" href={link} target="_blank" rel="noopener noreferrer">Enviar pedido por WhatsApp</a>
      : <p className="notice">El enlace de WhatsApp no está disponible. Tu pedido igualmente quedó registrado.</p>}
    {link && <p className="muted form-note">Al tocar el botón se abrirá WhatsApp con el mensaje preparado.</p>}
    <Link className="text-link" href="/catalogo" onClick={() => orders.newRequest()}>Preparar otro pedido</Link>
  </div>;
}
