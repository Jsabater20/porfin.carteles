// Run only on a disposable branch cloned before this migration.
require('ts-node/register');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { CatalogService } = require('../src/modules/catalog/catalog.service');
const { PublicCatalogService } = require('../src/modules/catalog/public-catalog.service');
const { PricingService } = require('../src/modules/pricing/pricing.service');
const testUrl = process.env.CONSOLIDATION_TEST_URL;
assert.ok(testUrl, 'CONSOLIDATION_TEST_URL must identify a disposable pre-migration branch.');
process.loadEnvFile('.env');
assert.notEqual(new URL(testUrl).hostname.replace('-pooler',''), new URL(process.env.DIRECT_URL).hostname.replace('-pooler',''), 'Never test on the configured production database.');
const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
const migration = () => {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js','migrate','deploy'], { env: { ...process.env, DATABASE_URL:testUrl, DIRECT_URL:testUrl }, encoding:'utf8', timeout:60000 });
  assert.equal(result.status,0,result.stdout + result.stderr);
};
(async () => {
  const before = await prisma.product.findMany({ orderBy:{id:'asc'}, include:{variants:{orderBy:{id:'asc'}}, fields:{orderBy:{id:'asc'},include:{options:true}},categories:true,careers:true,images:true,components:true} });
  const source = before.find(p=>p.slug==='cartel-tres-imagenes');
  assert.equal(source.status,'PUBLISHED'); assert.equal(source.variants.length,4);
  const order = await prisma.order.create({data:{reference:'CONSOLIDATION-TEST-'+Date.now(),customerName:'Cliente de prueba',customerPhone:'',requestedDate:new Date('2026-12-01'),deliveryMethod:'PICKUP',knownSubtotalCents:0,items:{create:{productId:source.id,productName:source.name,variantSnapshot:source.variants[0],customizationSnapshot:{texto:'Historia conservada'},pricingMode:'QUOTE',quantity:1}}},include:{items:true}});
  // A changed inventory must abort atomically before any variant is moved.
  await prisma.productVariant.update({where:{id:source.variants[0].id},data:{photoCount:2}});
  const rejected = spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','execute','--file','prisma/migrations/20261002000000_consolidate_three_image_variants/migration.sql','--schema','prisma/schema.prisma'], {env:{...process.env,DATABASE_URL:testUrl,DIRECT_URL:testUrl},encoding:'utf8',timeout:60000});
  assert.notEqual(rejected.status,0); assert.match(rejected.stderr,/Source variants differ/);
  assert.equal(await prisma.productVariant.count({where:{productId:source.id}}),4);
  assert.equal(await prisma.applicationMetadata.findUnique({where:{key:'catalog:three-images:v1'}}),null);
  await prisma.productVariant.update({where:{id:source.variants[0].id},data:{photoCount:3}});
  migration(); migration();
  const after = await prisma.product.findMany({ orderBy:{id:'asc'}, include:{variants:{orderBy:{id:'asc'}}, fields:{orderBy:{id:'asc'},include:{options:true}},categories:true,careers:true,images:true,components:true} });
  assert.equal(after.length,before.length);
  assert.deepEqual(after.flatMap(p=>p.variants.map(v=>v.id)).sort(),before.flatMap(p=>p.variants.map(v=>v.id)).sort());
  const archived=after.find(p=>p.id===source.id);
  assert.equal(archived.status,'HIDDEN'); assert.equal(archived.variants.length,0);
  assert.deepEqual(archived.fields,source.fields);assert.deepEqual(archived.categories,source.categories);
  for(const kind of ['generico','predeterminado']) {
    const old=before.find(p=>p.slug==='cartel-'+kind), target=after.find(p=>p.id===old.id);
    assert.equal(target.variants.length,4);
    for(const v of old.variants) assert.deepEqual(target.variants.find(n=>n.id===v.id),v);
    for(const v of source.variants.filter(v=>v.key.startsWith(kind+'-'))) {
      const moved=target.variants.find(n=>n.id===v.id); assert.ok(moved);
      const {productId,name,position,...rest}=moved;
      const {productId:op,name:on,position:oi,...original}=v;
      assert.deepEqual(rest,original);assert.equal(name,v.name+' · con 3 imágenes');assert.equal(productId,target.id);
      assert.equal(position,Math.max(...old.variants.map(v=>v.position))+1+(v.key.endsWith('circular')?1:0));
    }
    for(const f of old.fields) assert.deepEqual(target.fields.find(n=>n.id===f.id),f);
    assert.equal(target.fields.find(f=>f.key==='imagenes').required,false);
  }
  for(const old of before.filter(p=>!['cartel-tres-imagenes','cartel-generico','cartel-predeterminado'].includes(p.slug))) assert.deepEqual(after.find(p=>p.id===old.id),old);
  assert.deepEqual(await prisma.order.findUnique({where:{id:order.id},include:{items:true}}),order);
  const pub=new PublicCatalogService(prisma,new PricingService(prisma));
  await assert.rejects(()=>pub.get(source.slug),e=>e.getStatus()===410);
  for(const slug of ['cartel-generico','cartel-predeterminado']) assert.equal((await pub.get(slug)).variants.filter(v=>v.photoCount===3).length,2);
  const admin=await prisma.administrator.create({data:{name:'Test migration',email:'migration-'+Date.now()+'@example.test',passwordHash:'unusable',sessions:{create:{tokenHash:'test-'+Date.now(),expiresAt:new Date(Date.now()+60000)}}},include:{sessions:true}});
  const service=new CatalogService(prisma), session=admin.sessions[0].id;
  assert.equal((await service.get(source.id)).consolidatedInto.length,2);
  await assert.rejects(()=>service.update(source.id,{name:'Changed'},session),e=>e.getStatus()===409);
  await assert.rejects(()=>service.delete(source.id,session),e=>e.getStatus()===409);
  console.log('OK: stable IDs, 18 variants, archive, preserved fields/prices/history, API 410, admin 409, repeated deploy.');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
