import { Body, Controller, Delete, HttpCode, Post, Req, Res, SetMetadata, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { GuestSessionsService } from './guest-sessions.service';
import { GuestRateLimitService } from './guest-rate-limit.service';
import { GuestSessionGuard } from './guest-session.guard';
import { guestCookie, guestCookieName, guestCookieOptions } from './guest-cookie';
import { STOREFRONT_ROUTE } from './guest.constants';
import { GuestRequest } from './guest.types';

export class EmptyGuestDto {}
export class GuestSessionResponseDto {
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty() csrfToken!: string;
}

@Public()
@SetMetadata(STOREFRONT_ROUTE, true)
@ApiTags('Sesión invitada')
@ApiHeader({ name: 'X-Requested-With', required: true, schema: { default: 'porfin-storefront' } })
@Controller('guest-session')
export class GuestSessionsController {
  constructor(private readonly guests: GuestSessionsService, private readonly limits: GuestRateLimitService, private readonly config: ConfigService) {}

  @Post() @HttpCode(200)
  @ApiOperation({ summary: 'Crear o recuperar una sesión invitada; enviar JSON vacío' })
  @ApiOkResponse({ type: GuestSessionResponseDto })
  async start(@Body() _dto: EmptyGuestDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.limits.bootstrap(request.ip ?? 'unknown');
    const result = await this.guests.start(guestCookie(request, this.config));
    response.cookie(guestCookieName(this.config), result.token, { ...guestCookieOptions(this.config), expires: result.expiresAt });
    return { expiresAt: result.expiresAt, csrfToken: result.csrfToken };
  }

  @Delete() @HttpCode(204) @UseGuards(GuestSessionGuard)
  @ApiCookieAuth('guest-session') @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOperation({ summary: 'Cerrar sesión invitada y eliminar sus validaciones temporales' })
  async revoke(@Body() _dto: EmptyGuestDto, @Req() request: GuestRequest, @Res({ passthrough: true }) response: Response) {
    await this.guests.revoke(request.guestSession.id);
    response.clearCookie(guestCookieName(this.config), guestCookieOptions(this.config));
  }
}
