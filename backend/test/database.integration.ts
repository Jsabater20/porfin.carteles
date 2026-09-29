import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { PrismaService } from '../src/database/prisma.service';

test('PostgreSQL real: migración, seed y API', { timeout: 30000 }, async t => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, bodyParser: false, abortOnError: false });
  t.after(() => app.close());
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const prisma = app.get(PrismaService);
  const metadata = await prisma.applicationMetadata.findUnique({ where: { key: 'application' } });
  assert.equal(metadata?.value, 'porfin-carteles');
  const base = await app.getUrl();
  assert.deepEqual(await (await fetch(`${base}/api/v1/health`)).json(), { status: 'ok' });
  assert.equal((await fetch(`${base}/api/v1/health/ready`)).status, 200);
});
