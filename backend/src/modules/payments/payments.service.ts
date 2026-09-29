import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMovement, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { adminTransaction } from '../../common/utils/admin-transaction';
import { tokenHash } from '../../common/utils/credentials';
import { CreatePaymentMovementDto } from './payments.dto';

function totals(payments: PaymentMovement[], quoteTotalCents: number | null) {
  const chargedCents = payments.filter(item => item.type === 'CHARGE').reduce((sum, item) => sum + item.amountCents, 0);
  const refundedCents = payments.filter(item => item.type === 'REFUND').reduce((sum, item) => sum + item.amountCents, 0);
  const balanceCents = chargedCents - refundedCents;
  for (const value of [chargedCents, refundedCents, balanceCents]) if (!Number.isSafeInteger(value)) throw new ConflictException('El saldo supera el límite de cálculo.');
  const paymentStatus = quoteTotalCents !== null && balanceCents >= quoteTotalCents ? 'PAID' : balanceCents === 0 ? 'PENDING' : 'PARTIAL';
  return { chargedCents, refundedCents, balanceCents, quoteTotalCents, outstandingCents: quoteTotalCents === null ? null : Math.max(0, quoteTotalCents - balanceCents), paymentStatus };
}
function publicMovement({ requestHash: _hash, idempotencyKey: _key, ...movement }: PaymentMovement) { return movement; }
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}
  async summary(orderId: string) {
    return this.prisma.$transaction(async tx => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { quotes: { where: { status: 'ACCEPTED' }, orderBy: { version: 'desc' }, take: 1 }, payments: { orderBy: { occurredAt: 'asc' } } } });
      if (!order) throw new NotFoundException('Pedido no encontrado.');
      return { movements: order.payments.map(publicMovement), ...totals(order.payments, order.quotes[0] ? Number(order.quotes[0].totalCents) : null) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  create(dto: CreatePaymentMovementDto, sessionId: string, idempotencyKey: string) {
    const key = idempotencyKey.toLowerCase();
    const requestHash = tokenHash(JSON.stringify({ orderId: dto.orderId, quoteId: dto.quoteId ?? null, type: dto.type, amountCents: dto.amountCents, method: dto.method, reference: dto.reference ?? null }));
    return adminTransaction(this.prisma, sessionId, async (tx, administratorId) => {
      const previous = await tx.paymentMovement.findUnique({ where: { idempotencyKey: key } });
      if (previous && previous.requestHash !== requestHash) throw new ConflictException('La clave de idempotencia ya se usó con otro movimiento.');
      const order = await tx.order.findUnique({ where: { id: dto.orderId }, include: { quotes: { where: { status: 'ACCEPTED' }, orderBy: { version: 'desc' }, take: 1 }, payments: true } });
      if (!order) throw new NotFoundException('Pedido no encontrado.');
      const activeQuote = order.quotes[0];
      const before = totals(order.payments, activeQuote ? Number(activeQuote.totalCents) : null);
      if (previous) return { movement: publicMovement(previous), ...before };
      if (dto.type === 'CHARGE' && order.status === 'CANCELLED') throw new ConflictException('No se puede cobrar un pedido cancelado.');
      const quote = dto.quoteId ? await tx.orderQuote.findFirst({ where: { id: dto.quoteId, orderId: dto.orderId, status: 'ACCEPTED' } }) : activeQuote;
      if (!quote) throw new ConflictException('El movimiento requiere un presupuesto aceptado de este pedido.');
      if (dto.type === 'CHARGE' && quote.id !== activeQuote?.id) throw new ConflictException('El cobro debe corresponder al presupuesto aceptado vigente.');
      if (dto.type === 'CHARGE' && before.balanceCents + dto.amountCents > Number(quote.totalCents)) throw new BadRequestException('El cobro supera el total del presupuesto.');
      if (dto.type === 'REFUND' && dto.amountCents > before.balanceCents) throw new BadRequestException('La devolución supera el saldo cobrado.');
      const movement = await tx.paymentMovement.create({ data: { orderId: dto.orderId, quoteId: quote.id, type: dto.type, amountCents: dto.amountCents, method: dto.method, reference: dto.reference || null, administratorId, idempotencyKey: key, requestHash } });
      const after = totals([...order.payments, movement], before.quoteTotalCents);
      await tx.orderEvent.create({ data: { orderId: dto.orderId, type: 'PAYMENT_RECORDED', details: { movementId: movement.id, type: dto.type, amountCents: dto.amountCents, paymentStatus: after.paymentStatus, administratorId } } });
      return { movement: publicMovement(movement), ...after };
    });
  }
}