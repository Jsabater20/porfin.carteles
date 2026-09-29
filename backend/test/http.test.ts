import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IsString, Length } from 'class-validator';
import { configureApp } from '../src/config/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { HealthController } from '../src/modules/health/health.controller';

class ProbeDto {
  @IsString()
  @Length(1, 20)
  name!: string;
}

// Rutas exclusivas del test, nunca importadas por AppModule.
@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() dto: ProbeDto) { return dto; }
  @Get('error')
  error(): never { throw new Error('secret-database-credentials'); }
}

let databaseAvailable = true;
@Module({
  controllers: [HealthController, ProbeController],
  providers: [
    { provide: ConfigService, useValue: new ConfigService({ ALLOWED_ORIGINS: 'http://localhost:3000', SWAGGER_ENABLED: true }) },
    { provide: PrismaService, useValue: { applicationMetadata: { count: async () => { if (!databaseAvailable) throw new Error('private-database-url'); return 1; } } } },
  ],
})
class HttpTestModule {}

test('Contrato HTTP de la etapa 1', async t => {
  const app = await NestFactory.create<NestExpressApplication>(HttpTestModule, { logger: false, bodyParser: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const base = await app.getUrl();

  await t.test('Prefijo versionado, salud y readiness', async () => {
    assert.deepEqual(await (await fetch(`${base}/api/v1/health`)).json(), { status: 'ok' });
    assert.equal((await fetch(`${base}/api/v1/health/ready`)).status, 200);
    assert.equal((await fetch(`${base}/api/health`)).status, 404);
  });

  await t.test('Errores 404 y 500 uniformes, sin datos internos', async () => {
    for (const [route, code] of [['missing?token=private', 404], ['probe/error', 500]] as const) {
      const response = await fetch(`${base}/api/v1/${route}`);
      const error = await response.json() as Record<string, unknown>;
      assert.equal(response.status, code);
      assert.deepEqual(Object.keys(error).sort(), ['message', 'requestId', 'statusCode', 'timestamp']);
      assert.equal(error.requestId, response.headers.get('x-request-id'));
      assert.doesNotMatch(JSON.stringify(error), /secret-database|private|stack/);
    }
  });

  await t.test('DTO rechaza campos extra y conserva errores de validación', async () => {
    const response = await fetch(`${base}/api/v1/probe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '', injected: true }) });
    assert.equal(response.status, 400);
    const error = await response.json() as { message: string[] };
    assert.ok(Array.isArray(error.message));
    assert.ok(error.message.some(message => message.includes('injected')));
    assert.ok(error.message.some(message => message.includes('name')));
  });

  await t.test('JSON inválido y payload excesivo usan el mismo contrato', async () => {
    for (const [body, status] of [['{', 400], [JSON.stringify({ name: 'x'.repeat(1024 * 1024 + 1) }), 413]] as const) {
      const response = await fetch(`${base}/api/v1/probe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const error = await response.json() as { statusCode: number; requestId: string };
      assert.equal(response.status, status);
      assert.equal(error.statusCode, status);
      assert.ok(error.requestId);
    }
  });

  await t.test('Valida codificación sin alterar acentos ni emojis válidos', async () => {
    const text = 'Ana 🎉 Ñ';
    const valid = await fetch(base + '/api/v1/probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: text }) });
    assert.equal(valid.status, 201); assert.deepEqual(await valid.json(), { name: text });
    for (const name of ['\u0000', '\ud800', '\udfff']) {
      const invalid = await fetch(base + '/api/v1/probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      assert.equal(invalid.status, 400); assert.ok((await invalid.json() as any).requestId);
    }
  });

  await t.test('CORS habilita solo el origen configurado', async () => {
    const allowed = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'http://localhost:3000' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
    const denied = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'https://attacker.example' } });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  });

  await t.test('OpenAPI describe las rutas versionadas', async () => {
    const response = await fetch(`${base}/api/v1/docs-json`);
    assert.equal(response.status, 200);
    const document = await response.json() as { paths: Record<string, unknown> };
    assert.ok(document.paths['/api/v1/health']);
    assert.ok(document.paths['/api/v1/health/ready']);
  });

  await t.test('Una base no disponible produce 503 sin filtrar detalles', async () => {
    databaseAvailable = false;
    const response = await fetch(`${base}/api/v1/health/ready`);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private-database-url/);
    databaseAvailable = true;
  });
});
