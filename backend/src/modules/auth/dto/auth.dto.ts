import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EmailDto {
  @ApiProperty({ example: 'admin@example.com' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty({ format: 'password', minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token del enlace de recuperación; un solo uso.' })
  @Matches(/^[a-f0-9]{64}$/)
  token!: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  password!: string;
}
