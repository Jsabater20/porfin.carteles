import { ApiError } from '../../lib/api/errors';
import type { CreateOrderInput, GuestOrder } from '../../lib/contracts/orders';
import type { PreviewTransport } from '../cart/preview-manager';
import { ORDER_ID } from './validation';

export const ATTEMPT_KEY = 'porfin.order-attempt.v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface PendingOrder {
  kind: 'pending'; key: string; previewId: string; deliveryMethod: 'PICKUP' | 'SHIPPING';
  fingerprint: string; cartFingerprint: string; createdAt: string;
}
interface Receipt { kind: 'complete'; orderId: string; cartFingerprint: string }
interface OrderState {
  ready: boolean; status: 'idle' | 'submitting' | 'uncertain' | 'review' | 'error' | 'blocked' | 'success';
  pending: PendingOrder | null; orderId: string | null; message: string; storageWarning: boolean; retryBlocked: boolean;
}
const initial: OrderState = { ready: false, status: 'idle', pending: null, orderId: null, message: '', storageWarning: false, retryBlocked: false };
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hashPattern = /^[a-f0-9]{64}$/;
export async function fingerprint(value: unknown) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function restore(raw: string | null): PendingOrder | Receipt | null {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !hashPattern.test(value.cartFingerprint)) throw new Error();
  if (value.kind === 'complete' && typeof value.orderId === 'string' && ORDER_ID.test(value.orderId)) return { kind: 'complete', orderId: value.orderId, cartFingerprint: value.cartFingerprint };
  if (value.kind !== 'pending' || !uuidPattern.test(value.key) || !uuidPattern.test(value.previewId) ||
    !hashPattern.test(value.fingerprint) || !['PICKUP', 'SHIPPING'].includes(value.deliveryMethod) || !Number.isFinite(Date.parse(value.createdAt))) throw new Error();
  return { kind: 'pending', key: value.key, previewId: value.previewId, deliveryMethod: value.deliveryMethod,
    fingerprint: value.fingerprint, cartFingerprint: value.cartFingerprint, createdAt: value.createdAt };
}
export function createOrderManager(request: PreviewTransport, onSuccess: (cartFingerprint: string) => Promise<void>, uuid = () => crypto.randomUUID()) {
  let state = initial;
  let storage: StoragePort | undefined;
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<OrderState>) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); };
  function persist(value: PendingOrder | Receipt | null) {
    try { if (!storage) throw new Error(); if (value) storage.setItem(ATTEMPT_KEY, JSON.stringify(value)); else storage.removeItem(ATTEMPT_KEY); }
    catch { update({ storageWarning: true }); }
  }
  async function submit(input: CreateOrderInput, cartFingerprint: string) {
    if (busy || !state.ready || state.status === 'success' || state.status === 'blocked' || state.retryBlocked) return null;
    busy = true;
    try {
      const digest = await fingerprint(input);
      let pending = state.pending;
      if (pending && pending.fingerprint !== digest) {
        update({ message: 'Hay una solicitud sin respuesta confirmada. Reingresá exactamente los datos originales para recuperarla; no se creará otro pedido.' }); return null;
      }
      if (!pending) {
        pending = { kind: 'pending', key: uuid(), previewId: input.previewId, deliveryMethod: input.deliveryMethod, fingerprint: digest, cartFingerprint, createdAt: new Date().toISOString() };
        persist(pending);
      }
      update({ status: 'submitting', pending, message: '' });
      const signal = new AbortController().signal;
      const session = await request<{ csrfToken: string }>('guest-session', { method: 'POST', body: {}, signal });
      const order = await request<GuestOrder>('orders', { method: 'POST', body: input, csrfToken: session.csrfToken, idempotencyKey: pending.key, signal });
      if (!ORDER_ID.test(order.id)) throw new Error('Respuesta de pedido inválida');
      persist({ kind: 'complete', orderId: order.id, cartFingerprint: pending.cartFingerprint });
      // El proveedor aplica la política del carrito después de confirmar el registro.
      await onSuccess(pending.cartFingerprint);
      update({ status: 'success', orderId: order.id, pending: null, message: '' });
      return order;
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      const message = error instanceof ApiError ? error.message : '';
      if (status === 410 || status === 409 && /catálogo cambió|modalidad de entrega ya no está disponible/i.test(message)) {
        persist(null); update({ status: 'review', pending: null, message: 'El resumen venció o cambió el catálogo. Revisá y validá nuevamente el carrito antes de registrar.' });
      } else if (status === 400 || status === 422) {
        persist(null); update({ status: 'error', pending: null, message: message || 'Revisá los datos de la solicitud.' });
      } else if ([401, 404].includes(status)) {
        update({ status: 'blocked', message: 'La sesión ya no permite recuperar esta solicitud. No podemos confirmar si quedó registrada. Contactá a la tienda antes de crear otra.' });
      } else {
        const seconds = status === 429 ? Math.min(3600, Math.max(1, Number((error as ApiError).retryAfter) || 60)) : 0;
        update({ status: 'uncertain', retryBlocked: seconds > 0, message: seconds ? 'Esperá ' + seconds + ' segundos antes de reintentar la misma solicitud.'
          : 'No recibimos una confirmación. Reintentá con los mismos datos para recuperar el resultado sin duplicar el pedido.' });
        if (seconds) timer = setTimeout(() => update({ retryBlocked: false }), seconds * 1000);
      }
      return null;
    } finally { busy = false; }
  }
  return {
    getSnapshot: () => state, getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect: (target?: StoragePort) => {
      storage = target;
      // React Strict Mode puede volver a conectar; no reinicia una operación en curso.
      if (!state.ready) {
        try {
          if (!storage) throw new Error('storage');
          let raw: string | null;
          try { raw = storage.getItem(ATTEMPT_KEY); } catch { throw new Error('storage'); }
          const saved = restore(raw);
          if (saved?.kind === 'complete') void onSuccess(saved.cartFingerprint).catch(() => update({ storageWarning: true }));
          update(saved?.kind === 'pending' ? { ready: true, status: 'uncertain', pending: saved, message: 'Quedó una solicitud sin respuesta confirmada. Reingresá los mismos datos para recuperarla.' }
            : saved?.kind === 'complete' ? { ready: true, status: 'success', orderId: saved.orderId } : { ready: true });
        } catch (error) {
          update(error instanceof Error && error.message === 'storage' ? { ready: true, storageWarning: true } :
            { ready: true, status: 'blocked', message: 'No pudimos recuperar el registro de la última solicitud. Contactá a la tienda antes de repetirla.' });
        }
      }
      return () => { clearTimeout(timer); };
    },
    submit,
    newRequest: () => {
      if (busy || state.pending || state.status === 'blocked') return;
      persist(null); update({ status: 'idle', orderId: null, message: '' });
    },
  };
}
