import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminSettingsController, PublicSettingsController } from './settings.controller';
@Module({ controllers: [AdminSettingsController, PublicSettingsController], providers: [SettingsService] })
export class SettingsModule {}
