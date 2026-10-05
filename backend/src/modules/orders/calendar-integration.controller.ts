import { Body, Controller, Delete, Get, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CalendarIntegrationService } from './calendar-integration.service';
import { CompleteGoogleCalendarDto, SyncGoogleCalendarDto } from './dto/order.dto';

@ApiTags('Integración de calendario')
@ApiCookieAuth('session')
@ApiHeader({ name: 'X-Requested-With', description: 'Requerido en escrituras: porfin-admin', required: false })
@ApiHeader({ name: 'X-CSRF-Token', description: 'Requerido en escrituras', required: false })
@Roles(AdminRole.OWNER, AdminRole.ADMIN)
@Controller('admin/calendar-integration')
export class CalendarIntegrationController {
  constructor(private readonly calendar: CalendarIntegrationService) {}

  @Get('status')
  status() { return this.calendar.status(); }

  @Post('google/start')
  @ApiOperation({ summary: 'Preparar la vinculación opcional con Google Calendar' })
  start(@Req() request: AuthenticatedRequest) {
    return this.calendar.start(request.adminSession.id, request.admin.id);
  }

  @Post('google/complete')
  @ApiOperation({ summary: 'Completar la autorización de Google Calendar' })
  complete(@Body() dto: CompleteGoogleCalendarDto, @Req() request: AuthenticatedRequest) {
    return this.calendar.complete(dto.code, dto.state, request.adminSession.id, request.admin.id);
  }

  @Post('google/sync')
  @ApiOperation({ summary: 'Copiar los pedidos elegidos a Google Calendar' })
  sync(@Body() dto: SyncGoogleCalendarDto) { return this.calendar.sync(dto.orderIds); }

  @Delete('google')
  @ApiOperation({ summary: 'Desvincular Google Calendar' })
  disconnect() { return this.calendar.disconnect(); }
}
