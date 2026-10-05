import { Module } from '@nestjs/common';
import { GuestSessionsModule } from '../guest-sessions/guest-sessions.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';
import { OrderService } from './order.service';
import { PreviewController } from './preview.controller';
import { PreviewService } from './preview.service';
import { OrderNotificationMailer } from './order-notification-mailer.service';
import { CalendarIntegrationController } from './calendar-integration.controller';
import { CalendarIntegrationService } from './calendar-integration.service';

@Module({
  imports: [GuestSessionsModule, PricingModule],
  controllers: [PreviewController, OrdersController, AdminOrdersController, CalendarIntegrationController],
  providers: [PreviewService, OrderService, OrderNotificationMailer, CalendarIntegrationService],
})
export class OrdersModule {}
