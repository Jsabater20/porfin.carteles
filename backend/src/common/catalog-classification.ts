import { ProductKind, ProductType } from '@prisma/client';

export enum CatalogDisplayType {
  GENERIC = 'GENERIC',
  PREDEFINED = 'PREDEFINED',
  PREDEFINED_THREE_IMAGES = 'PREDEFINED_THREE_IMAGES',
  CUSTOM = 'CUSTOM',
  COMBO = 'COMBO',
}

export function catalogDisplayType(category: ProductKind | null, type: ProductType, photoCount: number): CatalogDisplayType {
  if (category === ProductKind.CARTEL && type === ProductType.PREDEFINED && photoCount === 3) {
    return CatalogDisplayType.PREDEFINED_THREE_IMAGES;
  }
  return type as CatalogDisplayType;
}
