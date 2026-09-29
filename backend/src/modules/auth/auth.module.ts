import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthCleanupService } from './auth-cleanup.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { RecoveryMailer } from './recovery-mailer.service';

@Module({
  controllers: [AuthController],
  providers: [AuthCleanupService, AuthService, AuthRateLimitService, RecoveryMailer,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
