import 'server-only';

import { cookies } from 'next/headers';
import { readApiConfig } from './config';
import { ApiError, parseApiResponse } from './errors';
import { routePolicy, selectCookies } from './policy';

// Solo lecturas. Las escrituras pasan por Route Handlers para conservar Set-Cookie.
export async function serverApi<T>(path: string, query?: URLSearchParams): Promise<T> {
  const scope = routePolicy(path, 'GET');
  if (!scope) throw new ApiError(400, 'Operación no disponible.');
  const { backendUrl } = readApiConfig();
  const headers = new Headers({ Accept: 'application/json' });
  if (scope !== 'public') {
    const cookie = selectCookies((await cookies()).toString(), scope);
    if (cookie) headers.set('Cookie', cookie);
  }
  let response: Response;
  try {
    response = await fetch(`${backendUrl}/${path}${query?.size ? `?${query}` : ''}`, {
      headers, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ApiError(503, 'La tienda no está disponible en este momento.');
  }
  if (response.status >= 300 && response.status < 400) throw new ApiError(502, 'Respuesta inesperada de la tienda.');
  return parseApiResponse<T>(response);
}
