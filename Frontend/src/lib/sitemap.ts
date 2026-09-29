import type {ProductCard,PublicPage} from './contracts/catalog';
import type {ContentKey} from './contracts/content';
export const EDITORIAL_PATHS:Record<ContentKey,string>={home:'/',about:'/nosotros',contact:'/contacto',faq:'/preguntas-frecuentes'};
export async function sitemapUrls(origin:string,loadProducts:(page:number)=>Promise<PublicPage<ProductCard>>,published:ContentKey[]) {
 const urls=new Set([origin+'/',origin+'/catalogo',...published.map(page=>origin+EDITORIAL_PATHS[page])]);
 for(let page=1;page<=1000;page++){
  const result=await loadProducts(page);
  for(const product of result.items){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)||product.slug.length>150)throw new Error('Slug inválido en sitemap.');urls.add(origin+'/productos/'+product.slug);}
  if(urls.size>50000)throw new Error('El catálogo necesita dividirse en varios sitemaps.');
  if(page*result.limit>=result.total)return [...urls];
  if(!result.items.length)throw new Error('Catálogo incompleto: no se publica un sitemap parcial.');
 }
 throw new Error('El catálogo necesita dividirse en varios sitemaps.');
}
