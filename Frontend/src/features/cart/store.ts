import { CART_KEY, CART_TTL, emptyCart, previewInput, restoreCart, type CartData, type CartLine } from './model';
import type { DeliveryMethod } from '../../lib/contracts/preview';

export interface CartSnapshot extends CartData { ready: boolean; revision: number; notice: string; storageWarning: boolean }
export function createCartStore() {
  const initial: CartSnapshot = { ...emptyCart(), ready: false, revision: 0, notice: '', storageWarning: false };
  let state = initial;
  let storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const armExpiry = (expiresAt: number) => {
    clearTimeout(timer);
    if (expiresAt > Date.now()) timer = setTimeout(() => {
      state = { ...state, ...emptyCart(), revision: state.revision + 1, notice: 'El carrito guardado venció.' };
      try { storage?.removeItem(CART_KEY); } catch {}
      emit();
    }, expiresAt - Date.now());
  };
  const restore = (raw: string | null) => {
    const result = restoreCart(raw);
    state = { ...state, ...result.data, ready: true, revision: state.revision + 1, notice: result.notice };
    armExpiry(result.expiresAt);
    if (result.notice) { try { storage?.removeItem(CART_KEY); } catch {} }
    emit();
  };
  function commit({ lines, deliveryMethod }: CartData): string | null {
    const data = { lines, deliveryMethod };
    if (!['UNDECIDED', 'PICKUP', 'SHIPPING'].includes(deliveryMethod)) return 'Elegí una modalidad válida.';
    if (!state.ready) return 'Esperá a que cargue tu carrito.';
    if (data.lines.length > 30) return 'Podés agregar hasta 30 productos diferentes al carrito.';
    if (new TextEncoder().encode(JSON.stringify(previewInput(data))).length > 1024 * 1024) return 'El carrito es demasiado grande. Reducí textos o productos.';
    const expiresAt = Date.now() + CART_TTL;
    let storageWarning = false;
    try {
      if (!storage) throw new Error();
      if (!data.lines.length) storage.removeItem(CART_KEY);
      else storage.setItem(CART_KEY, JSON.stringify({ version: 1, expiresAt, ...data }));
    } catch { storageWarning = true; }
    state = { ...state, ...data, revision: state.revision + 1, notice: '', storageWarning };
    armExpiry(data.lines.length ? expiresAt : 0);
    emit();
    return null;
  }
  return {
    getSnapshot: () => state, getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect: (target?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) => {
      storage = target;
      try { if (!storage) throw new Error(); restore(storage.getItem(CART_KEY)); }
      catch { state = { ...state, ready: true, storageWarning: true }; emit(); }
      return () => { clearTimeout(timer); storage = undefined; };
    },
    receive: restore,
    add: (line: CartLine) => state.lines.some((item) => item.lineId === line.lineId) ? 'Este renglón ya está en el carrito.' : commit({ lines: [...state.lines, line], deliveryMethod: state.deliveryMethod }),
    replace: (line: CartLine) => state.lines.some((item) => item.lineId === line.lineId)
      ? commit({ ...state, lines: state.lines.map((item) => item.lineId === line.lineId ? line : item) })
      : 'Este producto ya no está en el carrito.',
    quantity: (lineId: string, quantity: number) => {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return 'La cantidad debe estar entre 1 y 100.';
      return commit({ ...state, lines: state.lines.map((line) => line.lineId === lineId ? { ...line, quantity } : line) });
    },
    remove: (lineId: string) => commit({ ...state, lines: state.lines.filter((line) => line.lineId !== lineId) }),
    delivery: (deliveryMethod: DeliveryMethod) => commit({ lines: state.lines, deliveryMethod }),
    clear: () => commit(emptyCart()),
  };
}
export type CartStore = ReturnType<typeof createCartStore>;
