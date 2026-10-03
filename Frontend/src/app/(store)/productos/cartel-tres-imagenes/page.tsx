import Link from 'next/link';
import type { Metadata } from 'next';
import { getProduct } from '@/features/catalog/queries';
import { ApiError } from '@/lib/api/errors';
import { RetryButton } from '@/components/ui/retry-button';

export const metadata: Metadata = { title: 'Carteles con 3 imágenes', robots: { index: false, follow: true } };
export default async function ThreeImagesPage() {
  const results = await Promise.allSettled(['cartel-predeterminado'].map(getProduct));
  const products = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  for (const result of results) if (result.status === 'rejected' && !(result.reason instanceof ApiError)) throw result.reason;
  return <div className="container catalog-page">
    <header className="page-heading"><p className="eyebrow">Carteles</p><h1>Tu cartel predeterminado con 3 imágenes</h1><p>Elegí una de las opciones con tres imágenes dentro del cartel predeterminado y completá su personalización.</p></header>
    <p className="notice">Si habías agregado el producto anterior al carrito, quitá ese renglón y agregá la opción actualizada. Los pedidos ya enviados conservan sus datos.</p>
    <div className="product-grid">{products.map(product => <section className="panel-card" key={product.id}><h2>{product.name}</h2><ul>{product.variants.filter(variant => variant.photoCount === 3).map(variant => <li key={variant.id}><Link className="text-link" href={'/productos/' + product.slug + '?variante=' + encodeURIComponent(variant.id)}>{variant.name}</Link></li>)}</ul>{!product.variants.some(variant => variant.photoCount === 3) && <p>Las opciones con tres imágenes no están disponibles por el momento.</p>}</section>)}</div>
    {results.some(result => result.status === 'rejected') && <p className="notice">No pudimos cargar alguna de las propuestas. <RetryButton /></p>}
    <Link href="/catalogo" className="text-link">Volver al catálogo</Link>
  </div>;
}
