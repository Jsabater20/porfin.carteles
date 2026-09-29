import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { tokenHash, validToken } from '../../common/utils/credentials';
import { cookieOptions } from '../auth/session-cookie';

export const guestCookieName = (config: ConfigService) => config.get('NODE_ENV') === 'production' ? '__Host-porfin_guest' : 'porfin_guest';
export const guestCookieOptions = cookieOptions;
export const guestCsrfToken = (token: string) => tokenHash('porfin-guest-csrf:' + token);
export function guestCookie(request: Request, config: ConfigService): string | undefined {
  const name = guestCookieName(config);
  const matches = (request.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  if (matches.length !== 1) return undefined;
  const value = matches[0].slice(name.length + 1);
  return validToken(value) ? value : undefined;
}
