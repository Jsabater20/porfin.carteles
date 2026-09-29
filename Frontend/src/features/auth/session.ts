import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { serverApi } from '@/lib/api/server';
import { ApiError } from '@/lib/api/errors';
import { sessionCookieNames } from '@/lib/api/policy';
import type { AdminSession } from '@/lib/contracts/auth';

export const requireAdminSession = cache(async (): Promise<AdminSession> => {
  const jar = await cookies();
  if (!sessionCookieNames('admin').some((name) => jar.has(name))) redirect('/admin/login');
  try {
    return await serverApi<AdminSession>('auth/me');
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) redirect('/admin/login?estado=vencida');
    throw error;
  }
});
