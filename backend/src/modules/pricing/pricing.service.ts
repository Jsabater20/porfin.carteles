import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, PricingMode } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { PriceLineDto } from './dto/price-line.dto';

export type PriceLineInput = Omit<PriceLineDto, 'selections'> & { selections?: PriceLineDto['selections'] };
export type BasePriceVariant = { pricingMode: PricingMode; priceCents: number | null };
export interface BasePriceSummary {
  currency: 'ARS';
  fromCents: number | null;
  toCents: number | null;
  hasQuoteVariants: boolean;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private cents(value: number | null): number {
    if (value === null || !Number.isSafeInteger(value) || value < 0) throw new ServiceUnavailableException('El catálogo contiene un importe inválido.');
    return value;
  }

  summarize(variants: BasePriceVariant[]): BasePriceSummary {
    const fixed = variants.filter(variant => variant.pricingMode === PricingMode.FIXED).map(variant => this.cents(variant.priceCents));
    return { currency: 'ARS', fromCents: fixed.length ? Math.min(...fixed) : null, toCents: fixed.length ? Math.max(...fixed) : null, hasQuoteVariants: variants.some(variant => variant.pricingMode === PricingMode.QUOTE) };
  }

  async calculate(input: PriceLineInput, transaction?: Prisma.TransactionClient) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('La selección de precio debe ser un objeto.');
    const dto = plainToInstance(PriceLineDto, input);
    if (dto.selections === undefined) dto.selections = [];
    if ((await validate(dto, { whitelist: true, forbidNonWhitelisted: true, validationError: { target: false, value: false } })).length) throw new BadRequestException('Revisá producto, variante, cantidad y selecciones. No se aceptan precios enviados por el cliente.');
    if (new Set(dto.selections.map(selection => selection.fieldKey)).size !== dto.selections.length) throw new BadRequestException('Elegí una sola opción por campo.');
    // El preview podrá reutilizar su propia transacción. Sin ella, todas las
    // lecturas de precios/opciones pertenecen al mismo snapshot de PostgreSQL.
    return transaction ? this.calculateInTransaction(dto, transaction) : this.prisma.$transaction(tx => this.calculateInTransaction(dto, tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async calculateInTransaction(dto: PriceLineDto, tx: Prisma.TransactionClient) {
    const product = await tx.product.findFirst({
      where: { id: dto.productId, status: 'PUBLISHED' },
      select: {
        id: true, name: true, type: true,
        variants: { where: { id: dto.variantId, active: true }, select: { id: true, name: true, pricingMode: true, priceCents: true } },
        fields: { select: { key: true, type: true, required: true, options: { select: { key: true, label: true, additionalCents: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Producto no disponible.');
    const variant = product.variants[0];
    if (!variant) throw new BadRequestException('La variante no está disponible para este producto.');
    const selectedOptions = dto.selections.map(selection => {
      const field = product.fields.find(item => item.key === selection.fieldKey);
      const option = field?.type === 'SELECT' ? field.options.find(item => item.key === selection.optionKey) : undefined;
      if (!option) throw new BadRequestException('Hay una opción que no pertenece a este producto o campo.');
      return { fieldKey: field!.key, optionKey: option.key, label: option.label, additionalCents: this.cents(option.additionalCents) };
    });
    if (product.fields.some(field => field.type === 'SELECT' && field.required && !selectedOptions.some(option => option.fieldKey === field.key))) throw new BadRequestException('Falta elegir una opción obligatoria.');
    const additionalUnitCents = selectedOptions.reduce((total, option) => this.cents(total + option.additionalCents), 0);
    const quote = variant.pricingMode === PricingMode.QUOTE;
    if (quote && variant.priceCents !== null) throw new ServiceUnavailableException('El catálogo contiene una modalidad de precio inválida.');
    const baseUnitCents = quote ? null : this.cents(variant.priceCents);
    const unitPriceCents = baseUnitCents === null ? null : this.cents(baseUnitCents + additionalUnitCents);
    const subtotalCents = unitPriceCents === null ? null : this.cents(unitPriceCents * dto.quantity);
    return {
      productId: product.id, productName: product.name, variantId: variant.id, variantName: variant.name,
      quantity: dto.quantity, currency: 'ARS' as const, pricingMode: variant.pricingMode,
      status: quote ? 'PENDING_QUOTE' as const : 'PRICED' as const,
      baseUnitCents, additionalUnitCents, unitPriceCents, subtotalCents, selectedOptions,
    };
  }
}
