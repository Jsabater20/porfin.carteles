'use client';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAdmin } from '@/features/auth/admin-provider';
import { adminNavigation } from '@/features/auth/validation';
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => href === '/admin' ? pathname === href : pathname.startsWith(href);
  const { session, message, loggingOut, manager } = useAdmin();
  if (!session) return <main className="container loading-state" id="main-content" role="status">Actualizando el acceso…</main>;
  return <div className="admin-shell">
    <aside className="admin-sidebar" aria-label="Panel de administración"><Link href="/admin" className="brand"><BrandLogo /></Link><p className="eyebrow">Administración</p>
      <nav aria-label="Navegación administrativa">{adminNavigation().map((item) => item.enabled ? <Link key={item.label} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={active(item.href) ? "admin-nav-item active" : "admin-nav-item"}>{item.label}</Link> : <span key={item.label} className="admin-nav-item" aria-disabled="true">{item.label}<small>Próximamente</small></span>)}</nav>
      <Link href="/" className="text-link">Volver a la tienda ↗</Link>
    </aside>
    <div className="admin-body"><header className="admin-topbar"><span>{session.admin.role === 'OWNER' ? 'Propietario · acceso completo' : 'Administrador'}</span><strong>{session.admin.name}</strong><button type="button" className="text-button admin-logout" disabled={loggingOut} onClick={() => void manager.logout()}>{loggingOut ? 'Cerrando…' : 'Cerrar sesión'}</button></header>
      <main id="main-content" tabIndex={-1} className="admin-main">{message && <div className="notice" role="alert"><p>{message}</p><button className="text-button" onClick={() => void manager.refresh()}>Verificar sesión</button></div>}{children}</main>
    </div>
  </div>;
}
