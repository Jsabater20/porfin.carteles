import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from '../src/modules/media/cloudinary.service';
import { MEDIA_MAX_BYTES } from '../src/modules/media/media.constants';
import { validateEnvironment } from '../src/config/environment';

const cloudEnv = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret-only', CLOUDINARY_UPLOAD_PRESET: 'porfin_test' };
const service = () => new CloudinaryService(new ConfigService(cloudEnv));

test('Cloudinary ausente responde 503 y configuración parcial falla sin revelar secretos', async () => {
  const cloud = new CloudinaryService(new ConfigService({}));
  assert.equal(cloud.enabled, false);
  assert.throws(() => cloud.sign('test', 1), ServiceUnavailableException);
  await assert.rejects(cloud.validatePreset(), ServiceUnavailableException);
  const base = { DATABASE_URL: 'postgresql://u:p@localhost/db', DIRECT_URL: 'postgresql://u:p@localhost/db', ALLOWED_ORIGINS: 'http://localhost:3000' };
  assert.throws(() => validateEnvironment({ ...base, CLOUDINARY_API_SECRET: 'do-not-expose' }), error => error instanceof Error && !error.message.includes('do-not-expose'));
  assert.throws(() => validateEnvironment({ ...base, ...cloudEnv, CLOUDINARY_CLOUD_NAME: '../other-cloud' }));
  assert.equal(validateEnvironment({ ...base, ...cloudEnv }).CLOUDINARY_UPLOAD_PRESET, 'porfin_test');
});

test('Firma del SDK fija public_id, formatos y overwrite; no expone el secret', () => {
  const signed = service().sign('porfin/products/one/random-id', 1770000000);
  assert.equal(signed.signature, cloudinary.utils.api_sign_request(signed.params, cloudEnv.CLOUDINARY_API_SECRET));
  assert.notEqual(signed.signature, cloudinary.utils.api_sign_request({ ...signed.params, overwrite: true }, cloudEnv.CLOUDINARY_API_SECRET));
  assert.equal(signed.params.overwrite, false);
  assert.equal(signed.uploadUrl, 'https://api.cloudinary.com/v1_1/test-cloud/image/upload');
  assert.equal(JSON.stringify(signed).includes(cloudEnv.CLOUDINARY_API_SECRET), false);
});

test('Antes de firmar exige un preset firmado con límites reales', async t => {
  let preset: any = { unsigned: false, settings: { allowed_formats: ['jpg', 'png', 'webp'], max_file_size: MEDIA_MAX_BYTES } };
  t.mock.method(cloudinary.api, 'upload_preset', async () => preset);
  const cloud = service();
  await cloud.validatePreset();
  for (const invalid of [
    { ...preset, unsigned: true },
    { ...preset, settings: { ...preset.settings, max_file_size: MEDIA_MAX_BYTES + 1 } },
    { ...preset, settings: { allowed_formats: ['jpg'] } },
    { ...preset, settings: { ...preset.settings, allowed_formats: ['svg'] } },
    { ...preset, settings: { ...preset.settings, folder: 'unexpected' } },
  ]) {
    preset = invalid;
    await assert.rejects(cloud.validatePreset(), ServiceUnavailableException);
  }
});

test('Inspección y borrado manejan errores del proveedor sin filtrarlos', async t => {
  const cloud = service();
  let missing = true;
  t.mock.method(cloudinary.api, 'resource', async () => { throw missing ? { error: { http_code: 404 } } : new Error('secret-only'); });
  await assert.rejects(cloud.inspect('owned-id'), ConflictException);
  missing = false;
  await assert.rejects(cloud.inspect('owned-id'), error => error instanceof ServiceUnavailableException && !error.message.includes('secret-only'));
  const types: string[] = [];
  t.mock.method(cloudinary.uploader, 'destroy', async (_id: string, options: any) => { types.push(options.resource_type); return { result: 'not found' }; });
  await cloud.destroy('owned-id');
  assert.deepEqual(types, ['image', 'video', 'raw']);
});
