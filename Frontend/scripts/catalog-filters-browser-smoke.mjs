import assert from 'node:assert/strict';

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
const profile = root + '.test-build/catalog-filters-profile-' + Date.now();
await mkdir(profile, { recursive: true });
const api = await startFixtureApi(3101);
products[3].type = 'GENERIC';
products[4].category = 'PROP'; products[4].type = 'CUSTOM';
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

  const settled = () => waitFor('!!document.querySelector(".catalog-filters") && document.querySelector(".catalog-filters").getAttribute("aria-busy")==="false"');
  await navigate('/catalogo', '.catalog-filters');
  await settled();
  await delay(750);
  assert.equal(await evaluate('document.querySelector("#catalog-type")'), null);
  assert.equal(await evaluate('document.querySelector("#catalog-sort")'), null);
  await fill('#catalog-category', 'CARTEL');
  await waitFor('location.search.includes("category=CARTEL") && !!document.querySelector("#catalog-type")'); await settled();
  assert.equal(await evaluate('document.querySelector("#catalog-occasion")'), null);
  await fill('#catalog-type','PREDEFINED');
  await waitFor('location.search.includes("type=PREDEFINED") && !!document.querySelector("#catalog-career")'); await settled();
  await fill('#catalog-occasion','cat-0');
  await waitFor('location.search.includes("occasion=cat-0")'); await settled();
  await fill('#catalog-career','career-1');
  await waitFor('location.search.includes("career=career-1")'); await settled();
  await click('a[rel=next]'); await waitFor('location.search.includes("page=2")'); await settled();
  assert.equal(await evaluate('document.querySelector("#catalog-career").value'), 'career-1');
  await fill('#catalog-type','GENERIC');
  await waitFor('location.search.includes("type=GENERIC") && !document.querySelector("#catalog-career")'); await settled();
  assert.equal(await evaluate('new URLSearchParams(location.search).get("occasion")'), 'cat-0');
  assert.equal(await evaluate('new URLSearchParams(location.search).has("career") || new URLSearchParams(location.search).has("page")'), false);
  await evaluate('history.back();true');
  await waitFor('location.search.includes("page=2") && !!document.querySelector("#catalog-career")'); await settled();
  assert.equal(await evaluate('document.querySelector("#catalog-type").value'), 'PREDEFINED');
  await evaluate('history.forward();true');
  await waitFor('location.search.includes("type=GENERIC") && !document.querySelector("#catalog-career")'); await settled();
  await fill('#catalog-category','COMBO');
  await waitFor('location.search==="?category=COMBO" && !document.querySelector("#catalog-type")'); await settled();
  assert.equal(await evaluate('document.querySelector("#catalog-occasion")'), null);
  await fill('#catalog-category','PROP'); await waitFor('location.search==="?category=PROP"'); await settled();
  assert.equal(await evaluate('document.querySelector("#catalog-type")'), null);
  await fill('#catalog-category','CARTEL'); await waitFor('!!document.querySelector("#catalog-type")'); await settled();
  await fill('#catalog-type','CUSTOM'); await waitFor('location.search.includes("type=CUSTOM")'); await settled();
  assert.equal(await evaluate('document.querySelector("#catalog-occasion")'), null);
  await click('.filter-actions a'); await waitFor('location.search==="" && !document.querySelector("#catalog-type")'); await settled();
  await navigate('/catalogo?category=CARTEL&type=PREDEFINED&occasion=missing&career=missing&page=2','.catalog-filters');
  await waitFor('location.search==="?category=CARTEL&type=PREDEFINED"'); await settled();
  await navigate('/catalogo?type=COMBO&sort=name-asc','.catalog-filters'); await settled();
  assert.ok(await evaluate('document.body.textContent.includes("enlace anterior")'));
  assert.equal(await evaluate('document.querySelector("#catalog-category").value'),'COMBO');
  await click('.filter-actions button'); await waitFor('location.search==="?category=COMBO"'); await settled();
  // Search and reload must preserve the selected scope and reset pagination.
  await navigate('/catalogo?category=CARTEL&type=PREDEFINED&page=2','.catalog-filters'); await settled();
  await fill('#catalog-search','Cartel'); await click('.filter-actions button');
  await waitFor('new URLSearchParams(location.search).get("q")==="Cartel" && !new URLSearchParams(location.search).has("page")'); await settled();
  assert.equal(await evaluate('document.querySelector("#catalog-type").value'),'PREDEFINED');
  await send('Page.reload');
  await waitFor('!!document.querySelector("#catalog-search") && document.querySelector("#catalog-search").value==="Cartel"'); await settled();
  assert.equal(await evaluate('document.querySelector("#catalog-category").value'),'CARTEL');
  await fill('#catalog-search','sin-resultados'); await click('.filter-actions button');
  await waitFor('!!document.querySelector(".catalog-empty")'); await settled();
  assert.equal(await evaluate('document.querySelector(".pagination")'),null);
  await click('.catalog-empty a'); await waitFor('location.search===""'); await settled();
  for (const width of [1440,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
    await navigate('/catalogo?category=CARTEL&type=PREDEFINED','.catalog-filters'); await settled();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Desborde a '+width);
  }
  await navigate('/','h1');
  assert.ok(await evaluate('document.body.textContent.includes("Celebraciones con tu toque")'));
  assert.equal(await evaluate('[...document.querySelectorAll(".store-nav a")].filter(link=>link.textContent.trim()==="Home").length'),1);
  assert.equal(await evaluate('document.querySelectorAll(".showcase-options button").length'),3);
  assert.equal(await evaluate('document.querySelectorAll(".showcase-shapes button").length'),3);
  await click('.showcase-shapes button:nth-child(2)');
  await waitFor('document.querySelector(".showcase-copy h2").textContent==="Carteles circulares"');
  assert.match(await evaluate('document.querySelector(".showcase-copy .text-link").href'),/shape=CIRCULAR/);
  await click('.showcase-options button:nth-child(2)');
  await waitFor('document.querySelector(".showcase-copy h2").textContent==="Props"');
  await click('.showcase-options button:nth-child(1)');
  await waitFor('document.querySelector(".showcase-copy h2").textContent==="Carteles circulares"');
  assert.equal(await evaluate('document.querySelectorAll(".steps > li").length'),3);
  assert.equal(await evaluate('document.querySelectorAll(".home-career-list .career-tag").length'),1);
  assert.equal(await evaluate('document.querySelector(".career-tag").textContent.includes("Medicina")'),true);
  for (const width of [1440,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Desborde del Home a '+width);
    if (width !== 320) { const shot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); await writeFile(root+'.test-build/home-'+width+'.png',Buffer.from(shot.data,'base64')); }
  }
  await click('.career-tag');
  await waitFor('location.pathname==="/catalogo" && location.search.includes("career=career-1")'); await settled();
  assert.equal(await evaluate('document.querySelector("#catalog-career").value'), 'career-1');
  for (const [path, selector, name] of [['/catalogo', '.product-grid', 'catalog'], ['/productos/producto-0', '.product-detail-grid', 'product']]) {
    await navigate(path, selector);
    for (const width of [1440, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 });
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Desborde de '+name+' a '+width);
      if (width !== 320) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(root+'.test-build/'+name+'-'+width+'.png', Buffer.from(shot.data, 'base64')); }
    }
  }
  assert.deepEqual(exceptions,[]);
  console.log('OK: filtros, limpieza, paginación, atrás/adelante, enlaces anteriores, Home y 1440/390/320px');
} finally {
  ws?.close();
  await Promise.allSettled(processes.map(stop));
  await api.close();
}
