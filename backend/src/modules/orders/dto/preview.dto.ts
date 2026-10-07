import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsInt, IsString, Length, Matches, Max, MaxLength, Min, ValidateBy, ValidateNested } from 'class-validator';
import { PersonalizationType, PricingMode, ProductKind, ProductType } from '@prisma/client';
import { CatalogDisplayType } from '../../../common/catalog-classification';

export enum DeliveryMethod { UNDECIDED = 'UNDECIDED', PICKUP = 'PICKUP', SHIPPING = 'SHIPPING' }

export class PreviewAnswerDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) fieldKey!: string;
  @ApiProperty({ oneOf: [{ type: 'string', maxLength: 2000 }, { type: 'number' }] })
  @ValidateBy({ name: 'answerValue', validator: { validate: value => (typeof value === 'string' && [...value].length <= 2000 && !/[\u0000\uD800-\uDFFF]/u.test(value)) || (typeof value === 'number' && Number.isFinite(value)), defaultMessage: () => 'value debe ser un texto de hasta 2000 caracteres o un número finito.' } })
  value!: string | number;
}

export class PreviewLineDto {
  @ApiProperty({ description: 'Identificador estable del renglón del carrito. Permite personalizaciones distintas del mismo producto.' })
  @Matches(/^[a-zA-Z0-9_-]{1,80}$/) lineId!: string;
  @ApiProperty() @IsString() @Length(1, 100) productId!: string;
  @ApiProperty() @IsString() @Length(1, 100) variantId!: string;
  @ApiProperty({ minimum: 1, maximum: 100 }) @IsInt() @Min(1) @Max(100) quantity!: number;
  @ApiPropertyOptional({ type: [PreviewAnswerDto] })
  @IsArray() @ArrayMaxSize(30) @ArrayUnique((item: PreviewAnswerDto | null) => item?.fieldKey)
  @ValidateNested({ each: true }) @Type(() => PreviewAnswerDto) answers: PreviewAnswerDto[] = [];
}

export class PreviewDto {
  @ApiProperty({ type: [PreviewLineDto], minItems: 1, maxItems: 30 })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ArrayUnique((item: PreviewLineDto | null) => item?.lineId)
  @ValidateNested({ each: true }) @Type(() => PreviewLineDto) items!: PreviewLineDto[];
  @ApiPropertyOptional({ enum: DeliveryMethod, default: DeliveryMethod.UNDECIDED })
  @IsEnum(DeliveryMethod) deliveryMethod = DeliveryMethod.UNDECIDED;
}

export class PreviewAnswerResultDto {
  @ApiProperty() fieldKey!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: PersonalizationType }) type!: PersonalizationType;
  @ApiProperty({ type: String, nullable: true }) componentKey!: string | null;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }] }) value!: string | number;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }] }) displayValue!: string | number;
}
export class PreviewOptionDto {
  @ApiProperty() fieldKey!: string;
  @ApiProperty() optionKey!: string;
  @ApiProperty() label!: string;
  @ApiProperty() additionalCents!: number;
}
export class PreviewComponentDto {
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() position!: number;
}
export class PreviewTaxonomyDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}
export class PreviewLineResultDto {
  @ApiProperty({ type: Object }) variantAttributes!: Record<string, any>;
  @ApiProperty() lineId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ProductType }) type!: ProductType;
  @ApiProperty({ enum: ProductKind, nullable: true }) category!: ProductKind | null;
  @ApiProperty({ enum: CatalogDisplayType }) displayType!: CatalogDisplayType;
  @ApiProperty({ type: [PreviewTaxonomyDto] }) occasions!: PreviewTaxonomyDto[];
  @ApiProperty({ type: [PreviewTaxonomyDto] }) careers!: PreviewTaxonomyDto[];
  @ApiProperty() variantId!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ enum: ['ARS'] }) currency!: 'ARS';
  @ApiProperty({ enum: PricingMode }) pricingMode!: PricingMode;
  @ApiProperty({ enum: ['PRICED', 'PENDING_QUOTE'] }) status!: 'PRICED' | 'PENDING_QUOTE';
  @ApiProperty({ type: Number, nullable: true }) baseUnitCents!: number | null;
  @ApiProperty() additionalUnitCents!: number;
  @ApiProperty({ type: Number, nullable: true }) unitPriceCents!: number | null;
  @ApiProperty({ type: Number, nullable: true }) subtotalCents!: number | null;
  @ApiProperty({ type: [PreviewOptionDto] }) selectedOptions!: PreviewOptionDto[];
  @ApiProperty({ type: [PreviewAnswerResultDto] }) answers!: PreviewAnswerResultDto[];
  @ApiProperty({ type: [PreviewComponentDto] }) components!: PreviewComponentDto[];
  @ApiProperty() photoCountPerUnit!: number;
  @ApiProperty() photoCountTotal!: number;
  @ApiProperty({ enum: ['NONE', 'EMAIL', 'WHATSAPP'] }) photoDelivery!: 'NONE' | 'EMAIL' | 'WHATSAPP';
}
export class PreviewShippingDto {
  @ApiProperty({ enum: DeliveryMethod }) method!: DeliveryMethod;
  @ApiProperty({ enum: ['NOT_REQUIRED', 'TO_CONFIRM'] }) status!: 'NOT_REQUIRED' | 'TO_CONFIRM';
  @ApiProperty({ type: Number, nullable: true }) amountCents!: number | null;
}
export class PreviewSummaryDto {
  @ApiProperty() knownSubtotalCents!: number;
  @ApiProperty() pendingQuoteLines!: number;
  @ApiProperty() pendingQuoteQuantity!: number;
  @ApiProperty() totalQuantity!: number;
  @ApiProperty({ type: PreviewShippingDto }) shipping!: PreviewShippingDto;
  @ApiProperty({ type: Number, nullable: true, description: 'Siempre null: el preview no confirma un pedido ni su total final.' }) finalTotalCents!: null;
  @ApiProperty({ enum: ['PENDING_CONFIRMATION'] }) status!: 'PENDING_CONFIRMATION';
}
export class PreviewResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ enum: ['ARS'] }) currency!: 'ARS';
  @ApiProperty({ type: [PreviewLineResultDto] }) items!: PreviewLineResultDto[];
  @ApiProperty({ type: PreviewSummaryDto }) summary!: PreviewSummaryDto;
}
