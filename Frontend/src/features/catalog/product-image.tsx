'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { CatalogImage } from '@/lib/contracts/catalog';
import { isCatalogImageUrl } from './image-url';

export function ProductImage({ image, name, sizes = '(max-width: 520px) 100vw, (max-width: 900px) 50vw, 33vw', eager = false }: {
  image: CatalogImage | null; name: string; sizes?: string; eager?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const usable = image && isCatalogImageUrl(image.url) && failedUrl !== image.url;
  return (
    <div className="product-image">
      {usable ? <Image src={image.url} alt={image.altText || name} fill sizes={sizes} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'}
        onError={() => setFailedUrl(image.url)} /> :
        <div className="image-placeholder" role="img" aria-label={`${name}: imagen no disponible`}><span aria-hidden="true">✳</span><small>Imagen no disponible</small></div>}
    </div>
  );
}
