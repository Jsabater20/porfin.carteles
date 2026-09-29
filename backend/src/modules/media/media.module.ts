import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { MediaService } from './media.service';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaController } from './media.controller';

@Module({ controllers: [MediaController], providers: [CloudinaryService, MediaService, MediaCleanupService] })
export class MediaModule {}
