import 'server-only';

import { cache } from 'react';
import { serverApi } from '@/lib/api/server';
import { ApiError } from '@/lib/api/errors';
import type { ContentKey, ContentResult, PublicContent } from '@/lib/contracts/content';

export const getContent = cache(async (page: ContentKey): Promise<ContentResult> => {
  try { return { status: 'published', data: await serverApi<PublicContent>(`content/${page}`) }; }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) return { status: 'unpublished', data: null };
    if (error instanceof ApiError && (error.status >= 500 || error.status === 429)) return { status: 'unavailable', data: null };
    throw error;
  }
});
