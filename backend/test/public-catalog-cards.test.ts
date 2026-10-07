import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogShape } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { PublicCatalogService } from '../src/modules/catalog/public-catalog.service';
import { PublicCatalogQuery, PublicCatalogSort } from '../src/modules/catalog/dto/public-catalog.dto';
import { CatalogDisplayType } from '../src/common/catalog-classification';

const variant = (id: string, shape: string, photoCount: number, priceCents: number) => ({
  id, name: `${shape} · ${photoCount ? 'con 3 imágenes' : '60 × 100 cm'}`, pricingMode: 'FIXED',
  priceCents, photoCount, attributes: { formato: shape },
});
const image = (id: string, shape: CatalogShape | null, url = `https://res.cloudinary.com/test/image/upload/${id}.jpg`) => ({
  id, shape, url, altText: id, position: 0, cover: true, width: 800, height: 600,
});
const product = (id: string, variants: ReturnType<typeof variant>[], images: ReturnType<typeof image>[]) => ({
  id, name: id, slug: id, type: 'PREDEFINED', category: 'CARTEL', leadTime: '',
  categories: [], careers: [], variants, images,
});
const query = (patch: Partial<PublicCatalogQuery> = {}) => Object.assign(new PublicCatalogQuery(), {
  category: 'CARTEL', sort: PublicCatalogSort.NEWEST, ...patch,
});
function catalog(products: ReturnType<typeof product>[]) {
  const prisma = { product: { findMany: async () => products } } as unknown as PrismaService;
  return new PublicCatalogService(prisma, new PricingService(prisma));
}

test('una imagen genera una sola ficha por formato y la opción de tres imágenes conserva su precio', async () => {
  const service = catalog([product('psicologia', [
    variant('rect-base', 'rectangular', 0, 5_200_000),
    variant('circle-base', 'circular', 0, 5_500_000),
    variant('rect-photos', 'rectangular', 3, 5_500_000),
  ], [image('rect', CatalogShape.RECTANGULAR)])]);
  const result = await service.list(query());
  assert.equal(result.total, 1);
  assert.equal(result.items[0].defaultVariantId, 'rect-base');
  assert.equal(result.items[0].basePrice.fromCents, 5_200_000);
  assert.equal(result.items[0].coverImage?.shape, CatalogShape.RECTANGULAR);
  assert.doesNotMatch(result.items[0].name, /con 3 imágenes/i);
  assert.equal((await service.list(query({ shape: CatalogShape.CIRCULAR }))).total, 0);
  assert.equal((await service.list(query({ type: CatalogDisplayType.PREDEFINED_THREE_IMAGES }))).items[0].basePrice.fromCents, 5_500_000);
});

test('no reutiliza una foto para otra forma ni duplica la misma foto entre fichas', async () => {
  const rect = image('rect', CatalogShape.RECTANGULAR);
  const service = catalog([
    product('uno', [variant('a', 'rectangular', 0, 5_200_000), variant('b', 'circular', 0, 5_500_000)], [rect]),
    product('dos', [variant('c', 'rectangular', 0, 5_200_000)], [image('copy', CatalogShape.RECTANGULAR, rect.url)]),
    product('tres', [variant('d', 'circular', 0, 5_500_000)], [image('circle', CatalogShape.CIRCULAR)]),
    product('cuatro', [variant('e', 'rectangular', 0, 5_200_000)], [image('untagged', null)]),
  ]);
  const first = await service.list(query({ limit: 1 }));
  const second = await service.list(query({ limit: 1, page: 2 }));
  assert.equal(first.total, 2);
  assert.equal(first.items[0].name, 'uno · rectangular · 60 × 100 cm');
  assert.equal(second.items[0].coverImage?.shape, CatalogShape.CIRCULAR);
});
