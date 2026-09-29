import { redirect } from 'next/navigation';
import { requireAdminSession } from '@/features/auth/session';
import { serverApi } from '@/lib/api/server';
import type { PublicPage,Taxonomy } from '@/lib/contracts/catalog';
import { TaxonomyEditor } from './taxonomy-editor';
import { Pagination } from './pagination';
export async function TaxonomyPage({kind,searchParams}:{kind:'categories'|'careers';searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 await requireAdminSession(); const params=await searchParams; const n=Number(params.page); const page=Number.isInteger(n)&&n>0&&n<=100000?n:1;
 const result=await serverApi<PublicPage<Taxonomy>>('admin/'+kind,new URLSearchParams({page:String(page),limit:'25'}));
 const path=kind==='categories'?'/admin/categorias':'/admin/carreras';
 if(page>Math.max(1,Math.ceil(result.total/result.limit))) redirect(path);
 return <><TaxonomyEditor kind={kind} items={result.items}/><Pagination path={path} {...result}/></>;
}
