import Link from 'next/link';
import type { ProductCard as Product } from '@/lib/contracts/catalog';
import { productTypes } from './filters';
import { CatalogPrice } from './price';
import { ProductImage } from './product-image';

export function ProductCard({ product, catalogClassification = false }: { product: Product; catalogClassification?: boolean }) {
  const href = `/productos/${product.slug}${product.defaultVariantId ? `?variante=${encodeURIComponent(product.defaultVariantId)}` : ''}`;
  return (
    <article className="product-card">
      <Link href={href} className="product-card-link">
        <ProductImage image={product.coverImage} name={product.name} referenceSlug={product.slug} referenceShape={product.displayShape} />
        <div className="product-card-copy">
          <span className="eyebrow">{(catalogClassification && product.category === 'PROP') || product.categories.some(category => category.slug === 'props') ? 'Props · carteles chicos' : productTypes[product.type]}</span>
          <h3>{product.name}</h3>
          <CatalogPrice price={product.basePrice} />
          <span className="card-action">Ver producto <span aria-hidden="true">↗</span></span>
        </div>
      </Link>
    </article>
  );
}
