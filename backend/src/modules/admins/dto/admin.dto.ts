import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { AdminRole } from '@prisma/client';
import { EmailDto } from '../../auth/dto/auth.dto';

export class CreateAdminDto extends EmailDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  password!: string;

  @ApiPropertyOptional({ enum: AdminRole, default: AdminRole.ADMIN })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(AdminRole)
  role?: AdminRole;
}

export class UpdateAdminDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ format: 'email' })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ format: 'password', minLength: 12, maxLength: 128 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(12, 128)
  password?: string;

  @ApiPropertyOptional({ enum: AdminRole })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}

export class AdminListQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
