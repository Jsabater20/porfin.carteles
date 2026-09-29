import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';

export default function ProductNotFound() {
  return <div className="container"><EmptyState title="Este producto no está disponible" action={<Link href="/catalogo" className="button">Volver al catálogo</Link>}><p>Puede haber cambiado el enlace o dejado de estar publicado.</p></EmptyState></div>;
}
