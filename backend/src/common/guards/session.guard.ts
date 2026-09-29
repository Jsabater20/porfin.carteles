import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { STOREFRONT_ROUTE } from '../../modules/guest-sessions/guest.constants';
import { PUBLIC_ROUTE } from '../decorators/auth.decorators';
import { AuthService } from '../../modules/auth/auth.service';
import { AuthenticatedRequest } from '../../modules/auth/auth.types';
import { sessionCookie } from '../../modules/auth/session-cookie';
import { csrfToken, equalTokens } from '../utils/credentials';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    if (!isPublic) {
      const identity = await this.auth.authenticate(sessionCookie(request, this.config));
      request.admin = identity.admin;
      request.adminSession = identity.session;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      const allowed = this.config.getOrThrow<string>('ALLOWED_ORIGINS').split(',');
      const apiOrigin = this.config.getOrThrow<string>('API_ORIGIN');
      if (origin && ![...allowed, apiOrigin].includes(origin)) throw new ForbiddenException('Origen no permitido.');
      const expectedClient = this.reflector.getAllAndOverride<boolean>(STOREFRONT_ROUTE, [context.getHandler(), context.getClass()]) ? 'porfin-storefront' : 'porfin-admin';
      if (request.headers['x-requested-with'] !== expectedClient || !request.is('application/json')) throw new ForbiddenException('Usá JSON y el encabezado X-Requested-With correspondiente.');
      if (!isPublic && !equalTokens(request.headers['x-csrf-token'], csrfToken(request.adminSession.token))) throw new ForbiddenException('Token CSRF inválido.');
    }
    return true;
  }
}
