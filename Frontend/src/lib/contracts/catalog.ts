export type ProductType = 'GENERIC' | 'PREDEFINED' | 'CUSTOM' | 'COMBO';
export interface Taxonomy { id: string; name: string; slug: string }
export interface CatalogImage { id: string; url: string; altText: string; position: number; cover: boolean; width: number; height: number }
export interface BasePrice { currency: 'ARS'; fromCents: number | null; toCents: number | null; hasQuoteVariants: boolean }
export interface ProductCard {
  id: string; name: string; slug: string; type: ProductType; leadTime: string;
  categories: Taxonomy[]; careers: Taxonomy[]; coverImage: CatalogImage | null; basePrice: BasePrice;
}
export interface Variant { id: string; key: string; name: string; pricingMode: 'FIXED' | 'QUOTE'; priceCents: number | null; attributes: Record<string, string>; photoCount: number }
export interface PersonalizationField {
  key: string; label: string; type: 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'SELECT';
  required: boolean; position: number; componentKey: string | null;
  minLength: number | null; maxLength: number | null; minValue: number | null; maxValue: number | null;
  options: { key: string; label: string; additionalCents: number; position: number }[];
}
export interface ProductDetail extends ProductCard {
  description: string; measurements: string; materials: string; includes: string;
  images: CatalogImage[]; variants: Variant[]; fields: PersonalizationField[];
  components: { key: string; name: string; quantity: number; position: number }[];
}
export interface PublicPage<T> { items: T[]; total: number; page: number; limit: number }
