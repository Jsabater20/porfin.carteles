import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { guestCookie, guestCookieName, guestCookieOptions, guestCsrfToken } from '../src/modules/guest-sessions/guest-cookie';
import { csrfToken } from '../src/common/utils/credentials';
import { validatePersonalization } from '../src/modules/orders/personalization';
import { PRODUCT_IDEA_FIELD } from '../src/common/product-idea';

test('Cookie invitada segura, separación de CSRF y cookies ambiguas', () => {
  const config = new ConfigService({ NODE_ENV: 'production', SESSION_SAME_SITE: 'lax' });
  assert.equal(guestCookieName(config), '__Host-porfin_guest');
  assert.deepEqual(guestCookieOptions(config), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  const token = 'a'.repeat(64), name = guestCookieName(config);
  const read = (cookie: string) => guestCookie({ headers: { cookie } } as Request, config);
  assert.equal(read(name + '=' + token), token);
  assert.equal(read(name + '=' + token + '; ' + name + '=' + token), undefined);
  assert.equal(read(name + '=malformed'), undefined);
  assert.notEqual(guestCsrfToken(token), csrfToken(token));
});

test('Personalización normaliza Unicode y respeta límites sin convertir números desde textos', () => {
  const fields = [{ key: 'nombre', label: 'Nombre', type: 'SHORT_TEXT' as const, required: true, componentKey: null, minLength: 2, maxLength: 2, minValue: null, maxValue: null, options: [] }];
  assert.equal(validatePersonalization(fields, [{ fieldKey: 'nombre', value: 'e\u0301🙂' }])[0].value, 'é🙂');
  assert.throws(() => validatePersonalization(fields, [{ fieldKey: 'nombre', value: 12 }]));
  assert.throws(() => validatePersonalization(fields, [{ fieldKey: 'nombre', value: 'abc' }]));
  const number = [{ ...fields[0], type: 'NUMBER' as const, minLength: null, maxLength: null, minValue: 0, maxValue: 10 }];
  assert.equal(validatePersonalization(number, [{ fieldKey: 'nombre', value: 0 }])[0].value, 0);
  assert.throws(() => validatePersonalization(number, [{ fieldKey: 'nombre', value: '0' }]));
});

test('La idea libre reemplaza los campos configurables del catálogo', () => {
  const fields = [{ ...PRODUCT_IDEA_FIELD }];
  assert.deepEqual(validatePersonalization(fields, [{ fieldKey: 'idea', value: '  Colores pastel y nombre Ana  ' }]), [{
    fieldKey: 'idea', label: 'Contanos tu idea', type: 'LONG_TEXT', componentKey: null,
    value: 'Colores pastel y nombre Ana', displayValue: 'Colores pastel y nombre Ana',
  }]);
  assert.throws(() => validatePersonalization(fields, []));
  assert.throws(() => validatePersonalization(fields, [{ fieldKey: 'nombre', value: 'Ana' }]));
});
