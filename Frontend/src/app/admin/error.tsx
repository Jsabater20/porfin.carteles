'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="container"><EmptyState title="No pudimos abrir el panel" action={<><Button onClick={reset}>Volver a intentar</Button><Link className="text-link" href="/">Volver a la tienda</Link></>}><p>No pudimos verificar el acceso. Intentá nuevamente en unos momentos.</p></EmptyState></main>;
}
