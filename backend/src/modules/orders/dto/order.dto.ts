import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, QuoteStatus } from '@prisma/client';
import { IsEmail, IsUUID, ValidateIf, ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { DeliveryMethod } from './preview.dto';

const trimText = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().normalize('NFC') : value;
const optionalValue = (_object: unknown, value: unknown) => value !== undefined;

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4') previewId!: string;

  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @IsNotEmpty() @Length(1, 60) customerFirstName!: string;
  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @IsNotEmpty() @Length(1, 60) customerLastName!: string;
  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsEmail() @Length(3, 254) customerEmail!: string;
  @ApiProperty({ format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) customerBirthDate!: string;
  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @IsNotEmpty() @Matches(/^\+?[0-9()\-\s]{6,30}$/) customerPhone!: string;
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

export class OrderCalendarQueryDto {
  @ApiProperty({ format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) from!: string;
  @ApiProperty({ format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) to!: string;
}

export class UpdateOrderScheduleDto {
  @ApiProperty({ format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) scheduledDate!: string;
}

export class CreateManualOrderDto {
  @ApiProperty() @Transform(trimText) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(1, 120) customerName!: string;
  @ApiPropertyOptional() @ValidateIf(optionalValue) @Transform(trimText) @IsEmail() @Length(3, 254) customerEmail?: string;
  @ApiPropertyOptional() @ValidateIf(optionalValue) @Transform(trimText) @IsString() @Matches(/^\+?[0-9()\-\s]{6,30}$/) customerPhone?: string;
  @ApiProperty({ format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) scheduledDate!: string;
  @ApiProperty() @Transform(trimText) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(1, 500) description!: string;
  @ApiPropertyOptional({ enum: ['TO_CONFIRM', 'PICKUP', 'SHIPPING'], default: 'TO_CONFIRM' }) @IsOptional() @IsIn(['TO_CONFIRM', 'PICKUP', 'SHIPPING']) deliveryMethod: 'TO_CONFIRM' | 'PICKUP' | 'SHIPPING' = 'TO_CONFIRM';
  @ApiPropertyOptional({ enum: [OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED], default: OrderStatus.PENDING_CONFIRMATION }) @IsOptional() @IsIn([OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED]) status: 'PENDING_CONFIRMATION' | 'CONFIRMED' = OrderStatus.PENDING_CONFIRMATION;
  @ApiPropertyOptional() @ValidateIf(optionalValue) @Transform(trimText) @IsString() @Matches(/^[^\u0000\uD800-\uDFFF]*$/u) @Length(0, 1000) notes?: string;
}

export class CompleteGoogleCalendarDto {
  @ApiProperty() @IsString() @Length(10, 4096) code!: string;
  @ApiProperty() @IsString() @Length(20, 4096) state!: string;
}

export class SyncGoogleCalendarDto {
  @ApiProperty({ type: [String], maxItems: 100 })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique()
  @IsString({ each: true }) @Matches(/^c[a-z0-9]{24}$/, { each: true })
  orderIds!: string[];
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
