import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Administración', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
