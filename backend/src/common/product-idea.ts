import { PersonalizationType } from '@prisma/client';

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
