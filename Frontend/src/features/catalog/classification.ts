import type { ProductType, Taxonomy } from '@/lib/contracts/catalog';

export type ProductCategory = 'CARTEL' | 'PROP' | 'COMBO';
export type CatalogDisplayType = ProductType | 'PREDEFINED_THREE_IMAGES';

export const categoryLabels: Record<ProductCategory, string> = {
  CARTEL: 'Cartel',
  PROP: 'Prop',
  COMBO: 'Combo',
};

export const displayTypeLabels: Record<CatalogDisplayType, string> = {
  GENERIC: 'Genérico',
  PREDEFINED: 'Predeterminado',
  PREDEFINED_THREE_IMAGES: 'Predeterminado con 3 imágenes a elección',
  CUSTOM: 'Personalizado',
  COMBO: 'Combo',
};

export function getDisplayType(category: ProductCategory | null | undefined, type: ProductType, photoCount: number): CatalogDisplayType {
  return category === 'CARTEL' && type === 'PREDEFINED' && photoCount === 3 ? 'PREDEFINED_THREE_IMAGES' : type;
}

export interface CartClassification {
  category?: ProductCategory | null;
  displayType?: CatalogDisplayType;
  occasions?: Taxonomy[];
  careers?: Taxonomy[];
}
