import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { PublicCatalogQuery, PublicCatalogSort, PublicTaxonomyQuery } from './dto/public-catalog.dto';

// Proyección explícita: no publicar IDs de cargas, assets, referencias a
// borradores de combos ni futuros campos privados agregados al modelo.
const taxonomy = { id: true, name: true, slug: true } satisfies Prisma.CategorySelect;
const image = { id: true, url: true, altText: true, position: true, cover: true, width: true, height: true } satisfies Prisma.ProductImageSelect;
const visible = { status: 'PUBLISHED', variants: { some: { active: true } } } satisfies Prisma.ProductWhereInput;
const card = {
  id: true, name: true, slug: true, type: true, category: true, leadTime: true,
  categories: { orderBy: { categoryId: 'asc' }, select: { category: { select: { ...taxonomy, isOccasion: true } } } },
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

  private filters(query: PublicCatalogQuery): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [visible];
    if (query.q) and.push({ OR: [
      { name: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ] });
    const canonical = query.category !== undefined || query.occasion !== undefined || query.career !== undefined;
    if (!canonical) {
      // Existing links retain their original meaning, including type=COMBO.
      if (query.type) and.push({ type: query.type });
      if (query.categoryId) and.push({ categories: { some: { categoryId: query.categoryId } } });
      if (query.careerId) and.push({ careers: { some: { careerId: query.careerId } } });
      return { AND: and };
    }
    if (query.category) and.push({ category: query.category });
    // Parent filters determine which children have an effect.
    if (query.category !== 'CARTEL') return { AND: and };
    const type = query.type === 'COMBO' ? undefined : query.type;
    if (type) and.push({ type });
    if (type === 'GENERIC' || type === 'PREDEFINED') {
      if (query.occasion) {
        and.push({ categories: { some: { categoryId: query.occasion, category: { isOccasion: true } } } });
      } else if (query.categoryId) {
        // Preserve the legacy relation filter when no new occasion is provided.
        and.push({ categories: { some: { categoryId: query.categoryId } } });
      }
    }
    if (type === 'PREDEFINED' && (query.career ?? query.careerId)) {
      and.push({ careers: { some: { careerId: query.career ?? query.careerId } } });
    }
    return { AND: and };
  }

  private present(product: Prisma.ProductGetPayload<{ select: typeof card }>) {
    return {
      id: product.id, name: product.name, slug: product.slug, type: product.type, category: product.category, leadTime: product.leadTime,
      occasions: product.category === 'CARTEL' && ['GENERIC', 'PREDEFINED'].includes(product.type)
        ? product.categories.filter(item => item.category.isOccasion).map(({ category: { isOccasion, ...item } }) => item) : [],
      categories: product.categories.map(({ category: { isOccasion, ...item } }) => item), careers: product.careers.map(item => item.career),
      coverImage: product.images[0] ?? null, basePrice: this.pricing.summarize(product.variants),
    };
  }

  async featured(tx: Prisma.TransactionClient) {
    const items = await tx.featuredProduct.findMany({ where: { product: visible }, orderBy: { position: 'asc' }, take: 12, select: { product: { select: card } } });
    return items.map(item => this.present(item.product));
  }
  async list(query: PublicCatalogQuery) {
    const where = this.filters(query);
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = query.sort === PublicCatalogSort.NEWEST ? [{ createdAt: 'desc' }, { id: 'asc' }] : [{ name: query.sort === PublicCatalogSort.NAME_ASC ? 'asc' : 'desc' }, { id: 'asc' }];
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, select: card, orderBy, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.product.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items: items.map(product => this.present(product)), total, page: query.page, limit: query.limit };
  }

  async get(slug: string) {
    const product = await this.prisma.$transaction(tx => tx.product.findFirst({ where: { ...visible, slug }, select: detail }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    if (!product) {
      if (slug === 'cartel-tres-imagenes' && await this.prisma.applicationMetadata.findUnique({ where: { key: 'catalog:three-images:v1' } })) {
        throw new GoneException('Las opciones de tres imágenes ahora están en cartel-generico y cartel-predeterminado. Abrí /productos/cartel-tres-imagenes para elegir.');
      }
      throw new NotFoundException('Producto no encontrado.');
    }
    return { ...this.present(product), description: product.description, measurements: product.measurements, materials: product.materials, includes: product.includes, images: product.images, variants: product.variants, fields: product.fields, components: product.components };
  }

  async taxonomy(kind: 'category' | 'career' | 'occasion', query: PublicTaxonomyQuery) {
    const scoped = kind === 'occasion' || query.category !== undefined || query.type !== undefined || query.occasion !== undefined;
    let product: Prisma.ProductWhereInput = visible;
    if (kind !== 'category' && scoped) {
      const category = query.category ?? 'CARTEL';
      const type = query.type ?? (kind === 'career' ? 'PREDEFINED' : undefined);
      if (category !== 'CARTEL' || (kind === 'career' && type !== 'PREDEFINED') || type === 'CUSTOM' || type === 'COMBO') {
        return { items: [], total: 0, page: query.page, limit: query.limit };
      }
      product = { AND: [visible, { category: 'CARTEL', type: type ?? { in: ['GENERIC', 'PREDEFINED'] } },
        ...(kind === 'career' && query.occasion ? [{ categories: { some: { categoryId: query.occasion, category: { isOccasion: true } } } }] : []),
      ] };
    }
    const where = { ...(kind === 'occasion' ? { isOccasion: true } : {}), products: { some: { product } } };
    const args = { where, select: taxonomy, orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }], skip: (query.page - 1) * query.limit, take: query.limit };
    const [items, total] = kind !== 'career'
      ? await this.prisma.$transaction([this.prisma.category.findMany(args), this.prisma.category.count({ where })], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
      : await this.prisma.$transaction([this.prisma.career.findMany(args), this.prisma.career.count({ where })], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items, total, page: query.page, limit: query.limit };
  }
}
