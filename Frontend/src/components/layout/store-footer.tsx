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

function GmailIcon() {
  return <svg className="footer-contact-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285f4" d="M3.2 6.7v10.4c0 .9.7 1.6 1.6 1.6h2.3V10.4L3.2 7.5z" />
    <path fill="#34a853" d="M16.9 10.4v8.3h2.3c.9 0 1.6-.7 1.6-1.6V7.5z" />
    <path fill="#fbbc04" d="M16.9 10.4l3.9-2.9V6.7c0-2-2.3-3.1-3.9-1.9z" />
    <path fill="#ea4335" d="M7.1 10.4V4.8L12 8.5l4.9-3.7v5.6L12 14.1z" />
    <path fill="#c5221f" d="M3.2 6.7v.8l3.9 2.9V4.8C5.5 3.6 3.2 4.7 3.2 6.7z" />
  </svg>;
}

export function StoreFooter({ storeName, settings }: { storeName: string; settings: PublicSettings | null }) {
  return (
    <footer className="store-footer">
      <div className="container footer-inner">
        <div><Link href="/" className="brand" aria-label={`${storeName}, inicio`}><BrandLogo /></Link><p>Un detalle especial para cada celebración.</p></div>
        <div className="footer-links">
          <nav aria-label="Información de la tienda" className="footer-nav"><Link href="/nosotros">Nosotros</Link><Link href="/contacto">Contacto</Link><Link href="/preguntas-frecuentes">Preguntas frecuentes</Link><Link href="/admin/login">Administración</Link></nav>
          {(settings?.instagramUrl || settings?.contactEmail) && <nav aria-label="Redes y contacto" className="footer-contact">
            {settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram de Por fin Carteles"><InstagramIcon /><span>@porfin.carteles</span></a>}
            {settings.contactEmail && <a href={`mailto:${encodeURIComponent(settings.contactEmail)}`} aria-label={`Enviar un correo a ${settings.contactEmail}`}><GmailIcon /><span>{settings.contactEmail}</span></a>}
          </nav>}
        </div>
      </div>
    </footer>
  );
}
