import type { ReactNode } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { AdminProvider } from '@/features/auth/admin-provider';
import { requireAdminSession } from '@/features/auth/session';
export const dynamic = 'force-dynamic';
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();
  return <AdminProvider session={session}><AdminShell>{children}</AdminShell></AdminProvider>;
}
