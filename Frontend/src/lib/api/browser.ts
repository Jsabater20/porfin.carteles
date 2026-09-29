'use client';

import { ApiError, parseApiResponse } from './errors';
import { routePolicy } from './policy';

interface BrowserOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: URLSearchParams;
  csrfToken?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function browserApi<T>(path: string, options: BrowserOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const scope = routePolicy(path, method);
  if (!scope) throw new ApiError(400, 'Operación no disponible.');
  const headers = new Headers({ Accept: 'application/json' });
  if (method !== 'GET') {
    headers.set('Content-Type', 'application/json');
    headers.set('X-Requested-With', scope === 'guest' ? 'porfin-storefront' : 'porfin-admin');
    if (options.csrfToken) headers.set('X-CSRF-Token', options.csrfToken);
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  }
  let response: Response;
  try {
    response = await fetch(`/api/backend/${path}${options.query?.size ? '?' + options.query.toString() : ''}`, {
      method, headers, credentials: 'same-origin', cache: 'no-store',
      body: method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(503, 'No pudimos conectar con la tienda. Intentá nuevamente.');
  }
  return parseApiResponse<T>(response);
}
