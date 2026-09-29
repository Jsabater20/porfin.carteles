import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, abortOnError: false, logger: false, forceCloseConnections: true });
  const config = app.get(ConfigService);
  app.enableShutdownHooks();
  configureApp(app);
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
  app.useLogger(['error', 'warn', 'log']);
  console.log('API iniciada.');
}

void bootstrap().catch(() => {
  console.error('No se pudo iniciar la API. Revisá la configuración y la conexión a PostgreSQL.');
  process.exitCode = 1;
});
