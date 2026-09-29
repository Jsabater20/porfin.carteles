import {redirect} from 'next/navigation';
import {requireAdminSession} from '@/features/auth/session';
import {serverApi} from '@/lib/api/server';
import type {PublicPage} from '@/lib/contracts/catalog';
import type {Administrator} from '@/lib/contracts/admin-operations';
import {AccountsEditor} from '@/features/admin-operations/accounts-editor';
import {Pagination} from '@/features/admin-catalog/pagination';
export default async function Accounts({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const session=await requireAdminSession();if(session.admin.role!=='OWNER')redirect('/admin');
 const params=await searchParams,n=Number(params.page),page=Number.isInteger(n)&&n>0&&n<=100000?n:1;
 const result=await serverApi<PublicPage<Administrator>>('admin/admins',new URLSearchParams({page:String(page),limit:'25'}));
 if(page>Math.max(1,Math.ceil(result.total/result.limit)))redirect('/admin/administradores');
 return <><AccountsEditor items={result.items}/><Pagination path="/admin/administradores" {...result}/></>;
}
