import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftProduct,buildProduct,moneyToCents,changedProduct,moved,blankField,slugify,productInput } from '../src/features/admin-catalog/model';
import { uploadDestination,uploadImage,validateImage,MAX_IMAGE_BYTES } from '../src/features/admin-catalog/upload';
import { routePolicy,selectCookies } from '../src/lib/api/policy';
import type { AdminProduct, UploadAuthorization } from '../src/lib/contracts/admin-catalog';
const id='c123456789012345678901234';
function valid() { const d=draftProduct();d.name='Cartel';d.slug='cartel';d.description='Cartel personalizado';d.categoryIds=[id];d.variants[0].price='15000,25';d.variants[0].attributes=[{key:'formato',value:'rectangular'}];return d; }
test('la forma del cartel alimenta el filtro y es necesaria en cada opción',()=>{
 const d=valid();assert.equal(buildProduct(d).input.variants[0].attributes.formato,'rectangular');
 d.variants[0].attributes=[];assert.ok(buildProduct(d).errors['variants.0.shape']);
 d.variants[0].attributes=[{key:'formato',value:'xxl'}];assert.equal(buildProduct(d).errors['variants.0.shape'],undefined);
});
test('precios ARS exactos y cotizaciones sin precio inventado',()=>{
 assert.equal(moneyToCents('15000,25'),1500025);assert.equal(moneyToCents('0.29'),29);assert.equal(moneyToCents('0'),0);
 for(const bad of ['1.000,50','-1','1e3','1.005','10000000.01',''])assert.equal(moneyToCents(bad),null,bad);
 const d=valid();d.variants[0].pricingMode='QUOTE';d.variants[0].price='basura';
 const result=buildProduct(d);assert.deepEqual(result.errors,{});assert.equal(result.input.variants[0].priceCents,null);
 d.variants[0].pricingMode='FIXED';assert.ok(buildProduct(d).errors['variants.0.price']);
});
test('combos y campos conservan claves y validan referencias al quitar componentes',()=>{
 const d=valid();d.category='COMBO';d.type='COMBO';d.components=[{key:'cartel',name:'Cartel',quantity:'2',referenceProductId:id}];
 const f=blankField();f.key='nombre';f.label='Tu nombre';f.componentKey='cartel';f.required=true;d.fields=[f];
 assert.deepEqual(buildProduct(d).errors,{});assert.equal(buildProduct(d).input.components[0].quantity,2);
 assert.ok(buildProduct(d,id).errors['components.0']);d.components=[];assert.ok(buildProduct(d).errors['components']);assert.ok(buildProduct(d).errors['fields.0.componentKey']);
});
test('tipos de campos omiten límites incompatibles y validan opciones y adicionales',()=>{
 const d=valid(),f=blankField();f.label='Color';f.type='SELECT';f.minimum='basura';f.options=[{key:'rojo',label:'Rojo',additional:'10,25'}];d.fields=[f];
 let r=buildProduct(d);assert.deepEqual(r.errors,{});assert.equal(r.input.fields[0].options[0].additionalCents,1025);assert.equal('minLength' in r.input.fields[0],false);
 f.type='NUMBER';f.minimum='-2,5';f.maximum='4.5';r=buildProduct(d);assert.deepEqual(r.errors,{});assert.deepEqual(r.input.fields[0].options,[]);assert.equal(r.input.fields[0].minValue,-2.5);
 f.maximum='-3';assert.ok(buildProduct(d).errors['fields.0.maximum']);f.type='SHORT_TEXT';f.minimum='0';f.maximum='241';assert.ok(buildProduct(d).errors['fields.0.maximum']);
});
test('serialización limpia, IDs estables y PATCH solo con propiedades modificadas',()=>{
 const input=buildProduct(valid()).input;
 const p={...input,id,updatedAt:'2026-01-01',createdAt:'2026-01-01',categories:[{categoryId:id,category:{id,name:'Categoría',slug:'categoria'}}],careers:[],variants:input.variants.map(v=>({...v,id:'variant-id',position:0})),fields:[],components:[],images:[]} as AdminProduct;
 const before=productInput(p);const after=buildProduct(draftProduct(p)).input;assert.deepEqual(after,before);
 assert.equal('id' in before.variants[0],false);assert.deepEqual(changedProduct(before,after),{});
 after.name='Nombre cambiado';assert.deepEqual(changedProduct(before,after),{name:'Nombre cambiado'});
 const arr=[{key:'primero'},{key:'segundo'}];assert.deepEqual(moved(arr,0,1).map(v=>v.key),['segundo','primero']);assert.equal(arr[0].key,'primero');
});
test('publicación, cantidades y límites se validan antes de enviar',()=>{
 const d=valid();d.status='PUBLISHED';d.variants[0].active=false;d.variants[0].photos='11';d.categoryIds=[];
 const errors=buildProduct(d).errors;assert.ok(errors.variants);assert.equal(errors.categoryIds,undefined);assert.ok(errors['variants.0.photos']);
 assert.equal(slugify(' ¡Recibida: Medicina! '),'recibida-medicina');
});
test('pasarela de catálogo exige métodos y rutas exactos, cookies administrativas aisladas',()=>{
 assert.equal(routePolicy('admin/products/'+id,'PATCH'),'admin');
 assert.equal(routePolicy('admin/products/'+id+'/images/order','PATCH'),'admin');
 assert.equal(routePolicy('admin/media/uploads/12345678-1234-1234-1234-123456789012','DELETE'),'admin');
 for(const path of ['admin/products/'+id+'/unknown','admin/products/../auth','admin/orders','admin/products/'+id+'/images/invalid'])assert.equal(routePolicy(path,'PATCH'),undefined);
 assert.equal(routePolicy('admin/products','DELETE'),undefined);assert.equal(routePolicy('products/cartel','PATCH'),undefined);
 assert.equal(selectCookies('porfin_guest=x; porfin_session=y; extra=z','admin'),'porfin_session=y');
});
test('archivos y destino de carga no admiten formatos o sitios arbitrarios',()=>{
 assert.ok(validateImage({type:'image/svg+xml',size:12}));assert.ok(validateImage({type:'image/png',size:MAX_IMAGE_BYTES+1}));assert.ok(validateImage({type:'image/png',size:0}));assert.equal(validateImage({type:'image/webp',size:MAX_IMAGE_BYTES}),'');
 for(const url of ['http://api.cloudinary.com/v1_1/demo/image/upload','https://evil.test/v1_1/demo/image/upload','https://api.cloudinary.com.evil.test/v1_1/demo/image/upload','https://api.cloudinary.com/v1_1/demo/raw/upload','https://x@api.cloudinary.com/v1_1/demo/image/upload','https://api.cloudinary.com/v1_1/demo/image/upload?token=x'])assert.throws(()=>uploadDestination(url));
});
test('carga multipart sin cookies, cabeceras privadas ni confianza en la URL devuelta',async()=>{
 const auth:UploadAuthorization={uploadId:'id',expiresAt:new Date(Date.now()+60000).toISOString(),maxBytes:MAX_IMAGE_BYTES,formats:['png'],uploadUrl:'https://api.cloudinary.com/v1_1/demo/image/upload',apiKey:'public-key',signature:'signature',params:{timestamp:1,public_id:'porfin/example',upload_preset:'preset',overwrite:false,allowed_formats:'png',unexpected:'omit'}};
 let called=false;
 await uploadImage(auth,new File(['image'],'sample.png',{type:'image/png'}),async(url,options)=>{
  called=true;assert.equal(url,auth.uploadUrl);assert.equal(options?.credentials,'omit');assert.equal(options?.headers,undefined);assert.equal(options?.redirect,'error');
  const data=options?.body as FormData;assert.equal(data.get('overwrite'),'false');assert.equal(data.has('unexpected'),false);assert.equal(data.has('file'),true);
  return Response.json({secure_url:'https://untrusted.test/file'});
 });assert.ok(called);
});
