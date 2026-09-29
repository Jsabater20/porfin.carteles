import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFound() {
  return <main id="main-content" className="container"><EmptyState eyebrow="Página no encontrada" title="Por acá no era" action={<Link className="button" href="/">Volver a la tienda</Link>}><p>El enlace puede haber cambiado. Podés continuar desde el inicio.</p></EmptyState></main>;
}
