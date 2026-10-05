import { BadRequestException, Delete, Get, Query, Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole, OrderStatus } from '@prisma/client';
import { Roles } from '../../common/decorators/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { OrderService } from './order.service';
import { CreateManualOrderDto, CreateOrderQuoteDto, DeleteOrderDto, OrderCalendarQueryDto, UpdateOrderScheduleDto, UpdateOrderStatusDto, UpdateQuoteStatusDto } from './dto/order.dto';

@ApiTags('Pedidos administrativos')
@ApiCookieAuth('session')
@ApiHeader({ name: 'X-Requested-With', description: 'Requerido en escrituras: porfin-admin', required: false })
@ApiHeader({ name: 'X-CSRF-Token', description: 'Requerido en escrituras', required: false })
@Roles(AdminRole.OWNER, AdminRole.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  list(@Query('page') page = '1') {
    if (!/^[1-9][0-9]{0,5}$/.test(page)) throw new BadRequestException('Página inválida.');
    return this.orders.list(Number(page));
  }
  @Get('calendar')
  calendar(@Query() query: OrderCalendarQueryDto) { return this.orders.calendar(query.from, query.to); }
  @Post('manual')
  @ApiOperation({ summary: 'Registrar en la agenda un pedido recibido fuera de la tienda online' })
  createManual(@Body() dto: CreateManualOrderDto, @Req() request: AuthenticatedRequest) {
    return this.orders.createManual(dto, request.adminSession.id);
  }
  @Get(':id')
  get(@Param('id') id: string) { return this.orders.adminGet(id); }
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar definitivamente un pedido y sus registros relacionados' })
  remove(@Param('id') id: string, @Body() dto: DeleteOrderDto, @Req() request: AuthenticatedRequest) {
    return this.orders.remove(id, dto.reference, request.adminSession.id);
  }
  @Patch(':id/quotes/:quoteId/status')
  quoteStatus(@Param('id') id: string, @Param('quoteId') quoteId: string, @Body() dto: UpdateQuoteStatusDto, @Req() request: AuthenticatedRequest) {
    return this.orders.updateQuoteStatus(id, quoteId, dto.status, request.adminSession.id);
  }
  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar el estado de un pedido y registrar el historial del cambio' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @Req() request: AuthenticatedRequest) {
    return this.orders.updateStatus(id, dto.status, request.adminSession.id, dto.reason);
  }
  @Patch(':id/schedule')
  @ApiOperation({ summary: 'Reprogramar la fecha de entrega de un pedido' })
  updateSchedule(@Param('id') id: string, @Body() dto: UpdateOrderScheduleDto, @Req() request: AuthenticatedRequest) {
    return this.orders.updateSchedule(id, dto.scheduledDate, request.adminSession.id);
  }

  @Post(':id/quotes')
  @ApiOperation({ summary: 'Crear una nueva revisión inmutable del presupuesto de un pedido' })
  createQuote(@Param('id') id: string, @Body() dto: CreateOrderQuoteDto, @Req() request: AuthenticatedRequest) {
    return this.orders.createQuote(id, dto, request.adminSession.id);
  }
}
