import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <header className="container auth-header"><Link href="/" className="brand"><BrandLogo /></Link><Link href="/" className="text-link">Volver a la tienda</Link></header>
      <main id="main-content" className="auth-main">{children}</main>
    </div>
  );
}
