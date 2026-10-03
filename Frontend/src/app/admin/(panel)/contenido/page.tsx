import {requireAdminSession} from '@/features/auth/session';
import {serverApi} from '@/lib/api/server';
import type {ContentIndex,ContentInput} from '@/lib/contracts/admin-operations';
import {ContentEditor} from '@/features/admin-operations/content-editor';
export default async function Content() {
 await requireAdminSession();const index=await serverApi<ContentIndex>('admin/content'),p=index.pages.find(p=>p.page==='home');
 const initial:ContentInput={page:'home',title:p?.title??'',subtitle:p?.subtitle??'',body:p?.body??'',sections:p?.sections??[],faqItems:p?.faqItems??[],published:p?.published??true,featuredProductIds:index.featuredProductIds};
 return <ContentEditor initial={initial}/>;
}
