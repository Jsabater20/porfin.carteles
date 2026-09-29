import Link from 'next/link';
import type { ProductCard as Product } from '@/lib/contracts/catalog';
import { productTypes } from './filters';
import { CatalogPrice } from './price';
import { ProductImage } from './product-image';

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <Link href={`/productos/${product.slug}`} className="product-card-link">
        <ProductImage image={product.coverImage} name={product.name} />
        <div className="product-card-copy">
          <span className="eyebrow">{productTypes[product.type]}</span>
          <h3>{product.name}</h3>
          <CatalogPrice price={product.basePrice} />
          {product.leadTime && <p className="card-lead-time">{product.leadTime}</p>}
          <span className="card-action">Ver producto <span aria-hidden="true">↗</span></span>
        </div>
      </Link>
    </article>
  );
}
