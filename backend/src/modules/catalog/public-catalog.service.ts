import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { PublicCatalogQuery, PublicCatalogSort, PublicPageQuery } from './dto/public-catalog.dto';

// Proyección explícita: no publicar IDs de cargas, assets, referencias a
// borradores de combos ni futuros campos privados agregados al modelo.
const taxonomy = { id: true, name: true, slug: true } satisfies Prisma.CategorySelect;
const image = { id: true, url: true, altText: true, position: true, cover: true, width: true, height: true } satisfies Prisma.ProductImageSelect;
const visible = { status: 'PUBLISHED', variants: { some: { active: true } } } satisfies Prisma.ProductWhereInput;
const card = {
  id: true, name: true, slug: true, type: true, leadTime: true,
  categories: { orderBy: { categoryId: 'asc' }, select: { category: { select: taxonomy } } },
  careers: { orderBy: { careerId: 'asc' }, select: { career: { select: taxonomy } } },
  images: { orderBy: { position: 'asc' }, take: 1, select: image },
  variants: { where: { active: true }, select: { pricingMode: true, priceCents: true } },
} satisfies Prisma.ProductSelect;
const detail = {
  ...card, description: true, measurements: true, materials: true, includes: true,
  images: { orderBy: { position: 'asc' }, select: image },
  variants: { where: { active: true }, orderBy: { position: 'asc' }, select: { id: true, key: true, name: true, pricingMode: true, priceCents: true, attributes: true, photoCount: true } },
  fields: { orderBy: { position: 'asc' }, select: { key: true, label: true, type: true, required: true, position: true, componentKey: true, minLength: true, maxLength: true, minValue: true, maxValue: true,
    options: { orderBy: { position: 'asc' }, select: { key: true, label: true, additionalCents: true, position: true } } } },
  components: { orderBy: { position: 'asc' }, select: { key: true, name: true, quantity: true, position: true } },
} satisfies Prisma.ProductSelect;

@Injectable()
export class PublicCatalogService {
  constructor(private readonly prisma: PrismaService, private readonly pricing: PricingService) {}

  private present(product: Prisma.ProductGetPayload<{ select: typeof card }>) {
    return {
      id: product.id, name: product.name, slug: product.slug, type: product.type, leadTime: product.leadTime,
      categories: product.categories.map(item => item.category), careers: product.careers.map(item => item.career),
      coverImage: product.images[0] ?? null, basePrice: this.pricing.summarize(product.variants),
    };
  }

  async featured(tx: Prisma.TransactionClient) {
    const items = await tx.featuredProduct.findMany({ where: { product: visible }, orderBy: { position: 'asc' }, take: 12, select: { product: { select: card } } });
    return items.map(item => this.present(item.product));
  }
  async list(query: PublicCatalogQuery) {
    const where: Prisma.ProductWhereInput = {
      ...visible, type: query.type,
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.careerId ? { careers: { some: { careerId: query.careerId } } } : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = query.sort === PublicCatalogSort.NEWEST ? [{ createdAt: 'desc' }, { id: 'asc' }] : [{ name: query.sort === PublicCatalogSort.NAME_ASC ? 'asc' : 'desc' }, { id: 'asc' }];
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, select: card, orderBy, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.product.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items: items.map(product => this.present(product)), total, page: query.page, limit: query.limit };
  }

  async get(slug: string) {
    const product = await this.prisma.$transaction(tx => tx.product.findFirst({ where: { ...visible, slug }, select: detail }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    if (!product) throw new NotFoundException('Producto no encontrado.');
    return { ...this.present(product), description: product.description, measurements: product.measurements, materials: product.materials, includes: product.includes, images: product.images, variants: product.variants, fields: product.fields, components: product.components };
  }

  async taxonomy(kind: 'category' | 'career', query: PublicPageQuery) {
    const where = { products: { some: { product: visible } } };
    const args = { where, select: taxonomy, orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }], skip: (query.page - 1) * query.limit, take: query.limit };
    const [items, total] = kind === 'category'
      ? await this.prisma.$transaction([this.prisma.category.findMany(args), this.prisma.category.count({ where })], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
      : await this.prisma.$transaction([this.prisma.career.findMany(args), this.prisma.career.count({ where })], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items, total, page: query.page, limit: query.limit };
  }
}
