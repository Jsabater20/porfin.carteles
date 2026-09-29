import type { PersonalizationField, ProductDetail, Variant } from '../../lib/contracts/catalog';
import type { Answer } from '../../lib/contracts/preview';

export function validateAnswers(fields: PersonalizationField[], values: Record<string, string>) {
  const answers: Answer[] = [];
  const errors: Record<string, string> = Object.create(null);
  for (const field of fields) {
    const value = (Object.hasOwn(values, field.key) ? values[field.key] : '').normalize('NFC').trim();
    if (!value) { if (field.required) errors[field.key] = 'Completá este campo.'; continue; }
    if (!value.isWellFormed() || value.includes(String.fromCharCode(0))) { errors[field.key] = 'El texto contiene caracteres no admitidos.'; continue; }
    if (field.type === 'NUMBER') {
      // No aceptar hexadecimal, infinito ni convertir un campo vacío en cero.
      const numeric = /^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value) ? Number(value.replace(',', '.')) : NaN;
      if (!Number.isFinite(numeric)) errors[field.key] = 'Ingresá un número válido.';
      else if (field.minValue !== null && numeric < field.minValue) errors[field.key] = `El mínimo es ${field.minValue}.`;
      else if (field.maxValue !== null && numeric > field.maxValue) errors[field.key] = `El máximo es ${field.maxValue}.`;
      else answers.push({ fieldKey: field.key, value: numeric });
    } else if (field.type === 'SELECT') {
      if (!field.options.some((option) => option.key === value)) errors[field.key] = 'Elegí una opción disponible.';
      else answers.push({ fieldKey: field.key, value });
    } else {
      const length = [...value].length;
      const max = Math.min(field.type === 'SHORT_TEXT' ? 240 : 2000, field.maxLength ?? Infinity);
      if (length < (field.minLength ?? 0)) errors[field.key] = `Escribí al menos ${field.minLength} caracteres.`;
      else if (length > max) errors[field.key] = `Usá como máximo ${max} caracteres.`;
      else answers.push({ fieldKey: field.key, value });
    }
  }
  return { answers, errors };
}
export function estimateUnit(product: ProductDetail, variant: Variant, answers: Answer[]) {
  const additional = answers.reduce((sum, answer) => {
    const field = product.fields.find((item) => item.key === answer.fieldKey && item.type === 'SELECT');
    return sum + (field?.options.find((option) => option.key === answer.value)?.additionalCents ?? 0);
  }, 0);
  const unit = variant.pricingMode === 'QUOTE' || variant.priceCents === null ? null : variant.priceCents + additional;
  if (!Number.isSafeInteger(additional) || additional < 0 || (unit !== null && (!Number.isSafeInteger(unit) || unit < 0))) throw new Error('No pudimos calcular el importe orientativo.');
  return { unit, additional };
}
