import 'server-only';

import { cache } from 'react';
import { serverApi } from '@/lib/api/server';
import { ApiError } from '@/lib/api/errors';
import type { PublicSettings } from '@/lib/contracts/settings';

export const getStoreSettings = cache(async (): Promise<PublicSettings | null> => {
  try {
    return await serverApi<PublicSettings>('settings/public');
  } catch (error) {
    if (error instanceof ApiError && error.status >= 500) return null;
    throw error;
  }
});
