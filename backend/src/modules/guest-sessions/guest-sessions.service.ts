import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { opaqueToken, tokenHash } from '../../common/utils/credentials';
import { GUEST_TTL_MS } from './guest.constants';
import { guestCsrfToken } from './guest-cookie';

@Injectable()
export class GuestSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async start(previousToken?: string) {
    if (previousToken) {
      const current = await this.prisma.guestSession.findUnique({ where: { tokenHash: tokenHash(previousToken) } });
      if (current && !current.revokedAt && current.expiresAt > new Date()) return { token: previousToken, expiresAt: current.expiresAt, csrfToken: guestCsrfToken(previousToken) };
    }
    const token = opaqueToken();
    const expiresAt = new Date(Date.now() + GUEST_TTL_MS);
    await this.prisma.guestSession.create({ data: { tokenHash: tokenHash(token), expiresAt } });
    return { token, expiresAt, csrfToken: guestCsrfToken(token) };
  }

  async authenticate(token?: string) {
    if (!token) throw new UnauthorizedException('Iniciá una sesión de invitado para continuar.');
    const session = await this.prisma.guestSession.findUnique({ where: { tokenHash: tokenHash(token) } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('La sesión de invitado venció o fue cerrada.');
    return { id: session.id, token, expiresAt: session.expiresAt };
  }

  async revoke(id: string) {
    await this.prisma.$transaction(async tx => {
      await tx.guestSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.orderPreview.deleteMany({ where: { guestSessionId: id } });
    });
  }
}
