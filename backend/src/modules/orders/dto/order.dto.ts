import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, QuoteStatus } from '@prisma/client';
import { IsEmail, IsUUID, ValidateIf, ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { DeliveryMethod } from './preview.dto';

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4') previewId!: string;

  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @IsNotEmpty() @Length(1, 60) customerFirstName!: string;
  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @IsNotEmpty() @Length(1, 60) customerLastName!: string;
  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsEmail() @Length(3, 254) customerEmail!: string;
  @ApiPropertyOptional({ format: 'date' }) @ValidateIf((_o, value) => value !== undefined) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) customerBirthDate?: string;
  @ApiPropertyOptional() @ValidateIf((_o, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @IsNotEmpty() @Matches(/^\+?[0-9()\-\s]{6,30}$/) customerPhone?: string;
  @ApiProperty({ format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) requestedDate!: string;
  @ApiProperty({ enum: DeliveryMethod }) @IsEnum(DeliveryMethod) deliveryMethod!: DeliveryMethod;
  @ApiPropertyOptional() @ValidateIf((_o, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(0, 400) deliveryAddress?: string;
  @ApiPropertyOptional() @ValidateIf((_o, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(0, 1000) notes?: string;
}

export class OrderItemDto {
  @ApiProperty() productId!: string | null;
  @ApiProperty() productName!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ type: Number, nullable: true }) unitPriceCents!: number | null;
  @ApiProperty({ type: Number, nullable: true }) subtotalCents!: number | null;
  @ApiProperty() snapshot!: Record<string, unknown>;
}

export class OrderResponseDto {
  @ApiProperty({ format: 'cuid' }) id!: string;
  @ApiProperty() reference!: string;
  @ApiProperty() status!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty({ type: String, nullable: true }) customerFirstName!: string | null;
  @ApiProperty({ type: String, nullable: true }) customerLastName!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'email' }) customerEmail!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) customerBirthDate!: string | null;
  @ApiProperty() customerPhone!: string;
  @ApiProperty({ format: 'date-time' }) requestedDate!: string;
  @ApiProperty({ enum: DeliveryMethod }) deliveryMethod!: DeliveryMethod;
  @ApiProperty({ type: String, nullable: true }) deliveryAddress!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ type: [OrderItemDto] }) items!: OrderItemDto[];
  @ApiProperty() knownSubtotalCents!: number;
  @ApiProperty() pendingQuoteCount!: number;
  @ApiProperty({ type: Number, nullable: true }) shippingCents!: number | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ format: 'uuid' }) idempotencyKey!: string;
  @ApiProperty({ type: Object }) whatsapp!: { url: string | null; message: string };
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus }) @IsEnum(OrderStatus) status!: OrderStatus;
  @ApiPropertyOptional() @ValidateIf((_o, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(0, 500) reason?: string;
}

export class CreateOrderQuoteItemDto {
  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(1, 160) productName!: string;
  @ApiPropertyOptional() @ValidateIf((_o, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(0, 500) description?: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10000) quantity!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1000000000) unitPriceCents!: number;
}

export class CreateOrderQuoteDto {
  @ApiProperty({ type: [CreateOrderQuoteItemDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CreateOrderQuoteItemDto) items!: CreateOrderQuoteItemDto[];
  @ApiPropertyOptional() @ValidateIf((_o, value) => value !== undefined) @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(0, 1000) notes?: string;
}

export class UpdateQuoteStatusDto {
 @ApiProperty({ enum: QuoteStatus }) @IsEnum(QuoteStatus) status!: QuoteStatus;
}
