import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { TextEncodingPipe } from '../common/pipes/text-encoding.pipe';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import type { Request, Response, NextFunction } from 'express';
import { guestCookieName } from '../modules/guest-sessions/guest-cookie';
import { cookieName } from '../modules/auth/session-cookie';

export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.set('trust proxy', config.get<number>('TRUST_PROXY_HOPS', 0));
  const server = app.getHttpServer() as Server;
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 1000;
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.locals.requestId = randomUUID();
    response.setHeader('X-Request-Id', response.locals.requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('X-DNS-Prefetch-Control', 'off');
    const docs = config.get<boolean>('SWAGGER_ENABLED') && request.path.startsWith('/api/v1/docs');
    response.setHeader('Content-Security-Policy', docs
      ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      : "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (config.get('NODE_ENV') === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.useBodyParser('json', { limit: '1mb', inflate: false });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: false, inflate: false, parameterLimit: 100 });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new TextEncodingPipe(), new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
  }));
  app.enableCors({
    origin: config.getOrThrow<string>('ALLOWED_ORIGINS').split(','),
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });
  if (config.getOrThrow<boolean>('SWAGGER_ENABLED')) {
    const definition = new DocumentBuilder()
      .setTitle('Por fin! API')
      .setDescription('Catálogo público, sesión invitada y preview de carrito. Las escrituras de tienda usan X-Requested-With: porfin-storefront y su CSRF invitado. Acceso administrativo con sesiones, cookies, CSRF y roles OWNER/ADMIN. En las escrituras administrativas usar JSON y X-Requested-With: porfin-admin. Para operaciones autenticadas, agregar X-CSRF-Token obtenido en login o /auth/me.')
      .setVersion('0.12.0')
      .addCookieAuth(guestCookieName(config), { type: 'apiKey', in: 'cookie' }, 'guest-session')
      .addCookieAuth(cookieName(config), { type: 'apiKey', in: 'cookie' }, 'session')
      .build();
    SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, definition));
  }
}
