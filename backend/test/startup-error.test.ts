import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startupErrorMessage } from '../src/config/startup-error';

test('Un puerto ocupado se diferencia de un fallo de PostgreSQL sin exponer el error original', () => {
  const message = startupErrorMessage({ code: 'EADDRINUSE', port: 3001, message: 'sentinel-secret', stack: 'sentinel-secret' });
  assert.match(message, /puerto 3001 ya está ocupado/);
  assert.match(message, /otra terminal/);
  assert.doesNotMatch(message, /sentinel-secret|PostgreSQL/);
});

test('Los errores desconocidos y puertos no válidos no filtran datos sensibles', () => {
  for (const error of [null, 'sentinel-secret', new Error('sentinel-secret'), { code: 'P1001', message: 'sentinel-secret' }]) {
    assert.match(startupErrorMessage(error), /No se pudo iniciar la API/);
    assert.doesNotMatch(startupErrorMessage(error), /sentinel-secret/);
  }
  assert.match(startupErrorMessage({ code: 'EADDRINUSE', port: 'sentinel-secret' }), /puerto configurado/);
});
