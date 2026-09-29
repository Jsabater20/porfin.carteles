import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class PriceSelectionDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) fieldKey!: string;
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) optionKey!: string;
}

// Contrato interno reutilizable por el preview de la etapa 6. No acepta importes.
export class PriceLineDto {
  @ApiProperty() @IsString() @Length(1, 100) productId!: string;
  @ApiProperty() @IsString() @Length(1, 100) variantId!: string;
  @ApiProperty({ minimum: 1, maximum: 100 }) @IsInt() @Min(1) @Max(100) quantity!: number;
  @ApiPropertyOptional({ type: [PriceSelectionDto] })
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => PriceSelectionDto)
  selections: PriceSelectionDto[] = [];
}
