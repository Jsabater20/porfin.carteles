const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const backend = path.resolve(__dirname, '..');
const root = path.resolve(backend, '..');

async function main() {
  const envFile = path.join(backend, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  // This helper only manages the existing Windows development cluster.
  // Remote databases and production are managed by their hosting provider.
  if (process.platform !== 'win32' || process.env.NODE_ENV === 'production') return;
  let url;
  try { url = new URL(process.env.DATABASE_URL); }
  catch { throw new Error('Configurá DATABASE_URL en backend/.env.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '15432') return;

  const binaries = path.join(process.env.ProgramFiles || 'C:/Program Files', 'PostgreSQL/16/bin');
  const data = path.join(root, '.local/postgres-stage1/data');
  const log = path.join(root, '.local/postgres-stage1/server.log');
  const postgres = path.join(binaries, 'postgres.exe');
  const readyCommand = path.join(binaries, 'pg_isready.exe');
  if (!fs.existsSync(postgres) || !fs.existsSync(readyCommand) || !fs.existsSync(path.join(data, 'PG_VERSION'))) {
    throw new Error('Iniciá PostgreSQL local en el puerto 15432. Revisá docs/local-development.md.');
  }
  const isReady = () => spawnSync(readyCommand, ['-h', '127.0.0.1', '-p', '15432', '-t', '1'], {
    windowsHide: true, stdio: 'ignore', timeout: 2000,
  }).status === 0;
  if (isReady()) {
    console.log('PostgreSQL local disponible en 127.0.0.1:15432.');
    return;
  }

  // Never initialize/reset data or remove a PID file. PostgreSQL protects
  // against concurrent starts of this same cluster itself.
  console.log('Iniciando PostgreSQL local...');
  const output = fs.openSync(log, 'a');
  let startFailed = false;
  let child;
  try {
    child = spawn(postgres, ['-D', data, '-h', '127.0.0.1', '-p', '15432'], {
      detached: true, windowsHide: true, stdio: ['ignore', output, output],
    });
  } finally { fs.closeSync(output); }
  child.on('error', () => { startFailed = true; });
  child.unref();
  for (let attempt = 0; attempt < 30; attempt++) {
    await delay(500);
    if (isReady()) {
      console.log('PostgreSQL local iniciado. Continúa el arranque de la API.');
      return;
    }
    if (startFailed) break;
  }
  throw new Error('No se pudo iniciar PostgreSQL local. Revisá .local/postgres-stage1/server.log.');
}

main().catch(error => {
  // Report only our own messages; do not print database URLs or raw errors.
  console.error(error instanceof Error && /^(Configurá|Iniciá|No se pudo iniciar)/.test(error.message)
    ? error.message : 'No se pudo preparar PostgreSQL local. Revisá docs/local-development.md.');
  process.exitCode = 1;
});
