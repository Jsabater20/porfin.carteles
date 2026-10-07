export type DeliveryMethod = 'UNDECIDED' | 'PICKUP' | 'SHIPPING';
export interface Answer { fieldKey: string; value: string | number }
export interface PreviewInput {
  deliveryMethod: DeliveryMethod;
  items: { lineId: string; productId: string; variantId: string; quantity: number; answers: Answer[] }[];
}
export interface PreviewLine {
  lineId: string; productId: string; productName: string; slug: string; type: string;
  variantId: string; variantName: string; variantAttributes: Record<string, string>;
  quantity: number; currency: 'ARS'; pricingMode: 'FIXED' | 'QUOTE'; status: 'PRICED' | 'PENDING_QUOTE';
  baseUnitCents: number | null; additionalUnitCents: number; unitPriceCents: number | null; subtotalCents: number | null;
  selectedOptions: { fieldKey: string; optionKey: string; label: string; additionalCents: number }[];
  answers: (Answer & { label: string; type: string; componentKey: string | null; displayValue: string | number })[];
  components: { key: string; name: string; quantity: number; position: number }[];
  photoCountPerUnit: number; photoCountTotal: number; photoDelivery: 'NONE' | 'EMAIL' | 'WHATSAPP';
  category?: 'CARTEL' | 'PROP' | 'COMBO' | null;
  displayType?: 'GENERIC' | 'PREDEFINED' | 'PREDEFINED_THREE_IMAGES' | 'CUSTOM' | 'COMBO';
  occasions?: { id: string; name: string; slug: string }[];
  careers?: { id: string; name: string; slug: string }[];
}
export interface OrderPreview {
  id: string; expiresAt: string; currency: 'ARS'; items: PreviewLine[];
  summary: {
    knownSubtotalCents: number; pendingQuoteLines: number; pendingQuoteQuantity: number; totalQuantity: number;
    shipping: { method: DeliveryMethod; status: 'NOT_REQUIRED' | 'TO_CONFIRM'; amountCents: number | null };
    finalTotalCents: null; status: 'PENDING_CONFIRMATION';
  };
}
