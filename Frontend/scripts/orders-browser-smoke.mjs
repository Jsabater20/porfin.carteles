import assert from 'node:assert/strict';
import {auditPage} from './accessibility-audit.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startFixtureApi } from '../test/fixtures/storefront-api.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
assert.ok(existsSync(chrome), 'Indicá CHROME_PATH con un Chrome instalado.');
const profile = root + '.test-build/orders-browser-profile-' + Date.now();
await mkdir(profile, { recursive: true });
const api = await startFixtureApi(3101);
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
  const pending = new Map(), exceptions = [], whatsappAttempts = [];
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
    if (message.method === 'Fetch.requestPaused') { whatsappAttempts.push(message.params.request.url); void send('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'Aborted' }); }
    if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true });
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
  const checkedNavigate = navigate;
  const auditedNavigate = async (...args) => { await checkedNavigate(...args); if(process.env.AUDIT_ACCESSIBILITY==='1') await auditPage(evaluate,args[0]); };
  const fill = (selector, value) => evaluate(`{const el=document.querySelector(${JSON.stringify(selector)});const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));} true`);
  const click = (selector) => evaluate('document.querySelector(' + JSON.stringify(selector) + ').click();true');
  const cart = () => evaluate('JSON.parse(localStorage.getItem("porfin.cart.v1"))');
  const submitProduct = async () => { await click('.customizer button[type="submit"]'); await waitFor('!!document.querySelector(".success-notice")'); };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://wa.me/*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

  const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const fillCustomer = async (name = 'Ana') => {
    await fill('#order-customerFirstName', name); await fill('#order-customerLastName', 'Pérez'); await fill('#order-customerEmail', 'ana@example.com'); await fill('#order-customerPhone', '+54 9 11 2345 6789');
    await fill('#order-requestedDate', futureDate);
    if (await evaluate('!!document.querySelector("#order-deliveryAddress")')) await fill('#order-deliveryAddress', 'Calle 123, Córdoba');
    await fill('#order-notes', 'Entregar por la tarde');
  };
  const validate = async () => { await click('.cart-summary > button'); await waitFor('!!document.querySelector(".order-consent")'); };
  const accept = async () => { await click('.order-consent input'); await waitFor('!document.querySelector(".order-submit").disabled'); };
  await auditedNavigate('/pedido', '.order-page');
  await waitFor('document.body.innerText.includes("Primero armá tu carrito")');
  await auditedNavigate('/productos/producto-0', '.customizer');
  await fill('#personalization-name', 'Celebración'); await submitProduct();
  await auditedNavigate('/pedido', '.order-form');
  assert.equal(await evaluate('document.querySelector(".order-submit").disabled'), true);
  await fill('#order-delivery', 'SHIPPING'); await validate(); await accept();
  await click('.order-submit');
  await waitFor('!!document.querySelector("#error-customerFirstName")');
  assert.equal(await evaluate('document.activeElement.id'), 'order-customerFirstName');
  await fillCustomer(); await fill('#order-deliveryAddress', '');
  await click('.order-submit'); await waitFor('!!document.querySelector("#error-deliveryAddress")');
  assert.equal(api.state.orders.size, 0);
  await fill('#order-deliveryAddress', 'Calle 123, Córdoba');
  for (const width of [1440, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 500 });
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Desborde checkout ' + width);
    if (width !== 320) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(root + '.test-build/checkout-' + width + '.png', Buffer.from(shot.data, 'base64')); }
  }
  api.state.orderLoseResponse = true;
  await click('.order-submit');
  await waitFor('document.body.innerText.includes("No recibimos una confirmación")');
  assert.equal(api.state.orders.size, 1); assert.ok(await cart());
  const pendingOrder = await evaluate('sessionStorage.getItem("porfin.order-attempt.v1")');
  assert.doesNotMatch(pendingOrder, /Ana|5491123456789|Calle|tarde/);
  await evaluate('const changedCart=JSON.parse(localStorage.getItem("porfin.cart.v1"));changedCart.lines[0].quantity=3;localStorage.setItem("porfin.cart.v1",JSON.stringify(changedCart));true');
  // Simula recarga tras una respuesta perdida: conserva el preview original incluso vencido.
  for (const entry of api.state.previews.values()) entry.result.expiresAt = new Date(Date.now() - 1000).toISOString();
  // Evita que el diálogo beforeunload bloquee la navegación automatizada.
  await send('Page.setWebLifecycleState', { state: 'active' });
  await auditedNavigate('/pedido', '.order-form');
  await waitFor('document.body.innerText.includes("Quedó una solicitud")');
  await fillCustomer('Otro nombre'); await click('.order-submit');
  await waitFor('document.body.innerText.includes("exactamente los datos originales")');
  assert.equal(api.state.orderCalls.length, 1);
  await fillCustomer(); await click('.order-submit');
  await waitFor('!!document.querySelector(".order-receipt")');
  await waitFor('!location.search.includes("whatsapp")');
  for (let attempt = 0; attempt < 50 && !whatsappAttempts.length; attempt++) await delay(100);
  assert.equal(whatsappAttempts.length, 1, 'Abre WhatsApp al completar el formulario una sola vez');
  const firstPath = await evaluate('location.pathname');
  assert.equal(api.state.orders.size, 1); assert.equal(api.state.orderCalls[0].key, api.state.orderCalls[1].key);
  assert.equal((await cart()).lines[0].quantity, 3, 'Conserva el carrito editado mientras el pedido estaba pendiente');
  assert.match(await evaluate('document.querySelector(".whatsapp-link").href'), /^https:\/\/wa.me\//);
  assert.equal(await evaluate('document.querySelector(".whatsapp-link").rel'), 'noopener noreferrer');
  await click('.order-actions > .text-button');
  await waitFor('!!document.querySelector(".order-actions [role=status]")');
  await auditedNavigate(firstPath, '.order-receipt');
  assert.equal(api.state.orderCalls.length, 2);
  assert.equal(whatsappAttempts.length, 1, 'Revisitar el recibo no vuelve a redirigir');
  console.log('OK validaciones, envío, respuesta perdida, recarga, misma clave, recibo privado y copia de WhatsApp');

  await auditedNavigate('/pedido', '.order-page');
  await waitFor('!!document.querySelector(".order-page > .text-button")');
  await click('.order-page > .text-button');
  await waitFor('!!document.querySelector(".order-form")');
  await auditedNavigate('/carrito', '.cart-row');
  await click('.cart-lines > .actions .text-button');
  await click('[aria-label="Confirmar vaciado"] .button');
  await waitFor('document.body.innerText.includes("Tu carrito está vacío")');
  await auditedNavigate('/productos/producto-1', '.customizer');
  await fill('#personalization-name', 'Cotización'); await submitProduct();
  await auditedNavigate('/pedido', '.order-form');
  await fill('#order-delivery', 'PICKUP'); await validate(); await fillCustomer(); await accept();
  assert.equal(await evaluate('!!document.querySelector("#order-deliveryAddress")'), false);
  api.state.orderReject = { status: 409, message: 'El catálogo cambió. Volvé a validar el carrito.' };
  await click('.order-submit'); await waitFor('document.body.innerText.includes("El resumen venció o cambió")');
  await waitFor('!document.querySelector(".order-consent") && !!document.querySelector(".cart-summary > button")');
  assert.equal(api.state.orders.size, 1); assert.ok(await cart());
  await validate(); await accept();
  api.state.orderReject = { status: 410, message: 'La validación venció.' };
  await click('.order-submit'); await waitFor('!document.querySelector(".order-consent") && !!document.querySelector(".cart-summary > button")');
  await validate(); await accept();
  api.state.orderNoWhatsapp = true;
  await click('.order-submit'); await waitFor('!!document.querySelector(".order-receipt")');
  assert.equal(api.state.orders.size, 2);
  assert.equal(await cart(), null);
  const lastCall = api.state.orderCalls.at(-1);
  assert.equal('deliveryAddress' in lastCall.input, false);
  assert.equal(new Set(api.state.orderCalls.slice(2).map((entry) => entry.key)).size, 3);
  assert.match(await evaluate('document.body.innerText'), /A cotizar/);
  assert.equal(await evaluate('!!document.querySelector(".whatsapp-link")'), false);
  assert.match(await evaluate('document.body.innerText'), /enlace de WhatsApp no está disponible/);
  for (const width of [1440, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 500 });
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Desborde recibo ' + width);
    if (width !== 320) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(root + '.test-build/order-' + width + '.png', Buffer.from(shot.data, 'base64')); }
  }
  console.log('OK revisión tras 409/410, retiro sin dirección, cotización y WhatsApp sin configurar');
  api.state.orderReadDenied = true;
  await auditedNavigate(firstPath, '.order-page');
  await waitFor('document.body.innerText.includes("No pudimos acceder a esta solicitud")');
  assert.doesNotMatch(await evaluate('document.body.innerText'), /Ana Pérez|Calle 123/);
  const result = await fetch('http://localhost:3100' + firstPath);
  assert.doesNotMatch(await result.text(), /Ana Pérez|Calle 123/);
  assert.deepEqual(exceptions, []);
  console.log('OK sesión vencida, respuesta privada y tamaños de pantalla sin excepciones JavaScript');
} finally {
  ws?.close();
  await Promise.allSettled(processes.map(stop));
  await api.close();
}
