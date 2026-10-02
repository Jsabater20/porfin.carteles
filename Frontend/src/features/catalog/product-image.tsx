'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { CatalogImage } from '@/lib/contracts/catalog';
import { isCatalogImageUrl } from './image-url';
import { ReferenceArt, hasReferenceArt } from './reference-art';

export function ProductImage({ image, name, sizes = '(max-width: 520px) 100vw, (max-width: 900px) 50vw, 33vw', eager = false, referenceSlug }: {
  image: CatalogImage | null; name: string; sizes?: string; eager?: boolean; referenceSlug?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const usable = image && isCatalogImageUrl(image.url) && failedUrl !== image.url;
  if (!image && referenceSlug && hasReferenceArt(referenceSlug)) return <div className="product-image product-reference"><ReferenceArt slug={referenceSlug} label={name} /></div>;
  return (
    <div className="product-image">
      {usable ? <Image src={image.url} alt={image.altText || name} fill sizes={sizes} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'}
        onError={() => setFailedUrl(image.url)} /> :
        <div className="image-placeholder" role="img" aria-label={`${name}: imagen no disponible`}><span aria-hidden="true">✳</span><small>Imagen no disponible</small></div>}
    </div>
  );
}
