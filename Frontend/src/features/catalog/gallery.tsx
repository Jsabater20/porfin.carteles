'use client';

import { useState } from 'react';
import type { CatalogImage, CatalogShape } from '@/lib/contracts/catalog';
import { ProductImage } from './product-image';

export function Gallery({ images, name, slug, preferredShape }: { images: CatalogImage[]; name: string; slug?: string; preferredShape?: CatalogShape | null }) {
  const ordered = preferredShape ? images.filter((image) => image.shape === preferredShape) : images;
  const [selectedId, setSelectedId] = useState(ordered.find((image) => image.shape === preferredShape)?.id ?? ordered.find((image) => image.cover)?.id ?? ordered[0]?.id);
  const selected = ordered.find((image) => image.id === selectedId) ?? ordered[0] ?? null;
  return (
    <section className="gallery" aria-label={`Imágenes de ${name}`}>
      <ProductImage image={selected} name={name} referenceSlug={slug} referenceShape={preferredShape} sizes="(max-width: 800px) 100vw, 50vw" eager />
      {ordered.length > 1 && <div className="gallery-thumbnails">
        {ordered.map((image, index) => <button key={image.id} type="button" aria-pressed={image.id === selected?.id}
          aria-label={`Ver imagen ${index + 1}: ${image.altText || name}`} onClick={() => setSelectedId(image.id)}>
          <ProductImage image={image} name={name} sizes="80px" />
        </button>)}
      </div>}
    </section>
  );
}
