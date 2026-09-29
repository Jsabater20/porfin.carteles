import {notFound} from 'next/navigation';
import {requireAdminSession} from '@/features/auth/session';
import {serverApi} from '@/lib/api/server';
import {ApiError} from '@/lib/api/errors';
import type {AdminOrder,PaymentSummary} from '@/lib/contracts/admin-operations';
import {OrderDetail} from '@/features/admin-operations/order-detail';
export default async function Order({params}:{params:Promise<{id:string}>}) {
 await requireAdminSession();const {id}=await params;if(!/^c[a-z0-9]{24}$/.test(id))notFound();
 const [order,payments]=await Promise.all([serverApi<AdminOrder>('admin/orders/'+id),serverApi<PaymentSummary>('admin/payments/orders/'+id)]).catch(e=>{if(e instanceof ApiError&&e.status===404)notFound();throw e;});
 return <OrderDetail key={id} initialOrder={order} initialPayments={payments}/>;
}
