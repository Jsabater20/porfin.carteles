import type { Metadata } from 'next';
import {productMetadata} from '@/lib/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { EmptyState } from '@/components/ui/empty-state';
import { RetryButton } from '@/components/ui/retry-button';
import { getProduct } from '@/features/catalog/queries';
import { isProductSlug, productTypes } from '@/features/catalog/filters';
import { Gallery } from '@/features/catalog/gallery';
import { hasReferenceArt } from '@/features/catalog/reference-art';
import { ProductCustomizer } from '@/features/personalization/product-customizer';
import type { CatalogShape } from '@/lib/contracts/catalog';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ editar?: string | string[]; variante?: string | string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isProductSlug(slug)) return { title: 'Producto no disponible', robots: { index: false } };
  try {
    const product = await getProduct(slug);
    return productMetadata(product);
  } catch (error) {
    if (error instanceof ApiError) return { title: 'Producto no disponible', robots: { index: false } };
    throw error;
  }
}
export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const editLineId = typeof query.editar === 'string' ? query.editar : undefined;
  if (!isProductSlug(slug)) notFound();
  let product;
  try { product = await getProduct(slug); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    if (!(error instanceof ApiError)) throw error;
    return <div className="container"><EmptyState title="No pudimos cargar este producto" action={<RetryButton />}><p>Intentá nuevamente en unos minutos.</p></EmptyState></div>;
  }
  const initialVariantId = typeof query.variante === 'string' ? query.variante : undefined;
  const shapeOf = (format?: string): CatalogShape | null => {
    const shape = format?.toUpperCase();
    return shape && ['RECTANGULAR', 'CIRCULAR', 'XXL'].includes(shape) ? shape as CatalogShape : null;
  };
  const hasArtwork = (item: typeof product.variants[number]) => {
    const shape = shapeOf(item.attributes.formato);
    return shape
      ? product.images.some(image => image.shape === shape) || hasReferenceArt(product.slug, shape)
      : product.images.some(image => image.shape === null) || hasReferenceArt(product.slug);
  };
  const selectedVariant = product.variants.find(item => item.id === initialVariantId && (editLineId || product.category !== 'CARTEL' || hasArtwork(item)))
    ?? product.variants.find(item => product.category === 'CARTEL' && hasArtwork(item)) ?? product.variants[0];
  if (!selectedVariant) notFound();
  const format = selectedVariant?.attributes.formato?.toUpperCase();
  const preferredShape = shapeOf(format);
  const sameShapeVariants = product.variants.filter(item => shapeOf(item.attributes.formato) === preferredShape);
  const variantLabel = selectedVariant.name.trim().replace(/\s*[·-]\s*con 3 im[aá]genes$/i, '');
  const displayName = variantLabel && variantLabel.toLocaleLowerCase('es-AR') !== 'base' && !product.name.toLocaleLowerCase('es-AR').includes(variantLabel.toLocaleLowerCase('es-AR'))
    ? `${product.name} · ${variantLabel}` : product.name;
  return <div className="container product-page">
    <nav className="breadcrumbs" aria-label="Ubicación"><Link href="/">Inicio</Link><span aria-hidden="true">/</span><Link href="/catalogo">Catálogo</Link><span aria-hidden="true">/</span><span aria-current="page">{displayName}</span></nav>
    <div className="product-detail-grid">
      <Gallery key={product.id + (preferredShape ?? '')} images={product.images} name={displayName} slug={product.slug} preferredShape={preferredShape} />
      <div className="product-summary">
        <p className="eyebrow">{productTypes[product.type]}</p><h1>{displayName}</h1>
        {product.description && <p className="muted preserve-lines">{product.description}</p>}
        <ProductCustomizer key={product.id + (editLineId ?? '') + selectedVariant.id} product={{ ...product, variants: sameShapeVariants }} editLineId={editLineId} initialVariantId={selectedVariant.id} />
        <div className="tag-list">{product.categories.map((category) => <Link key={category.id} className="tag" href={`/catalogo?categoryId=${encodeURIComponent(category.id)}`}>{category.name}</Link>)}
          {product.careers.map((career) => <Link key={career.id} className="tag" href={`/catalogo?careerId=${encodeURIComponent(career.id)}`}>{career.name}</Link>)}</div>
      </div>
    </div>
    <div className="product-information">
      {(product.measurements || product.includes) && <section><h2>Sobre este producto</h2>
        <dl className="attributes">{[['Medidas', product.measurements], ['Qué incluye', product.includes]].map(([label, value]) => value && <div key={label}><dt>{label}</dt><dd className="preserve-lines">{value}</dd></div>)}</dl>
      </section>}
      {product.components.length > 0 && <section><h2>Qué trae el combo</h2><ul className="component-list">{product.components.map((component) => <li key={component.key}><strong>{component.quantity} ×</strong> {component.name}</li>)}</ul><p className="muted">El precio corresponde al conjunto. Los elementos incluidos son los detallados en esta ficha.</p></section>}
    </div>
  </div>;
}
