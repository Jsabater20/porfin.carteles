import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentPageKey, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { adminTransaction } from '../../common/utils/admin-transaction';
import { PublicCatalogService } from '../catalog/public-catalog.service';
import { PatchContentDto } from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService, private readonly catalog: PublicCatalogService) {}

  async adminList() {
    const [pages, featured] = await this.prisma.$transaction([
      this.prisma.contentPage.findMany({ orderBy: { page: 'asc' } }),
      this.prisma.featuredProduct.findMany({ orderBy: { position: 'asc' } }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { availablePages: Object.values(ContentPageKey), pages, featuredProductIds: featured.map(item => item.productId) };
  }

  update(dto: PatchContentDto, sessionId: string) {
    const { page, featuredProductIds, ...patch } = dto;
    const changes = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    if (!Object.keys(changes).length && featuredProductIds === undefined) throw new BadRequestException('Indicá los campos a modificar.');
    if (featuredProductIds !== undefined && page !== ContentPageKey.home) throw new BadRequestException('Los destacados se editan en home.');
    return adminTransaction(this.prisma, sessionId, async tx => {
      const current = await tx.contentPage.findUnique({ where: { page } });
      const data = {
        title: dto.title ?? current?.title ?? '', subtitle: dto.subtitle ?? current?.subtitle ?? '', body: dto.body ?? current?.body ?? '',
        sections: (dto.sections ?? current?.sections ?? []) as Prisma.InputJsonValue,
        faqItems: (dto.faqItems ?? current?.faqItems ?? []) as Prisma.InputJsonValue,
        published: dto.published ?? current?.published ?? false,
      };
      if (data.published && !data.title) throw new BadRequestException('Para publicar necesitás un título.');
      if (data.published && page === ContentPageKey.faq && !(data.faqItems as unknown[]).length) throw new BadRequestException('Agregá al menos una pregunta antes de publicar FAQ.');
      if (featuredProductIds !== undefined) {
        const count = await tx.product.count({ where: { id: { in: featuredProductIds }, status: 'PUBLISHED', variants: { some: { active: true } } } });
        if (count !== featuredProductIds.length) throw new BadRequestException('Los destacados deben ser productos publicados con variantes activas.');
        await tx.featuredProduct.deleteMany();
        if (featuredProductIds.length) await tx.featuredProduct.createMany({ data: featuredProductIds.map((productId, position) => ({ productId, position })) });
      }
      const saved = await tx.contentPage.upsert({ where: { page }, create: { page, ...data }, update: data });
      const featured = page === ContentPageKey.home ? await tx.featuredProduct.findMany({ orderBy: { position: 'asc' } }) : [];
      return { ...saved, featuredProductIds: featured.map(item => item.productId) };
    });
  }

  async get(page: ContentPageKey) {
    return this.prisma.$transaction(async tx => {
      const content = await tx.contentPage.findFirst({ where: { page, published: true }, select: { page: true, title: true, subtitle: true, body: true, sections: true, faqItems: true } });
      if (!content) throw new NotFoundException('Página no publicada.');
      return { ...content, featuredProducts: page === ContentPageKey.home ? await this.catalog.featured(tx) : [] };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
