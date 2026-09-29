import type { BasePrice } from '@/lib/contracts/catalog';
import { formatMoney } from '@/lib/format/money';

export function CatalogPrice({ price }: { price: BasePrice }) {
  const amount = price.fromCents;
  return (
    <div className="catalog-price">
      <strong>{amount === null ? 'A cotizar' : `${price.hasQuoteVariants || price.toCents !== amount ? 'Desde ' : ''}${formatMoney(amount)}`}</strong>
      {amount !== null && <small>ARS · precio base</small>}
      {amount !== null && price.hasQuoteVariants && <small>También hay opciones a cotizar</small>}
    </div>
  );
}
