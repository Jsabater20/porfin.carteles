import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import type { PublicSettings } from '@/lib/contracts/settings';

function InstagramIcon() {
  return <svg className="footer-contact-icon instagram-icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" />
  </svg>;
}

function MailIcon() {
  return <svg className="footer-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" />
  </svg>;
}

export function StoreFooter({ storeName, settings }: { storeName: string; settings: PublicSettings | null }) {
  return (
    <footer className="store-footer">
      <div className="container footer-inner">
        <div className="footer-brand"><Link href="/" className="brand" aria-label={`${storeName}, inicio`}><BrandLogo /></Link><p>Un detalle especial para cada celebración.</p><span className="footer-location">Santa Fe Capital, Argentina</span></div>
        <div className="footer-links">
          <h2 className="footer-heading">Nuestra tienda</h2>
          <nav aria-label="Información de la tienda" className="footer-nav"><Link href="/nosotros">Nosotros</Link><Link href="/contacto">Contacto</Link><Link href="/preguntas-frecuentes">Preguntas frecuentes</Link></nav>
        </div>
        {(settings?.instagramUrl || settings?.contactEmail) && <div className="footer-social"><h2 className="footer-heading">Sigamos en contacto</h2><nav aria-label="Redes y contacto" className="footer-contact">
          {settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram de Por fin Carteles"><span className="footer-icon-wrap"><InstagramIcon /></span><span className="footer-contact-copy"><small>Ideas y novedades</small><span>@porfin.carteles</span></span><span className="footer-contact-arrow" aria-hidden="true">↗</span></a>}
          {settings.contactEmail && <a href={`mailto:${encodeURIComponent(settings.contactEmail)}`} aria-label={`Enviar un correo a ${settings.contactEmail}`}><span className="footer-icon-wrap"><MailIcon /></span><span className="footer-contact-copy"><small>Escribinos</small><span>{settings.contactEmail}</span></span></a>}
        </nav></div>}
      </div>
    </footer>
  );
}
