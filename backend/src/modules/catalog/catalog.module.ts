import { Module } from '@nestjs/common';
import { CatalogController, TaxonomyController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PublicCatalogController } from './public-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({ imports: [PricingModule], controllers: [CatalogController, TaxonomyController, PublicCatalogController], exports: [PublicCatalogService], providers: [CatalogService, PublicCatalogService] })
export class CatalogModule {}