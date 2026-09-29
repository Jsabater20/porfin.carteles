import { Prisma } from '@prisma/client';
// Persistencia decimal exacta; el contrato HTTP mantiene centavos enteros seguros.
export function moneyJson<T>(value: T): T {
  const visit = (item: any): any => {
    if (item instanceof Prisma.Decimal) {
      const number = item.toNumber();
      if (!Number.isSafeInteger(number)) throw new Error('Importe fuera del rango seguro.');
      return number;
    }
    if (item instanceof Date || item === null || typeof item !== 'object') return item;
    if (Array.isArray(item)) return item.map(visit);
    return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, visit(child)]));
  };
  return visit(value);
}
