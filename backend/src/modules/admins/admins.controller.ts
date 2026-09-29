import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AdminsService } from './admins.service';
import { AdminListQuery, CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';

@ApiTags('Admins')
@ApiCookieAuth('session')
@ApiForbiddenResponse({ description: 'Solo OWNER puede gestionar administradores.' })
@Roles(AdminRole.OWNER)
@Controller('admin/admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar administradores (paginado)' })
  list(@Query() query: AdminListQuery) { return this.admins.list(query); }

  @Post()
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({ name: 'X-Requested-With', required: true, schema: { default: 'porfin-admin' } })
  create(@Body() dto: CreateAdminDto, @Req() request: AuthenticatedRequest) { return this.admins.create(dto, request.adminSession.id); }

  @Patch(':id')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({ name: 'X-Requested-With', required: true, schema: { default: 'porfin-admin' } })
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto, @Req() request: AuthenticatedRequest) { return this.admins.update(id, dto, request.adminSession.id); }
}
