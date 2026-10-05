import { GoogleCalendarCallback } from '@/features/admin-operations/google-calendar-callback';
import { requireAdminSession } from '@/features/auth/session';

export default async function GoogleCalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminSession();
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === 'string' ? query[key] as string : undefined;
  return <GoogleCalendarCallback code={value('code')} state={value('state')} error={value('error')}/>;
}
