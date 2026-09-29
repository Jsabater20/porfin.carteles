import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/globals.css';
import {siteConfig} from '@/lib/seo';

export function generateMetadata(): Metadata { const site=siteConfig(); return {
  metadataBase: new URL(site.origin),
  robots: {index:site.indexable,follow:true},
  title: { default: 'Por fin! · Carteles para celebrar', template: '%s · Por fin!' },
  description: 'Carteles y combos personalizados para acompañar tus celebraciones.',
}; }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <a className="skip-link" href="#main-content">Ir al contenido</a>
        {children}
      </body>
    </html>
  );
}
