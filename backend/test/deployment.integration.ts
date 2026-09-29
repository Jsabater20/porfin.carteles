import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const configured: NodeJS.ProcessEnv = {
  ...process.env, NODE_ENV: 'production', DATABASE_URL: 'postgresql://test:sentinel-secret@db.example.invalid/store?sslmode=require&sslaccept=strict',
  DIRECT_URL: 'postgresql://test:sentinel-secret@db.example.invalid/store?sslmode=require&sslaccept=strict',
  API_ORIGIN: 'https://api.example.com', ALLOWED_ORIGINS: 'https://tienda.example.com', PASSWORD_RESET_URL: 'https://tienda.example.com/admin/reset-password',
  MAIL_MODE: 'smtp', SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'test', SMTP_PASSWORD: 'sentinel-secret', MAIL_FROM: 'test@example.invalid',
  SWAGGER_ENABLED: 'false', CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'sentinel-secret', CLOUDINARY_UPLOAD_PRESET: 'test',
};

test('Artefactos compilados y validación previa al despliegue sin acceso remoto', { timeout: 30000 }, () => {
  for (const file of ['dist/main.js', 'dist-tools/scripts/create-owner.js', 'dist-tools/prisma/seed.js']) assert.ok(existsSync(file), 'Ejecutá npm run build: falta ' + file);
  const check = (patch: NodeJS.ProcessEnv) => spawnSync(process.execPath, ['scripts/check-production.cjs'], { env: { ...configured, ...patch }, encoding: 'utf8', timeout: 10000 });
  const valid = check({}); assert.equal(valid.status, 0, valid.stdout + valid.stderr); assert.match(valid.stdout, /No se verificaron credenciales remotas/);
  for (const patch of [{ NODE_ENV: 'development' }, { MAIL_MODE: 'disabled' }, { SWAGGER_ENABLED: 'true' }, { DATABASE_URL: 'sentinel-secret' }, { CLOUDINARY_CLOUD_NAME: '' }]) {
    const result = check(patch); assert.equal(result.status, 1); assert.doesNotMatch(result.stdout + result.stderr, /sentinel-secret/);
  }
});

test('Arranque compilado falla con configuración inválida sin imprimir secretos', { timeout: 15000 }, () => {
  const result = spawnSync(process.execPath, ['dist/main.js'], { env: { ...configured, DATABASE_URL: 'sentinel-secret' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stderr, /No se pudo iniciar la API/); assert.doesNotMatch(result.stdout + result.stderr, /sentinel-secret|PrismaClientInitializationError/);
});