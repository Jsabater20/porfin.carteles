import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftProduct, buildProduct, changeClassification, supportsCareers, supportsOccasions, productInput, changedProduct, isOccasion } from '../src/features/admin-catalog/model';
import type { AdminProduct } from '../src/lib/contracts/admin-catalog';

test('categoría determina tipo técnico, campos dependientes y limpieza explícita', () => {
  const draft = draftProduct(); draft.occasionIds = ['recibida']; draft.careerIds = ['medicina'];
  const generic = changeClassification(draft, 'CARTEL', 'GENERIC');
  assert.equal(supportsOccasions(generic), true); assert.equal(supportsCareers(generic), false);
  assert.deepEqual(generic.occasionIds, ['recibida']); assert.deepEqual(generic.careerIds, []);
  for (const category of ['PROP', 'COMBO'] as const) {
    const changed = changeClassification(draft, category);
    assert.equal(changed.type, category === 'PROP' ? 'CUSTOM' : 'COMBO');
    assert.deepEqual(changed.occasionIds, []); assert.deepEqual(changed.careerIds, []);
    assert.equal(supportsOccasions(changed), false); assert.equal(supportsCareers(changed), false);
  }
  assert.deepEqual(changeClassification(draft, 'CARTEL', 'CUSTOM').occasionIds, []);
  assert.deepEqual(draft.careerIds, ['medicina']);
});
test('salir de combo conserva variantes y campos, quitando sus asociaciones a componentes', () => {
  const combo = changeClassification(draftProduct(), 'COMBO');
  combo.components = [{ key: 'cartel', name: 'Cartel', quantity: '1' }];
  combo.fields = [{ key: 'nombre', label: 'Nombre', type: 'SHORT_TEXT', required: true, componentKey: 'cartel', minimum: '', maximum: '', options: [] }];
  const changed = changeClassification(combo, 'CARTEL');
  assert.equal(changed.type, 'PREDEFINED'); assert.deepEqual(changed.components, []);
  assert.deepEqual(changed.variants, combo.variants); assert.equal(changed.fields[0].key, 'nombre'); assert.equal(changed.fields[0].componentKey, '');
});
test('editar texto conserva asociaciones históricas ocultas y no envía familias como ocasiones', () => {
  const input = buildProduct(draftProduct()).input;
  const product = { ...input, category: 'PROP', type: 'CUSTOM', name: 'Prop', slug: 'prop', description: 'Prop personalizado', id: 'id', createdAt: '', updatedAt: '',
    categories: [{ categoryId: 'family', category: { id: 'family', name: 'Props', slug: 'props', isOccasion: false } }, { categoryId: 'old', category: { id: 'old', name: 'Recibida', slug: 'recibida', isOccasion: true } }],
    careers: [{ careerId: 'old-career', career: { id: 'old-career', name: 'Medicina', slug: 'medicina' } }],
    variants: [{ ...input.variants[0], id: 'variant', position: 0, priceCents: 1200 }], fields: [], components: [], images: [],
  } as AdminProduct;
  const draft = draftProduct(product); draft.name = 'Prop actualizado';
  assert.deepEqual(buildProduct(draft).errors, {});
  assert.deepEqual(productInput(product).occasionIds, ['old']);
  assert.deepEqual(changedProduct(productInput(product), buildProduct(draft).input), { name: 'Prop actualizado' });
  assert.equal(isOccasion(product.categories[0].category), false);
});
test('un prop nuevo no necesita crear ocasiones ni carreras', () => {
  const draft = changeClassification(draftProduct(), 'PROP');
  draft.name = 'Prop'; draft.slug = 'prop'; draft.description = 'Cartel pequeño'; draft.variants[0].price = '1000';
  assert.deepEqual(buildProduct(draft).errors, {});
});
