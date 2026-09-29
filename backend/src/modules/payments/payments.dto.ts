import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, ValidateIf, Matches, IsString, Length, Max, Min } from 'class-validator';
import { PaymentMovementType } from '@prisma/client';

export class CreatePaymentMovementDto {
  @ApiProperty({ enum: PaymentMovementType }) @IsEnum(PaymentMovementType) type!: PaymentMovementType;
  @ApiProperty({ format: 'cuid' }) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(1, 100) orderId!: string;
  @ApiPropertyOptional({ format: 'cuid' }) @ValidateIf((_o, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(1, 100) quoteId?: string;
  @ApiProperty() @IsInt() @Min(1) @Max(1000000000) amountCents!: number;
  @ApiProperty({ example: 'TRANSFER' }) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(1, 50) method!: string;
  @ApiPropertyOptional() @ValidateIf((_o, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(0, 160) reference?: string;
}
