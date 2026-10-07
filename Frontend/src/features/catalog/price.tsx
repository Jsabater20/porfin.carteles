import type { BasePrice } from '@/lib/contracts/catalog';
import { formatMoney } from '@/lib/format/money';

export function CatalogPrice({ price }: { price: BasePrice }) {
  const amount = price.fromCents;
  return (
    <div className="catalog-price">
      <strong>{amount === null ? 'A cotizar' : formatMoney(amount)}</strong>
      {amount !== null && <small>Precio del producto en ARS</small>}
    </div>
  );
}
