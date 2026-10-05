import assert from 'node:assert/strict';
import {auditPage} from './accessibility-audit.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { createRequire } from 'node:module';


const root = fileURLToPath(new URL('../', import.meta.url));
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
assert.ok(existsSync(chrome), 'Indicá CHROME_PATH con un Chrome instalado.');
const profile = root + '.test-build/catalog-browser-profile-' + Date.now();
await mkdir(profile, { recursive: true });
const backendRoot = path.resolve(root, '../backend');
process.chdir(backendRoot);
const loadBackend = createRequire(import.meta.url);
loadBackend(path.join(backendRoot, 'node_modules/ts-node')).register({ project: path.join(backendRoot, 'tsconfig.json') });
const { integrationApp } = loadBackend(path.join(backendRoot, 'test/support/integration.ts'));
const { hashPassword } = loadBackend(path.join(backendRoot, 'src/common/utils/credentials.ts'));
const ctx = await integrationApp({ ALLOWED_ORIGINS: 'http://localhost:3100', CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret-only', CLOUDINARY_UPLOAD_PRESET: 'porfin_test' });

const { CloudinaryService } = loadBackend(path.join(backendRoot,'src/modules/media/cloudinary.service.ts'));
const { ConflictException, ServiceUnavailableException } = loadBackend(path.join(backendRoot,'node_modules/@nestjs/common'));
const cloud=ctx.app.get(CloudinaryService), assets=new Map();
let failInspect=false;
cloud.validatePreset=async()=>{};
cloud.inspect=async(id)=>{if(failInspect)throw new ServiceUnavailableException('Verificación temporalmente no disponible');if(!assets.has(id))throw new ConflictException('Imagen pendiente');return assets.get(id);};
cloud.destroy=async(id)=>{assets.delete(id);};

const api = { close: ctx.cleanup };
const originalPassword = 'Una clave inicial de prueba 123!';
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], {
  cwd: root, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production', BACKEND_API_URL: ctx.url + '/api/v1', WEB_ORIGIN: 'http://localhost:3100' }, stdio: 'ignore',
});
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=9232', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile,
  ...(process.env.TEST_BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws;
const processes = [next, browser];
async function stop(child) { if (child.exitCode === null && child.signalCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; } }
try {
  const passwordHash = await hashPassword(originalPassword);
  await ctx.prisma.administrator.createMany({ data: [{ name: 'Propietaria de prueba', email: 'owner@example.test', passwordHash, role: 'OWNER' }, { name: 'Administradora de prueba', email: 'admin@example.test', passwordHash, role: 'ADMIN' }] });
  let version;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if (!(await fetch('http://localhost:3100/api/backend/health')).ok) throw new Error();
      version = await (await fetch('http://127.0.0.1:9232/json/version')).json(); break;
    } catch { await delay(250); }
  }
  assert.ok(version, 'No iniciaron los servidores de prueba.');
  const tabs = await (await fetch('http://127.0.0.1:9232/json/list')).json();
  ws = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map(), exceptions = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error('Timeout ' + method)); }, 20000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); clearTimeout(item.timer); pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result);
    }
    if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true });
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  };
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error('No se cumplió: ' + expression + '\n' + await evaluate('document.body?.innerText'));
  };
  const navigate = async (path, selector) => {
    await send('Page.navigate', { url: 'http://localhost:3100' + path });
    await waitFor('location.pathname===' + JSON.stringify(path.split('?')[0]) + ' && document.readyState==="complete" && !!document.querySelector(' + JSON.stringify(selector) + ')');
    if (['#product-name', '#taxonomy-name', '#image-file'].includes(selector)) await waitFor('!!document.querySelector(".editor-fields") && !document.querySelector(".editor-fields").disabled');
    if (selector === '.auth-submit') await waitFor('!document.querySelector(".auth-submit").disabled');
  };
  const checkedNavigate = navigate;
  const auditedNavigate = async (...args) => { await checkedNavigate(...args); if(process.env.AUDIT_ACCESSIBILITY==='1') await auditPage(evaluate,args[0]); };
  const fill = (selector, value) => evaluate(`{const el=document.querySelector(${JSON.stringify(selector)});const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));} true`);
  const click = async (selector) => { await waitFor('!!document.querySelector(' + JSON.stringify(selector) + ') && !document.querySelector(' + JSON.stringify(selector) + ').matches(":disabled")'); return evaluate('document.querySelector(' + JSON.stringify(selector) + ').click();true'); };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });


  const login = async (email, password = originalPassword) => {
    await auditedNavigate('/admin/login', '.auth-submit');
    await fill('#auth-email', email); await fill('#auth-password', password); await click('.auth-submit');
    await waitFor('location.pathname==="/admin" && !!document.querySelector(".admin-logout")');
  };

  const clickText=async(text)=>{const target='Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==='+JSON.stringify(text)+' && !e.matches(":disabled"))';await waitFor('!!'+target);await evaluate(target+'.click();true');};
  const saved=()=>waitFor('document.body.innerText.includes("Cambios guardados.") && !document.querySelector(".editor-fields").disabled');
  await send('Network.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'https://api.cloudinary.com/*'},{urlPattern:'http://localhost:3100/_next/image*'}]});
  const png=await evaluate('(()=>{const canvas=document.createElement("canvas");canvas.width=100;canvas.height=100;const context=canvas.getContext("2d");context.fillStyle="#ead9cb";context.fillRect(0,0,100,100);return canvas.toDataURL("image/png").split(",")[1];})()');
  const previousMessage=ws.onmessage, uploadRequests=[];
  ws.onmessage=event=>{
   previousMessage(event);
   const data=JSON.parse(event.data);if(data.method!=='Fetch.requestPaused')return;
   const {requestId,request}=data.params;
   void (async()=>{
    if(request.url.includes('/_next/image')){await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:png});return;}
    if(request.method!=='OPTIONS'){
     uploadRequests.push(request);
     const uploads=await ctx.prisma.mediaUpload.findMany({where:{confirmedAt:null,cancelledAt:null}});
     for(const upload of uploads)assets.set(upload.publicId,{asset_id:'asset-'+upload.id,public_id:upload.publicId,resource_type:'image',type:'upload',format:'png',bytes:100,width:1,height:1,secure_url:'https://res.cloudinary.com/test-cloud/image/upload/v1/'+upload.publicId+'.png'});
    }
    await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'http://localhost:3100'},{name:'Access-Control-Allow-Methods',value:'POST, OPTIONS'},{name:'Access-Control-Allow-Headers',value:'*'}],body:Buffer.from(JSON.stringify({secure_url:'https://untrusted.test/not-used'})).toString('base64')});
   })().catch(error=>{exceptions.push(error.message);});
  };
  // Entrar a una pantalla privada directamente también requiere login.
  await send('Page.navigate',{url:'http://localhost:3100/admin/productos'});
  await waitFor('location.pathname==="/admin/login" && !!document.querySelector(".auth-submit") && !document.querySelector(".auth-submit").disabled');
  await login('owner@example.test');
  await auditedNavigate('/admin/categorias','#taxonomy-name');
  await fill('#taxonomy-name','Recibidas');await clickText('Generar dirección');await click('.taxonomy-form button[type=submit]');
  await waitFor('!!document.querySelector(".admin-table tbody tr")');
  await auditedNavigate('/admin/carreras','#taxonomy-name');
  await fill('#taxonomy-name','Medicina');await clickText('Generar dirección');await click('.taxonomy-form button[type=submit]');
  await waitFor('!!document.querySelector(".admin-table tbody tr")');
  await auditedNavigate('/admin/productos/nuevo','#product-name');
  await click('.editor-save button');await waitFor('!!document.querySelector("#product-name-error")');
  await waitFor('document.activeElement.id==="product-name"');
  await fill('#product-name','Cartel de recibida');await fill('#product-description','Cartel para celebrar');
  assert.equal(await evaluate('document.querySelector("#product-slug").value'),'cartel-de-recibida');
  await click('.taxonomy-choices input');await fill('#shape-0','rectangular');await fill('#price-0','15000,25');
  await click('.add-variant');await fill('#shape-1','circular');await fill('#variant-name-1','A medida');await fill('#pricing-1','QUOTE');
  await click('.editor-save button');
  await waitFor('location.pathname.startsWith("/admin/productos/c") && !!document.querySelector("#product-status")');
  const product=await ctx.prisma.product.findUniqueOrThrow({where:{slug:'cartel-de-recibida'},include:{variants:true}});
  assert.equal(product.status,'HIDDEN');assert.equal(product.variants[0].priceCents,1500025);assert.equal(product.variants[1].priceCents,null);
  assert.equal(product.variants[0].attributes.formato,'rectangular');assert.equal(product.variants[1].attributes.formato,'circular');
  const editPath='/admin/productos/'+product.id;
  await fill('#product-status','PUBLISHED');await click('.editor-save button');await saved();
  assert.equal((await ctx.prisma.productVariant.findMany({where:{productId:product.id}})).find(v=>v.key==='base').id,product.variants[0].id);
  const publicProduct=await fetch(ctx.url+'/api/v1/products/cartel-de-recibida');assert.equal(publicProduct.status,200);
  await auditedNavigate('/productos/cartel-de-recibida','h1');assert.match(await evaluate('document.body.innerText'),/Cartel de recibida/);
  // Detectar que otro administrador cambió el mismo campo.
  await auditedNavigate(editPath,'#product-name');await fill('#product-name','Edición local');
  await ctx.prisma.product.update({where:{id:product.id},data:{name:'Edición concurrente'}});
  await click('.editor-save button');await waitFor('document.body.innerText.includes("cambió desde que lo abriste")');
  assert.equal((await ctx.prisma.product.findUniqueOrThrow({where:{id:product.id}})).name,'Edición concurrente');
  await clickText('Recargar datos');await clickText('Confirmar');await waitFor('document.querySelector("#product-name").value==="Edición concurrente"');
  await fill('#product-name','Cartel de recibida');await click('.editor-save button');await saved();
  await auditedNavigate('/admin/categorias','#taxonomy-name');await clickText('Eliminar Recibidas');await clickText('Confirmar');
  await waitFor('document.body.innerText.includes("uso") || document.body.innerText.includes("asociad")');
  assert.equal(await ctx.prisma.category.count(),1);
  // Clasificación del editor: limpiar solo después de una decisión explícita.
  await auditedNavigate('/admin/productos/nuevo','#product-name');
  await click('.taxonomy-choices input');
  await fill('#product-type','GENERIC');
  assert.equal(await evaluate('document.querySelectorAll(".taxonomy-choices").length'),1);
  assert.equal(await evaluate('document.querySelector(".taxonomy-choices input").checked'),true);
  await fill('#product-type','CUSTOM');
  assert.equal(await evaluate('document.querySelector(".taxonomy-choices")'),null);
  await fill('#product-category','PROP');
  assert.equal(await evaluate('document.querySelector("#product-type")'),null);
  await fill('#product-name','Prop sin ocasión');await fill('#product-description','Un prop');await fill('#price-0','1000');
  await click('.editor-save button');await waitFor('location.pathname.startsWith("/admin/productos/c") && !!document.querySelector("#product-status")');
  const prop=await ctx.prisma.product.findUniqueOrThrow({where:{slug:'prop-sin-ocasion'},include:{categories:true}});
  assert.equal(prop.category,'PROP');assert.equal(prop.type,'CUSTOM');assert.equal(prop.categories.length,0);
  // Combo con referencia a otro producto.
  await auditedNavigate('/admin/productos/nuevo','#product-name');await fill('#product-name','Combo fiesta');await fill('#product-description','Cartel y accesorios');await fill('#product-category','COMBO');assert.equal(await evaluate('document.querySelector("#product-type")'),null);assert.equal(await evaluate('document.querySelector(".taxonomy-choices")'),null);await fill('#price-0','20000');
  await click('.add-component');await fill('#component-name-0','Cartel principal');await fill('#component-quantity-0','2');await fill('.reference-search','Cartel');
  await waitFor('!!document.querySelector(".reference-picker li button")');await click('.reference-picker li button');
  await click('.editor-save button');await waitFor('location.pathname.startsWith("/admin/productos/c") && !!document.querySelector("#product-status")');
  const combo=await ctx.prisma.product.findUniqueOrThrow({where:{slug:'combo-fiesta'},include:{components:true}});assert.equal(combo.components[0].referenceProductId,product.id);
  console.log('OK altas, variantes, forma, cotización, publicación, IDs estables, conflictos y combo referenciado');
  await auditedNavigate('/admin/productos?status=HIDDEN&type=COMBO','.admin-product-list');assert.match(await evaluate('document.querySelector(".admin-product-list").innerText'),/Combo fiesta/);assert.doesNotMatch(await evaluate('document.querySelector(".admin-product-list").innerText'),/Cartel de recibida/);
  await auditedNavigate(editPath,'#product-name');
  for(const width of [1440,390,320]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<500});
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Desborde editor '+width);
   if(width!==320){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(root+'.test-build/catalog-editor-'+width+'.png',Buffer.from(shot.data,'base64'));}
  }
  // Archivo pequeño real; el proveedor es interceptado, nunca se contacta Cloudinary.
  await auditedNavigate(editPath+'/imagenes','#image-file');
  const selectFile=async(type='image/png')=>evaluate('(async()=>{const b=Uint8Array.from(atob('+JSON.stringify(png)+'),c=>c.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([b],"cartel.png",{type:'+JSON.stringify(type)+'}));const input=document.querySelector("#image-file");input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await selectFile('image/svg+xml');await clickText('Cargar imagen');await waitFor('document.body.innerText.includes("Elegí una imagen JPG")');
  assert.equal(await ctx.prisma.mediaUpload.count(),0);
  await selectFile();await fill('#image-alt','Cartel dorado');failInspect=true;
  await clickText('Cargar imagen');await waitFor('document.body.innerText.includes("Servicio temporalmente no disponible") && !document.querySelector(".editor-fields").disabled');
  assert.equal(await ctx.prisma.mediaUpload.count(),1);assert.equal(await ctx.prisma.productImage.count(),0);
  failInspect=false;await clickText('Verificar carga');await waitFor('document.querySelectorAll(".admin-gallery article").length===1 && document.body.innerText.includes("Imagen confirmada")');
  assert.equal(await ctx.prisma.mediaUpload.count(),1);assert.equal(uploadRequests.length,1);
  await selectFile();await fill('#image-alt','Segunda imagen');await clickText('Cargar imagen');
  await waitFor('document.querySelectorAll(".admin-gallery article").length===2 && document.body.innerText.includes("Imagen confirmada")');
  await waitFor('!!Array.from(document.querySelectorAll(".admin-gallery article button")).find(e=>e.textContent==="Bajar" && !e.matches(":disabled"))');
  await evaluate('Array.from(document.querySelectorAll(".admin-gallery article button")).find(e=>e.textContent==="Bajar" && !e.matches(":disabled")).click();true');
  await waitFor('document.body.innerText.includes("Orden guardado")');
  assert.equal((await ctx.prisma.productImage.findFirst({where:{productId:product.id,cover:true}})).altText,'Segunda imagen');
  const altId=await evaluate('document.querySelector(".admin-gallery input").id');await fill('#'+altId,'Portada actualizada');await clickText('Guardar descripción');await waitFor('document.body.innerText.includes("Descripción guardada")');
  await clickText('Eliminar imagen');await clickText('Confirmar');await waitFor('document.querySelectorAll(".admin-gallery article").length===1 && document.body.innerText.includes("Imagen eliminada")');
  assert.equal((await ctx.prisma.productImage.findFirst({where:{productId:product.id}})).cover,true);
  assert.ok(uploadRequests.every(r=>!Object.keys(r.headers).some(h=>/cookie|csrf|authorization/i.test(h))));
  for(const width of [1440,390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<500});assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Desborde galería '+width);}
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(root+'.test-build/catalog-gallery-320.png',Buffer.from(shot.data,'base64'));
  assert.deepEqual(exceptions,[]);
  console.log('OK imágenes con proveedor simulado: formato, firma, envío sin credenciales, confirmación recuperable, portada, texto y eliminación; responsive 1440/390/320');
} finally {
  ws?.close();
  await Promise.allSettled(processes.map(stop));
  await api.close();
}
