import { BadRequestException, Body, Controller, Get, Param, Headers, HttpCode, Post, Req, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { Public } from '../../common/decorators/auth.decorators';
import { GuestSessionGuard } from '../guest-sessions/guest-session.guard';
import { STOREFRONT_ROUTE } from '../guest-sessions/guest.constants';
import { GuestRequest } from '../guest-sessions/guest.types';
import { CreateOrderDto, OrderResponseDto } from './dto/order.dto';
import { GuestRateLimitService } from '../guest-sessions/guest-rate-limit.service';
import { OrderService } from './order.service';

@Public()
@SetMetadata(STOREFRONT_ROUTE, true)
@UseGuards(GuestSessionGuard)
@ApiTags('Pedidos')
@ApiCookieAuth('guest-session')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrderService, private readonly limits: GuestRateLimitService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un pedido propio de la sesión invitada' })
  get(@Param('id') id: string, @Req() request: GuestRequest) { return this.orders.guestGet(id, request.guestSession.id); }

  @Post() @HttpCode(200)
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiOperation({ summary: 'Registrar un pedido real a partir de un preview vigente' })
  @ApiHeader({ name: 'X-Requested-With', required: true, schema: { default: 'porfin-storefront' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID v4 nuevo para cada pedido lógico; reutilizar en reintentos.' })
  async create(@Body() dto: CreateOrderDto, @Headers('idempotency-key') key: string, @Req() request: GuestRequest) {
    if (typeof key !== 'string' || !isUUID(key, '4')) throw new BadRequestException('Idempotency-Key debe ser un UUID v4.');
    await this.limits.order(request.ip ?? 'unknown', request.guestSession.id);
    return this.orders.create(dto, request.guestSession.id, key);
  }
}
