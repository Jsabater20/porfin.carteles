'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { whatsappLink } from './validation';
import { useCart } from '@/features/cart/provider';

export function OrderActions({ whatsapp }: { whatsapp: { url: string | null; message: string } }) {
  const { orders } = useCart();
  const [notice, setNotice] = useState('');
  const text = useRef<HTMLTextAreaElement>(null);
  const link = whatsappLink(whatsapp.url);
  async function copy() {
    try { await navigator.clipboard.writeText(whatsapp.message); setNotice('Mensaje copiado. Pegalo en el chat de la tienda.'); }
    catch { text.current?.focus(); text.current?.select(); setNotice('Seleccionamos el texto. Copialo desde el menú de tu navegador.'); }
  }
  return <div className="order-actions">
    <h2>Continuá con la tienda</h2>
    {link ? <a className="button whatsapp-link" href={link} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
      : <p className="notice">El enlace de WhatsApp no está disponible. Tu solicitud quedó registrada; podés copiar el mensaje y consultar los datos de contacto.</p>}
    <p className="muted form-note">Al abrir WhatsApp, revisá el mensaje y tocá Enviar. Abrir el enlace no envía el mensaje automáticamente.</p>
    <div className="custom-field"><label htmlFor="order-message">Mensaje para la tienda</label><textarea ref={text} id="order-message" readOnly value={whatsapp.message} rows={7} /></div>
    <button type="button" className="text-button" onClick={() => void copy()}>Copiar mensaje</button>
    {notice && <p role="status">{notice}</p>}
    <div className="actions"><Link className="text-link" href="/contacto">Contactar a la tienda</Link><Link className="text-link" href="/catalogo" onClick={() => orders.newRequest()}>Seguir mirando</Link></div>
  </div>;
}
