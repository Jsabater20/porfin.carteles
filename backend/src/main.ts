import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';
import { startupErrorMessage } from './config/startup-error';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, abortOnError: false, logger: false, forceCloseConnections: true });
  try {
    const config = app.get(ConfigService);
    app.enableShutdownHooks();
    configureApp(app);
    await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
    app.useLogger(['error', 'warn', 'log']);
    console.log('API iniciada.');
  } catch (error) {
    // Release Prisma connections and shutdown hooks after a failed listen.
    await app.close().catch(() => undefined);
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  console.error(startupErrorMessage(error));
  process.exitCode = 1;
});
