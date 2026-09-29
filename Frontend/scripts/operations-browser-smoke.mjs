import assert from 'node:assert/strict';
import {auditPage} from './accessibility-audit.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { operationsScenario } from './operations-scenario.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
assert.ok(existsSync(chrome), 'Indicá CHROME_PATH con un Chrome instalado.');
const profile = root + '.test-build/operations-browser-profile-' + Date.now();
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
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
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
    if (selector.startsWith('#')) await waitFor('Array.from(document.querySelectorAll(".editor-fields")).every(e=>!e.disabled)');
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
  await operationsScenario({ctx,login,navigate:auditedNavigate,fill,click,send,evaluate,waitFor,ws,exceptions,root});
} finally {
  ws?.close();
  await Promise.allSettled(processes.map(stop));
  await api.close();
}
