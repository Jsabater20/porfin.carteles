import type { Variant } from '@/lib/contracts/catalog';
import { formatMoney } from '@/lib/format/money';
import { PhotoDeliveryNotice } from '@/components/photo-delivery-notice';

export function Variants({ variants, selectedId, imagesByEmail = false }: { variants: Variant[]; selectedId?: string; imagesByEmail?: boolean }) {
  const variant = variants.find((item) => item.id === selectedId) ?? variants[0];
  if (!variant) return <p className="notice">Este producto no está disponible.</p>;
  return (
    <section className="variant-section" aria-label="Precio y detalles del producto">
      <div className="variant-detail">
        <p className="variant-price">{variant.pricingMode === 'QUOTE' || variant.priceCents === null ? 'A cotizar' : formatMoney(variant.priceCents)}</p>
        <p className="muted">{variant.pricingMode === 'QUOTE' ? 'El precio se confirma según tu pedido.' : 'Precio en ARS. La entrega se coordina al confirmar el pedido.'}</p>
        {Object.keys(variant.attributes).length > 0 && <dl className="attributes">{Object.entries(variant.attributes).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}
        {variant.photoCount > 0 && <PhotoDeliveryNotice count={variant.photoCount} method={imagesByEmail && variant.photoCount === 3 ? 'EMAIL' : 'WHATSAPP'} className="notice" />}
      </div>
    </section>
  );
}
