export interface PublicSettings {
  storeName: string;
  description: string;
  whatsappNumber: string | null;
  whatsappUrl: string | null;
  contactEmail: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  pickupAddress: string;
  deliveryMethods: ('PICKUP' | 'SHIPPING')[];
  deliveryNotes: string;
  leadTimeText: string;
  businessHours: string;
}
