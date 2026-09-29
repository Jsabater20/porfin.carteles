import { APP_GUARD } from '@nestjs/core';
import { PublicReadGuard } from './common/guards/public-read.guard';
import { GuestSessionsModule } from './modules/guest-sessions/guest-sessions.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './modules/health/health.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminsModule } from './modules/admins/admins.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ContentModule } from './modules/content/content.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MediaModule } from './modules/media/media.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  providers: [{ provide: APP_GUARD, useClass: PublicReadGuard }],
  imports: [GuestSessionsModule, ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), DatabaseModule, AuthModule, AdminsModule, CatalogModule, MediaModule, OrdersModule, PaymentsModule, ContentModule, SettingsModule, HealthModule],
})
export class AppModule {}
