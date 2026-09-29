'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { browserApi } from '@/lib/api/browser';
import { createCartStore, type CartStore } from './store';
import { createPreviewManager } from './preview-manager';
import { CART_KEY, previewInput } from './model';
import { createOrderManager, fingerprint } from '@/features/orders/manager';

type Services = { store: CartStore; previews: ReturnType<typeof createPreviewManager>; orders: ReturnType<typeof createOrderManager> };
const Context = createContext<Services | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const [services] = useState(() => {
    const store = createCartStore();
    return { store, previews: createPreviewManager(store, browserApi), orders: createOrderManager(browserApi, async (submitted) => {
      const snapshot = store.getSnapshot();
      if (await fingerprint(previewInput(snapshot)) === submitted && store.getSnapshot().revision === snapshot.revision) store.clear();
    }) };
  });
  useEffect(() => {
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch {}
    let sessionStorage: Storage | undefined;
    try { sessionStorage = window.sessionStorage; } catch {}
    const disconnect = services.store.connect(storage);
    const disconnectOrder = services.orders.connect(sessionStorage);
    const disconnectPreview = services.previews.connect();
    const onStorage = (event: StorageEvent) => {
      if ((event.key === CART_KEY || event.key === null) && event.storageArea === storage) services.store.receive(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); disconnectOrder(); disconnectPreview(); disconnect(); };
  }, [services]);
  return <Context.Provider value={services}>{children}</Context.Provider>;
}
export function useCart() {
  const services = useContext(Context);
  if (!services) throw new Error('El carrito necesita su proveedor.');
  const state = useSyncExternalStore(services.store.subscribe, services.store.getSnapshot, services.store.getServerSnapshot);
  const preview = useSyncExternalStore(services.previews.subscribe, services.previews.getSnapshot, services.previews.getServerSnapshot);
  const orderState = useSyncExternalStore(services.orders.subscribe, services.orders.getSnapshot, services.orders.getServerSnapshot);
  return { ...services, state, preview, orderState };
}
