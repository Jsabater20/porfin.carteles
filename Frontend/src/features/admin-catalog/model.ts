import type { AdminProduct, ProductInput, FieldInput, VariantInput, ComponentInput, ProductKind } from '../../lib/contracts/admin-catalog';
export const CUID = /^c[a-z0-9]{24}$/;
export const TYPES = { GENERIC: 'Genérico', PREDEFINED: 'Predeterminado', CUSTOM: 'Personalizado', COMBO: 'Combo' };
export const KINDS = { CARTEL: 'Cartel', PROP: 'Prop', COMBO: 'Combo' };
export const SIGN_TYPES = { GENERIC: 'Genérico', PREDEFINED: 'Predeterminado', CUSTOM: 'Personalizado' };
export const isOccasion = (item: { slug: string; isOccasion?: boolean }) => item.isOccasion ?? !['carteles', 'props', 'combos'].includes(item.slug);
export const productKind = (product: Pick<AdminProduct, 'category' | 'type' | 'categories'>): ProductKind => product.category ?? (product.type === 'COMBO' ? 'COMBO' : product.categories.some(item => item.category.slug === 'props') ? 'PROP' : 'CARTEL');
export const supportsOccasions = (draft: ProductDraft) => draft.category === 'CARTEL' && ['GENERIC', 'PREDEFINED'].includes(draft.type);
export const supportsCareers = (draft: ProductDraft) => draft.category === 'CARTEL' && draft.type === 'PREDEFINED';
export function changeClassification(draft: ProductDraft, category: ProductKind, type = draft.type): ProductDraft {
  const technicalType = category === 'COMBO' ? 'COMBO' : category === 'PROP' ? 'CUSTOM' : type === 'COMBO' ? 'PREDEFINED' : type;
  const next: ProductDraft = { ...draft, category, type: technicalType };
  if (!supportsOccasions(next)) next.occasionIds = [];
  if (!supportsCareers(next)) next.careerIds = [];
  if (category !== 'COMBO' && draft.components.length) {
    next.components = [];
    next.fields = draft.fields.map(field => ({ ...field, componentKey: '' }));
  }
  return next;
}
export const STATUSES = { HIDDEN: 'Oculto', PUBLISHED: 'Publicado', UNAVAILABLE: 'No disponible' };
export const FIELD_TYPES = { SHORT_TEXT: 'Texto corto', LONG_TEXT: 'Texto largo', NUMBER: 'Número', SELECT: 'Selección' };
export const slugify = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const newKey = () => 'item-' + crypto.randomUUID();
export function moneyToCents(value: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 1000000000 ? cents : null;
}
const moneyText = (value: number | null) => value === null ? '' : (value / 100).toFixed(2);
export interface VariantDraft extends Omit<VariantInput, 'priceCents' | 'attributes' | 'photoCount'> { price: string; photos: string; attributes: { key: string; value: string }[] }
export interface FieldDraft extends Omit<FieldInput, 'minLength' | 'maxLength' | 'minValue' | 'maxValue' | 'options'> { minimum: string; maximum: string; options: { key: string; label: string; additional: string }[] }
export interface ProductDraft extends Omit<ProductInput, 'variants' | 'fields' | 'components'> { variants: VariantDraft[]; fields: FieldDraft[]; components: (Omit<ComponentInput, 'quantity'> & { quantity: string })[] }
export const blankVariant = (): VariantDraft => ({ key: newKey(), name: '', pricingMode: 'FIXED', price: '', photos: '0', active: true, attributes: [] });
export const blankField = (): FieldDraft => ({ key: newKey(), label: '', type: 'SHORT_TEXT', required: false, componentKey: '', minimum: '', maximum: '', options: [] });
export function productInput(product: AdminProduct): ProductInput {
  return {
    category: productKind(product), occasionIds: product.categories.filter(item => isOccasion(item.category)).map(item => item.categoryId),
    name: product.name, slug: product.slug, description: product.description, type: product.type, status: product.status, measurements: product.measurements, materials: product.materials, includes: product.includes, leadTime: product.leadTime,
    categoryIds: product.categories.map((item) => item.categoryId), careerIds: product.careers.map((item) => item.careerId),
    variants: product.variants.map(({ key, name, pricingMode, priceCents, attributes, photoCount, active }) => ({ key, name, pricingMode, priceCents, attributes, photoCount, active })),
    fields: product.fields.map((field) => ({ key: field.key, label: field.label, type: field.type, required: field.required, ...(field.componentKey ? { componentKey: field.componentKey } : {}),
      ...(field.minLength !== null ? { minLength: field.minLength } : {}), ...(field.maxLength !== null ? { maxLength: field.maxLength } : {}), ...(field.minValue !== null ? { minValue: field.minValue } : {}), ...(field.maxValue !== null ? { maxValue: field.maxValue } : {}),
      options: field.options.map(({ key, label, additionalCents }) => ({ key, label, additionalCents })) })),
    components: product.components.map(({ key, name, quantity, referenceProductId }) => ({ key, name, quantity, ...(referenceProductId ? { referenceProductId } : {}) })),
  };
}
export function draftProduct(product?: AdminProduct): ProductDraft {
  if (!product) return { category: 'CARTEL', occasionIds: [], name: '', slug: '', description: '', type: 'PREDEFINED', status: 'HIDDEN', measurements: '', materials: '', includes: '', leadTime: '', categoryIds: [], careerIds: [], variants: [{ key: 'base', name: 'Base', pricingMode: 'FIXED', price: '', photos: '0', active: true, attributes: [] }], fields: [], components: [] };
  const input = productInput(product);
  return { ...input, variants: input.variants.map(({ priceCents, photoCount, attributes, ...rest }) => ({ ...rest, price: moneyText(priceCents), photos: String(photoCount), attributes: Object.entries(attributes).map(([key, value]) => ({ key, value })) })),
    fields: input.fields.map(({ minLength, maxLength, minValue, maxValue, options, ...rest }) => ({ ...rest, minimum: String(minLength ?? minValue ?? ''), maximum: String(maxLength ?? maxValue ?? ''), options: options.map(({ additionalCents, ...option }) => ({ ...option, additional: moneyText(additionalCents) })) })),
    components: input.components.map((item) => ({ ...item, quantity: String(item.quantity) })) };
}
export function buildProduct(draft: ProductDraft, id?: string) {
  const errors: Record<string, string> = {};
  const error = (key: string, message: string) => { errors[key] = message; };
  const text = (key: string, value: string, max: number, required = false) => { if ((required && !value.trim()) || [...value].length > max || /[\u0000\uD800-\uDFFF]/u.test(value)) error(key, 'Revisá este texto (máximo ' + max + ' caracteres).'); return value.trim(); };
  const number = (key: string, value: string, min: number, max: number, integer = true) => { const n = Number(value.replace(',', '.')); if (!value.trim() || !/^-?\d+(?:[.,]\d+)?$/.test(value) || !Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max) error(key, 'Ingresá un número válido entre ' + min + ' y ' + max + '.'); return n; };
  const unique = (items: { key: string }[], path: string) => { if (new Set(items.map((x) => x.key)).size !== items.length || items.some((x) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.key) || x.key.length > 80)) error(path, 'Hay identificadores repetidos o inválidos. Recargá el producto.'); };
  const input: ProductInput = {
    category: draft.category, occasionIds: [...(draft.occasionIds ?? [])],
    name: text('name', draft.name, 120, true), slug: draft.slug.trim(), description: text('description', draft.description, 5000, true), type: draft.type, status: draft.status,
    measurements: text('measurements', draft.measurements, 500), materials: text('materials', draft.materials, 500), includes: text('includes', draft.includes, 2000), leadTime: text('leadTime', draft.leadTime, 500),
    categoryIds: [...draft.categoryIds], careerIds: [...draft.careerIds], variants: [], fields: [], components: [],
  };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 150) error('slug', 'Usá letras minúsculas sin acentos, números y guiones (hasta 150).');
  if (!Object.hasOwn(TYPES, draft.type) || !Object.hasOwn(STATUSES, draft.status)) error('type', 'Elegí un tipo y estado válidos.');
  if (input.categoryIds.length > 20 || new Set(input.categoryIds).size !== input.categoryIds.length) error('categoryIds', 'Hasta 20 relaciones anteriores sin repetir.');
  if (draft.category && (!Object.hasOwn(KINDS, draft.category) || (draft.category === 'COMBO') !== (draft.type === 'COMBO') || (draft.category === 'PROP' && draft.type !== 'CUSTOM'))) error('category', 'Revisá la categoría y el tipo de cartel.');
  if ((input.occasionIds?.length ?? 0) > 20 || new Set(input.occasionIds).size !== input.occasionIds?.length) error('occasionIds', 'Elegí hasta 20 ocasiones sin repetir.');
  if (input.careerIds.length > 30 || new Set(input.careerIds).size !== input.careerIds.length) error('careerIds', 'Elegí hasta 30 carreras sin repetir.');
  if (!draft.variants.length || draft.variants.length > 30) error('variants', 'Necesitás entre 1 y 30 variantes.');
  unique(draft.variants, 'variants'); unique(draft.fields, 'fields'); unique(draft.components, 'components');
  input.variants = draft.variants.map((v, i) => {
    const path = 'variants.' + i, cents = v.pricingMode === 'QUOTE' ? null : moneyToCents(v.price);
    if (v.pricingMode === 'FIXED' && cents === null) error(path + '.price', 'Ingresá un precio en pesos, con hasta dos decimales (máximo 10.000.000).');
    if (!['FIXED', 'QUOTE'].includes(v.pricingMode)) error(path + '.price', 'Elegí precio fijo o a cotizar.');
    if (v.attributes.length > 20 || new Set(v.attributes.map((a) => a.key)).size !== v.attributes.length || v.attributes.some((a) => !/^[a-zA-Z0-9_-]{1,80}$/.test(a.key) || a.value.length > 200)) error(path + '.attributes', 'Hasta 20 atributos únicos; claves sin espacios ni acentos y valores de hasta 200 caracteres.');
    return { key: v.key, name: text(path + '.name', v.name, 120, true), pricingMode: v.pricingMode, priceCents: cents, photoCount: number(path + '.photos', v.photos, 0, 10), active: v.active, attributes: Object.fromEntries(v.attributes.map((a) => [a.key, a.value])) };
  });
  if (draft.status === 'PUBLISHED' && !input.variants.some((v) => v.active)) error('variants', 'Para publicar necesitás una variante activa.');
  if (draft.components.length > 50 || (draft.type === 'COMBO') !== (draft.components.length > 0)) error('components', 'Un combo necesita entre 1 y 50 componentes. Los otros tipos no llevan componentes.');
  input.components = draft.components.map((c, i) => {
    if (c.referenceProductId === id && id) error('components.' + i, 'El combo no puede referenciarse a sí mismo.');
    return { key: c.key, name: text('components.' + i + '.name', c.name, 120, true), quantity: number('components.' + i + '.quantity', c.quantity, 1, 100), ...(c.referenceProductId ? { referenceProductId: c.referenceProductId } : {}) };
  });
  if (draft.fields.length > 30) error('fields', 'Hasta 30 campos de personalización.');
  input.fields = draft.fields.map((f, i) => {
    const path = 'fields.' + i;
    if (!Object.hasOwn(FIELD_TYPES, f.type)) error(path, 'Tipo de campo inválido.');
    if (f.componentKey && !input.components.some((c) => c.key === f.componentKey)) error(path + '.componentKey', 'Elegí un componente existente.');
    const field: FieldInput = { key: f.key, label: text(path + '.label', f.label, 120, true), type: f.type, required: f.required, ...(f.componentKey ? { componentKey: f.componentKey } : {}), options: [] };
    if (f.type === 'SELECT') {
      unique(f.options, path + '.options');
      if (!f.options.length || f.options.length > 50) error(path + '.options', 'La selección necesita entre 1 y 50 opciones.');
      field.options = f.options.map((option, n) => { const cents = moneyToCents(option.additional); if (cents === null) error(path + '.options.' + n + '.additional', 'Ingresá un adicional válido en pesos.'); return { key: option.key, label: text(path + '.options.' + n + '.label', option.label, 120, true), additionalCents: cents ?? 0 }; });
    } else if (f.type === 'NUMBER') {
      if (f.minimum !== '') field.minValue = number(path + '.minimum', f.minimum, -Number.MAX_VALUE, Number.MAX_VALUE, false);
      if (f.maximum !== '') field.maxValue = number(path + '.maximum', f.maximum, -Number.MAX_VALUE, Number.MAX_VALUE, false);
    } else {
      const max = f.type === 'SHORT_TEXT' ? 240 : 2000;
      if (f.minimum !== '') field.minLength = number(path + '.minimum', f.minimum, 0, max);
      if (f.maximum !== '') field.maxLength = number(path + '.maximum', f.maximum, 1, max);
    }
    if (Number(f.minimum.replace(',', '.')) > Number(f.maximum.replace(',', '.')) && f.minimum !== '' && f.maximum !== '' && f.type !== 'SELECT') error(path + '.maximum', 'El máximo no puede ser menor al mínimo.');
    return field;
  });
  return { input, errors };
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export const sameValue = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function changedProduct(before: ProductInput, after: ProductInput): Partial<ProductInput> {
  return Object.fromEntries(Object.keys(after).filter((key) => !sameValue(before[key as keyof ProductInput], after[key as keyof ProductInput])).map((key) => [key, after[key as keyof ProductInput]]));
}
export function moved<T>(items: T[], index: number, delta: number): T[] {
  const result = [...items]; const next = index + delta; if (index < 0 || next < 0 || index >= items.length || next >= items.length) return result;
  [result[index], result[next]] = [result[next], result[index]]; return result;
}
