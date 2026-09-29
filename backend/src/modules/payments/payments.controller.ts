import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CreatePaymentMovementDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Pagos administrativos')
@ApiCookieAuth('session')
@ApiHeader({ name: 'X-Requested-With', description: 'Requerido en escrituras: porfin-admin', required: false })
@ApiHeader({ name: 'X-CSRF-Token', description: 'Requerido en escrituras', required: false })
@Roles(AdminRole.OWNER, AdminRole.ADMIN)
@Controller('admin/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('orders/:orderId')
  get(@Param('orderId') orderId: string) { return this.payments.summary(orderId); }
  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiOperation({ summary: 'Registrar un cobro o devolución y calcular el estado de pago' })
  create(@Body() dto: CreatePaymentMovementDto, @Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string) {
    if (typeof key !== 'string' || !isUUID(key, '4')) throw new BadRequestException('Idempotency-Key debe ser un UUID v4.');
    return this.payments.create(dto, request.adminSession.id, key);
  }
}
