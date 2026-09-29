import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { Public } from '../../common/decorators/auth.decorators';
import { GuestSessionGuard } from '../guest-sessions/guest-session.guard';
import { GuestRateLimitService } from '../guest-sessions/guest-rate-limit.service';
import { GuestRequest } from '../guest-sessions/guest.types';
import { STOREFRONT_ROUTE } from '../guest-sessions/guest.constants';
import { PreviewDto, PreviewResponseDto } from './dto/preview.dto';
import { PreviewService } from './preview.service';

@Public()
@SetMetadata(STOREFRONT_ROUTE, true)
@UseGuards(GuestSessionGuard)
@ApiTags('Validación del carrito')
@ApiCookieAuth('guest-session')
@Controller('orders')
export class PreviewController {
  constructor(private readonly previews: PreviewService, private readonly limits: GuestRateLimitService) {}

  @Post('preview') @HttpCode(200)
  @ApiOperation({ summary: 'Validar carrito y guardar un resumen temporal; no crea un pedido' })
  @ApiHeader({ name: 'X-Requested-With', required: true, schema: { default: 'porfin-storefront' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID v4 nuevo para cada validación lógica; reutilizar en reintentos.' })
  @ApiOkResponse({ type: PreviewResponseDto })
  async create(@Body() dto: PreviewDto, @Headers('idempotency-key') key: string, @Req() request: GuestRequest) {
    if (typeof key !== 'string' || !isUUID(key, '4')) throw new BadRequestException('Idempotency-Key debe ser un UUID v4.');
    await this.limits.preview(request.ip ?? 'unknown', request.guestSession.id);
    return this.previews.create(dto, request.guestSession.id, key);
  }

  @Get('previews/:id')
  @ApiOperation({ summary: 'Consultar una validación vigente de la sesión invitada actual' })
  @ApiOkResponse({ type: PreviewResponseDto })
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: GuestRequest) { return this.previews.get(id, request.guestSession.id); }
}
