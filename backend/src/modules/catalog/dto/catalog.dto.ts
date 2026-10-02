import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PersonalizationType, PricingMode, ProductStatus, ProductKind, ProductType } from '@prisma/client';
import { AdminListQuery } from '../../admins/dto/admin.dto';

const optional = (_object: unknown, value: unknown) => value !== undefined;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class TaxonomyDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @ApiProperty({ example: 'recibidas' }) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug!: string;
}
export class PatchTaxonomyDto extends PartialType(TaxonomyDto, { skipNullProperties: false }) {}

export class VariantDto {
  @ApiProperty({ example: 'con-fotos' }) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) key!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @ApiProperty({ enum: PricingMode }) @IsEnum(PricingMode) pricingMode!: PricingMode;
  @ApiProperty({ nullable: true, description: 'Centavos ARS. FIXED: entero no negativo. QUOTE: null.' })
  @ValidateIf((_object, value) => value !== null) @IsInt() @Min(0) @Max(1000000000) priceCents!: number | null;
  @ApiPropertyOptional({ example: { size: '60x40' } }) @IsObject() attributes: Record<string, string> = {};
  @ApiPropertyOptional({ default: 0 }) @IsInt() @Min(0) @Max(10) photoCount = 0;
  @ApiPropertyOptional({ default: true }) @IsBoolean() active = true;
}

export class OptionDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) key!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) label!: string;
  @ApiPropertyOptional({ default: 0 }) @IsInt() @Min(0) @Max(1000000000) additionalCents = 0;
}

export class FieldDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) key!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) label!: string;
  @ApiProperty({ enum: PersonalizationType }) @IsEnum(PersonalizationType) type!: PersonalizationType;
  @ApiPropertyOptional({ default: false }) @IsBoolean() required = false;
  @ApiPropertyOptional() @ValidateIf(optional) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) componentKey?: string;
  @ApiPropertyOptional() @ValidateIf(optional) @IsInt() @Min(0) @Max(2000) minLength?: number;
  @ApiPropertyOptional() @ValidateIf(optional) @IsInt() @Min(1) @Max(2000) maxLength?: number;
  @ApiPropertyOptional() @ValidateIf(optional) @IsNumber({ allowNaN: false, allowInfinity: false }) minValue?: number;
  @ApiPropertyOptional() @ValidateIf(optional) @IsNumber({ allowNaN: false, allowInfinity: false }) maxValue?: number;
  @ApiPropertyOptional({ type: [OptionDto] }) @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => OptionDto) options: OptionDto[] = [];
}

export class ComponentDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) key!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(100) quantity!: number;
  @ApiPropertyOptional() @ValidateIf(optional) @IsString() @Length(1, 100) referenceProductId?: string;
}

export class ProductDto {
  @ApiPropertyOptional({ enum: ProductKind, description: 'Omitir solo para clientes anteriores.' })
  @ValidateIf(optional) @IsEnum(ProductKind) category?: ProductKind;
  @ApiPropertyOptional({ type: [String], description: 'Ocasiones. Conserva las familias antiguas internamente.' })
  @ValidateIf(optional) @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) occasionIds?: string[];
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(150) slug!: string;
  @ApiProperty() @IsString() @Length(1, 5000) description!: string;
  @ApiProperty({ enum: ProductType }) @IsEnum(ProductType) type!: ProductType;
  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.HIDDEN }) @IsEnum(ProductStatus) status: ProductStatus = ProductStatus.HIDDEN;
  @ApiPropertyOptional() @IsString() @MaxLength(500) measurements = '';
  @ApiPropertyOptional() @IsString() @MaxLength(500) materials = '';
  @ApiPropertyOptional() @IsString() @MaxLength(2000) includes = '';
  @ApiPropertyOptional() @IsString() @MaxLength(500) leadTime = '';
  @ApiPropertyOptional({ type: [String], description: 'Relaciones anteriores; usar occasionIds en clientes nuevos.' }) @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) categoryIds: string[] = [];
  @ApiPropertyOptional({ type: [String] }) @IsArray() @ArrayMaxSize(30) @ArrayUnique() @IsString({ each: true }) careerIds: string[] = [];
  @ApiProperty({ type: [VariantDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => VariantDto) variants!: VariantDto[];
  @ApiPropertyOptional({ type: [FieldDto] }) @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => FieldDto) fields: FieldDto[] = [];
  @ApiPropertyOptional({ type: [ComponentDto] }) @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ComponentDto) components: ComponentDto[] = [];
}

// PartialType conserva inicializadores; se eliminan en el constructor para que PATCH
// solo cambie propiedades enviadas y no oculte ni vacíe un producto por accidente.
export class PatchProductDto extends PartialType(ProductDto, { skipNullProperties: false }) {
  constructor() { super(); for (const key of Object.keys(this)) delete (this as Record<string, unknown>)[key]; }
}

export class CatalogQuery extends AdminListQuery {
  @ApiPropertyOptional({ enum: ProductKind }) @ValidateIf(optional) @IsEnum(ProductKind) category?: ProductKind;
  @ApiPropertyOptional() @ValidateIf(optional) @IsString() @MaxLength(120) q?: string;
  @ApiPropertyOptional({ enum: ProductType }) @ValidateIf(optional) @IsEnum(ProductType) type?: ProductType;
  @ApiPropertyOptional({ enum: ProductStatus }) @ValidateIf(optional) @IsEnum(ProductStatus) status?: ProductStatus;
  @ApiPropertyOptional() @ValidateIf(optional) @IsString() @MaxLength(100) categoryId?: string;
  @ApiPropertyOptional() @ValidateIf(optional) @IsString() @MaxLength(100) careerId?: string;
}
