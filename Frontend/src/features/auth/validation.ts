import { ApiError } from '../../lib/api/errors';
export type AuthMode = 'login' | 'recovery' | 'reset';
export function validateAuth(mode: AuthMode, email: string, password: string, confirmation: string) {
  const errors: Record<string, string> = {};
  const normalizedEmail = email.trim().toLowerCase();
  if (mode !== 'reset' && (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))) errors.email = 'Ingresá un correo electrónico válido.';
  if (mode !== 'recovery' && ([...password].length < (mode === 'reset' ? 12 : 1) || [...password].length > 128)) errors.password = mode === 'reset' ? 'Usá entre 12 y 128 caracteres.' : 'Ingresá tu contraseña (hasta 128 caracteres).';
  if (mode === 'reset' && password !== confirmation) errors.confirmation = 'Las contraseñas no coinciden.';
  return { errors, email: normalizedEmail };
}
export function resetToken(fragment: string): string {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const tokens = params.getAll('token');
  return tokens.length === 1 && /^[a-f0-9]{64}$/.test(tokens[0]) ? tokens[0] : '';
}
export function retryDelay(error: unknown, now = Date.now()): number {
  if (!(error instanceof ApiError) || error.status !== 429) return 0;
  const seconds = Number(error.retryAfter);
  const delay = error.retryAfter && Number.isFinite(seconds) ? seconds : (Date.parse(error.retryAfter ?? '') - now) / 1000;
  return Math.min(3600, Math.max(1, Math.ceil(Number.isFinite(delay) ? delay : 60)));
}
export function authMessage(mode: AuthMode, error: unknown) {
  if (error instanceof ApiError && error.status === 429) return 'Hubo demasiados intentos. Esperá antes de volver a intentar.';
  if (mode === 'login' && error instanceof ApiError && error.status === 401) return 'Correo o contraseña incorrectos.';
  if (mode === 'reset' && error instanceof ApiError && error.status === 400) return 'El enlace no es válido, ya fue utilizado o venció. Solicitá otro.';
  if (mode === 'recovery') return 'La recuperación no está disponible en este momento. Intentá más tarde.';
  if (mode === 'reset') return 'No pudimos confirmar el cambio. Podés reintentar o probar iniciar sesión con tu contraseña nueva.';
  return 'No pudimos iniciar sesión. Revisá la conexión y volvé a intentar.';
}
export const adminNavigation = (role: 'ADMIN' | 'OWNER') => [
  { label: 'Inicio', href: '/admin', enabled: true },
  { label: 'Productos', href: '/admin/productos', enabled: true },
  { label: 'Categorías', href: '/admin/categorias', enabled: true },
  { label: 'Carreras', href: '/admin/carreras', enabled: true },
  { label: 'Pedidos', href: '/admin/pedidos', enabled: true },
  { label: 'Contenido', href: '/admin/contenido', enabled: true },
  { label: 'Configuración', href: '/admin/configuracion', enabled: true },
  ...(role === 'OWNER' ? [{ label: 'Administradores', href: '/admin/administradores', enabled: true }] : []),
];
