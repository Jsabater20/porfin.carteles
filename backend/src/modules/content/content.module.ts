import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ContentService } from './content.service';
import { AdminContentController, PublicContentController } from './content.controller';

@Module({ imports: [CatalogModule], controllers: [AdminContentController, PublicContentController], providers: [ContentService] })
export class ContentModule {}
