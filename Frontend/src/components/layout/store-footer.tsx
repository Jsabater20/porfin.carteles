import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import type { PublicSettings } from '@/lib/contracts/settings';

export function StoreFooter({ storeName, settings }: { storeName: string; settings: PublicSettings | null }) {
  return (
    <footer className="store-footer">
      <div className="container footer-inner">
        <div><Link href="/" className="brand" aria-label={`${storeName}, inicio`}><BrandLogo /></Link><p>Un detalle especial para cada celebración.</p></div>
        <div className="footer-links">
          <nav aria-label="Información de la tienda" className="footer-nav"><Link href="/nosotros">Nosotros</Link><Link href="/contacto">Contacto</Link><Link href="/preguntas-frecuentes">Preguntas frecuentes</Link><Link href="/admin/login">Administración</Link></nav>
          {(settings?.instagramUrl || settings?.contactEmail) && <nav aria-label="Redes y contacto" className="footer-contact">
            {settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram · @porfin.carteles</a>}
            {settings.contactEmail && <a href={`mailto:${encodeURIComponent(settings.contactEmail)}`}>{settings.contactEmail}</a>}
          </nav>}
        </div>
      </div>
    </footer>
  );
}
