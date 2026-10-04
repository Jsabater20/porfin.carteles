import type { PreviewLine } from './preview';

export interface CreateOrderInput {
  previewId: string; customerFirstName: string; customerLastName: string; customerEmail: string; customerBirthDate: string; customerPhone: string; requestedDate: string;
  deliveryMethod: 'PICKUP' | 'SHIPPING'; deliveryAddress?: string; notes?: string;
}
export interface GuestOrder {
  id: string; reference: string;
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'DELIVERED' | 'CANCELLED';
  customerFirstName: string | null; customerLastName: string | null; customerEmail: string | null; customerBirthDate: string | null;
  customerName: string; customerPhone: string; requestedDate: string; scheduledDate: string; source: 'STOREFRONT' | 'MANUAL'; deliveryMethod: 'PICKUP' | 'SHIPPING' | 'TO_CONFIRM';
  deliveryAddress: string | null; notes: string | null; createdAt: string; idempotencyKey?: string;
  knownSubtotalCents: number; pendingQuoteCount: number; shippingCents: number | null;
  items: { id: string; productId: string | null; productName: string; variantName: string; quantity: number;
    unitPriceCents: number | null; subtotalCents: number | null;
    snapshot: { variant: { photoCount: number }; customization: { answers: PreviewLine['answers'] }; components: PreviewLine['components'] };
  }[];
  whatsapp: { url: string | null; message: string };
}
