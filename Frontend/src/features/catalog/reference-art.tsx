import { useId } from 'react';

interface ReferenceArtwork { page: number; frame: string }
const artworks: Record<string, ReferenceArtwork> = {
  'cartel-generico': { page: 2, frame: '120 495 585 675' },
  'cartel-predeterminado': { page: 3, frame: '40 580 730 480' },
  'cartel-tres-imagenes': { page: 4, frame: '130 510 550 660' },
  'cartel-baby-shower': { page: 5, frame: '130 470 590 695' },
  'cartel-personalizado': { page: 6, frame: '25 370 770 925' },
  'props-personalizados': { page: 7, frame: '100 540 620 480' },
  'combo-1': { page: 9, frame: '65 510 665 815' },
  'combo-2': { page: 10, frame: '40 475 750 710' },
  'combo-3': { page: 11, frame: '30 560 750 770' },
};
export function hasReferenceArt(slug?: string): boolean { return Boolean(slug && Object.hasOwn(artworks, slug)); }
/** Display the artwork area of the original PDF page; the source image remains intact. */
export function ReferenceArt({ slug, label }: { slug: string; label: string }) {
  const clipId = useId();
  const artwork = Object.hasOwn(artworks, slug) ? artworks[slug] : undefined;
  if (!artwork) return null;
  const [x, y, width, height] = artwork.frame.split(' ').map(Number);
  return <svg className="reference-art" viewBox={artwork.frame} role="img" aria-label={label}>
    <defs><clipPath id={clipId}><rect x={x} y={y} width={width} height={height} /></clipPath></defs>
    <image clipPath={'url(#' + clipId + ')'} href={'/catalogo/referencia/pagina-' + artwork.page + '.webp'} width="813" height="1444" />
  </svg>;
}
