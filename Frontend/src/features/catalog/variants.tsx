'use client';

import { useState } from 'react';
import type { Variant } from '@/lib/contracts/catalog';
import { formatMoney } from '@/lib/format/money';

export function Variants({ variants }: { variants: Variant[] }) {
  const [id, setId] = useState(variants[0]?.id);
  const variant = variants.find((item) => item.id === id) ?? variants[0];
  if (!variant) return <p className="notice">Este producto no tiene opciones disponibles.</p>;
  return (
    <section className="variant-section" aria-label="Opciones del producto">
      <label className="field-label" htmlFor="product-variant">Elegí una opción para conocer sus detalles</label>
      <select id="product-variant" value={variant.id} onChange={(event) => setId(event.target.value)}>
        {variants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <div className="variant-detail" aria-live="polite" aria-atomic="true">
        <p className="variant-price">{variant.pricingMode === 'QUOTE' || variant.priceCents === null ? 'A cotizar' : formatMoney(variant.priceCents)}</p>
        <p className="muted">{variant.pricingMode === 'QUOTE' ? 'El precio se confirma según tu pedido.' : 'Precio base en ARS. Los adicionales y la entrega se confirman al preparar el pedido.'}</p>
        {Object.keys(variant.attributes).length > 0 && <dl className="attributes">{Object.entries(variant.attributes).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}
        {variant.photoCount > 0 && <p className="notice">Esta opción lleva {variant.photoCount} {variant.photoCount === 1 ? 'foto' : 'fotos'}. Las fotos se envían por WhatsApp al coordinar el pedido.</p>}
      </div>
    </section>
  );
}
