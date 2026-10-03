import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PersonalizationType, PricingMode, ProductKind, ProductType } from '@prisma/client';
import { CatalogDisplayType } from '../../../common/catalog-classification';

const optional = (_object: unknown, value: unknown) => value !== undefined;
export enum PublicCatalogSort { NEWEST = 'newest', NAME_ASC = 'name-asc', NAME_DESC = 'name-desc' }

export class PublicPageQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100000 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 50 })
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 24;
}

export class PublicCatalogQuery extends PublicPageQuery {
  @ApiPropertyOptional({ enum: ProductKind, description: 'Clase de producto: CARTEL, PROP o COMBO.' })
  @ValidateIf(optional) @IsEnum(ProductKind) category?: ProductKind;
  @ApiPropertyOptional({ description: 'ID de la ocasión. Solo corresponde a carteles genéricos o predeterminados.' })
  @ValidateIf(optional) @IsString() @Length(1, 100) occasion?: string;
  @ApiPropertyOptional({ description: 'ID de la carrera. Solo corresponde a carteles predeterminados.' })
  @ValidateIf(optional) @IsString() @Length(1, 100) career?: string;
  @ApiPropertyOptional()
  @ValidateIf(optional) @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MaxLength(120) q?: string;
  @ApiPropertyOptional({ enum: CatalogDisplayType }) @ValidateIf(optional) @IsEnum(CatalogDisplayType) type?: CatalogDisplayType;
  @ApiPropertyOptional({ deprecated: true, description: 'Filtro anterior por ID de categoría; se conserva durante la transición.' }) @ValidateIf(optional) @IsString() @Length(1, 100) categoryId?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Alias anterior de career; se conserva durante la transición.' }) @ValidateIf(optional) @IsString() @Length(1, 100) careerId?: string;
  @ApiPropertyOptional({ enum: PublicCatalogSort, default: PublicCatalogSort.NEWEST }) @IsEnum(PublicCatalogSort) sort = PublicCatalogSort.NEWEST;
}
export class PublicTaxonomyQuery extends PublicPageQuery {
  @ApiPropertyOptional({ enum: ProductKind }) @ValidateIf(optional) @IsEnum(ProductKind) category?: ProductKind;
  @ApiPropertyOptional({ enum: CatalogDisplayType }) @ValidateIf(optional) @IsEnum(CatalogDisplayType) type?: CatalogDisplayType;
  @ApiPropertyOptional({ description: 'ID de la ocasión seleccionada.' })
  @ValidateIf(optional) @IsString() @Length(1, 100) occasion?: string;
}

export class PublicProductParams {
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(150) slug!: string;
}

export class PublicTaxonomyDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}
export class PublicImageDto {
  @ApiProperty() id!: string;
  @ApiProperty() url!: string;
  @ApiProperty() altText!: string;
  @ApiProperty() position!: number;
  @ApiProperty() cover!: boolean;
  @ApiProperty() width!: number;
  @ApiProperty() height!: number;
}
export class BasePriceDto {
  @ApiProperty({ enum: ['ARS'] }) currency!: 'ARS';
  @ApiProperty({ type: Number, nullable: true, description: 'Precio base mínimo entre variantes activas FIXED, sin adicionales.' }) fromCents!: number | null;
  @ApiProperty({ type: Number, nullable: true }) toCents!: number | null;
  @ApiProperty() hasQuoteVariants!: boolean;
}
export class PublicVariantDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: PricingMode }) pricingMode!: PricingMode;
  @ApiProperty({ type: Number, nullable: true }) priceCents!: number | null;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } }) attributes!: Record<string, string>;
  @ApiProperty() photoCount!: number;
}
export class PublicOptionDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty() additionalCents!: number;
  @ApiProperty() position!: number;
}
export class PublicFieldDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: PersonalizationType }) type!: PersonalizationType;
  @ApiProperty() required!: boolean;
  @ApiProperty() position!: number;
  @ApiProperty({ type: String, nullable: true }) componentKey!: string | null;
  @ApiProperty({ type: Number, nullable: true }) minLength!: number | null;
  @ApiProperty({ type: Number, nullable: true }) maxLength!: number | null;
  @ApiProperty({ type: Number, nullable: true }) minValue!: number | null;
  @ApiProperty({ type: Number, nullable: true }) maxValue!: number | null;
  @ApiProperty({ type: [PublicOptionDto] }) options!: PublicOptionDto[];
}
export class PublicComponentDto {
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() position!: number;
}
export class PublicProductCardDto {
  @ApiProperty({ enum: ProductKind, nullable: true, description: 'Puede ser null durante la migración de productos antiguos.' }) category!: ProductKind | null;
  @ApiProperty({ type: [PublicTaxonomyDto] }) occasions!: PublicTaxonomyDto[];
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ProductType }) type!: ProductType;
  @ApiProperty() leadTime!: string;
  @ApiProperty({ type: [PublicTaxonomyDto] }) categories!: PublicTaxonomyDto[];
  @ApiProperty({ type: [PublicTaxonomyDto] }) careers!: PublicTaxonomyDto[];
  @ApiProperty({ type: PublicImageDto, nullable: true }) coverImage!: PublicImageDto | null;
  @ApiProperty({ type: BasePriceDto }) basePrice!: BasePriceDto;
}
export class PublicProductDetailDto extends PublicProductCardDto {
  @ApiProperty() description!: string;
  @ApiProperty() measurements!: string;
  @ApiProperty() materials!: string;
  @ApiProperty() includes!: string;
  @ApiProperty({ type: [PublicImageDto] }) images!: PublicImageDto[];
  @ApiProperty({ type: [PublicVariantDto] }) variants!: PublicVariantDto[];
  @ApiProperty({ type: [PublicFieldDto] }) fields!: PublicFieldDto[];
  @ApiProperty({ type: [PublicComponentDto] }) components!: PublicComponentDto[];
}
export class PublicProductPageDto {
  @ApiProperty({ type: [PublicProductCardDto] }) items!: PublicProductCardDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
export class PublicTaxonomyPageDto {
  @ApiProperty({ type: [PublicTaxonomyDto] }) items!: PublicTaxonomyDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
