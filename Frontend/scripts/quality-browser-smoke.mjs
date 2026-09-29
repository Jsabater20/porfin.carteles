import assert from 'node:assert/strict';
import {auditPage} from './accessibility-audit.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startFixtureApi, products } from '../test/fixtures/storefront-api.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
assert.ok(existsSync(chrome), 'Indicá CHROME_PATH con un Chrome instalado.');
const profile = root + '.test-build/quality-browser-profile-' + Date.now();
await mkdir(profile, { recursive: true });
const api = await startFixtureApi(3101);
const template = products[2].fields[0];
products[2].fields.push(
  { ...template, key: 'color', label: 'Color de accesorios', type: 'SELECT', componentKey: 'props', options: [{ key: 'gold', label: 'Dorado', additionalCents: 500, position: 0 }] },
  { ...template, key: 'age', label: 'Número especial', type: 'NUMBER', required: false, minValue: 0, maxValue: 100, componentKey: 'props' },
  { ...template, key: 'notes', label: 'Frase', type: 'LONG_TEXT', required: false, maxLength: 2000, componentKey: 'cartel' },
);
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], {
  cwd: root, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', BACKEND_API_URL: 'http://127.0.0.1:3101/api/v1', WEB_ORIGIN: 'http://localhost:3100' }, stdio: 'ignore',
});
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=9232', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile,
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
  const fill = (selector, value) => evaluate(`{const el=document.querySelector(${JSON.stringify(selector)});const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));} true`);
  const click = (selector) => evaluate('document.querySelector(' + JSON.stringify(selector) + ').click();true');

  await send('Page.enable');await send('Runtime.enable');
  const measurements=[];
  for(const width of [1440,390,320]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
   for(const route of ['/','/catalogo','/productos/producto-0','/productos/producto-2','/nosotros','/contacto','/preguntas-frecuentes','/carrito','/admin/login','/admin/recuperar']){
    await navigate(route,'h1');await auditPage(evaluate,route+' '+width);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Desborde '+route+' '+width);
    const entry=await evaluate('({route:location.pathname,width:innerWidth,domMs:Math.round(performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd),jsBytes:performance.getEntriesByType("resource").filter(r=>r.name.includes("/_next/static/")&&r.name.includes(".js")).reduce((n,r)=>n+r.decodedBodySize,0)})');
    measurements.push(entry);assert.ok(entry.jsBytes<2*1024*1024,'JS inicial excede 2 MiB en '+route);
   }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
  await navigate('/productos/producto-0','.customizer');await fill('#personalization-name','Ana');await click('.customizer button[type=submit]');await waitFor('!!document.querySelector(".success-notice")');
  await navigate('/carrito','.cart-row');await auditPage(evaluate,'carrito con producto');
  await navigate('/','h1');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await evaluate('document.activeElement.classList.contains("skip-link")'),true);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await waitFor('document.activeElement.id==="main-content"');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate('getComputedStyle(document.documentElement).scrollBehavior'),'auto');
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(root+'.test-build/quality-home-390.png',Buffer.from(shot.data,'base64'));
  const robots=await(await fetch('http://localhost:3100/robots.txt')).text();assert.match(robots,/Disallow: \/$/m);
  const sitemap=await(await fetch('http://localhost:3100/sitemap.xml')).text();assert.doesNotMatch(sitemap,/<loc>/);
  for(const route of ['/carrito','/pedido','/admin/login']){
   const markup=await(await fetch('http://localhost:3100'+route)).text();assert.match(markup,/<meta name="robots" content="[^"]*noindex/);
  }
  assert.equal((await fetch('http://localhost:3100/api/health/live')).status,200);
  assert.equal((await fetch('http://localhost:3100/api/health/ready')).status,200);
  assert.deepEqual(exceptions,[]);
  await writeFile(root+'.test-build/quality-measurements.json',JSON.stringify(measurements,null,2));
  console.log('OK axe: tienda, catálogo, fichas, contenido, carrito y acceso en 1440/390/320; teclado, movimiento reducido, SEO privado y salud');
  console.log('JS inicial máximo observado: '+Math.max(...measurements.map(m=>m.jsBytes))+' bytes; tiempos locales registrados, sin equivalencia a Core Web Vitals reales.');

} finally {
  ws?.close();
  await Promise.allSettled(processes.map(stop));
  await api.close();
}
