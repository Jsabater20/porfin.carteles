import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startFixtureApi } from '../test/fixtures/storefront-api.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'http://localhost:3100';
const api = await startFixtureApi();
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], {
  cwd: root, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', BACKEND_API_URL: 'http://127.0.0.1:3101/api/v1', WEB_ORIGIN: base }, stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
next.stdout.on('data', (data) => { logs = (logs + data).slice(-6000); });
next.stderr.on('data', (data) => { logs = (logs + data).slice(-6000); });
const get = (path, options = {}) => fetch(base + path, { signal: AbortSignal.timeout(15000), ...options });
const html = async (path) => { const response = await get(path); assert.equal(response.status, 200); return response.text(); };
const run = async (name, check) => { await check(); console.log('OK ' + name); };
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (next.exitCode !== null) throw new Error('Next no inició: ' + logs);
    try { if ((await get('/api/backend/health')).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  assert.ok(ready, 'Next no estuvo disponible a tiempo.');
  await run('inicio publicado y orden de destacados', async () => {
    const page = await html('/');
    assert.match(page, /Celebraciones con tu toque/);
    assert.ok(page.indexOf('Combo de celebración') < page.indexOf('Cartel personalizado'));
  });
  await run('catálogo, filtros completos y paginación', async () => {
    const page = await html('/catalogo');
    assert.match(page, /Carteles y combos/);
    assert.match(page, /Ocasión 51/);
    assert.match(page, /Desde/);
    assert.match(page, /123,45/);
    assert.match(page, /A cotizar/);
    const second = await html('/catalogo?type=PREDEFINED&categoryId=cat-0&careerId=career-1&sort=name-asc&page=2');
    assert.ok(second.includes('page=1') || second.includes('rel="prev"'));
    assert.match(second, /categoryId=cat-0/);
    assert.match(second, /careerId=career-1/);
    assert.match(second, /sort=name-asc/);
  });
  await run('búsqueda vacía, parámetros inválidos y página fuera de rango', async () => {
    assert.match(await html('/catalogo?q=sin-resultados'), /No encontramos productos/);
    assert.match(await html('/catalogo?page=-5&type=INVALID&sort=INVALID'), /Carteles y combos/);
    const response = await get('/catalogo?page=999', { redirect: 'manual' });
    if (response.status === 307) assert.match(response.headers.get('location'), /page=3/);
    else assert.match(await response.text(), /NEXT_REDIRECT/);
  });
  await run('fichas fijas, a cotizar, combos y producto inexistente', async () => {
    assert.match(await html('/productos/producto-0'), /Nombre para el cartel/);
    const quote = await html('/productos/producto-1');
    assert.match(quote, /A cotizar/);
    assert.match(quote, /fotos/);
    const combo = await html('/productos/producto-2');
    assert.match(combo, /Qué trae el combo/);
    assert.match(combo, /Accesorios/);
    const missing = await get('/productos/no-existe');
    assert.ok([200, 404].includes(missing.status));
    assert.match(await missing.text(), /Este producto no está disponible/);
  });
  await run('contenido plano, FAQ y contacto', async () => {
    const about = await html('/nosotros');
    assert.match(about, /&lt;script&gt;/);
    assert.doesNotMatch(about, /<script>alert/);
    assert.match(await html('/preguntas-frecuentes'), /¿Cómo envío mis fotos/);
    assert.match(await html('/contacto'), /https:\/\/wa.me\/5491112345678/);
  });
  await run('contenido no publicado y caída de API con recuperación', async () => {
    api.state.unpublished = true;
    assert.match(await html('/nosotros'), /Estamos preparando esta información/);
    api.state.unpublished = false;
    api.state.unavailable = true;
    assert.match(await html('/catalogo'), /No pudimos cargar el catálogo/);
    assert.match(await html('/'), /No pudimos cargar toda la información/);
    api.state.unavailable = false;
    assert.match(await html('/catalogo'), /Carteles y combos/);
  });
  assert.ok(api.state.requests.some((path) => path.includes('categories?page=2')));
  console.log('F2: recorridos HTTP aprobados con API de contratos local.');
} finally {
  if (next.exitCode === null) {
    const stopped = once(next, 'exit');
    next.kill();
    await stopped;
  }
  await api.close();
}
