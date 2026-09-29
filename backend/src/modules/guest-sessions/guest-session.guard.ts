import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { equalTokens } from '../../common/utils/credentials';
import { GuestSessionsService } from './guest-sessions.service';
import { guestCookie, guestCsrfToken } from './guest-cookie';
import { GuestRequest } from './guest.types';

@Injectable()
export class GuestSessionGuard implements CanActivate {
  constructor(private readonly guests: GuestSessionsService, private readonly config: ConfigService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    request.guestSession = await this.guests.authenticate(guestCookie(request, this.config));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !equalTokens(request.headers['x-csrf-token'], guestCsrfToken(request.guestSession.token))) throw new ForbiddenException('Token CSRF de invitado inválido.');
    return true;
  }
}
