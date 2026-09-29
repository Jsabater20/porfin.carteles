import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../../src/config/configure-app';
import { PrismaService } from '../../src/database/prisma.service';

export async function integrationApp(environment: Record<string, string> = {}, beforeConfigure?: (app: NestExpressApplication) => void) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const originalUrl = process.env.DATABASE_URL;
  if (!originalUrl) throw new Error('Configurá DATABASE_URL para las pruebas de integración.');
  const schema = `test_auth_${randomBytes(8).toString('hex')}`;
  const connection = new URL(originalUrl);
  connection.searchParams.set('schema', schema);
  const root = new PrismaClient({ datasources: { db: { url: originalUrl } } });
  await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const local = path.resolve('.local');
  await mkdir(local, { recursive: true });
  const outbox = await mkdtemp(path.join(local, 'test-mail-'));
  Object.assign(process.env, { DATABASE_URL: connection.toString(), DIRECT_URL: connection.toString(), NODE_ENV: 'test', MAIL_MODE: 'file', MAIL_OUTBOX_DIR: outbox, API_ORIGIN: 'http://localhost:3001', ALLOWED_ORIGINS: 'http://localhost:3000', SWAGGER_ENABLED: 'true', TRUST_PROXY_HOPS: '0', SESSION_SAME_SITE: 'lax' });
  Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '', CLOUDINARY_UPLOAD_PRESET: '' }, environment);
  let app: NestExpressApplication | undefined;
  const cleanup = async () => {
    if (app) await app.close();
    if (!/^test_auth_[a-f0-9]{16}$/.test(schema)) throw new Error('Esquema de prueba inválido.');
    await root.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await root.$disconnect();
    if (!path.resolve(outbox).startsWith(local + path.sep)) throw new Error('Ruta temporal inválida.');
    await rm(outbox, { recursive: true, force: true });
  };
  try {
    const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, encoding: 'utf8', timeout: 30000 });
    if (migration.status !== 0) throw new Error('No se pudieron aplicar las migraciones al esquema aislado.');
    const { AppModule } = await import('../../src/app.module');
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, bodyParser: false, abortOnError: false });
    beforeConfigure?.(app);
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    return { app, prisma: app.get(PrismaService), url, outbox, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
