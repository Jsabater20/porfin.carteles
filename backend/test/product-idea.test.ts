import assert from 'node:assert/strict';
import test from 'node:test';
import { PRODUCT_IDEA_FIELD, requiresProductIdea, sendsThreeImagesByEmail } from '../src/common/product-idea';
import { validatePersonalization } from '../src/modules/orders/personalization';

test('solo un cartel personalizado exige contar la idea', () => {
  assert.equal(requiresProductIdea('CARTEL', 'CUSTOM'), true);
  for (const type of ['GENERIC', 'PREDEFINED'] as const) assert.equal(requiresProductIdea('CARTEL', type), false);
  assert.equal(requiresProductIdea('COMBO', 'CUSTOM'), false);
  assert.deepEqual(validatePersonalization([], []), []);
  assert.throws(() => validatePersonalization([{ ...PRODUCT_IDEA_FIELD }], []));
});

test('el correo corresponde a variantes de tres imágenes genéricas o predeterminadas', () => {
  for (const type of ['GENERIC', 'PREDEFINED'] as const) {
    assert.equal(sendsThreeImagesByEmail('CARTEL', type, 3), true);
    assert.equal(sendsThreeImagesByEmail('CARTEL', type, 0), false);
  }
  assert.equal(sendsThreeImagesByEmail('CARTEL', 'CUSTOM', 3), false);
  assert.equal(sendsThreeImagesByEmail('COMBO', 'COMBO', 3), false);
});
