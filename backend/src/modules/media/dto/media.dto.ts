import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogShape } from '@prisma/client';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsString, IsUUID, Length, MaxLength, ValidateIf } from 'class-validator';
import { MEDIA_MAX_IMAGES } from '../media.constants';

export class UploadSignatureDto {
  @ApiProperty() @IsString() @Length(1, 100) productId!: string;
}

export class CompleteUploadDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() uploadId!: string;
  @ApiProperty({ default: '', maxLength: 240 }) @IsString() @MaxLength(240) altText = '';
  @ApiPropertyOptional({ enum: CatalogShape, nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null) @IsEnum(CatalogShape) shape?: CatalogShape | null;
}

export class ImageMetadataDto {
  @ApiProperty({ maxLength: 240 }) @IsString() @MaxLength(240) altText!: string;
  @ApiPropertyOptional({ enum: CatalogShape, nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null) @IsEnum(CatalogShape) shape?: CatalogShape | null;
}

export class ImageOrderDto {
  @ApiProperty({ type: [String], description: 'Todos los IDs de la galería, en orden. El primero será la portada.' })
  @IsArray() @ArrayUnique() @ArrayMaxSize(MEDIA_MAX_IMAGES) @IsString({ each: true }) @Length(1, 100, { each: true })
  imageIds!: string[];
}
