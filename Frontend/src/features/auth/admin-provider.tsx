'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { AdminSession } from '@/lib/contracts/auth';
import { browserApi } from '@/lib/api/browser';
import { createAdminManager } from './admin-manager';
type Manager = ReturnType<typeof createAdminManager>;
const Context = createContext<Manager | null>(null);
export function AdminProvider({ session, children }: { session: AdminSession; children: ReactNode }) {
  const [manager] = useState(() => createAdminManager(session, browserApi,
    (reason) => window.location.replace(reason === 'changed' ? '/admin' : '/admin/login?estado=' + (reason === 'logout' ? 'cerrada' : 'vencida')),
    () => { try { const channel = new BroadcastChannel('porfin-admin'); channel.postMessage('changed'); channel.close(); } catch {} }));
  useEffect(() => {
    const disconnect = manager.connect();
    const check = () => { if (document.visibilityState === 'visible') void manager.refresh(); };
    window.addEventListener('focus', check); window.addEventListener('pageshow', check); document.addEventListener('visibilitychange', check);
    let channel: BroadcastChannel | undefined;
    try { channel = new BroadcastChannel('porfin-admin'); channel.onmessage = () => void manager.refresh(); } catch {}
    return () => { disconnect(); channel?.close(); window.removeEventListener('focus', check); window.removeEventListener('pageshow', check); document.removeEventListener('visibilitychange', check); };
  }, [manager]);
  return <Context.Provider value={manager}>{children}</Context.Provider>;
}
export function useAdmin() {
  const manager = useContext(Context);
  if (!manager) throw new Error('El panel necesita su proveedor de sesión.');
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getServerSnapshot);
  return { manager, ...state };
}
