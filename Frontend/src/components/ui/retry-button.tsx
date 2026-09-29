'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from './button';

export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Button disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? 'Cargando…' : 'Volver a intentar'}</Button>;
}
