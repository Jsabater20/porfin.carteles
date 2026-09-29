import type {Metadata} from 'next';
import {readApiConfig} from './api/config';
import type {ProductDetail} from './contracts/catalog';
import {isCatalogImageUrl} from '../features/catalog/image-url';
export function siteConfig(env:Record<string,string|undefined>=process.env) {
 const {webOrigin}=readApiConfig(env),flag=env.SITE_INDEXABLE??'false';
 if(!['true','false'].includes(flag))throw new Error('SITE_INDEXABLE debe ser true o false.');
 const url=new URL(webOrigin),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 return {origin:webOrigin,indexable:flag==='true'&&url.protocol==='https:'&&!local};
}
export function publicMetadata(title:string,description:string,path:string,index=true,images:string[]=[]):Metadata {
 const site=siteConfig(),url=site.origin+path;
 return {title,description,alternates:{canonical:url},robots:{index:site.indexable&&index,follow:true},
 openGraph:{type:'website',locale:'es_AR',siteName:'Por fin!',title,description,url,...(images.length?{images:images.map(url=>({url}))}:{})},
 twitter:{card:images.length?'summary_large_image':'summary',title,description,...(images.length?{images}:{})}};
}
export function productMetadata(product:ProductDetail):Metadata {
 const images=product.images.filter(i=>isCatalogImageUrl(i.url)).slice(0,1).map(i=>i.url);
 return publicMetadata(product.name,product.description.slice(0,160),'/productos/'+encodeURIComponent(product.slug),true,images);
}
export function robotsPolicy(env:Record<string,string|undefined>=process.env) {
 const site=siteConfig(env);
 return site.indexable?{rules:{userAgent:'*',allow:'/',disallow:['/admin','/api/','/carrito','/pedido']},sitemap:site.origin+'/sitemap.xml'}:{rules:{userAgent:'*',disallow:'/'}};
}
