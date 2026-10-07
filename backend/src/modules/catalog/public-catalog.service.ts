import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CatalogShape, PublicCatalogQuery, PublicCatalogSort, PublicTaxonomyQuery } from './dto/public-catalog.dto';
import { CatalogDisplayType } from '../../common/catalog-classification';
import { PRODUCT_IDEA_FIELD } from '../../common/product-idea';

// Proyección explícita: no publicar IDs de cargas, assets, referencias a
// borradores de combos ni futuros campos privados agregados al modelo.
const taxonomy = { id: true, name: true, slug: true } satisfies Prisma.CategorySelect;
const image = { id: true, url: true, altText: true, position: true, cover: true, width: true, height: true, shape: true } satisfies Prisma.ProductImageSelect;
const visible = { status: 'PUBLISHED', variants: { some: { active: true } } } satisfies Prisma.ProductWhereInput;
const cardBase = {
  id: true, name: true, slug: true, type: true, category: true, leadTime: true,
  categories: { orderBy: { categoryId: 'asc' }, select: { category: { select: { ...taxonomy, isOccasion: true } } } },
  careers: { orderBy: { careerId: 'asc' }, select: { career: { select: taxonomy } } },
  images: { orderBy: { position: 'asc' }, select: image },
} satisfies Prisma.ProductSelect;
const variantSummary = { id: true, name: true, pricingMode: true, priceCents: true, photoCount: true, attributes: true } satisfies Prisma.ProductVariantSelect;
const card = {
  ...cardBase,
  variants: { where: { active: true }, orderBy: { position: 'asc' }, select: variantSummary },
} satisfies Prisma.ProductSelect;
const detail = {
  ...card, description: true, measurements: true, materials: true, includes: true,
  images: { orderBy: { position: 'asc' }, select: image },
  variants: { where: { active: true }, orderBy: { position: 'asc' }, select: { id: true, key: true, name: true, pricingMode: true, priceCents: true, attributes: true, photoCount: true } },
  components: { orderBy: { position: 'asc' }, select: { key: true, name: true, quantity: true, position: true } },
} satisfies Prisma.ProductSelect;

@Injectable()
export class PublicCatalogService {
  constructor(private readonly prisma: PrismaService, private readonly pricing: PricingService) {}

  private variantShape(shape?: CatalogShape): Prisma.ProductVariantWhereInput {
    return shape ? { active: true, attributes: { path: ['formato'], equals: shape.toLowerCase() } } : { active: true };
  }

  private typeFilter(type: CatalogDisplayType, shape?: CatalogShape): Prisma.ProductWhereInput {
    const variant = this.variantShape(shape);
    if (type === CatalogDisplayType.PREDEFINED_THREE_IMAGES) {
      return { type: 'PREDEFINED', variants: { some: { ...variant, photoCount: 3 } } };
    }
    if (type === CatalogDisplayType.PREDEFINED) {
      return { type: 'PREDEFINED', variants: { some: { ...variant, photoCount: { not: 3 } } } };
    }
    return { type, ...(shape ? { variants: { some: variant } } : {}) };
  }

  private filters(query: PublicCatalogQuery): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [visible];
    if (query.q) and.push({ OR: [
      { name: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ] });
    const canonical = query.category !== undefined || query.occasion !== undefined || query.career !== undefined || query.shape !== undefined;
    if (!canonical) {
      // Existing links retain their original meaning, including type=COMBO.
      if (query.type) and.push(this.typeFilter(query.type, query.shape));
      else if (query.shape) and.push({ variants: { some: this.variantShape(query.shape) } });
      if (query.categoryId) and.push({ categories: { some: { categoryId: query.categoryId } } });
      if (query.careerId) and.push({ careers: { some: { careerId: query.careerId } } });
      return { AND: and };
    }
    if (query.category) and.push({ category: query.category });
    else if (query.shape) and.push({ category: 'CARTEL' });
    // Parent filters determine which children have an effect.
    if (query.category && query.category !== 'CARTEL') return { AND: and };
    const type = query.type === CatalogDisplayType.COMBO ? undefined : query.type;
    if (type) and.push(this.typeFilter(type, query.shape));
    else if (query.shape) and.push({ variants: { some: this.variantShape(query.shape) } });
    if (type === CatalogDisplayType.GENERIC || type === CatalogDisplayType.PREDEFINED || type === CatalogDisplayType.PREDEFINED_THREE_IMAGES) {
      if (query.occasion) {
        and.push({ categories: { some: { categoryId: query.occasion, category: { isOccasion: true } } } });
      } else if (query.categoryId) {
        // Preserve the legacy relation filter when no new occasion is provided.
        and.push({ categories: { some: { categoryId: query.categoryId } } });
      }
    }
    if ((type === CatalogDisplayType.PREDEFINED || type === CatalogDisplayType.PREDEFINED_THREE_IMAGES) && (query.career ?? query.careerId)) {
      and.push({ careers: { some: { careerId: query.career ?? query.careerId } } });
    }
    return { AND: and };
  }

  private present(product: Prisma.ProductGetPayload<{ select: typeof card }>, query?: Pick<PublicCatalogQuery, 'type' | 'shape'>) {
    const variants = product.variants.filter(variant => {
      if (query?.shape && (variant.attributes as Prisma.JsonObject).formato !== query.shape.toLowerCase()) return false;
      if (query?.type === CatalogDisplayType.PREDEFINED_THREE_IMAGES) return variant.photoCount === 3;
      if (query?.type === CatalogDisplayType.PREDEFINED) return variant.photoCount !== 3;
      return true;
    });
    const coverImage = query?.shape
      ? product.images.find(item => item.shape === query.shape) ?? null
      : product.images.find(item => item.cover) ?? product.images[0] ?? null;
    return {
      id: product.id, name: product.name, slug: product.slug, type: product.type, category: product.category, leadTime: product.leadTime,
      occasions: product.category === 'CARTEL' && ['GENERIC', 'PREDEFINED'].includes(product.type)
        ? product.categories.filter(item => item.category.isOccasion).map(({ category: { isOccasion, ...item } }) => item) : [],
      categories: product.categories.map(({ category: { isOccasion, ...item } }) => item), careers: product.careers.map(item => item.career),
      coverImage, defaultVariantId: variants[0]?.id ?? null, displayShape: query?.shape ?? coverImage?.shape ?? null,
      basePrice: this.pricing.summarize(variants),
    };
  }

  private presentVariant(product: Prisma.ProductGetPayload<{ select: typeof cardBase }>, variant: Prisma.ProductVariantGetPayload<{ select: typeof variantSummary }>) {
    const rawShape = (variant.attributes as Prisma.JsonObject).formato;
    const shape = typeof rawShape === 'string' && Object.values(CatalogShape).includes(rawShape.toUpperCase() as CatalogShape)
      ? rawShape.toUpperCase() as CatalogShape : null;
    const coverImage = shape
      ? product.images.find(item => item.shape === shape) ?? product.images.find(item => item.shape === null && item.cover) ?? product.images.find(item => item.shape === null) ?? null
      : product.images.find(item => item.cover) ?? product.images[0] ?? null;
    const variantLabel = variant.name.trim();
    const name = variantLabel && variantLabel.toLocaleLowerCase('es-AR') !== 'base' && !product.name.toLocaleLowerCase('es-AR').includes(variantLabel.toLocaleLowerCase('es-AR'))
      ? `${product.name} · ${variantLabel}` : product.name;
    return {
      id: product.id, name, slug: product.slug, type: product.type, category: product.category, leadTime: product.leadTime,
      occasions: product.category === 'CARTEL' && ['GENERIC', 'PREDEFINED'].includes(product.type)
        ? product.categories.filter(item => item.category.isOccasion).map(({ category: { isOccasion, ...item } }) => item) : [],
      categories: product.categories.map(({ category: { isOccasion, ...item } }) => item), careers: product.careers.map(item => item.career),
      coverImage, defaultVariantId: variant.id, displayShape: shape ?? coverImage?.shape ?? null,
      basePrice: this.pricing.summarize([variant]),
    };
  }

  async featured(tx: Prisma.TransactionClient) {
    const items = await tx.featuredProduct.findMany({ where: { product: visible }, orderBy: { position: 'asc' }, take: 12, select: { product: { select: card } } });
    return items.flatMap(item => item.product.variants.map(variant => this.presentVariant(item.product, variant))).slice(0, 12);
  }
  async list(query: PublicCatalogQuery) {
    const product = this.filters(query);
    const shape = query.shape && (!query.category || query.category === 'CARTEL') ? query.shape : undefined;
    const type = query.category && query.category !== 'CARTEL' ? undefined : query.type;
    const where: Prisma.ProductVariantWhereInput = {
      active: true, product,
      ...(shape ? { attributes: { path: ['formato'], equals: shape.toLowerCase() } } : {}),
      ...(type === CatalogDisplayType.PREDEFINED_THREE_IMAGES ? { photoCount: 3 } : type === CatalogDisplayType.PREDEFINED ? { photoCount: { not: 3 } } : {}),
    };
    const orderBy: Prisma.ProductVariantOrderByWithRelationInput[] = query.sort === PublicCatalogSort.NEWEST
      ? [{ product: { createdAt: 'desc' } }, { productId: 'asc' }, { position: 'asc' }]
      : [{ product: { name: query.sort === PublicCatalogSort.NAME_ASC ? 'asc' : 'desc' } }, { productId: 'asc' }, { position: 'asc' }];
    const [items, total] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({ where, select: { ...variantSummary, product: { select: cardBase } }, orderBy, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.productVariant.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items: items.map(({ product, ...variant }) => this.presentVariant(product, variant)), total, page: query.page, limit: query.limit };
  }

  async get(slug: string) {
    const product = await this.prisma.$transaction(tx => tx.product.findFirst({ where: { ...visible, slug }, select: detail }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    if (!product) {
      if (slug === 'cartel-tres-imagenes' && await this.prisma.applicationMetadata.findUnique({ where: { key: 'catalog:three-images:v1' } })) {
        throw new GoneException('Las opciones de tres imágenes ahora están dentro de cartel-predeterminado. Abrí /productos/cartel-tres-imagenes para elegir.');
      }
      throw new NotFoundException('Producto no encontrado.');
    }
    return { ...this.present(product), description: product.description, measurements: product.measurements, materials: product.materials, includes: product.includes, images: product.images, variants: product.variants, fields: [{ ...PRODUCT_IDEA_FIELD }], components: product.components };
  }

  async taxonomy(kind: 'category' | 'career' | 'occasion', query: PublicTaxonomyQuery) {
    const scoped = kind === 'occasion' || query.category !== undefined || query.type !== undefined || query.occasion !== undefined || query.shape !== undefined;
    let product: Prisma.ProductWhereInput = visible;
    if (kind !== 'category' && scoped) {
      const category = query.category ?? 'CARTEL';
      const type = query.type ?? (kind === 'career' ? CatalogDisplayType.PREDEFINED : undefined);
      const predefined = type === CatalogDisplayType.PREDEFINED || type === CatalogDisplayType.PREDEFINED_THREE_IMAGES;
      if (category !== 'CARTEL' || (kind === 'career' && !predefined) || type === CatalogDisplayType.CUSTOM || type === CatalogDisplayType.COMBO) {
        return { items: [], total: 0, page: query.page, limit: query.limit };
      }
      product = { AND: [visible, { category: 'CARTEL' }, type ? this.typeFilter(type, query.shape) : { type: { in: ['GENERIC', 'PREDEFINED'] }, ...(query.shape ? { variants: { some: this.variantShape(query.shape) } } : {}) },
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
