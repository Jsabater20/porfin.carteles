import { PersonalizationType, ProductKind, ProductType } from '@prisma/client';

export const requiresProductIdea = (category: ProductKind | null, type: ProductType) =>
  category === 'CARTEL' && type === 'CUSTOM';

export const sendsThreeImagesByEmail = (category: ProductKind | null, type: ProductType, photoCount: number) =>
  category === 'CARTEL' && (type === 'GENERIC' || type === 'PREDEFINED') && photoCount === 3;

export const PRODUCT_IDEA_FIELD = {
  key: 'idea',
  label: 'Contanos tu idea',
  type: PersonalizationType.LONG_TEXT,
  required: true,
  position: 0,
  componentKey: null,
  minLength: null,
  maxLength: 2000,
  minValue: null,
  maxValue: null,
  options: [],
};
