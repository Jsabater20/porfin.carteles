import Link from 'next/link';
import {redirect} from 'next/navigation';
import { requireAdminSession } from '@/features/auth/session';
import {serverApi} from '@/lib/api/server';
import type {OrderList} from '@/lib/contracts/admin-operations';
import {ORDER_LABELS,date,money} from '@/features/admin-operations/model';
import {Pagination} from '@/features/admin-catalog/pagination';
export default async function Orders({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 await requireAdminSession();const params=await searchParams,n=Number(params.page),page=Number.isInteger(n)&&n>0&&n<=100000?n:1;
 const result=await serverApi<OrderList>('admin/orders',new URLSearchParams({page:String(page)}));
 if(page>Math.max(1,Math.ceil(result.total/result.pageSize)))redirect('/admin/pedidos');
 return <><h1>Pedidos</h1><p className="muted">Solicitudes más recientes primero. El subtotal conocido puede tener importes pendientes de cotización.</p>
 {!result.items.length?<p className="notice">Todavía no hay pedidos.</p>:<div className="admin-product-list">{result.items.map(o=><article className="panel-card" key={o.id}><div><h2><Link href={'/admin/pedidos/'+o.id}>{o.reference} · {o.customerName}</Link></h2><p>{ORDER_LABELS[o.status]} · Fecha solicitada: {date(o.requestedDate)}</p><p>Subtotal conocido: {money(o.knownSubtotalCents)} · {o.pendingQuoteCount} pendientes de cotización</p></div><Link className="text-link" href={'/admin/pedidos/'+o.id}>Abrir pedido</Link></article>)}</div>}
 <Pagination path="/admin/pedidos" page={page} limit={result.pageSize} total={result.total}/></>;
}
