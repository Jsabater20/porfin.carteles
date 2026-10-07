import assert from 'node:assert/strict';

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startFixtureApi, products } from '../test/fixtures/storefront-api.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
assert.ok(existsSync(chrome), 'Indicá CHROME_PATH con un Chrome instalado.');
const profile = root + '.test-build/consolidation-profile-' + Date.now();
await mkdir(profile, { recursive: true });
const api = await startFixtureApi(3101);
for (const [index, kind] of ['generico','predeterminado'].entries()) {
  const product = structuredClone(products[0]);
  product.id = 'consolidated-' + kind; product.slug = 'cartel-' + kind;
  product.name = 'Cartel ' + kind; product.type = index ? 'PREDEFINED' : 'GENERIC';
  product.variants = ['rectangular','circular'].flatMap(shape=>[
    { ...product.variants[0], id:kind+'-'+shape+'-base', key:kind+'-'+shape+'-base', name:shape, attributes:{formato:shape}, photoCount:0, priceCents:5200000 },
    { ...product.variants[0], id:kind+'-'+shape+'-photos', key:kind+'-'+shape+'-photos', name:shape+' · con 3 imágenes', attributes:{formato:shape}, photoCount:3, priceCents:5500000 },
  ]);
  product.images = ['RECTANGULAR','CIRCULAR'].map((shape,index)=>({id:kind+'-'+shape,url:'https://res.cloudinary.com/test/image/upload/'+kind+'-'+shape+'.jpg',altText:shape,shape,cover:index===0,position:index,width:800,height:600}));
  products.push(product);
}
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], {
  cwd: root, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', BACKEND_API_URL: 'http://127.0.0.1:3101/api/v1', WEB_ORIGIN: 'http://localhost:3100' }, stdio: 'ignore',
});
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-gpu-sandbox', '--use-gl=swiftshader', '--disable-features=Vulkan,SkiaGraphite', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=9232', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile,
  ...(process.env.TEST_BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws;
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

  await send('Page.enable');await send('Runtime.enable');

  await send('Page.navigate',{url:'http://localhost:3100/productos/cartel-tres-imagenes'});
  await waitFor('location.pathname==="/catalogo" && location.search.includes("type=PREDEFINED")');
  for (const kind of ['generico','predeterminado']) for (const shape of ['rectangular','circular']) {
    const id=kind+'-'+shape+'-base';
    await navigate('/productos/cartel-'+kind+'?variante='+id,'#product-variant');
    await waitFor('document.querySelector("#product-variant").value === '+JSON.stringify(id));
    assert.equal(await evaluate('!!document.querySelector("#personalization-idea")'),false);
    assert.equal(await evaluate('document.querySelector("#product-variant").options.length'),2);
    assert.ok(await evaluate('document.querySelector("#product-variant").textContent.includes("+ 3 imágenes a elección")'));
    assert.ok(await evaluate('document.querySelector(".variant-price").textContent.includes("52.000")'));
    await evaluate('(()=>{const element=document.querySelector("#product-variant");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(element,'+JSON.stringify(kind+'-'+shape+'-photos')+');element.dispatchEvent(new Event("change",{bubbles:true}));})()');
    await waitFor('document.querySelector(".variant-detail").textContent.includes("porfincarteles@gmail.com") && document.querySelector(".variant-price").textContent.includes("55.000")');
  }
  await navigate('/productos/cartel-generico?variante=inexistente','#product-variant');
  await waitFor('document.querySelector("#product-variant").value === "generico-rectangular-base"');
  for (const width of [1440,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
    await navigate('/productos/cartel-generico?variante=generico-rectangular-base','#product-variant');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Desborde a '+width);
  }
  await navigate('/catalogo','.store-nav');
  await evaluate('document.querySelector(\'.store-nav a[href="/#como-pedir"]\').click()');
  await waitFor('location.pathname==="/" && location.hash==="#como-pedir" && !!document.querySelector("#como-pedir") && Math.abs(document.querySelector("#como-pedir").getBoundingClientRect().top) < 150');
  await navigate('/','.hero-copy');
  await evaluate('document.querySelector(\'.hero-copy a[href="#como-pedir"]\').click()');
  await waitFor('location.hash==="#como-pedir" && Math.abs(document.querySelector("#como-pedir").getBoundingClientRect().top) < 150');
  assert.deepEqual(exceptions,[]);
  console.log('OK: variantes, precios, tamaños de pantalla y enlaces a Cómo pedir desde catálogo y home');
} finally {
  ws?.close();
  await Promise.allSettled(processes.map(stop));
  await api.close();
}
