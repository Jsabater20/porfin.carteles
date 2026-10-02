import type { Metadata } from 'next';
import {productMetadata} from '@/lib/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { formatMoney } from '@/lib/format/money';
import { EmptyState } from '@/components/ui/empty-state';
import { RetryButton } from '@/components/ui/retry-button';
import { getProduct } from '@/features/catalog/queries';
import { isProductSlug, productTypes } from '@/features/catalog/filters';
import { Gallery } from '@/features/catalog/gallery';
import { ProductCustomizer } from '@/features/personalization/product-customizer';

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
  return <div className="container product-page">
    <nav className="breadcrumbs" aria-label="Ubicación"><Link href="/">Inicio</Link><span aria-hidden="true">/</span><Link href="/catalogo">Catálogo</Link><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span></nav>
    <div className="product-detail-grid">
      <Gallery key={product.id} images={product.images} name={product.name} slug={product.slug} />
      <div className="product-summary">
        <p className="eyebrow">{productTypes[product.type]}</p><h1>{product.name}</h1>
        {product.description && <p className="muted preserve-lines">{product.description}</p>}
        <ProductCustomizer key={product.id + (editLineId ?? '') + (typeof query.variante === 'string' ? query.variante : '')} product={product} editLineId={editLineId} initialVariantId={typeof query.variante === 'string' ? query.variante : undefined} />
        {product.leadTime && <p><strong>Preparación:</strong> {product.leadTime}</p>}
        <div className="tag-list">{product.categories.map((category) => <Link key={category.id} className="tag" href={`/catalogo?categoryId=${encodeURIComponent(category.id)}`}>{category.name}</Link>)}
          {product.careers.map((career) => <Link key={career.id} className="tag" href={`/catalogo?careerId=${encodeURIComponent(career.id)}`}>{career.name}</Link>)}</div>
      </div>
    </div>
    <div className="product-information">
      {(product.measurements || product.materials || product.includes) && <section><h2>Sobre este producto</h2>
        <dl className="attributes">{[['Medidas', product.measurements], ['Materiales', product.materials], ['Qué incluye', product.includes]].map(([label, value]) => value && <div key={label}><dt>{label}</dt><dd className="preserve-lines">{value}</dd></div>)}</dl>
      </section>}
      {product.components.length > 0 && <section><h2>Qué trae el combo</h2><ul className="component-list">{product.components.map((component) => <li key={component.key}><strong>{component.quantity} ×</strong> {component.name}</li>)}</ul><p className="muted">El precio corresponde al conjunto. Los elementos incluidos son los detallados en esta ficha.</p></section>}
      {product.fields.length > 0 && <section><h2>Opciones de personalización</h2><p className="muted">Estos son los datos que vas a poder completar al preparar tu pedido.</p>
        <ul className="personalization-list">{product.fields.map((field) => <li key={field.key}><strong>{field.label}</strong>{field.required && <span className="muted"> · obligatorio</span>}
          {field.componentKey && <span className="muted"> · {product.components.find((component) => component.key === field.componentKey)?.name || field.componentKey}</span>}
          {field.options.length > 0 && <ul>{field.options.map((option) => <li key={option.key}>{option.label}{option.additionalCents > 0 ? ` (+${formatMoney(option.additionalCents)})` : ' (sin adicional)'}</li>)}</ul>}
        </li>)}</ul>
      </section>}
    </div>
  </div>;
}
