import type { CreateOrderInput } from '../../lib/contracts/orders';
export const ORDER_ID = /^c[a-z0-9]{24}$/;
export interface CustomerFields { customerName: string; customerPhone: string; requestedDate: string; deliveryAddress: string; notes: string }
export const emptyCustomer: CustomerFields = { customerName: '', customerPhone: '', requestedDate: '', deliveryAddress: '', notes: '' };
export function argentinaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map((key) => parts.find((part) => part.type === key)!.value).join('-');
}
export function validateCustomer(fields: CustomerFields, previewId: string, deliveryMethod: 'PICKUP' | 'SHIPPING', today = argentinaDate()) {
  const errors: Partial<Record<keyof CustomerFields, string>> = {};
  const normalized = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim().normalize('NFC')])) as unknown as CustomerFields;
  const validText = (value: string, max: number) => [...value].length <= max && !/[\u0000\uD800-\uDFFF]/u.test(value);
  if (!normalized.customerName || !validText(normalized.customerName, 120)) errors.customerName = 'Ingresá tu nombre (hasta 120 caracteres).';
  const phone = normalized.customerPhone.replace(/[^0-9]/g, '');
  if (!/^\+?[0-9()\-\s]{6,30}$/.test(normalized.customerPhone) || !/^[1-9][0-9]{7,14}$/.test(phone)) errors.customerPhone = 'Ingresá un teléfono con código de país; por ejemplo, +54 9 11 2345 6789.';
  const date = normalized.requestedDate;
  const parsed = new Date(date + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < today) errors.requestedDate = 'Elegí una fecha válida, desde hoy en Argentina.';
  if (deliveryMethod === 'SHIPPING' && (!normalized.deliveryAddress || !validText(normalized.deliveryAddress, 400))) errors.deliveryAddress = 'Ingresá la dirección de envío (hasta 400 caracteres).';
  if (!validText(normalized.notes, 1000)) errors.notes = 'Las observaciones admiten hasta 1000 caracteres.';
  const input: CreateOrderInput = { previewId, customerName: normalized.customerName, customerPhone: phone, requestedDate: date, deliveryMethod,
    ...(deliveryMethod === 'SHIPPING' ? { deliveryAddress: normalized.deliveryAddress } : {}),
    ...(normalized.notes ? { notes: normalized.notes } : {}) };
  return { errors, input };
}
export function whatsappLink(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'wa.me' && !url.port && !url.username && !url.password && /^\/[1-9][0-9]{7,14}$/.test(url.pathname) && !url.hash ? url.href : null;
  } catch { return null; }
}
