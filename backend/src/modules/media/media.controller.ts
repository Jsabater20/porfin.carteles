import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CompleteUploadDto, ImageOrderDto, ImageTextDto, UploadSignatureDto } from './dto/media.dto';
import { MediaService } from './media.service';

@ApiTags('Imágenes del catálogo')
@ApiCookieAuth('session')
@ApiHeader({ name: 'X-Requested-With', description: 'En escrituras: porfin-admin', required: false })
@ApiHeader({ name: 'X-CSRF-Token', description: 'Requerido en escrituras', required: false })
@Roles(AdminRole.OWNER, AdminRole.ADMIN)
@Controller('admin')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('media/upload-signature')
  @ApiOperation({ summary: 'Autorizar una carga directa a Cloudinary (JPG, PNG, WebP; 5 MiB)' })
  signature(@Body() dto: UploadSignatureDto, @Req() req: AuthenticatedRequest) { return this.media.signature(dto, req.adminSession.id); }

  @Post('media/complete') @HttpCode(200)
  @ApiOperation({ summary: 'Verificar el archivo en Cloudinary e incorporarlo a la galería; admite reintentos' })
  complete(@Body() dto: CompleteUploadDto, @Req() req: AuthenticatedRequest) { return this.media.complete(dto, req.adminSession.id); }

  @Delete('media/uploads/:uploadId') @HttpCode(204)
  cancel(@Param('uploadId', ParseUUIDPipe) uploadId: string, @Req() req: AuthenticatedRequest) { return this.media.cancel(uploadId, req.adminSession.id); }

  @Get('products/:productId/images')
  list(@Param('productId') productId: string) { return this.media.list(productId); }

  @Patch('products/:productId/images/order')
  @ApiOperation({ summary: 'Ordenar toda la galería; la primera imagen será portada' })
  reorder(@Param('productId') productId: string, @Body() dto: ImageOrderDto, @Req() req: AuthenticatedRequest) { return this.media.reorder(productId, dto, req.adminSession.id); }

  @Patch('products/:productId/images/:id')
  update(@Param('productId') productId: string, @Param('id') id: string, @Body() dto: ImageTextDto, @Req() req: AuthenticatedRequest) { return this.media.updateText(productId, id, dto.altText, req.adminSession.id); }

  @Delete('products/:productId/images/:id') @HttpCode(204)
  @ApiOperation({ summary: 'Quitar de la galería y programar borrado del archivo en Cloudinary' })
  remove(@Param('productId') productId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.media.remove(productId, id, req.adminSession.id); }
}
