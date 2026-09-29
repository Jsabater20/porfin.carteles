import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AdminRole, ContentPageKey } from '@prisma/client';
import { Public, Roles } from '../../common/decorators/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PublicProductCardDto } from '../catalog/dto/public-catalog.dto';
import { ContentPageParams, ContentSectionDto, FaqItemDto, PatchContentDto } from './dto/content.dto';
import { ContentService } from './content.service';

class PublicContentDto {
  @ApiProperty({ enum: ContentPageKey }) page!: ContentPageKey;
  @ApiProperty() title!: string;
  @ApiProperty() subtitle!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: [ContentSectionDto] }) sections!: ContentSectionDto[];
  @ApiProperty({ type: [FaqItemDto] }) faqItems!: FaqItemDto[];
  @ApiProperty({ type: [PublicProductCardDto] }) featuredProducts!: PublicProductCardDto[];
}
@Public() @ApiTags('Contenido público') @Controller('content')
export class PublicContentController {
  constructor(private readonly content: ContentService) {}
  @Get(':page') @ApiOkResponse({ type: PublicContentDto })
  @ApiOperation({ summary: 'Leer una página publicada y, en home, sus productos destacados visibles' })
  get(@Param() params: ContentPageParams) { return this.content.get(params.page); }
}

@Roles(AdminRole.OWNER, AdminRole.ADMIN)
@ApiTags('Contenido privado') @ApiCookieAuth('session')
@ApiHeader({ name: 'X-Requested-With', description: 'En escrituras: porfin-admin', required: false })
@ApiHeader({ name: 'X-CSRF-Token', description: 'Requerido en escrituras', required: false })
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly content: ContentService) {}
  @Get() list() { return this.content.adminList(); }
  @Patch() @ApiOperation({ summary: 'Editar/publicar una página y ordenar destacados de home' })
  update(@Body() dto: PatchContentDto, @Req() request: AuthenticatedRequest) { return this.content.update(dto, request.adminSession.id); }
}
