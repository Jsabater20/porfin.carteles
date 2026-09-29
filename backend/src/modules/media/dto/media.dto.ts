import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { MEDIA_MAX_IMAGES } from '../media.constants';

export class UploadSignatureDto {
  @ApiProperty() @IsString() @Length(1, 100) productId!: string;
}

export class CompleteUploadDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() uploadId!: string;
  @ApiProperty({ default: '', maxLength: 240 }) @IsString() @MaxLength(240) altText = '';
}

export class ImageTextDto {
  @ApiProperty({ maxLength: 240 }) @IsString() @MaxLength(240) altText!: string;
}

export class ImageOrderDto {
  @ApiProperty({ type: [String], description: 'Todos los IDs de la galería, en orden. El primero será la portada.' })
  @IsArray() @ArrayUnique() @ArrayMaxSize(MEDIA_MAX_IMAGES) @IsString({ each: true }) @Length(1, 100, { each: true })
  imageIds!: string[];
}
