import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Public, Roles } from '../../common/decorators/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PatchSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

class PublicSettingsDto {
  @ApiProperty() storeName!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, nullable: true }) whatsappNumber!: string | null;
  @ApiProperty({ type: String, nullable: true }) whatsappUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) contactEmail!: string | null;
  @ApiProperty({ type: String, nullable: true }) instagramUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) facebookUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) tiktokUrl!: string | null;
  @ApiProperty() pickupAddress!: string;
  @ApiProperty({ type: [String], enum: ['PICKUP', 'SHIPPING'], isArray: true }) deliveryMethods!: string[];
  @ApiProperty() deliveryNotes!: string;
  @ApiProperty() leadTimeText!: string;
  @ApiProperty() businessHours!: string;
}
@Public() @ApiTags('Configuración pública') @Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get('public') @ApiOkResponse({ type: PublicSettingsDto })
  get() { return this.settings.publicSettings(); }
}

@Roles(AdminRole.OWNER, AdminRole.ADMIN) @ApiCookieAuth('session') @ApiTags('Configuración privada')
@ApiHeader({ name: 'X-Requested-With', description: 'En escrituras: porfin-admin', required: false })
@ApiHeader({ name: 'X-CSRF-Token', description: 'Requerido en escrituras', required: false })
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get() get() { return this.settings.adminSettings(); }
  @Patch() update(@Body() dto: PatchSettingsDto, @Req() request: AuthenticatedRequest) { return this.settings.update(dto, request.adminSession.id); }
}
