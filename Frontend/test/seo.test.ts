import {test} from 'node:test';
import assert from 'node:assert/strict';
import {siteConfig,robotsPolicy} from '../src/lib/seo';
import {sitemapUrls} from '../src/lib/sitemap';
import type {ProductCard} from '../src/lib/contracts/catalog';
test('sitios locales y staging quedan fuera de indexación salvo habilitación explícita en HTTPS',()=>{
 assert.equal(siteConfig({}).indexable,false);
 assert.equal(siteConfig({WEB_ORIGIN:'http://localhost:3000',SITE_INDEXABLE:'true'}).indexable,false);
 const env={WEB_ORIGIN:'https://tienda.example.com',BACKEND_API_URL:'https://api.example.com/api/v1',SITE_INDEXABLE:'true'};
 assert.equal(siteConfig(env).indexable,true);assert.deepEqual(robotsPolicy(env).rules.disallow,['/admin','/api/','/carrito','/pedido']);
 assert.throws(()=>siteConfig({...env,SITE_INDEXABLE:'yes'}));
});
test('sitemap recorre catálogo completo, incluye solo páginas publicadas y no expone rutas privadas',async()=>{
 const calls:number[]=[];
 const urls=await sitemapUrls('https://tienda.example.com',async page=>{calls.push(page);return {items:[{slug:'cartel-'+page} as ProductCard],page,limit:1,total:2};},['about']);
 assert.deepEqual(calls,[1,2]);assert.ok(urls.includes('https://tienda.example.com/productos/cartel-2'));
 assert.ok(urls.includes('https://tienda.example.com/nosotros'));assert.equal(urls.some(u=>/admin|pedido|carrito|contacto/.test(u)),false);
 await assert.rejects(sitemapUrls('https://tienda.example.com',async()=>({items:[],page:1,limit:1,total:5}),[]),/incompleto/);
 await assert.rejects(sitemapUrls('https://tienda.example.com',async()=>({items:[{slug:'../admin'} as ProductCard],page:1,limit:1,total:1}),[]),/Slug/);
});
