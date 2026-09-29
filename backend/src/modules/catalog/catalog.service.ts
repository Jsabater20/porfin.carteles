import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductType, ProductStatus, PricingMode, PersonalizationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ADMIN_LOCK } from '../auth/auth.types';
import { AdminListQuery } from '../admins/dto/admin.dto';
import { CatalogQuery, PatchProductDto, PatchTaxonomyDto, ProductDto, TaxonomyDto } from './dto/catalog.dto';

const include = {
  categories: { include: { category: true } }, careers: { include: { career: true } },
  variants: { orderBy: { position: 'asc' } },
  fields: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
  components: { orderBy: { position: 'asc' } },
  images: { orderBy: { position: 'asc' } },
} satisfies Prisma.ProductInclude;
type FullProduct = Prisma.ProductGetPayload<{ include: typeof include }>;
type Taxonomy = 'category' | 'career';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private async write<T>(sessionId: string, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(async tx => {
        // El mismo lock protege cambios de permisos y operaciones administrativas.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
        const session = await tx.adminSession.findFirst({ where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() }, administrator: { active: true } } });
        if (!session) throw new ForbiddenException('La sesión administrativa ya no está activa.');
        return action(tx);
      }, { timeout: 15000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException('El nombre, slug o clave ya está en uso.');
        if (error.code === 'P2003') throw new ConflictException('El elemento está en uso y no se puede eliminar.');
        if (error.code === 'P2025') throw new NotFoundException('Elemento no encontrado.');
      }
      throw error;
    }
  }

  async listTaxonomy(kind: Taxonomy, query: AdminListQuery) {
    const args = { skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { name: 'asc' as const } };
    const [items, total] = kind === 'category'
      ? await this.prisma.$transaction([this.prisma.category.findMany(args), this.prisma.category.count()])
      : await this.prisma.$transaction([this.prisma.career.findMany(args), this.prisma.career.count()]);
    return { items, total, page: query.page, limit: query.limit };
  }

  createTaxonomy(kind: Taxonomy, dto: TaxonomyDto, sessionId: string) {
    return this.write(sessionId, tx => kind === 'category' ? tx.category.create({ data: dto }) : tx.career.create({ data: dto }));
  }

  updateTaxonomy(kind: Taxonomy, id: string, dto: PatchTaxonomyDto, sessionId: string) {
    if (!Object.values(dto).some(value => value !== undefined)) throw new BadRequestException('Indicá los campos a modificar.');
    return this.write(sessionId, tx => kind === 'category' ? tx.category.update({ where: { id }, data: dto }) : tx.career.update({ where: { id }, data: dto }));
  }

  deleteTaxonomy(kind: Taxonomy, id: string, sessionId: string) {
    return this.write(sessionId, tx => kind === 'category' ? tx.category.delete({ where: { id } }) : tx.career.delete({ where: { id } }));
  }

  async list(query: CatalogQuery) {
    const where: Prisma.ProductWhereInput = {
      type: query.type, status: query.status,
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.careerId ? { careers: { some: { careerId: query.careerId } } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, include, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include });
    if (!product) throw new NotFoundException('Producto no encontrado.');
    return product;
  }

  private input(product: FullProduct): ProductDto {
    return {
      name: product.name, slug: product.slug, description: product.description, type: product.type, status: product.status,
      measurements: product.measurements, materials: product.materials, includes: product.includes, leadTime: product.leadTime,
      categoryIds: product.categories.map(item => item.categoryId), careerIds: product.careers.map(item => item.careerId),
      variants: product.variants.map(item => ({ key: item.key, name: item.name, pricingMode: item.pricingMode, priceCents: item.priceCents, attributes: item.attributes as Record<string, string>, photoCount: item.photoCount, active: item.active })),
      fields: product.fields.map(item => ({ key: item.key, label: item.label, type: item.type, required: item.required, componentKey: item.componentKey ?? undefined, minLength: item.minLength ?? undefined, maxLength: item.maxLength ?? undefined, minValue: item.minValue ?? undefined, maxValue: item.maxValue ?? undefined, options: item.options.map(option => ({ key: option.key, label: option.label, additionalCents: option.additionalCents })) })),
      components: product.components.map(item => ({ key: item.key, name: item.name, quantity: item.quantity, referenceProductId: item.referenceProductId ?? undefined })),
    };
  }

  private unique(items: { key: string }[], label: string) {
    if (new Set(items.map(item => item.key)).size !== items.length) throw new BadRequestException(`No repitas claves en ${label}.`);
  }

  private async validate(tx: Prisma.TransactionClient, dto: ProductDto, id?: string) {
    this.unique(dto.variants, 'variantes'); this.unique(dto.fields, 'campos'); this.unique(dto.components, 'componentes');
    if (!dto.variants.length) throw new BadRequestException('Todo producto necesita al menos una variante.');
    for (const variant of dto.variants) {
      if ((variant.pricingMode === PricingMode.FIXED && variant.priceCents === null) || (variant.pricingMode === PricingMode.QUOTE && variant.priceCents !== null)) throw new BadRequestException('FIXED requiere precio; QUOTE requiere priceCents=null.');
      if (Object.entries(variant.attributes).length > 20 || Object.entries(variant.attributes).some(([key, value]) => !/^[a-zA-Z0-9_-]{1,80}$/.test(key) || typeof value !== 'string' || value.length > 200)) throw new BadRequestException('Los atributos deben ser hasta 20 textos de 200 caracteres.');
    }
    if (dto.status === ProductStatus.PUBLISHED && !dto.variants.some(variant => variant.active)) throw new BadRequestException('Para publicar necesitás al menos una variante activa.');
    if (dto.type !== ProductType.COMBO && dto.components.length) throw new BadRequestException('Solo los combos pueden tener componentes.');
    if (dto.type === ProductType.COMBO && !dto.components.length) throw new BadRequestException('Un combo necesita componentes.');
    if (dto.type === ProductType.COMBO && id && await tx.comboComponent.count({ where: { referenceProductId: id } })) throw new ConflictException('Este producto ya integra otro combo y no puede convertirse en combo.');
    const references = [...new Set(dto.components.flatMap(component => component.referenceProductId ? [component.referenceProductId] : []))];
    if (id && references.includes(id)) throw new BadRequestException('Un combo no puede incluirse a sí mismo.');
    const referenced = await tx.product.findMany({ where: { id: { in: references } }, select: { id: true, type: true } });
    if (referenced.length !== references.length || referenced.some(product => product.type === ProductType.COMBO)) throw new BadRequestException('Los componentes deben referenciar productos existentes que no sean combos.');
    if (await tx.category.count({ where: { id: { in: dto.categoryIds } } }) !== dto.categoryIds.length) throw new BadRequestException('Hay categorías inexistentes.');
    if (await tx.career.count({ where: { id: { in: dto.careerIds } } }) !== dto.careerIds.length) throw new BadRequestException('Hay carreras inexistentes.');
    for (const field of dto.fields) {
      this.unique(field.options, `opciones de ${field.label}`);
      if (field.componentKey && !dto.components.some(component => component.key === field.componentKey)) throw new BadRequestException('El componente indicado en un campo no existe.');
      if (field.type === PersonalizationType.SELECT) {
        if (!field.options.length) throw new BadRequestException('Los campos de selección necesitan opciones.');
      } else if (field.options.length) throw new BadRequestException('Solo los campos SELECT pueden tener opciones.');
      const text = field.type === PersonalizationType.SHORT_TEXT || field.type === PersonalizationType.LONG_TEXT;
      if (!text && (field.minLength !== undefined || field.maxLength !== undefined)) throw new BadRequestException('Los límites de longitud corresponden a campos de texto.');
      if (text && ((field.minLength ?? 0) > (field.maxLength ?? (field.type === 'SHORT_TEXT' ? 240 : 2000)) || (field.type === 'SHORT_TEXT' && (field.maxLength ?? 0) > 240))) throw new BadRequestException('Revisá los límites del campo de texto.');
      if (field.type !== PersonalizationType.NUMBER && (field.minValue !== undefined || field.maxValue !== undefined)) throw new BadRequestException('Los límites numéricos corresponden a campos NUMBER.');
      if (field.minValue !== undefined && field.maxValue !== undefined && field.minValue > field.maxValue) throw new BadRequestException('El mínimo no puede superar al máximo.');
    }
  }

  private async relations(tx: Prisma.TransactionClient, id: string, dto: ProductDto) {
    await tx.productCategory.deleteMany({ where: { productId: id } });
    await tx.productCategory.createMany({ data: dto.categoryIds.map(categoryId => ({ productId: id, categoryId })) });
    await tx.productCareer.deleteMany({ where: { productId: id } });
    if (dto.careerIds.length) await tx.productCareer.createMany({ data: dto.careerIds.map(careerId => ({ productId: id, careerId })) });
    await tx.productVariant.deleteMany({ where: { productId: id, key: { notIn: dto.variants.map(item => item.key) } } });
    for (const [position, variant] of dto.variants.entries()) {
      const data = { ...variant, position, attributes: variant.attributes as Prisma.InputJsonObject };
      await tx.productVariant.upsert({ where: { productId_key: { productId: id, key: variant.key } }, create: { ...data, productId: id }, update: data });
    }
    await tx.personalizationField.deleteMany({ where: { productId: id, key: { notIn: dto.fields.map(item => item.key) } } });
    for (const [position, field] of dto.fields.entries()) {
      const { options, ...properties } = field;
      const data = { ...properties, position, componentKey: field.componentKey ?? null, minLength: field.minLength ?? null, maxLength: field.maxLength ?? null, minValue: field.minValue ?? null, maxValue: field.maxValue ?? null };
      const saved = await tx.personalizationField.upsert({ where: { productId_key: { productId: id, key: field.key } }, create: { ...data, productId: id }, update: data });
      await tx.personalizationOption.deleteMany({ where: { fieldId: saved.id, key: { notIn: options.map(item => item.key) } } });
      for (const [optionPosition, option] of options.entries()) {
        const optionData = { ...option, position: optionPosition };
        await tx.personalizationOption.upsert({ where: { fieldId_key: { fieldId: saved.id, key: option.key } }, create: { ...optionData, fieldId: saved.id }, update: optionData });
      }
    }
    await tx.comboComponent.deleteMany({ where: { comboId: id, key: { notIn: dto.components.map(item => item.key) } } });
    for (const [position, component] of dto.components.entries()) {
      const data = { ...component, position, referenceProductId: component.referenceProductId ?? null };
      await tx.comboComponent.upsert({ where: { comboId_key: { comboId: id, key: component.key } }, create: { ...data, comboId: id }, update: data });
    }
  }

  create(dto: ProductDto, sessionId: string) {
    return this.write(sessionId, async tx => {
      await this.validate(tx, dto);
      const { categoryIds, careerIds, variants, fields, components, ...data } = dto;
      const product = await tx.product.create({ data });
      await this.relations(tx, product.id, dto);
      return tx.product.findUniqueOrThrow({ where: { id: product.id }, include });
    });
  }

  update(id: string, patch: PatchProductDto, sessionId: string) {
    const changes = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    if (!Object.keys(changes).length) throw new BadRequestException('Indicá los campos a modificar.');
    return this.write(sessionId, async tx => {
      const current = await tx.product.findUnique({ where: { id }, include });
      if (!current) throw new NotFoundException('Producto no encontrado.');
      const dto = { ...this.input(current), ...changes } as ProductDto;
      await this.validate(tx, dto, id);
      const { categoryIds, careerIds, variants, fields, components, ...data } = dto;
      await tx.product.update({ where: { id }, data });
      await this.relations(tx, id, dto);
      return tx.product.findUniqueOrThrow({ where: { id }, include });
    });
  }

  delete(id: string, sessionId: string) {
    return this.write(sessionId, async tx => {
      const current = await tx.product.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Producto no encontrado.');
      if (current.status !== ProductStatus.HIDDEN) throw new ConflictException('Ocultá el producto antes de eliminarlo.');
      return tx.product.delete({ where: { id } });
    });
  }
}
