import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request } from 'express';
import { validToken } from '../../common/utils/credentials';

export const cookieName = (config: ConfigService) => config.get('NODE_ENV') === 'production' ? '__Host-porfin_session' : 'porfin_session';
export function cookieOptions(config: ConfigService): CookieOptions {
  return { httpOnly: true, secure: config.get('NODE_ENV') === 'production', sameSite: config.get<'lax' | 'strict' | 'none'>('SESSION_SAME_SITE', 'lax'), path: '/' };
}

export function sessionCookie(request: Request, config: ConfigService): string | undefined {
  const name = cookieName(config);
  const matches = (request.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (matches.length !== 1) return undefined;
  const value = matches[0].slice(name.length + 1);
  return validToken(value) ? value : undefined;
}
