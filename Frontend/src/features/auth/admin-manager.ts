import { ApiError } from '../../lib/api/errors';
import type { AdminSession } from '../../lib/contracts/auth';
interface RequestOptions { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; query?: URLSearchParams; idempotencyKey?: string; body?: unknown; csrfToken?: string; signal?: AbortSignal }
export type AdminTransport = <T>(path: string, options?: RequestOptions) => Promise<T>;
export function createAdminManager(initial: AdminSession, request: AdminTransport, leave: (reason: 'expired' | 'logout' | 'changed') => void, broadcast = () => {}) {
  let state = { session: initial as AdminSession | null, message: '', loggingOut: false };
  const serverState = state;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  let checking: Promise<void> | undefined;
  let connected = false;
  const update = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); };
  const end = (reason: 'expired' | 'logout' | 'changed') => { if (!state.session) return; generation++; clearTimeout(timer); clearInterval(poll); update({ session: null, loggingOut: false, message: '' }); leave(reason); };
  const arm = () => {
    clearTimeout(timer);
    if (!connected || !state.session) return;
    const ttl = Date.parse(state.session.expiresAt) - Date.now();
    if (!Number.isFinite(ttl) || ttl <= 0) { end('expired'); return; }
    timer = setTimeout(() => end('expired'), Math.min(ttl, 2147483647));
  };
  async function refresh() {
    if (!state.session || state.loggingOut) return;
    if (checking) return checking;
    const run = generation;
    const task = (async () => {
      try {
        const session = await request<AdminSession>('auth/me');
        if (run !== generation) return;
        if (!session.admin.active) { end('expired'); return; }
        if (session.admin.id !== state.session?.admin.id || session.admin.role !== state.session?.admin.role || session.admin.name !== state.session?.admin.name) { end('changed'); return; }
        update({ session, message: '' }); arm();
      } catch (error) {
        if (run !== generation) return;
        if (error instanceof ApiError && [401, 403].includes(error.status)) end('expired');
        else update({ message: 'No pudimos verificar la sesión. Reintentaremos al recuperar la conexión.' });
      }
    })();
    checking = task;
    try { await task; } finally { if (checking === task) checking = undefined; }
  }
  async function logout() {
    if (state.loggingOut || !state.session) return;
    generation++; update({ loggingOut: true, message: '' });
    try {
      // Recupera CSRF actual sin persistirlo ni tocar la sesión invitada.
      const current = await request<AdminSession>('auth/me');
      await request('auth/logout', { method: 'POST', body: {}, csrfToken: current.csrfToken });
      broadcast(); end('logout');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { broadcast(); end('logout'); }
      else update({ loggingOut: false, message: 'No pudimos confirmar el cierre de sesión. Volvé a intentarlo.' });
    }
  }
  async function adminRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!state.session || state.loggingOut) throw new ApiError(401, 'Iniciá sesión para continuar.');
    if (Date.parse(state.session.expiresAt) <= Date.now()) { end('expired'); throw new ApiError(401, 'La sesión venció.'); }
    try { return await request<T>(path, { ...options, csrfToken: state.session.csrfToken }); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) end('expired');
      else if (error instanceof ApiError && error.status === 403) await refresh();
      // Nunca repite automáticamente una escritura.
      throw error;
    }
  }
  return {
    getSnapshot: () => state, getServerSnapshot: () => serverState,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect: () => { connected = true; arm(); if (state.session) { poll = setInterval(() => void refresh(), 60_000); void refresh(); } return () => { connected = false; generation++; checking = undefined; clearTimeout(timer); clearInterval(poll); }; },
    refresh, logout, request: adminRequest,
  };
}
