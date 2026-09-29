import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PUBLIC_ROUTE } from '../decorators/auth.decorators';
import { GuestRateLimitService } from '../../modules/guest-sessions/guest-rate-limit.service';
import { HealthController } from '../../modules/health/health.controller';

@Injectable()
export class PublicReadGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly limits: GuestRateLimitService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    // Los healthchecks deben seguir funcionando aun con clientes limitados.
    if (isPublic && ['GET', 'HEAD'].includes(request.method) && context.getClass() !== HealthController) {
      await this.limits.publicRead(request.ip ?? 'unknown');
    }
    return true;
  }
}