import {requireAdminSession} from '@/features/auth/session';
import {serverApi} from '@/lib/api/server';
import type {ContentIndex,ContentInput} from '@/lib/contracts/admin-operations';
import {ContentEditor} from '@/features/admin-operations/content-editor';
export default async function Content({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 await requireAdminSession();const params=await searchParams,page:ContentInput['page']=typeof params.page==='string'&&['home','about','contact','faq'].includes(params.page)?params.page as ContentInput['page']:'home';
 const index=await serverApi<ContentIndex>('admin/content'),p=index.pages.find(p=>p.page===page);
 const initial:ContentInput={page,title:p?.title??'',subtitle:p?.subtitle??'',body:p?.body??'',sections:p?.sections??[],faqItems:p?.faqItems??[],published:p?.published??false,...(page==='home'?{featuredProductIds:index.featuredProductIds}:{})};
 return <ContentEditor key={page} initial={initial}/>;
}
