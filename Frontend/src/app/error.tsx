'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function AppError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="container"><EmptyState title="Algo no salió como esperábamos" action={<Button onClick={reset}>Volver a intentar</Button>}><p>No pudimos cargar la página. Intentá nuevamente en unos momentos.</p></EmptyState></main>;
}
