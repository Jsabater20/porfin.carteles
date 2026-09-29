import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { hashPassword, verifyPassword, opaqueToken, csrfToken, equalTokens } from '../src/common/utils/credentials';
import { cookieName, cookieOptions } from '../src/modules/auth/session-cookie';

test('Contraseñas con salt único y comprobación segura', async () => {
  const password = 'contraseña-larga-para-pruebas';
  const first = await hashPassword(password), second = await hashPassword(password);
  assert.notEqual(first, second); assert.ok(await verifyPassword(password, first));
  assert.equal(await verifyPassword('incorrecta', first), false);
  assert.equal(await verifyPassword(password), false);
});

test('Cookie de producción segura y CSRF vinculado a sesión', () => {
  const config = new ConfigService({ NODE_ENV: 'production', SESSION_SAME_SITE: 'lax' });
  assert.equal(cookieName(config), '__Host-porfin_session');
  assert.deepEqual(cookieOptions(config), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  assert.equal(cookieOptions(config).domain, undefined);
  const token = opaqueToken();
  assert.ok(equalTokens(csrfToken(token), csrfToken(token)));
  assert.equal(equalTokens(csrfToken(opaqueToken()), csrfToken(token)), false);
});
