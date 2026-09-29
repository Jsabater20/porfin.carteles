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
const profile = root + '.test-build/cart-browser-profile-' + Date.now();
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
  const cart = () => evaluate('JSON.parse(localStorage.getItem("porfin.cart.v1"))');
  const submitProduct = async () => { await click('.customizer button[type="submit"]'); await waitFor('!!document.querySelector(".success-notice")'); };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await navigate('/productos/producto-0', '.customizer');
  await click('.customizer button[type="submit"]');
  await waitFor('!!document.querySelector("#personalization-name-error")');
  assert.equal(await evaluate('document.activeElement.id'), 'personalization-name');
  await fill('#personalization-name', 'Ana'); await fill('#product-quantity', '2'); await submitProduct();
  await click('.success-notice .text-button');
  await fill('#personalization-name', 'Sol'); await fill('#product-quantity', '1'); await submitProduct();
  assert.equal((await cart()).lines.length, 2);
  console.log('OK requeridos, foco y dos personalizaciones del mismo producto');
  await navigate('/carrito', '.cart-row');
  assert.equal(await evaluate('document.querySelectorAll(".cart-row").length'), 2);
  const saved = await cart();
  await navigate('/productos/producto-0?editar=' + saved.lines[0].lineId, '.customizer');
  assert.equal(await evaluate('document.querySelector("#personalization-name").value'), 'Ana');
  await fill('#personalization-name', 'Eva'); await submitProduct();
  assert.equal((await cart()).lines[0].lineId, saved.lines[0].lineId);
  assert.equal((await cart()).lines[0].answers[0].value, 'Eva');
  await navigate('/productos/producto-2', '.customizer');
  await fill('#personalization-name', 'Combo'); await fill('#personalization-color', 'gold'); await fill('#personalization-age', '0'); await fill('#personalization-notes', 'Frase de prueba'); await submitProduct();
  await navigate('/productos/producto-1', '.customizer');
  await fill('#personalization-name', 'A cotizar'); await submitProduct();
  await navigate('/carrito', '.cart-row');
  assert.equal(await evaluate('document.querySelectorAll(".cart-row").length'), 4);
  assert.equal((await cart()).lines[2].answers.find((answer) => answer.fieldKey === 'age').value, 0);
  assert.doesNotMatch(JSON.stringify(await cart()), /csrfToken|idempotency|previewId/);
  console.log('OK edición, persistencia al navegar, combos, selecciones, número cero y texto largo');
  api.state.previewFailures = 1; api.state.priceDelta = 250;
  await click('.cart-summary > button');
  await waitFor('document.querySelector(".cart-summary").innerText.includes("No pudimos validar")');
  await click('.cart-summary > button');
  await waitFor('!!document.querySelector(".validated-summary")');
  assert.equal(api.state.previewCalls[0].key, api.state.previewCalls[1].key);
  assert.equal(api.state.guestBootstraps, 1);
  assert.match(await evaluate('document.querySelector(".validated-summary").innerText'), /Hay cambios de precio/);
  assert.match(await evaluate('document.querySelector(".validated-summary").innerText'), /Pendientes de cotización/);
  assert.ok(api.state.previewCalls[1].input.items.every((line) => !('display' in line) && !('priceCents' in line)));
  for (const width of [1440, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 500 });
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Desborde en ' + width);
    if (width !== 320) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(root + '.test-build/cart-' + width + '.png', Buffer.from(shot.data, 'base64')); }
  }
  console.log('OK cookie/CSRF, reintento idempotente, cambio de precios, cotización y tamaños de pantalla');
  const firstId = (await cart()).lines[0].lineId;
  await fill('#qty-' + firstId, '3');
  await waitFor('!document.querySelector(".validated-summary")');
  await fill('#cart-delivery', 'PICKUP');
  api.state.previewTtl = 1500;
  await click('.cart-summary > button');
  await waitFor('!!document.querySelector(".validated-summary")');
  assert.notEqual(api.state.previewCalls.at(-1).key, api.state.previewCalls[1].key);
  assert.equal(api.state.previewCalls.at(-1).input.deliveryMethod, 'PICKUP');
  await waitFor('document.querySelector(".cart-summary").innerText.includes("El resumen venció")');
  api.state.unavailableProducts.add('product-0');
  await click('.cart-summary > button');
  await waitFor('document.querySelectorAll(".cart-row .field-error").length===2');
  console.log('OK invalidación por cantidad/entrega, expiración y errores 422 por renglón');
  await click('.cart-lines > .actions .text-button');
  await click('[aria-label="Confirmar vaciado"] .text-button');
  assert.equal((await cart()).lines.length, 4);
  await click('.cart-lines > .actions .text-button');
  await click('[aria-label="Confirmar vaciado"] .button');
  await waitFor('document.body.innerText.includes("Tu carrito está vacío")');
  assert.equal(await cart(), null);
  await evaluate('localStorage.setItem("porfin.cart.v1","{bad");true');
  await navigate('/carrito', '.empty-state');
  await waitFor('document.body.innerText.includes("No pudimos recuperar el carrito")');
  assert.equal(await cart(), null);
  assert.deepEqual(exceptions, []);
  console.log('OK vaciado confirmado, recuperación de almacenamiento corrupto y sin excepciones JavaScript');
} finally {
  ws?.close();
  await Promise.allSettled(processes.map(stop));
  await api.close();
}
