import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { tokenHash } from '../../common/utils/credentials';

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  private async consume(key: string, maximum: number, seconds: number) {
    const digest = tokenHash(key);
    const rows = await this.prisma.$queryRaw<{ attempts: number }[]>`
      INSERT INTO "AuthRateLimit" ("key", "attempts", "expiresAt")
      VALUES (${digest}, 1, CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second')
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE WHEN "AuthRateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN 1 ELSE LEAST("AuthRateLimit"."attempts" + 1, ${maximum + 1}) END,
        "expiresAt" = CASE WHEN "AuthRateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second' ELSE "AuthRateLimit"."expiresAt" END
      RETURNING "attempts"`;
    if (rows[0].attempts > maximum) throw new HttpException({ message: 'Demasiados intentos. Intentá nuevamente más tarde.', retryAfterSeconds: seconds }, 429);
  }

  async check(action: 'login' | 'recovery' | 'reset', ip: string, email?: string) {
    await this.consume(`${action}:ip:${ip}`, action === 'login' ? 50 : 20, 900);
    if (email) await this.consume(`${action}:email:${email}`, action === 'login' ? 10 : 3, 900);
    await this.prisma.authRateLimit.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
  }
}
