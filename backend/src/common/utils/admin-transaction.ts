import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ADMIN_LOCK } from '../../modules/auth/auth.types';

export function adminTransaction<T>(prisma: PrismaService, sessionId: string, action: (tx: Prisma.TransactionClient, administratorId: string) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_LOCK})`;
    const session = await tx.adminSession.findFirst({ where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() }, administrator: { active: true, role: { in: ['OWNER', 'ADMIN'] } } } });
    if (!session) throw new ForbiddenException('La sesión administrativa ya no está activa.');
    return action(tx, session.administratorId);
  }, { timeout: 15000 });
}
