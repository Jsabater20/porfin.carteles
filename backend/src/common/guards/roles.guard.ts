import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ALLOWED_ROLES } from '../decorators/auth.decorators';
import { AuthenticatedRequest } from '../../modules/auth/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<AdminRole[]>(ALLOWED_ROLES, [context.getHandler(), context.getClass()]);
    if (roles?.length && !roles.includes(context.switchToHttp().getRequest<AuthenticatedRequest>().admin?.role)) throw new ForbiddenException('No tenés permisos para esta operación.');
    return true;
  }
}
