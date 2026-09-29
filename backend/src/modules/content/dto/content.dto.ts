import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsString, Length, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { ContentPageKey } from '@prisma/client';

const defined = (_object: unknown, value: unknown) => value !== undefined;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const safeText = /^[^\u0000\uD800-\uDFFF]*$/u;

export class ContentPageParams {
  @ApiProperty({ enum: ContentPageKey }) @IsEnum(ContentPageKey) page!: ContentPageKey;
}
export class ContentSectionDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) key!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 150) @Matches(safeText) heading!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 3000) @Matches(safeText) text!: string;
}
export class FaqItemDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) key!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 200) @Matches(safeText) question!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 2000) @Matches(safeText) answer!: string;
}
export class PatchContentDto extends ContentPageParams {
  @ApiPropertyOptional() @ValidateIf(defined) @Transform(trim) @IsString() @MaxLength(200) @Matches(safeText) title?: string;
  @ApiPropertyOptional() @ValidateIf(defined) @Transform(trim) @IsString() @MaxLength(500) @Matches(safeText) subtitle?: string;
  @ApiPropertyOptional({ description: 'Texto plano; el frontend debe renderizarlo como texto, sin interpretar HTML.' })
  @ValidateIf(defined) @Transform(trim) @IsString() @MaxLength(10000) @Matches(safeText) body?: string;
  @ApiPropertyOptional({ type: [ContentSectionDto] })
  @ValidateIf(defined) @IsArray() @ArrayMaxSize(20) @ArrayUnique((item: ContentSectionDto | null) => item?.key) @ValidateNested({ each: true }) @Type(() => ContentSectionDto) sections?: ContentSectionDto[];
  @ApiPropertyOptional({ type: [FaqItemDto] })
  @ValidateIf(defined) @IsArray() @ArrayMaxSize(30) @ArrayUnique((item: FaqItemDto | null) => item?.key) @ValidateNested({ each: true }) @Type(() => FaqItemDto) faqItems?: FaqItemDto[];
  @ApiPropertyOptional() @ValidateIf(defined) @IsBoolean() published?: boolean;
  @ApiPropertyOptional({ type: [String], description: 'Solo home: lista completa y ordenada de productos destacados.' })
  @ValidateIf(defined) @IsArray() @ArrayMaxSize(12) @ArrayUnique() @IsString({ each: true }) @Length(1, 100, { each: true }) featuredProductIds?: string[];
}
