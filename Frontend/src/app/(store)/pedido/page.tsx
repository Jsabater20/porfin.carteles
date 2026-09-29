import type { Metadata } from 'next';
import { Checkout } from '@/features/orders/checkout';
import { getStoreSettings } from '@/features/settings/queries';
export const metadata: Metadata = { title: 'Preparar solicitud', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function CheckoutPage() { return <Checkout settings={await getStoreSettings()} />; }
