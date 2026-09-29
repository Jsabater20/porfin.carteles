import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { tokenHash } from '../../common/utils/credentials';

@Injectable()
export class GuestRateLimitService {
  constructor(private readonly prisma: PrismaService) {}
  private async consume(key: string, maximum: number, seconds: number) {
    const digest = tokenHash(key);
    const rows = await this.prisma.$queryRaw<{ attempts: number }[]>`
      INSERT INTO "GuestRateLimit" ("key", "attempts", "expiresAt")
      VALUES (${digest}, 1, CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second')
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE WHEN "GuestRateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN 1 ELSE LEAST("GuestRateLimit"."attempts" + 1, ${maximum + 1}) END,
        "expiresAt" = CASE WHEN "GuestRateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second' ELSE "GuestRateLimit"."expiresAt" END
      RETURNING "attempts"`;
    if (rows[0].attempts > maximum) throw new HttpException({ message: 'Demasiadas solicitudes. Intentá nuevamente más tarde.', retryAfterSeconds: seconds }, 429);
  }
  async publicRead(ip: string) { await this.consume('public:read:ip:' + ip, 300, 60); }
  async bootstrap(ip: string) { await this.consume('guest:start:ip:' + ip, 30, 3600); }
  async order(ip: string, sessionId: string) {
    await this.consume('guest:order:ip:' + ip, 120, 3600);
    await this.consume('guest:order:session:' + sessionId, 60, 3600);
  }
  async preview(ip: string, sessionId: string) {
    await this.consume('guest:preview:ip:' + ip, 120, 900);
    await this.consume('guest:preview:session:' + sessionId, 60, 900);
  }
}
