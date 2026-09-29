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
import { readFile, readdir } from 'node:fs/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
assert.ok(existsSync(chrome), 'Indicá CHROME_PATH con un Chrome instalado.');
const profile = root + '.test-build/auth-browser-profile-' + Date.now();
await mkdir(profile, { recursive: true });
const backendRoot = path.resolve(root, '../backend');
process.chdir(backendRoot);
const loadBackend = createRequire(import.meta.url);
loadBackend(path.join(backendRoot, 'node_modules/ts-node')).register({ project: path.join(backendRoot, 'tsconfig.json') });
const { integrationApp } = loadBackend(path.join(backendRoot, 'test/support/integration.ts'));
const { hashPassword } = loadBackend(path.join(backendRoot, 'src/common/utils/credentials.ts'));
const ctx = await integrationApp({ ALLOWED_ORIGINS: 'http://localhost:3100', PASSWORD_RESET_URL: 'http://localhost:3100/admin/reset-password' });
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
    if (selector === '.auth-submit') await waitFor('!document.querySelector(".auth-submit").disabled');
  };
  const checkedNavigate = navigate;
  const auditedNavigate = async (...args) => { await checkedNavigate(...args); if(process.env.AUDIT_ACCESSIBILITY==='1') await auditPage(evaluate,args[0]); };
  const fill = (selector, value) => evaluate(`{const el=document.querySelector(${JSON.stringify(selector)});const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));} true`);
  const click = (selector) => evaluate('document.querySelector(' + JSON.stringify(selector) + ').click();true');
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });


  const login = async (email, password = originalPassword) => {
    await auditedNavigate('/admin/login', '.auth-submit');
    await fill('#auth-email', email); await fill('#auth-password', password); await click('.auth-submit');
    await waitFor('location.pathname==="/admin" && !!document.querySelector(".admin-logout")');
  };
  const signOut = async () => { await click('.admin-logout'); await waitFor('location.pathname==="/admin/login" && !!document.querySelector(".auth-submit") && !document.querySelector(".auth-submit").disabled'); };
  const urls = [];
  const previousMessage = ws.onmessage;
  ws.onmessage = (event) => { previousMessage(event); const data = JSON.parse(event.data); if (data.method === 'Network.requestWillBeSent') urls.push(data.params.request.url); };
  await send('Network.enable');
  await send('Page.navigate', { url: 'http://localhost:3100/admin' });
  await waitFor('location.pathname==="/admin/login" && !!document.querySelector(".auth-submit") && !document.querySelector(".auth-submit").disabled');
  assert.equal(await evaluate('document.querySelector(".auth-card form").method'), 'post');
  await click('.auth-submit'); await waitFor('!!document.querySelector("#auth-email-error")');
  assert.equal(await evaluate('document.activeElement.id'), 'auth-email');
  await fill('#auth-email', 'owner@example.test'); await fill('#auth-password', 'incorrecta'); await click('.auth-submit');
  await waitFor('document.body.innerText.includes("Correo o contraseña incorrectos")');
  assert.equal(await evaluate('document.querySelector("#auth-password").value'), '');
  await login('owner@example.test');
  assert.match(await evaluate('document.querySelector(".admin-sidebar nav").innerText'), /Administradores/);
  assert.equal(await evaluate('document.cookie.includes("porfin_session")'), false);
  assert.equal(await evaluate('Object.keys(localStorage).length + Object.keys(sessionStorage).length'), 0);
  assert.equal(await evaluate('fetch("/api/backend/guest-session",{method:"POST",headers:{"Content-Type":"application/json","X-Requested-With":"porfin-storefront"},body:"{}"}).then(r=>r.ok)'), true);
  const cookies = await send('Network.getCookies');
  const guestCookie = cookies.cookies.find((cookie) => cookie.name === 'porfin_guest').value;
  await evaluate('localStorage.setItem("cart-preservation-test","unchanged");true');
  for (const width of [1440, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 500 });
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Desborde panel ' + width);
    if (width !== 320) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(root + '.test-build/admin-' + width + '.png', Buffer.from(shot.data, 'base64')); }
  }
  await signOut();
  assert.match(await evaluate('document.body.innerText'), /Tu sesión se cerró/);
  assert.equal((await send('Network.getCookies')).cookies.find((cookie) => cookie.name === 'porfin_guest').value, guestCookie);
  assert.equal(await evaluate('localStorage.getItem("cart-preservation-test")'), 'unchanged');
  assert.equal((await send('Network.getCookies')).cookies.some((cookie) => cookie.name === 'porfin_session'), false);
  await login('admin@example.test');
  assert.doesNotMatch(await evaluate('document.querySelector(".admin-sidebar nav").innerText'), /Administradores/);
  const account = await ctx.prisma.administrator.findUniqueOrThrow({ where: { email: 'admin@example.test' } });
  await ctx.prisma.adminSession.updateMany({ where: { administratorId: account.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await evaluate('window.dispatchEvent(new Event("focus"));true');
  await waitFor('location.pathname==="/admin/login" && document.body.innerText.includes("Tu sesión venció")');
  console.log('OK login, OWNER/ADMIN, logout con CSRF, cookies separadas y revocación del acceso');

  await auditedNavigate('/admin/recuperar', '.auth-submit'); await fill('#auth-email', 'unknown@example.test'); await click('.auth-submit');
  await waitFor('document.body.innerText.includes("Revisá tu correo")');
  const generic = await evaluate('document.querySelector(".auth-card p").innerText');
  await auditedNavigate('/admin/recuperar', '.auth-submit'); await fill('#auth-email', 'owner@example.test'); await click('.auth-submit');
  await waitFor('document.body.innerText.includes("Revisá tu correo")');
  assert.equal(await evaluate('document.querySelector(".auth-card p").innerText'), generic);
  const files = await readdir(ctx.outbox);
  assert.equal(files.length, 1);
  const mail = JSON.parse(await readFile(path.join(ctx.outbox, files[0]), 'utf8'));
  const token = mail.text.match(/#token=([a-f0-9]{64})/)[1];
  await auditedNavigate('/admin/reset-password', '.auth-card');
  await waitFor('document.body.innerText.includes("Este enlace no tiene un código válido")');
  await send('Page.navigate', { url: 'http://localhost:3100/admin/reset-password#token=' + token });
  await waitFor('!!document.querySelector("#auth-confirmation") && location.hash===""');
  assert.equal(urls.some((url) => url.includes(token)), false);
  await fill('#auth-password', 'corta'); await fill('#auth-confirmation', 'distinta'); await click('.auth-submit');
  await waitFor('!!document.querySelector("#auth-password-error") && !!document.querySelector("#auth-confirmation-error")');
  const newPassword = 'Una contraseña nueva de prueba 123!';
  await fill('#auth-password', newPassword); await fill('#auth-confirmation', newPassword);
  await click('.auth-submit'); await waitFor('document.body.innerText.includes("Contraseña actualizada")');
  assert.equal(await evaluate('JSON.stringify({...localStorage,...sessionStorage}).includes(' + JSON.stringify(token) + ')'), false);
  await send('Page.navigate', { url: 'http://localhost:3100/admin/reset-password#token=' + token });
  await waitFor('!!document.querySelector("#auth-confirmation")');
  await fill('#auth-password', newPassword); await fill('#auth-confirmation', newPassword); await click('.auth-submit');
  await waitFor('document.body.innerText.includes("ya fue utilizado o venció")');
  await login('owner@example.test', newPassword);
  await signOut();
  console.log('OK recuperación genérica, buzón local, fragmento retirado, cambio de clave y token de un uso');

  await auditedNavigate('/admin/login', '.auth-submit');
  for (const width of [1440, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 500 });
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Desborde login ' + width);
    if (width !== 320) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(root + '.test-build/login-' + width + '.png', Buffer.from(shot.data, 'base64')); }
  }
  const anonymous = await fetch('http://localhost:3100/admin', { redirect: 'manual' });
  assert.ok([200, 307].includes(anonymous.status));
  if (anonymous.status === 307) assert.equal(anonymous.headers.get('location'), '/admin/login');
  else { const html = await anonymous.text(); assert.match(html, /NEXT_REDIRECT/); assert.doesNotMatch(html, /Propietaria de prueba/); }
  assert.deepEqual(exceptions, []);
  console.log('OK protección del panel, móvil/escritorio y ausencia de excepciones JavaScript');
} finally {
  ws?.close();
  await Promise.allSettled(processes.map(stop));
  await api.close();
}
