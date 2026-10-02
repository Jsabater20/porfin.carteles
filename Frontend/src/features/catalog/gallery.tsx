'use client';

import { useState } from 'react';
import type { CatalogImage } from '@/lib/contracts/catalog';
import { ProductImage } from './product-image';

export function Gallery({ images, name, slug }: { images: CatalogImage[]; name: string; slug?: string }) {
  const [selectedId, setSelectedId] = useState(images.find((image) => image.cover)?.id ?? images[0]?.id);
  const selected = images.find((image) => image.id === selectedId) ?? images[0] ?? null;
  return (
    <section className="gallery" aria-label={`Imágenes de ${name}`}>
      <ProductImage image={selected} name={name} referenceSlug={slug} sizes="(max-width: 800px) 100vw, 50vw" eager />
      {images.length > 1 && <div className="gallery-thumbnails">
        {images.map((image, index) => <button key={image.id} type="button" aria-pressed={image.id === selected?.id}
          aria-label={`Ver imagen ${index + 1}: ${image.altText || name}`} onClick={() => setSelectedId(image.id)}>
          <ProductImage image={image} name={name} sizes="80px" />
        </button>)}
      </div>}
    </section>
  );
}
