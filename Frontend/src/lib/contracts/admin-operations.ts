import type { GuestOrder } from './orders';
import type { PreviewLine } from './preview';
import type { PublicContent,ContentKey } from './content';
export type OrderStatus=GuestOrder['status'];
export type QuoteStatus='DRAFT'|'SENT'|'ACCEPTED'|'REJECTED';
export interface OrderListItem {id:string;reference:string;customerName:string;status:OrderStatus;requestedDate:string;scheduledDate:string;source:'STOREFRONT'|'MANUAL';knownSubtotalCents:number;pendingQuoteCount:number;createdAt:string}
export interface OrderList {items:OrderListItem[];total:number;page:number;pageSize:number}
export interface OrderCalendar {items:OrderListItem[]}
export interface ManualOrderInput {customerName:string;customerEmail?:string;customerPhone?:string;scheduledDate:string;description:string;deliveryMethod:'TO_CONFIRM'|'PICKUP'|'SHIPPING';status:'PENDING_CONFIRMATION'|'CONFIRMED';notes?:string}
export interface QuoteInput {items:{productName:string;description:string;quantity:number;unitPriceCents:number}[];notes:string}
export interface Quote {id:string;version:number;status:QuoteStatus;totalCents:number;notes:string|null;administratorId:string;createdAt:string;items:(QuoteInput['items'][number]&{id:string;subtotalCents:number})[]}
export interface PaymentInput {orderId:string;quoteId:string;type:'CHARGE'|'REFUND';amountCents:number;method:string;reference:string}
export interface Movement extends PaymentInput {id:string;occurredAt:string;administratorId:string}
export interface PaymentSummary {movements:Movement[];chargedCents:number;refundedCents:number;balanceCents:number;quoteTotalCents:number|null;outstandingCents:number|null;paymentStatus:'PENDING'|'PARTIAL'|'PAID'}
export interface AdminOrder extends OrderListItem {
 customerEmail:string|null;customerBirthDate:string|null;customerFirstName:string|null;customerLastName:string|null;customerPhone:string;deliveryMethod:string;deliveryAddress:string|null;notes:string|null;shippingCents:number|null;
 items:{id:string;productName:string;quantity:number;unitPriceCents:number|null;subtotalCents:number|null;pricingMode:'FIXED'|'QUOTE';
 variantSnapshot:{name?:string;attributes?:Record<string,string>;photoCount?:number}|null;
 customizationSnapshot:{answers?:PreviewLine['answers'];selectedOptions?:PreviewLine['selectedOptions']};componentsSnapshot:PreviewLine['components']|null}[];
 events:{id:string;type:string;details:Record<string,unknown>|null;createdAt:string}[];
 quotes:Quote[];payments:Movement[];
}
export interface EditablePage extends Pick<PublicContent,'page'|'title'|'subtitle'|'body'|'sections'|'faqItems'> {published:boolean}
export interface ContentIndex {availablePages:ContentKey[];pages:EditablePage[];featuredProductIds:string[]}
export interface ContentInput extends EditablePage {featuredProductIds?:string[]}
export interface Administrator {id:string;name:string;email:string;role:'OWNER'|'ADMIN';active:boolean}
