import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { csrfToken } from '../../common/utils/credentials';
import { AuthService } from './auth.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { EmailDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';
import { AuthenticatedRequest } from './auth.types';
import { cookieName, cookieOptions, sessionCookie } from './session-cookie';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService, private readonly limits: AuthRateLimitService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesión administrativa' })
  @ApiHeader({ name: 'X-Requested-With', required: true, schema: { default: 'porfin-admin' } })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas o cuenta inactiva.' })
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.limits.check('login', request.ip ?? 'unknown', dto.email);
    const result = await this.auth.login(dto, sessionCookie(request, this.config));
    response.cookie(cookieName(this.config), result.token, { ...cookieOptions(this.config), expires: result.expiresAt });
    return { admin: result.admin, expiresAt: result.expiresAt, csrfToken: result.csrfToken };
  }

  @Get('me')
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Consultar sesión y obtener token CSRF' })
  me(@Req() request: AuthenticatedRequest) {
    return { admin: request.admin, expiresAt: request.adminSession.expiresAt, csrfToken: csrfToken(request.adminSession.token) };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiCookieAuth('session')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({ name: 'X-Requested-With', required: true, schema: { default: 'porfin-admin' } })
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.adminSession.id);
    response.clearCookie(cookieName(this.config), cookieOptions(this.config));
    return { message: 'Sesión cerrada.' };
  }

  @Public()
  @Post('recovery')
  @HttpCode(202)
  @ApiHeader({ name: 'X-Requested-With', required: true, schema: { default: 'porfin-admin' } })
  async recovery(@Body() dto: EmailDto, @Req() request: Request) {
    await this.limits.check('recovery', request.ip ?? 'unknown', dto.email);
    return this.auth.recover(dto.email);
  }

  @Public()
  @Post('reset')
  @HttpCode(200)
  @ApiHeader({ name: 'X-Requested-With', required: true, schema: { default: 'porfin-admin' } })
  async reset(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    await this.limits.check('reset', request.ip ?? 'unknown');
    return this.auth.reset(dto);
  }
}
