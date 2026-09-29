import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { PublicCatalogService } from './public-catalog.service';
import { PublicCatalogQuery, PublicPageQuery, PublicProductDetailDto, PublicProductPageDto, PublicProductParams, PublicTaxonomyPageDto } from './dto/public-catalog.dto';

@Public()
@ApiTags('Catálogo público')
@Controller()
export class PublicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

  @Get('products')
  @ApiOperation({ summary: 'Productos publicados: búsqueda, filtros y paginación, sin registro' })
  @ApiOkResponse({ type: PublicProductPageDto })
  list(@Query() query: PublicCatalogQuery) { return this.catalog.list(query); }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Ficha pública con variantes activas, galería y personalizaciones' })
  @ApiOkResponse({ type: PublicProductDetailDto })
  @ApiNotFoundResponse({ description: 'Producto inexistente, oculto o no disponible.' })
  get(@Param() params: PublicProductParams) { return this.catalog.get(params.slug); }

  @Get('categories')
  @ApiOperation({ summary: 'Categorías con productos visibles' })
  @ApiOkResponse({ type: PublicTaxonomyPageDto })
  categories(@Query() query: PublicPageQuery) { return this.catalog.taxonomy('category', query); }

  @Get('careers')
  @ApiOperation({ summary: 'Carreras con productos visibles' })
  @ApiOkResponse({ type: PublicTaxonomyPageDto })
  careers(@Query() query: PublicPageQuery) { return this.catalog.taxonomy('career', query); }
}
