const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const files = readdirSync('test').filter(file => /\.(test|integration)\.ts$/.test(file)).sort().map(file => 'test/' + file);
if (!files.length) throw new Error('No se encontraron pruebas.');
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', '-r', 'ts-node/register', ...files], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);