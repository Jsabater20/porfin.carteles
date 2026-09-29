import { readApiConfig } from '@/lib/api/config';
import { forwardToBackend } from '@/lib/api/gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardToBackend(request, path, readApiConfig());
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
