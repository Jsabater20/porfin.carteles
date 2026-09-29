'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function StoreError({ reset }: { reset: () => void }) {
  return <EmptyState title="No pudimos cargar esta página" action={<Button onClick={reset}>Volver a intentar</Button>}><p>Esperá un momento y probá nuevamente.</p></EmptyState>;
}
