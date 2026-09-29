import { Module } from '@nestjs/common';
import { GuestSessionsController } from './guest-sessions.controller';
import { GuestSessionsService } from './guest-sessions.service';
import { GuestSessionGuard } from './guest-session.guard';
import { GuestRateLimitService } from './guest-rate-limit.service';
import { GuestCleanupService } from './guest-cleanup.service';

@Module({
  controllers: [GuestSessionsController],
  providers: [GuestSessionsService, GuestSessionGuard, GuestRateLimitService, GuestCleanupService],
  exports: [GuestSessionsService, GuestSessionGuard, GuestRateLimitService],
})
export class GuestSessionsModule {}
