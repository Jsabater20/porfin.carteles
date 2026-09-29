import type {MetadataRoute} from 'next';
import {siteConfig} from '@/lib/seo';
import {sitemapUrls} from '@/lib/sitemap';
import {serverApi} from '@/lib/api/server';
import {ApiError} from '@/lib/api/errors';
import type {PublicPage,ProductCard} from '@/lib/contracts/catalog';
import type {ContentKey} from '@/lib/contracts/content';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
 const site=siteConfig();if(!site.indexable)return [];
 const pages=await Promise.all((['about','contact','faq'] as ContentKey[]).map(async page=>{try{await serverApi('content/'+page);return page;}catch(e){if(e instanceof ApiError&&e.status===404)return null;throw e;}}));
 const urls=await sitemapUrls(site.origin,page=>serverApi<PublicPage<ProductCard>>('products',new URLSearchParams({page:String(page),limit:'50',sort:'name-asc'})),pages.filter((p):p is ContentKey=>p!==null));
 return urls.map(url=>({url}));
}
