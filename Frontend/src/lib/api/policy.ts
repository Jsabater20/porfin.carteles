export type ApiScope = 'public' | 'admin' | 'guest';
export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

// Se amplía por etapa: ningún comodín expone automáticamente nuevas rutas de NestJS.
const routes: Record<string, Partial<Record<ApiMethod, ApiScope>>> = {
  'orders/preview': { POST: 'guest' },
  orders: { POST: 'guest' },
  'admin/orders': { GET: 'admin' },
  'admin/orders/calendar': { GET: 'admin' },
  'admin/orders/manual': { POST: 'admin' },
  'admin/calendar-integration/status': { GET: 'admin' },
  'admin/calendar-integration/google/start': { POST: 'admin' },
  'admin/calendar-integration/google/complete': { POST: 'admin' },
  'admin/calendar-integration/google/sync': { POST: 'admin' },
  'admin/calendar-integration/google': { DELETE: 'admin' },
  'admin/payments': { POST: 'admin' },
  'admin/content': { GET: 'admin', PATCH: 'admin' },
  'admin/admins': { GET: 'admin', POST: 'admin' },
  'admin/products': { GET: 'admin', POST: 'admin' },
  'admin/categories': { GET: 'admin', POST: 'admin' },
  'admin/careers': { GET: 'admin', POST: 'admin' },
  'admin/media/upload-signature': { POST: 'admin' },
  'admin/media/complete': { POST: 'admin' },
  products: { GET: 'public' },
  categories: { GET: 'public' },
  occasions: { GET: 'public' },
  careers: { GET: 'public' },
  health: { GET: 'public' },
  'health/ready': { GET: 'public' },
  'settings/public': { GET: 'public' },
  'auth/me': { GET: 'admin' },
  'auth/login': { POST: 'admin' },
  'auth/logout': { POST: 'admin' },
  'auth/recovery': { POST: 'admin' },
  'auth/reset': { POST: 'admin' },
  'guest-session': { POST: 'guest', DELETE: 'guest' },
};

export function routePolicy(path: string, method: string): ApiScope | undefined {
  if (/^admin\/orders\/c[a-z0-9]{24}$/.test(path) && ['GET', 'DELETE'].includes(method)) return 'admin';
  if (/^admin\/orders\/c[a-z0-9]{24}\/status$/.test(path) && method === 'PATCH') return 'admin';
  if (/^admin\/orders\/c[a-z0-9]{24}\/schedule$/.test(path) && method === 'PATCH') return 'admin';
  if (/^admin\/orders\/c[a-z0-9]{24}\/quotes$/.test(path) && method === 'POST') return 'admin';
  if (/^admin\/orders\/c[a-z0-9]{24}\/quotes\/c[a-z0-9]{24}\/status$/.test(path) && method === 'PATCH') return 'admin';
  if (/^admin\/payments\/orders\/c[a-z0-9]{24}$/.test(path) && method === 'GET') return 'admin';
  if (/^admin\/admins\/c[a-z0-9]{24}$/.test(path) && method === 'PATCH') return 'admin';
  if (/^admin\/(products|categories|careers)\/c[a-z0-9]{24}$/.test(path) && (['PATCH', 'DELETE'].includes(method) || method === 'GET' && path.startsWith('admin/products/'))) return 'admin';
  if (/^admin\/products\/c[a-z0-9]{24}\/images$/.test(path) && method === 'GET') return 'admin';
  if (/^admin\/products\/c[a-z0-9]{24}\/images\/order$/.test(path) && method === 'PATCH') return 'admin';
  if (/^admin\/products\/c[a-z0-9]{24}\/images\/c[a-z0-9]{24}$/.test(path) && ['PATCH', 'DELETE'].includes(method)) return 'admin';
  if (/^admin\/media\/uploads\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(path) && method === 'DELETE') return 'admin';
  if (method === 'GET' && /^orders\/c[a-z0-9]{24}$/.test(path)) return 'guest';
  if (method === 'GET' && (/^products\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) && path.slice(9).length <= 150 || /^content\/(home|about|contact|faq)$/.test(path))) return 'public';
  if (!Object.hasOwn(routes, path) || !Object.hasOwn(routes[path], method)) return undefined;
  return routes[path][method as ApiMethod];
}

export function sessionCookieNames(scope: ApiScope): string[] {
  if (scope === 'public') return [];
  const suffix = scope === 'admin' ? 'session' : 'guest';
  return [`porfin_${suffix}`, `__Host-porfin_${suffix}`];
}

export function selectCookies(header: string | null, scope: ApiScope): string {
  const allowed = sessionCookieNames(scope);
  // Se conservan duplicados para que NestJS pueda rechazarlos, sin elegir uno arbitrariamente.
  return (header ?? '').split(';').map((part) => part.trim()).filter((part) => {
    const separator = part.indexOf('=');
    return separator > 0 && allowed.includes(part.slice(0, separator));
  }).join('; ');
}
