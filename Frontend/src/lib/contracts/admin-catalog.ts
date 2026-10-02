import type { ProductType, Taxonomy, CatalogImage, PersonalizationField } from './catalog';
export type ProductStatus = 'HIDDEN' | 'PUBLISHED' | 'UNAVAILABLE';
export interface VariantInput { key: string; name: string; pricingMode: 'FIXED' | 'QUOTE'; priceCents: number | null; attributes: Record<string, string>; photoCount: number; active: boolean }
export interface FieldInput { key: string; label: string; type: PersonalizationField['type']; required: boolean; componentKey?: string; minLength?: number; maxLength?: number; minValue?: number; maxValue?: number; options: { key: string; label: string; additionalCents: number }[] }
export interface ComponentInput { key: string; name: string; quantity: number; referenceProductId?: string }
export type ProductKind = 'CARTEL' | 'PROP' | 'COMBO';
export interface ProductInput {
  category?: ProductKind; occasionIds?: string[];
  name: string; slug: string; description: string; type: ProductType; status: ProductStatus;
  measurements: string; materials: string; includes: string; leadTime: string;
  categoryIds: string[]; careerIds: string[]; variants: VariantInput[]; fields: FieldInput[]; components: ComponentInput[];
}
export interface AdminProduct extends Omit<ProductInput, 'categoryIds' | 'careerIds' | 'variants' | 'fields' | 'components'> {
  consolidatedInto?: { id: string; slug: string; name: string }[];
  id: string; updatedAt: string; createdAt: string;
  categories: { categoryId: string; category: Taxonomy }[]; careers: { careerId: string; career: Taxonomy }[];
  variants: (VariantInput & { id: string; position: number })[];
  fields: (Omit<FieldInput, 'componentKey' | 'minLength' | 'maxLength' | 'minValue' | 'maxValue'> & { id: string; position: number; componentKey: string | null; minLength: number | null; maxLength: number | null; minValue: number | null; maxValue: number | null })[];
  components: (Omit<ComponentInput, 'referenceProductId'> & { id: string; position: number; referenceProductId: string | null })[];
  images: CatalogImage[];
}
export interface UploadAuthorization { uploadId: string; expiresAt: string; maxBytes: number; formats: string[]; uploadUrl: string; apiKey: string; signature: string; params: Record<string, string | number | boolean> }
