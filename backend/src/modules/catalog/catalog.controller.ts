import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/auth.decorators';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AdminListQuery } from '../admins/dto/admin.dto';
import { CatalogService } from './catalog.service';
import { CatalogQuery, PatchProductDto, PatchTaxonomyDto, ProductDto, TaxonomyDto } from './dto/catalog.dto';

@ApiTags('Catálogo privado')
@ApiCookieAuth('session')
@ApiHeader({ name: 'X-Requested-With', description: 'Requerido en escrituras: porfin-admin', required: false })
@ApiHeader({ name: 'X-CSRF-Token', description: 'Requerido en escrituras', required: false })
@Roles(AdminRole.OWNER, AdminRole.ADMIN)
@Controller('admin/products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get() list(@Query() query: CatalogQuery) { return this.catalog.list(query); }
  @Get(':id') get(@Param('id') id: string) { return this.catalog.get(id); }
  @Post() create(@Body() dto: ProductDto, @Req() request: AuthenticatedRequest) { return this.catalog.create(dto, request.adminSession.id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: PatchProductDto, @Req() request: AuthenticatedRequest) { return this.catalog.update(id, dto, request.adminSession.id); }
  @Delete(':id') @HttpCode(204) delete(@Param('id') id: string, @Req() request: AuthenticatedRequest) { return this.catalog.delete(id, request.adminSession.id); }
}

@ApiTags('Categorías y carreras')
@ApiCookieAuth('session')
@ApiHeader({ name: 'X-Requested-With', description: 'Requerido en escrituras: porfin-admin', required: false })
@ApiHeader({ name: 'X-CSRF-Token', description: 'Requerido en escrituras', required: false })
@Roles(AdminRole.OWNER, AdminRole.ADMIN)
@Controller('admin')
export class TaxonomyController {
  constructor(private readonly catalog: CatalogService) {}
  @Get('categories') categories(@Query() query: AdminListQuery) { return this.catalog.listTaxonomy('category', query); }
  @Post('categories') createCategory(@Body() dto: TaxonomyDto, @Req() request: AuthenticatedRequest) { return this.catalog.createTaxonomy('category', dto, request.adminSession.id); }
  @Patch('categories/:id') updateCategory(@Param('id') id: string, @Body() dto: PatchTaxonomyDto, @Req() request: AuthenticatedRequest) { return this.catalog.updateTaxonomy('category', id, dto, request.adminSession.id); }
  @Delete('categories/:id') @HttpCode(204) deleteCategory(@Param('id') id: string, @Req() request: AuthenticatedRequest) { return this.catalog.deleteTaxonomy('category', id, request.adminSession.id); }
  @Get('careers') careers(@Query() query: AdminListQuery) { return this.catalog.listTaxonomy('career', query); }
  @Post('careers') createCareer(@Body() dto: TaxonomyDto, @Req() request: AuthenticatedRequest) { return this.catalog.createTaxonomy('career', dto, request.adminSession.id); }
  @Patch('careers/:id') updateCareer(@Param('id') id: string, @Body() dto: PatchTaxonomyDto, @Req() request: AuthenticatedRequest) { return this.catalog.updateTaxonomy('career', id, dto, request.adminSession.id); }
  @Delete('careers/:id') @HttpCode(204) deleteCareer(@Param('id') id: string, @Req() request: AuthenticatedRequest) { return this.catalog.deleteTaxonomy('career', id, request.adminSession.id); }
}
