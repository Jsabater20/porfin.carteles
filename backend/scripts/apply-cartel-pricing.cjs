const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const driveCatalog = JSON.parse(readFileSync(resolve(__dirname, '../prisma/data/drive-catalog.json'), 'utf8'));
const targetSlugs = [...new Set([
  'cartel-generico',
  'cartel-predeterminado',
  'cartel-baby-shower',
  'cartel-personalizado',
  ...driveCatalog.items.map((item) => item.slug),
])];

const standard = [
  { key: 'rectangular', name: 'Rectangular · 60 × 100 cm', formato: 'rectangular', medidas: '60 × 100 cm', photoCount: 0, priceCents: 5_200_000 },
  { key: 'circular', name: 'Circular · 70 cm de diámetro', formato: 'circular', medidas: '70 cm de diámetro', photoCount: 0, priceCents: 5_500_000 },
  { key: 'rectangular-3-imagenes', name: 'Rectangular · 60 × 100 cm · con 3 imágenes', formato: 'rectangular', medidas: '60 × 100 cm', photoCount: 3, priceCents: 5_500_000 },
  { key: 'circular-3-imagenes', name: 'Circular · 70 cm de diámetro · con 3 imágenes', formato: 'circular', medidas: '70 cm de diámetro', photoCount: 3, priceCents: 5_900_000 },
];
const babyShower = [
  { key: 'circular', name: 'Circular · 50 cm de diámetro', formato: 'circular', medidas: '50 cm de diámetro', photoCount: 0, priceCents: 5_500_000 },
  { key: 'circular-3-imagenes', name: 'Circular · 50 cm de diámetro · con 3 imágenes', formato: 'circular', medidas: '50 cm de diámetro', photoCount: 3, priceCents: 5_900_000 },
];
const custom = [
  { key: 'rectangular', name: 'Rectangular · 60 × 100 cm', formato: 'rectangular', medidas: '60 × 100 cm', photoCount: 0, priceCents: 6_480_000 },
  { key: 'circular', name: 'Circular · 70 cm de diámetro', formato: 'circular', medidas: '70 cm de diámetro', photoCount: 0, priceCents: 6_880_000 },
  { key: 'xxl', name: 'XXL alargado · 50 × 100 cm', formato: 'xxl', medidas: '50 × 100 cm', photoCount: 0, priceCents: 6_880_000 },
];

function specifications(slug) {
  if (slug === 'cartel-personalizado') return custom;
  return slug === 'cartel-baby-shower' ? babyShower : standard;
}

function matches(variant, specification) {
  if (variant.key === specification.key) return true;
  const attributes = variant.attributes && typeof variant.attributes === 'object' ? variant.attributes : {};
  if (attributes.formato === specification.formato && variant.photoCount === specification.photoCount) return true;
  return variant.photoCount === specification.photoCount && variant.key.includes(specification.formato);
}

function isConfigured(product) {
  const active = product.variants.filter((variant) => variant.active);
  const expected = specifications(product.slug);
  return active.length === expected.length && expected.every((specification) => active.some((variant) =>
    matches(variant, specification)
    && variant.pricingMode === 'FIXED'
    && variant.priceCents === specification.priceCents
    && variant.attributes?.formato === specification.formato
    && variant.attributes?.medidas === specification.medidas));
}

async function updateProduct(product) {
  const used = new Set();
  const expected = specifications(product.slug);
  for (const [position, specification] of expected.entries()) {
    const variant = product.variants.find((candidate) => !used.has(candidate.id) && matches(candidate, specification));
    const data = {
      name: specification.name,
      pricingMode: 'FIXED',
      priceCents: specification.priceCents,
      attributes: { formato: specification.formato, medidas: specification.medidas },
      photoCount: specification.photoCount,
      active: true,
      position,
    };
    if (variant) {
      used.add(variant.id);
      await prisma.productVariant.update({ where: { id: variant.id }, data });
    } else {
      const created = await prisma.productVariant.create({ data: { ...data, productId: product.id, key: specification.key } });
      used.add(created.id);
    }
  }
  await prisma.productVariant.updateMany({ where: { productId: product.id, id: { notIn: [...used] } }, data: { active: false } });
  if (product.slug === 'cartel-personalizado') {
    await prisma.product.update({ where: { id: product.id }, data: { measurements: 'Rectangular: 60 × 100 cm. Circular: 70 cm de diámetro. XXL alargado: 50 × 100 cm.' } });
  } else if (driveCatalog.items.some((item) => item.slug === product.slug)) {
    await prisma.product.update({ where: { id: product.id }, data: { measurements: 'Rectangular: 60 × 100 cm. Circular: 70 cm de diámetro.' } });
  }
}

async function run() {
  const products = await prisma.product.findMany({
    where: { slug: { in: targetSlugs }, category: 'CARTEL', type: { in: ['GENERIC', 'PREDEFINED', 'CUSTOM'] } },
    select: { id: true, slug: true, variants: { orderBy: { position: 'asc' } } },
    orderBy: { slug: 'asc' },
  });
  const found = new Set(products.map((product) => product.slug));
  const preview = { mode: apply ? 'apply' : 'preview', products: products.length, missing: targetSlugs.filter((slug) => !found.has(slug)), update: products.filter((product) => !isConfigured(product)).map((product) => product.slug) };
  console.log(JSON.stringify(preview, null, 2));
  if (!apply) return;
  for (const [index, product] of products.entries()) {
    await updateProduct(product);
    console.log(`[${index + 1}/${products.length}] ${product.slug}`);
  }
  const verified = await prisma.product.findMany({ where: { id: { in: products.map((product) => product.id) } }, select: { id: true, slug: true, variants: true } });
  const invalid = verified.filter((product) => !isConfigured(product)).map((product) => product.slug);
  if (invalid.length) throw new Error(`No se pudieron verificar los precios de: ${invalid.join(', ')}.`);
  console.log(`Verificados ${verified.length} productos.`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
