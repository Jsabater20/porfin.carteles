import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productionConfig} from '../scripts/production-config.mjs';
const env={NODE_ENV:'production',WEB_ORIGIN:'https://tienda.example.com',BACKEND_API_URL:'https://api.example.com/api/v1',PORT:'8080'};
test('producción exige configuración explícita, HTTPS y puerto válido; indexación optativa',()=>{
 assert.deepEqual(productionConfig(env),{port:8080,indexable:false});
 assert.equal(productionConfig({...env,SITE_INDEXABLE:'true'}).indexable,true);
 for(const patch of [{NODE_ENV:'development'},{WEB_ORIGIN:undefined},{BACKEND_API_URL:undefined},{WEB_ORIGIN:'http://localhost:3000'},{BACKEND_API_URL:'https://user:password@api.example.com/api/v1'},{WEB_ORIGIN:'https://tienda.example.com/path'},{BACKEND_API_URL:'https://api.example.com/wrong'},{PORT:'0'},{PORT:'65536'},{SITE_INDEXABLE:'yes'}])assert.throws(()=>productionConfig({...env,...patch}));
});
