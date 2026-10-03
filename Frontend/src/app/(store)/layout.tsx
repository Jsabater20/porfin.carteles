import type { ReactNode } from 'react';
import { CartProvider } from '@/features/cart/provider';
import { StoreHeader } from '@/components/layout/store-header';
import { StoreFooter } from '@/components/layout/store-footer';
import { WhatsAppFloat } from '@/components/layout/whatsapp-float';
import { getStoreSettings } from '@/features/settings/queries';

// El build no necesita que NestJS o PostgreSQL estén encendidos.
export const dynamic = 'force-dynamic';

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();
  const name = settings?.storeName || 'Por fin!';
  return (
    <CartProvider><div className="site-shell">
      <StoreHeader storeName={name} />
      <main id="main-content" tabIndex={-1} className="store-main">{children}</main>
      <StoreFooter storeName={name} settings={settings} />
      <WhatsAppFloat url={settings?.whatsappUrl} />
    </div></CartProvider>
  );
}
