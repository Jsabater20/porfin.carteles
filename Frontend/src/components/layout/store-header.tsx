import Link from 'next/link';
import { CartLink } from '@/features/cart/cart-link';
import { BrandLogo } from '@/components/brand-logo';

export function StoreHeader({ storeName }: { storeName: string }) {
  return (
    <header className="store-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label={`${storeName}, inicio`}>
          <BrandLogo />
        </Link>
        <nav aria-label="Navegación principal" className="store-nav">
          <Link href="/">Home</Link>
          <Link href="/catalogo">Catálogo</Link>
          <a href="/#como-pedir">Cómo pedir</a>
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
