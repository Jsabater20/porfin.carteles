const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { v2: cloudinary } = require('cloudinary');

const source = JSON.parse(readFileSync(resolve(__dirname, '../prisma/data/drive-catalog.json'), 'utf8'));
const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const allowedFormats = new Set(['jpg', 'jpeg', 'png', 'webp']);
const maximumBytes = 5 * 1024 * 1024;

function cloudOptions() {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Faltan variables de Cloudinary: ${missing.join(', ')}.`);
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: 30_000,
  };
}

function validateSource() {
  const slugs = new Set();
  const fileIds = new Set();
  for (const item of source.items) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) throw new Error(`Slug inválido: ${item.slug}`);
    if (!['GENERIC', 'PREDEFINED'].includes(item.type)) throw new Error(`Tipo inválido: ${item.slug}`);
    if ((item.type === 'PREDEFINED') !== Boolean(item.career)) throw new Error(`Carrera incompatible: ${item.slug}`);
    if (slugs.has(item.slug) || fileIds.has(item.driveFileId)) throw new Error(`Entrada duplicada: ${item.slug}`);
    slugs.add(item.slug);
    fileIds.add(item.driveFileId);
  }
}

async function download(fileId) {
  const response = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`, {
    redirect: 'follow',
    headers: { 'user-agent': 'Porfin-Catalog-Importer/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Drive respondió ${response.status} para ${fileId}.`);
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].toLowerCase();
  if (!contentType.startsWith('image/')) throw new Error(`Drive no devolvió una imagen para ${fileId}.`);
  const format = contentType.slice('image/'.length).replace('jpeg', 'jpg');
  if (!allowedFormats.has(format)) throw new Error(`Formato no permitido (${contentType}) para ${fileId}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > maximumBytes) throw new Error(`Tamaño inválido para ${fileId}.`);
  return { dataUri: `data:${contentType};base64,${buffer.toString('base64')}`, bytes: buffer.length };
}

async function cloudAsset(item) {
  const options = cloudOptions();
  const publicId = `porfin/products/drive-catalog/${item.slug}`;
  try {
    return await cloudinary.api.resource(publicId, { ...options, resource_type: 'image', type: 'upload' });
  } catch (error) {
    const code = error?.error?.http_code ?? error?.http_code;
    if (code !== 404) throw error;
  }
  const image = await download(item.driveFileId);
  const result = await cloudinary.uploader.upload(image.dataUri, {
    ...options,
    public_id: publicId,
    resource_type: 'image',
    type: 'upload',
    overwrite: false,
    unique_filename: false,
  });
  if (!result.secure_url || !result.asset_id || !allowedFormats.has(result.format) || result.bytes > maximumBytes) {
    throw new Error(`Cloudinary devolvió datos inválidos para ${item.slug}.`);
  }
  return result;
}

async function ensureProduct(item, familyId, occasionId, careerIds) {
  const current = await prisma.product.findUnique({ where: { slug: item.slug }, select: { id: true } });
  if (current) return { id: current.id, created: false };
  const careerId = item.career ? careerIds.get(item.career.slug) : undefined;
  if (item.career && !careerId) throw new Error(`No se resolvió la carrera de ${item.slug}.`);
  const description = item.type === 'GENERIC'
    ? 'Diseño genérico listo para adaptar con el texto y los detalles de tu celebración.'
    : `Diseño predeterminado para ${item.career.name}, listo para adaptar con tus datos.`;
  const created = await prisma.product.create({ data: {
    name: item.name,
    slug: item.slug,
    description,
    category: 'CARTEL',
    type: item.type,
    status: 'PUBLISHED',
    measurements: 'Formato y medidas a coordinar.',
    materials: '',
    includes: 'Un cartel personalizado a partir del diseño elegido.',
    leadTime: '',
    categories: { create: [{ categoryId: familyId }, { categoryId: occasionId }] },
    careers: careerId ? { create: [{ careerId }] } : undefined,
    variants: { create: [{
      key: 'a-coordinar',
      name: 'Formato y medidas a coordinar',
      pricingMode: 'QUOTE',
      priceCents: null,
      attributes: {},
      photoCount: 0,
      active: true,
      position: 0,
    }] },
  }, select: { id: true } });
  return { id: created.id, created: true };
}

async function attachImage(item, productId, administratorId) {
  const existing = await prisma.productImage.findFirst({ where: { productId }, select: { id: true } });
  if (existing) return false;
  const asset = await cloudAsset(item);
  const format = String(asset.format).replace('jpeg', 'jpg');
  if (!allowedFormats.has(format) || !Number.isInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > maximumBytes
    || !Number.isInteger(asset.width) || !Number.isInteger(asset.height) || asset.width <= 0 || asset.height <= 0
    || asset.width * asset.height > 40_000_000) throw new Error(`Imagen inválida en Cloudinary: ${item.slug}.`);
  await prisma.$transaction(async (tx) => {
    if (await tx.productImage.findFirst({ where: { productId }, select: { id: true } })) return;
    const now = new Date();
    const uploadData = {
      productId,
      administratorId,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      expiresAt: now,
      cleanupAfter: new Date(now.getTime() + 65 * 60 * 1000),
      confirmedAt: now,
      cancelledAt: null,
      cleanedAt: null,
    };
    const upload = await tx.mediaUpload.upsert({
      where: { publicId: asset.public_id },
      create: { id: randomUUID(), publicId: asset.public_id, ...uploadData },
      update: uploadData,
    });
    await tx.productImage.create({ data: {
      productId,
      uploadId: upload.id,
      assetId: asset.asset_id,
      publicId: asset.public_id,
      url: asset.secure_url,
      format,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      altText: item.name,
      position: 0,
      cover: true,
    } });
  }, { maxWait: 10_000, timeout: 30_000 });
  return true;
}

async function run() {
  validateSource();
  const existing = await prisma.product.findMany({
    where: { slug: { in: source.items.map((item) => item.slug) } },
    select: { slug: true, images: { select: { id: true }, take: 1 } },
  });
  const known = new Map(existing.map((item) => [item.slug, item.images.length > 0]));
  const preview = {
    mode: apply ? 'apply' : 'preview',
    total: source.items.length,
    create: source.items.filter((item) => !known.has(item.slug)).map((item) => item.slug),
    addImage: source.items.filter((item) => known.has(item.slug) && !known.get(item.slug)).map((item) => item.slug),
    preserve: source.items.filter((item) => known.get(item.slug)).map((item) => item.slug),
  };
  console.log(JSON.stringify(preview, null, 2));
  if (!apply) return;

  const administrator = await prisma.administrator.findFirst({
    where: { active: true },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (!administrator) throw new Error('No hay un administrador activo para registrar las imágenes.');
  const family = await prisma.category.upsert({
    where: { slug: 'carteles' },
    create: { name: 'Carteles', slug: 'carteles', isOccasion: false },
    update: { isOccasion: false },
    select: { id: true },
  });
  const occasion = await prisma.category.upsert({
    where: { slug: 'recibidas' },
    create: { name: 'Recibidas', slug: 'recibidas', isOccasion: true },
    update: { isOccasion: true },
    select: { id: true },
  });
  const careerIds = new Map();
  for (const career of source.items.flatMap((item) => item.career ? [item.career] : [])) {
    if (careerIds.has(career.slug)) continue;
    let saved = await prisma.career.findUnique({ where: { slug: career.slug }, select: { id: true } });
    if (!saved) {
      saved = await prisma.career.findFirst({ where: { name: { equals: career.name, mode: 'insensitive' } }, select: { id: true } });
    }
    saved ??= await prisma.career.create({ data: career, select: { id: true } });
    careerIds.set(career.slug, saved.id);
  }

  const result = { created: [], imagesAdded: [], preserved: [] };
  for (const [index, item] of source.items.entries()) {
    const product = await ensureProduct(item, family.id, occasion.id, careerIds);
    const imageAdded = await attachImage(item, product.id, administrator.id);
    if (product.created) result.created.push(item.slug);
    if (imageAdded) result.imagesAdded.push(item.slug);
    if (!product.created && !imageAdded) result.preserved.push(item.slug);
    console.log(`[${index + 1}/${source.items.length}] ${item.slug}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
