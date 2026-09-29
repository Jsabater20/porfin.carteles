import { ApiError } from '../../lib/api/errors';
import type { OrderPreview, PreviewInput } from '../../lib/contracts/preview';
import { previewInput } from './model';
import type { CartStore } from './store';

export interface PreviewRequest {
  method: 'POST'; body: unknown; csrfToken?: string; idempotencyKey?: string; signal: AbortSignal;
}
export type PreviewTransport = <T>(path: string, options: PreviewRequest) => Promise<T>;
export interface PreviewState {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'expired';
  preview: OrderPreview | null; message: string; lineErrors: Record<string, string[]>; priceChanges: string[];
  retryBlocked: boolean;
}
const initial: PreviewState = { status: 'idle', preview: null, message: '', lineErrors: Object.create(null), priceChanges: [], retryBlocked: false };
export function createPreviewManager(cart: CartStore, request: PreviewTransport, uuid = () => crypto.randomUUID()) {
  let state = initial;
  let attempt: { fingerprint: string; key: string } | null = null;
  let session: { csrfToken: string; expiresAt: string } | null = null;
  let generation = 0, revision = cart.getSnapshot().revision;
  let active: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const update = (next: PreviewState) => { state = next; listeners.forEach((listener) => listener()); };
  const invalidate = () => { generation++; active?.abort(); clearTimeout(timer); attempt = null; update(initial); };
  async function validate(fresh = false) {
    if (state.status === 'loading' || state.retryBlocked) return;
    const current = cart.getSnapshot();
    if (!current.ready || !current.lines.length) return;
    const payload: PreviewInput = previewInput(current);
    const fingerprint = JSON.stringify(payload);
    if (fresh || !attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, key: uuid() };
    const key = attempt.key;
    const run = ++generation;
    active?.abort(); clearTimeout(timer);
    const controller = new AbortController(); active = controller;
    update({ ...initial, status: 'loading' });
    try {
      let preview: OrderPreview | undefined;
      for (let tries = 0; tries < 2; tries++) {
        try {
          if (!session || Date.parse(session.expiresAt) <= Date.now()) session = await request('guest-session', { method: 'POST', body: {}, signal: controller.signal });
          preview = await request<OrderPreview>('orders/preview', { method: 'POST', body: payload, csrfToken: session!.csrfToken, idempotencyKey: key, signal: controller.signal });
          break;
        } catch (error) {
          if (tries === 0 && error instanceof ApiError && [401, 403].includes(error.status)) { session = null; continue; }
          throw error;
        }
      }
      if (run !== generation || fingerprint !== JSON.stringify(previewInput(cart.getSnapshot())) || !preview) return;
      const ttl = Date.parse(preview.expiresAt) - Date.now();
      if (!Number.isFinite(ttl) || ttl <= 0) { attempt = null; update({ ...initial, status: 'expired', message: 'El resumen venció. Volvé a validar el carrito.' }); return; }
      const priceChanges = preview.items.filter((item) => current.lines.find((line) => line.lineId === item.lineId)?.display.unitEstimateCents !== item.unitPriceCents).map((item) => item.lineId);
      update({ ...initial, status: 'ready', preview, priceChanges });
      timer = setTimeout(() => { attempt = null; update({ ...initial, status: 'expired', message: 'El resumen venció. Volvé a validar para obtener precios actuales.' }); }, Math.min(ttl, 2147483647));
    } catch (error) {
      if (run !== generation || controller.signal.aborted) return;
      const lineErrors: Record<string, string[]> = Object.create(null);
      if (error instanceof ApiError) for (const line of current.lines) {
        const prefix = 'Línea ' + line.lineId + ': ';
        const messages = error.messages.filter((message) => message.startsWith(prefix)).map((message) => message.slice(prefix.length));
        if (messages.length) lineErrors[line.lineId] = messages;
      }
      if (error instanceof ApiError && error.status === 410) attempt = null;
      const retrySeconds = error instanceof ApiError && error.status === 429 ? Math.min(3600, Math.max(1, Number(error.retryAfter) || 60)) : 0;
      const message = retrySeconds ? `Recibimos muchas consultas. Esperá ${retrySeconds} segundos para volver a validar.`
        : error instanceof ApiError && error.status === 422 ? 'Revisá los productos señalados. Podés editar sus opciones o quitarlos del carrito.'
        : error instanceof ApiError && error.status === 410 ? 'El resumen venció. Volvé a validar el carrito.'
        : error instanceof ApiError && [401, 403].includes(error.status) ? 'No pudimos recuperar tu sesión. Volvé a intentar; tu carrito sigue guardado.'
        : error instanceof ApiError && error.status === 409 ? 'La validación tuvo un conflicto. Reintentá la misma operación.'
        : 'No pudimos validar el carrito. Reintentá cuando vuelva la conexión.';
      update({ ...initial, status: error instanceof ApiError && error.status === 410 ? 'expired' : 'error', message, lineErrors, retryBlocked: retrySeconds > 0 });
      if (retrySeconds) timer = setTimeout(() => update({ ...state, retryBlocked: false }), retrySeconds * 1000);
    }
  }
  return {
    getSnapshot: () => state, getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect: () => {
      revision = cart.getSnapshot().revision;
      const off = cart.subscribe(() => { if (revision !== cart.getSnapshot().revision) { revision = cart.getSnapshot().revision; invalidate(); } });
      return () => { off(); invalidate(); };
    },
    validate, invalidate,
  };
}
