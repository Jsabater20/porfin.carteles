import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma, PrismaClient, ProductKind } from '@prisma/client';
import { ProductDto } from '../src/modules/catalog/dto/catalog.dto';

type ReferenceProduct = Omit<ProductDto, 'categoryIds' | 'components' | 'category' | 'occasionIds'> & {
  categories: string[]; sourcePage: number;
  components: { key: string; name: string; quantity: number; referenceSlug?: string }[];
};
type Reference = { categories: { name: string; slug: string }[]; products: ReferenceProduct[] };
const source = JSON.parse(readFileSync(resolve(__dirname, '../prisma/data/catalog-reference.json'), 'utf8')) as Reference;
const prisma = new PrismaClient();

function productKind(product: ReferenceProduct): ProductKind {
  const kinds: Record<string, ProductKind> = { carteles: 'CARTEL', props: 'PROP', combos: 'COMBO' };
  const families = product.categories.filter(slug => kinds[slug]);
  if (families.length !== 1) throw new Error('Familia ambigua: ' + product.slug);
  const kind = kinds[families[0]];
  if ((kind === 'COMBO') !== (product.type === 'COMBO') || (kind === 'PROP' && product.type !== 'CUSTOM')) throw new Error('Tipo incompatible: ' + product.slug);
  return kind;
}

async function run() {
  for (const product of source.products) {
    productKind(product);
    const { categories, sourcePage, components, ...properties } = product;
    const dto = plainToInstance(ProductDto, { ...properties, categoryIds: categories, components: components.map(({ referenceSlug, ...component }) => component) });
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) throw new Error('Datos inválidos: ' + product.slug);
    if (product.variants.some(v => v.pricingMode !== 'QUOTE' || v.priceCents !== null)) throw new Error('El documento no contiene precios.');
    for (const component of components) if (component.referenceSlug && !source.products.some(p => p.slug === component.referenceSlug && p.type !== 'COMBO')) throw new Error('Referencia de combo inválida.');
  }
  const existing = await prisma.product.findMany({ where: { slug: { in: source.products.map(p => p.slug) } }, select: { slug: true } });
  const known = new Set(existing.map(p => p.slug));
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', create: source.products.filter(p => !known.has(p.slug)).map(p => p.slug), preserve: [...known] }, null, 2));
  if (!process.argv.includes('--apply')) return;
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(70930011)');
    const categoryIds = new Map<string, string>();
    for (const category of source.categories) {
      const matches = await tx.category.findMany({ where: { OR: [{ slug: category.slug }, { name: category.name }] } });
      if (matches.some(c => c.slug !== category.slug)) throw new Error('Conflicto de categoría: ' + category.slug);
      const saved = matches[0] ?? await tx.category.create({ data: { ...category, isOccasion: !['carteles', 'props', 'combos'].includes(category.slug) } });
      categoryIds.set(category.slug, saved.id);
    }
    const created: string[] = [], preserved: string[] = [];
    for (const product of source.products) {
      if (await tx.product.findUnique({ where: { slug: product.slug }, select: { id: true } })) { preserved.push(product.slug); continue; }
      const { categories, sourcePage, variants, fields, components, careerIds, ...properties } = product;
      const resolvedComponents = [];
      for (const [position, component] of components.entries()) {
        const { referenceSlug, ...data } = component;
        const reference = referenceSlug ? await tx.product.findUniqueOrThrow({ where: { slug: referenceSlug }, select: { id: true, type: true } }) : null;
        if (reference?.type === 'COMBO') throw new Error('Un combo no puede referenciar otro combo.');
        resolvedComponents.push({ ...data, position, referenceProductId: reference?.id ?? null });
      }
      await tx.product.create({ data: {
        ...properties, category: productKind(product),
        categories: { create: categories.map(slug => { const id = categoryIds.get(slug); if (!id) throw new Error('Categoría inexistente.'); return { categoryId: id }; }) },
        variants: { create: variants.map((v, position) => ({ ...v, position, attributes: v.attributes as Prisma.InputJsonObject })) },
        fields: { create: fields.map(({ options, ...field }, position) => ({ ...field, position, options: { create: options.map((option, optionPosition) => ({ ...option, position: optionPosition })) } })) },
        components: { create: resolvedComponents },
      } });
      created.push(product.slug);
    }
    return { created, preserved };
  }, { timeout: 60000 });
  console.log(JSON.stringify(result, null, 2));
}
void run().catch(error => { console.error(error instanceof Error && error.constructor === Error ? error.message : 'No se pudo importar el catálogo. Revisá la conexión y los datos.'); if (error && typeof error === 'object') console.error('Código:', error.code ?? error.errorCode ?? error.name); process.exitCode = 1; }).finally(() => prisma.$disconnect());