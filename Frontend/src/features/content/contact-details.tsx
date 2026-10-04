import type { PublicSettings } from '@/lib/contracts/settings';
import { safeContactLink } from './safe-link';

export function ContactDetails({ settings }: { settings: PublicSettings | null }) {
  if (!settings) return <p className="notice">No pudimos cargar los datos de contacto. Intentá nuevamente en unos minutos.</p>;
  const links = [
    ['WhatsApp', settings.whatsappUrl], ['Instagram', settings.instagramUrl], ['Facebook', settings.facebookUrl], ['TikTok', settings.tiktokUrl],
  ].flatMap(([label, value]) => { const href = safeContactLink(value); return href ? [{ label, href }] : []; });
  return <section className="contact-details" aria-label="Datos de contacto y entrega">
    {links.length > 0 && <div className="actions">{links.map((link) => <a key={link.label} className="button button-secondary" href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div>}
    {settings.contactEmail && <p>Correo: <a className="text-link" href={`mailto:${encodeURIComponent(settings.contactEmail)}`}>{settings.contactEmail}</a></p>}
    {settings.pickupAddress && <div><h2>Coordinación en Santa Fe Capital</h2><p className="preserve-lines">{settings.pickupAddress}</p></div>}
    {settings.businessHours && <div><h2>Horarios</h2><p className="preserve-lines">{settings.businessHours}</p></div>}
    {settings.deliveryMethods.length > 0 && <p>Modalidades: {settings.deliveryMethods.map((method) => method === 'PICKUP' ? 'a coordinar en Santa Fe Capital' : 'envío por correo').join(' y ')}.</p>}
    {settings.deliveryNotes && <p className="preserve-lines">{settings.deliveryNotes}</p>}
    {!links.length && !settings.contactEmail && !settings.pickupAddress && !settings.businessHours && !settings.deliveryMethods.length && !settings.deliveryNotes && <p className="muted">Los datos de contacto y entrega estarán disponibles pronto.</p>}
  </section>;
}
