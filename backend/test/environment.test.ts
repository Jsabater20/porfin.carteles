import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvironment } from '../src/config/environment';

const base = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/porfin',
  DIRECT_URL: 'postgresql://user:password@localhost:5432/porfin',
  ALLOWED_ORIGINS: 'http://localhost:3000',
};

test('Normaliza el puerto y las opciones sin exponer credenciales', () => {
  const env = validateEnvironment(base);
  assert.equal(env.PORT, 3001);
  assert.equal(env.SWAGGER_ENABLED, true);
  assert.throws(() => validateEnvironment({ ...base, DATABASE_URL: 'secret-value' }), /DATABASE_URL debe ser/);
});

test('Rechaza orígenes comodín, puertos inválidos y HTTP en producción', () => {
  assert.throws(() => validateEnvironment({ ...base, ALLOWED_ORIGINS: '*' }));
  assert.throws(() => validateEnvironment({ ...base, PORT: '3.5' }));
  assert.throws(() => validateEnvironment({ ...base, NODE_ENV: 'production' }));
  const env = validateEnvironment({ ...base, DATABASE_URL: base.DATABASE_URL + '?sslmode=require&sslaccept=strict', DIRECT_URL: base.DIRECT_URL + '?sslmode=require&sslaccept=strict', NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://tienda.example.com', API_ORIGIN: 'https://api.example.com' });
  assert.equal(env.SWAGGER_ENABLED, false);
});

const production = {
  ...base, NODE_ENV: 'production', API_ORIGIN: 'https://api.example.com', ALLOWED_ORIGINS: 'https://tienda.example.com',
  DATABASE_URL: base.DATABASE_URL + '?sslmode=require&sslaccept=strict', DIRECT_URL: base.DIRECT_URL + '?sslmode=require&sslaccept=strict',
};
test('Producción exige TLS verificado y rechaza configuraciones ambiguas sin revelar secretos', () => {
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) for (const query of ['', '?sslmode=disable', '?sslmode=require&sslaccept=accept_invalid_certs', '?sslmode=require&sslmode=disable&sslaccept=strict']) {
    assert.throws(() => validateEnvironment({ ...production, [key]: 'postgresql://user:secret-sentinel@db.example.com/store' + query }), (error: any) => !error.message.includes('secret-sentinel'));
  }
  for (const patch of [{ API_ORIGIN: '' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { MAIL_MODE: 'file' }, { MAIL_MODE: 'smtp' }, { TRUST_PROXY_HOPS: 'true' }, { PASSWORD_RESET_URL: 'https://attacker.example/reset' }, { PASSWORD_RESET_URL: 'https://tienda.example.com/reset?token=secret' }]) assert.throws(() => validateEnvironment({ ...production, ...patch }));
  const env = validateEnvironment({ ...production, SESSION_SAME_SITE: 'none', TRUST_PROXY_HOPS: 1 });
  assert.equal(env.SESSION_SAME_SITE, 'none'); assert.equal(env.TRUST_PROXY_HOPS, 1);
});
