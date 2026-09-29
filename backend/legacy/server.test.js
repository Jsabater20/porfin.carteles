import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

test('Etapa 1: administración y catálogo', {timeout:30000}, async t => {
  const directory=await mkdtemp(path.join(tmpdir(),'porfin-test-'));
  const port=String(35000+Math.floor(Math.random()*10000));
  const child=spawn(process.execPath,['backend/server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:port,DATA_DIR:directory,ADMIN_PASSWORD:'test-password'},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}await rm(directory,{recursive:true,force:true});});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('El servidor no inició')),10000);child.stdout.on('data',chunk=>{if(chunk.toString().includes('http://')){clearTimeout(timer);resolve();}});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Salida inesperada: '+code));});});
  let cookie='';
  async function request(route,method='GET',body,authenticated=true) {
    const response=await fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{'Content-Type':'application/json',...(authenticated?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();return {response,data};
  }
  await t.test('Acceso privado y sesión',async()=>{
    assert.equal((await request('/api/admin')).response.status,401);
    assert.equal((await request('/api/admin/products','POST',{})).response.status,401);
    assert.equal((await request('/api/login','POST',{password:'incorrecta'})).response.status,401);
    const login=await request('/api/login','POST',{password:'test-password'});
    assert.equal(login.response.status,200);cookie=login.response.headers.get('set-cookie').split(';')[0];
    assert.match(login.response.headers.get('set-cookie'),/HttpOnly/);
  });
  const {data:initial}=await request('/api/admin');
  const original=initial.products[0];
  let created;
  await t.test('Crear, editar, ocultar y marcar no disponible',async()=>{
    const result=await request('/api/admin/products','POST',{...original,id:'',name:'Producto de prueba',status:'oculto',price:null});
    assert.equal(result.response.status,200);created=result.data;
    let catalog=(await request('/api/catalog')).data.products;
    assert.ok(!catalog.some(p=>p.id===created.id));
    assert.equal((await request('/api/admin/products','POST',{...created,status:'publicado'})).response.status,200);
    catalog=(await request('/api/catalog')).data.products;
    assert.equal(catalog.find(p=>p.id===created.id).price,null);
    await request('/api/admin/products','POST',{...created,status:'no disponible',price:24000});
    catalog=(await request('/api/catalog')).data.products;
    assert.equal(catalog.find(p=>p.id===created.id).status,'no disponible');
    assert.equal(catalog.find(p=>p.id===created.id).price,24000);
  });
  await t.test('Validar precios, categorías, variantes, campos y combos',async()=>{
    const invalid=[{price:-1},{price:1.5},{occasions:['Categoría inexistente']},{variants:[null]},{fields:[null]},{variants:[{id:'x',name:'Con fotos',extra:-100}]},{fields:[{id:'a',label:'Nombre',required:true},{id:'b',label:'Nombre',required:false}]},{type:'combo',components:[]},{images:['javascript:alert(1)']}];
    for(const value of invalid)assert.equal((await request('/api/admin/products','POST',{...created,...value})).response.status,400,JSON.stringify(value));
    const combo={...created,id:'combo-test',type:'combo',price:10000,components:[{name:'Cartel',quantity:1},{name:'Banderines',quantity:6}],fields:[{id:'cartel',label:'Nombre del cartel',required:true}],variants:[{id:'fotos',name:'Con tres fotos',extra:2000,photos:true}]};
    const saved=await request('/api/admin/products','POST',combo);
    assert.equal(saved.response.status,200);assert.deepEqual(saved.data.components,combo.components);assert.equal(saved.data.price,10000);
  });
  await t.test('Configurar categorías sin exigir WhatsApp y proteger categorías en uso',async()=>{
    const settings={...initial.settings,categories:[...initial.settings.categories,'Aniversario']};
    assert.equal((await request('/api/admin/settings','POST',settings)).response.status,200);
    assert.ok((await request('/api/catalog')).data.settings.categories.includes('Aniversario'));
    assert.equal((await request('/api/admin/settings','POST',{...settings,categories:['Aniversario']})).response.status,400);
  });
  await t.test('Subir imagen, conservar galería y servir su archivo',async()=>{
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2S8AAAAASUVORK5CYII=';
    assert.equal((await request('/api/admin/upload','POST',{image:'data:image/png;base64,aG9sYQ=='})).response.status,400);
    const upload=await request('/api/admin/upload','POST',{image:'data:image/png;base64,'+png});
    assert.equal(upload.response.status,200);
    const saved=await request('/api/admin/products','POST',{...created,images:[upload.data.url,'https://example.com/second.png']});
    assert.equal(saved.response.status,200);
    assert.deepEqual(saved.data.images,[upload.data.url,'https://example.com/second.png']);
    const image=await fetch(`http://127.0.0.1:${port}${upload.data.url}`);
    assert.equal(image.headers.get('content-type'),'image/png');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(png,'base64'));
  });
  await t.test('Módulo del editor disponible y cierre de sesión efectivo',async()=>{
    const module=await fetch(`http://127.0.0.1:${port}/product-editor.js`);
    assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);
    assert.equal((await request('/api/admin/logout','POST',{})).response.status,200);
    assert.equal((await request('/api/admin')).response.status,401);
  });
});
