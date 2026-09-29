const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Importe inválido.');
  return ars.format(cents / 100);
}
