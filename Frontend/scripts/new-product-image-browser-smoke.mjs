import assert from 'node:assert/strict';

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startAdminProductApi } from '../test/fixtures/admin-product-api.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
assert.ok(existsSync(chrome), 'Indicá CHROME_PATH con un Chrome instalado.');
const profile = root + '.test-build/new-product-image-profile-' + Date.now();
await mkdir(profile, { recursive: true });
const api = await startAdminProductApi(3101);
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], {
  cwd: root, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', BACKEND_API_URL: 'http://127.0.0.1:3101/api/v1', WEB_ORIGIN: 'http://localhost:3100' }, stdio: 'ignore',
});
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-gpu-sandbox', '--use-gl=swiftshader', '--disable-features=Vulkan,SkiaGraphite', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=9232', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile,
  ...(process.env.TEST_BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws;
const uploadRequests = [];
const processes = [next, browser];
async function stop(child) { if (child.exitCode === null && child.signalCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; } }
try {
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
    if (message.method === 'Fetch.requestPaused') {
      const {requestId,request} = message.params;
      if (request.method === 'POST') uploadRequests.push(request);
      void send('Fetch.fulfillRequest', {requestId,responseCode:200,responseHeaders:[{name:'Access-Control-Allow-Origin',value:'http://localhost:3100'},{name:'Content-Type',value:'application/json'}],body:Buffer.from('{}').toString('base64')});
    }
    if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', {accept:true});
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); clearTimeout(item.timer); pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  };
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error('No se cumplió: ' + expression);
  };
  const navigate = async (path, selector) => {
    await send('Page.navigate', { url: 'http://localhost:3100' + path });
    await waitFor('location.pathname===' + JSON.stringify(path.split('?')[0]) + ' && document.readyState==="complete" && !!document.querySelector(' + JSON.stringify(selector) + ')');
  };


  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCookie',{name:'porfin_session',value:'fixture-admin',url:'http://localhost:3100',path:'/'});
  await send('Fetch.enable',{patterns:[{urlPattern:'https://api.cloudinary.com/*'}]});
  const fill = (selector,value) => evaluate('(()=>{const el=document.querySelector('+JSON.stringify(selector)+');const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:el.tagName==="SELECT"?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(el,'+JSON.stringify(value)+');el.dispatchEvent(new Event(el.tagName==="SELECT"?"change":"input",{bubbles:true}));})()');
  const click = selector => evaluate('document.querySelector('+JSON.stringify(selector)+').click()');
  const clickText = text => evaluate('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==='+JSON.stringify(text)+').click()');
  const selectFile = async (type='image/png', corrupt=false) => {
    await evaluate('(()=>{const canvas=document.createElement("canvas");canvas.width=100;canvas.height=80;const ctx=canvas.getContext("2d");ctx.fillStyle="#edbdc8";ctx.fillRect(0,0,100,80);const bytes='+ (corrupt ? 'new Uint8Array([1,2,3])' : 'Uint8Array.from(atob(canvas.toDataURL("image/png").split(",")[1]),c=>c.charCodeAt(0))') +';const transfer=new DataTransfer();transfer.items.add(new File([bytes],"cartel.png",{type:'+JSON.stringify(type)+'}));const el=document.querySelector("#product-image-file");el.files=transfer.files;el.dispatchEvent(new Event("change",{bubbles:true}));})()');
  };
  const newProduct = async (name,shape='rectangular') => {
    await navigate('/admin/productos/nuevo','#product-image-file');
    await waitFor('!document.querySelector(".editor-fields").disabled');
    await fill('#product-name',name);await fill('#product-description','Imagen de prueba');await fill('#shape-0',shape);await fill('#price-0','52000');
  };
  const saved = async () => waitFor('location.pathname!=="/admin/productos/nuevo" && !!document.querySelector("#product-status")');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await newProduct('Cartel con foto');
  await selectFile('image/svg+xml');await click('.editor-save button');
  await waitFor('!!document.querySelector("#product-image-file-error")');
  assert.equal(api.state.creates,0);
  await selectFile('image/png',true);await click('.editor-save button');
  await waitFor('document.querySelector("#product-image-file-error")?.textContent.includes("abrir")');
  assert.equal(api.state.creates,0,'No crea productos para archivos corruptos');
  await selectFile();await waitFor('!!document.querySelector(".selected-product-image img")');
  for (const width of [1440,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<500});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Desborde '+width);
  }
  await click('.editor-save button');await saved();
  const first=Array.from(api.state.products.values())[0];
  assert.equal(api.state.creates,1);assert.equal(first.status,'HIDDEN');assert.equal(first.images.length,1);
  assert.equal(first.images[0].shape,'RECTANGULAR');assert.equal(first.images[0].altText,first.name);assert.equal(first.images[0].cover,true);
  assert.equal(uploadRequests.length,1);
  console.log('OK: vista previa, formatos invalidos, archivo corrupto y creacion con portada');

  await newProduct('Cartel con carga pendiente','circular');await selectFile();
  api.state.failCompleteOnce=true;
  await click('.editor-save button');await waitFor('!!document.querySelector("#image-file")');
  assert.equal(api.state.creates,2);assert.equal(api.state.uploads.size,2);
  assert.equal(await evaluate('document.querySelector("#image-shape").value'),'CIRCULAR');
  assert.ok(await evaluate('!!document.querySelector(".selected-product-image img")'));
  await clickText('Verificar carga');await saved();
  assert.equal(api.state.creates,2);assert.equal(api.state.uploads.size,2);assert.equal(uploadRequests.length,2);
  console.log('OK: recupera confirmacion sin duplicar producto ni reenviar imagen');

  await newProduct('Cartel con servicio caido');await selectFile();api.state.signatureUnavailable=true;
  await click('.editor-save button');await waitFor('!!document.querySelector("#image-file")');
  assert.equal(api.state.creates,3);assert.equal(api.state.uploads.size,2);
  api.state.signatureUnavailable=false;await clickText('Cargar imagen');await saved();
  assert.equal(api.state.creates,3);assert.equal(api.state.uploads.size,3);assert.equal(uploadRequests.length,3);
  console.log('OK: conserva la foto y el producto si no se pudo autorizar la carga');

  await newProduct('Cartel con dos formas');
  await click('.add-variant');await fill('#shape-1','circular');await fill('#price-1','55000');await selectFile();
  await click('.editor-save button');await waitFor('!!document.querySelector("#product-image-shape-error")');
  assert.equal(api.state.creates,3);
  await fill('#product-image-shape','CIRCULAR');await click('.editor-save button');await saved();
  assert.equal(api.state.creates,4);assert.equal(Array.from(api.state.products.values())[3].images[0].shape,'CIRCULAR');
  assert.ok(uploadRequests.every(r=>!Object.keys(r.headers).some(key=>/cookie|csrf|authorization/i.test(key))));
  assert.deepEqual(exceptions,[]);
  console.log('OK: elige la forma de la foto entre varias variantes, carga sin credenciales y sin errores JS');
} finally {
  ws?.close();
  await Promise.allSettled(processes.map(stop));
  await api.close();
}
