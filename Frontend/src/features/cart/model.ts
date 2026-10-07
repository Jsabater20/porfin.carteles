import type { Answer, DeliveryMethod, PreviewInput } from '../../lib/contracts/preview';
import type { CartClassification, CatalogDisplayType, ProductCategory } from '../catalog/classification';
import type { Taxonomy } from '../../lib/contracts/catalog';

export const CART_KEY = 'porfin.cart.v1';
export const CART_TTL = 7 * 24 * 60 * 60 * 1000;
export interface CartLine {
  lineId: string; productId: string; variantId: string; quantity: number; answers: Answer[];
  display: CartClassification & {
    slug: string; name: string; variantName: string; unitEstimateCents: number | null;
    photoCount: number; labels: { fieldKey: string; label: string; optionLabel?: string }[];
  };
}
export interface CartData { lines: CartLine[]; deliveryMethod: DeliveryMethod }
export interface SavedCart extends CartData { version: 1; expiresAt: number }
export const emptyCart = (): CartData => ({ lines: [], deliveryMethod: 'UNDECIDED' });
export function previewInput(cart: CartData): PreviewInput {
  return { deliveryMethod: cart.deliveryMethod, items: cart.lines.map((line) => ({
    lineId: line.lineId, productId: line.productId, variantId: line.variantId, quantity: line.quantity,
    answers: line.answers.map(({ fieldKey, value }) => ({ fieldKey, value })).sort((a, b) => a.fieldKey.localeCompare(b.fieldKey, 'en')),
  })) };
}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && [...value].length <= max && value.isWellFormed() && !value.includes(String.fromCharCode(0));
const id = (value: unknown): value is string => text(value, 100) && value.length > 0;
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const productCategory = (value: unknown): value is ProductCategory => ['CARTEL', 'PROP', 'COMBO'].includes(String(value));
const displayType = (value: unknown): value is CatalogDisplayType => ['GENERIC', 'PREDEFINED', 'PREDEFINED_THREE_IMAGES', 'CUSTOM', 'COMBO'].includes(String(value));
function taxonomies(value: unknown): Taxonomy[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) throw new Error();
  return value.map(item => {
    if (!object(item) || !id(item.id) || !text(item.name, 200) || !text(item.slug, 150) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) throw new Error();
    return { id: item.id, name: item.name, slug: item.slug };
  });
}
export function restoreCart(raw: string | null, now = Date.now()): { data: CartData; notice: string; expiresAt: number } {
  const empty = (notice = '') => ({ data: emptyCart(), notice, expiresAt: 0 });
  if (!raw) return empty();
  try {
    if (raw.length > 3 * 1024 * 1024) return empty('No pudimos recuperar el carrito guardado.');
    const saved: unknown = JSON.parse(raw);
    if (!object(saved) || saved.version !== 1 || !Array.isArray(saved.lines) || saved.lines.length > 30 ||
      !['UNDECIDED', 'PICKUP', 'SHIPPING'].includes(String(saved.deliveryMethod)) || typeof saved.expiresAt !== 'number' || !Number.isFinite(saved.expiresAt)) throw new Error();
    if (saved.expiresAt <= now) return empty('El carrito guardado venció. Podés empezar uno nuevo.');
    if (saved.expiresAt > now + CART_TTL + 60_000) throw new Error();
    const lines: CartLine[] = saved.lines.map((line: unknown) => {
      if (!object(line) || !text(line.lineId, 80) || !/^[a-zA-Z0-9_-]+$/.test(line.lineId) || !id(line.productId) || !id(line.variantId) ||
        typeof line.quantity !== 'number' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100 ||
        !Array.isArray(line.answers) || line.answers.length > 30 || !object(line.display)) throw new Error();
      const answers: Answer[] = line.answers.map((answer: unknown) => {
        if (!object(answer) || !text(answer.fieldKey, 80) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(answer.fieldKey) ||
          !(text(answer.value, 2000) || typeof answer.value === 'number' && Number.isFinite(answer.value))) throw new Error();
        return { fieldKey: answer.fieldKey, value: answer.value as string | number };
      });
      if (new Set(answers.map((answer) => answer.fieldKey)).size !== answers.length) throw new Error();
      const d = line.display;
      if (!text(d.slug, 150) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug) || !text(d.name, 200) || !text(d.variantName, 200) ||
        !(d.unitEstimateCents === null || amount(d.unitEstimateCents)) || !amount(d.photoCount) || !Array.isArray(d.labels) || d.labels.length > 30) throw new Error();
      const labels = d.labels.map((label: unknown) => {
        if (!object(label) || !text(label.fieldKey, 80) || !text(label.label, 400) || label.optionLabel !== undefined && !text(label.optionLabel, 200)) throw new Error();
        return { fieldKey: label.fieldKey, label: label.label, ...(label.optionLabel !== undefined ? { optionLabel: label.optionLabel as string } : {}) };
      });
      const currentIdea = answers.find(answer => answer.fieldKey === 'idea');
      const legacyIdea = !currentIdea && answers.length ? (answers.length === 1
        ? String(labels.find(label => label.fieldKey === answers[0].fieldKey)?.optionLabel ?? answers[0].value)
        : answers.map(answer => { const label = labels.find(item => item.fieldKey === answer.fieldKey); return `${label?.label ?? answer.fieldKey}: ${label?.optionLabel ?? answer.value}`; }).join('\n')) : '';
      const ideaText = [...String(currentIdea?.value ?? legacyIdea).normalize('NFC')].slice(0, 2000).join('');
      if (d.category !== undefined && d.category !== null && !productCategory(d.category)) throw new Error();
      if (d.displayType !== undefined && !displayType(d.displayType)) throw new Error();
      const keepsIdea = d.category === undefined || d.displayType === undefined || d.category === 'CARTEL' && d.displayType === 'CUSTOM';
      const normalizedAnswers: Answer[] = keepsIdea && ideaText ? [{ fieldKey: 'idea', value: ideaText }] : [];
      const normalizedLabels = keepsIdea && ideaText ? [{ fieldKey: 'idea', label: 'Contanos tu idea' }] : [];
      const occasions = taxonomies(d.occasions), careers = taxonomies(d.careers);
      return { lineId: line.lineId, productId: line.productId, variantId: line.variantId, quantity: line.quantity, answers: normalizedAnswers,
        display: { slug: d.slug, name: d.name, variantName: d.variantName, unitEstimateCents: d.unitEstimateCents as number | null, photoCount: d.photoCount, labels: normalizedLabels,
          ...(d.category !== undefined ? { category: d.category as ProductCategory | null } : {}), ...(d.displayType !== undefined ? { displayType: d.displayType as CatalogDisplayType } : {}),
          ...(occasions !== undefined ? { occasions } : {}), ...(careers !== undefined ? { careers } : {}) } };
    });
    if (new Set(lines.map((line) => line.lineId)).size !== lines.length) throw new Error();
    const data: CartData = { lines, deliveryMethod: saved.deliveryMethod as DeliveryMethod };
    if (new TextEncoder().encode(JSON.stringify(previewInput(data))).length > 1024 * 1024) throw new Error();
    return { data, notice: '', expiresAt: saved.expiresAt };
  } catch { return empty('No pudimos recuperar el carrito guardado. Podés armarlo nuevamente.'); }
}
