import { Module } from '@nestjs/common';
import { GuestSessionsModule } from '../guest-sessions/guest-sessions.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';
import { OrderService } from './order.service';
import { PreviewController } from './preview.controller';
import { PreviewService } from './preview.service';

@Module({
  imports: [GuestSessionsModule, PricingModule],
  controllers: [PreviewController, OrdersController, AdminOrdersController],
  providers: [PreviewService, OrderService],
})
export class OrdersModule {}
