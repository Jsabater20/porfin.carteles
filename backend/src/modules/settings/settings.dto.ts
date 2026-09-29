import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEmail, IsIn, IsString, Length, Matches, MaxLength, ValidateBy, ValidateIf } from 'class-validator';

const defined = (_object: unknown, value: unknown) => value !== undefined;
const nullable = (_object: unknown, value: unknown) => value !== undefined && value !== null;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const safeText = /^[^\u0000\uD800-\uDFFF]*$/u;
const httpsUrl = () => ValidateBy({ name: 'publicHttpsUrl', validator: {
  validate(value: unknown) {
    if (typeof value !== 'string' || value.length > 500) return false;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') && !/[\u0000\uD800-\uDFFF]/u.test(value); } catch { return false; }
  }, defaultMessage: () => 'La URL debe usar HTTPS, sin credenciales, y tener hasta 500 caracteres.',
} });

export class PatchSettingsDto {
  @ApiPropertyOptional() @ValidateIf(defined) @Transform(trim) @IsString() @Length(1, 120) @Matches(safeText) storeName?: string;
  @ApiPropertyOptional() @ValidateIf(defined) @Transform(trim) @IsString() @MaxLength(2000) @Matches(safeText) description?: string;
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Número internacional, solo dígitos, sin +. null deshabilita el enlace.' })
  @ValidateIf(nullable) @Matches(/^[1-9][0-9]{7,14}$/) whatsappNumber?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(nullable) @Transform(trim) @IsEmail() @MaxLength(254) contactEmail?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @ValidateIf(nullable) @Transform(trim) @httpsUrl() instagramUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @ValidateIf(nullable) @Transform(trim) @httpsUrl() facebookUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @ValidateIf(nullable) @Transform(trim) @httpsUrl() tiktokUrl?: string | null;
  @ApiPropertyOptional() @ValidateIf(defined) @Transform(trim) @IsString() @MaxLength(500) @Matches(safeText) pickupAddress?: string;
  @ApiPropertyOptional({ type: [String], enum: ['PICKUP', 'SHIPPING'], isArray: true })
  @ValidateIf(defined) @IsArray() @ArrayMaxSize(2) @ArrayUnique() @IsIn(['PICKUP', 'SHIPPING'], { each: true }) deliveryMethods?: string[];
  @ApiPropertyOptional() @ValidateIf(defined) @Transform(trim) @IsString() @MaxLength(2000) @Matches(safeText) deliveryNotes?: string;
  @ApiPropertyOptional() @ValidateIf(defined) @Transform(trim) @IsString() @MaxLength(1000) @Matches(safeText) leadTimeText?: string;
  @ApiPropertyOptional() @ValidateIf(defined) @Transform(trim) @IsString() @MaxLength(500) @Matches(safeText) businessHours?: string;
}
