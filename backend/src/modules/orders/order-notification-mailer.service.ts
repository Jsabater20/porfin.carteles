import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Prisma } from '@prisma/client';
import { tokenHash } from '../../common/utils/credentials';

interface NotificationOrder {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  requestedDate: Date | string;
  deliveryMethod: string;
  notes: string | null;
  knownSubtotalCents: number | Prisma.Decimal;
  pendingQuoteCount: number;
  items: { productName: string; variantName: unknown; quantity: number; subtotalCents: number | Prisma.Decimal | null }[];
}

@Injectable()
export class OrderNotificationMailer {
  constructor(private readonly config: ConfigService) {}

  async send(recipient: string | null | undefined, order: NotificationOrder) {
    if (!recipient || !isEmail(recipient) || /[\r\n]/.test(recipient)) return false;
    const mode = this.config.get<string>('MAIL_MODE', 'disabled');
    if (!['file', 'smtp', 'resend'].includes(mode)) return false;
    const date = (order.requestedDate instanceof Date ? order.requestedDate.toISOString() : order.requestedDate).slice(0, 10).split('-').reverse().join('/');
    const amount = (value: number | Prisma.Decimal) => ((typeof value === 'number' ? value : value.toNumber()) / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
    const origin = this.config.get<string>('ALLOWED_ORIGINS', '').split(',')[0]?.trim();
    const adminUrl = origin ? `${origin}/admin/pedidos/${order.id}` : '';
    const text = [
      `Se registró un nuevo pedido en Porfin Carteles: ${order.reference}`,
      '',
      `Cliente: ${order.customerName}`,
      `Teléfono: ${order.customerPhone}`,
      ...(order.customerEmail ? [`Mail: ${order.customerEmail}`] : []),
      `Lo necesita para: ${date}`,
      `Entrega: ${order.deliveryMethod === 'PICKUP' ? 'A coordinar en Santa Fe Capital' : 'Envío por correo'}`,
      ...(order.notes ? [`Observaciones: ${order.notes}`] : []),
      '',
      'Productos:',
      ...order.items.map(item => `• ${item.quantity} × ${item.productName} (${typeof item.variantName === 'string' ? item.variantName : 'Variante'}) — ${item.subtotalCents === null ? 'A cotizar' : amount(item.subtotalCents)}`),
      '',
      `Subtotal conocido: ${amount(order.knownSubtotalCents)}`,
      `Productos pendientes de cotización: ${order.pendingQuoteCount}`,
      'Estado: pendiente de confirmación.',
      ...(adminUrl ? ['', `Abrir el pedido en administración: ${adminUrl}`] : []),
    ].join('\n');
    const message = {
      from: mode === 'resend' ? this.config.get<string>('EMAIL_FROM') : this.config.get<string>('MAIL_FROM', 'Porfin Carteles <no-reply@example.invalid>'),
      to: recipient,
      subject: `Nuevo pedido ${order.reference} · ${order.customerName}`,
      text,
    };
    try {
      if (mode === 'resend') {
        const apiKey = this.config.get<string>('RESEND_API_KEY');
        if (!apiKey || !message.from) return false;
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `order-${tokenHash(order.id)}` },
          body: JSON.stringify({ ...message, to: [recipient] }),
        });
        if (!response.ok) throw new Error('Delivery failed');
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !result.id.trim()) throw new Error('Invalid delivery response');
        return true;
      }
      if (mode === 'file') {
        if (this.config.get('NODE_ENV') === 'production') return false;
        const directory = path.resolve(this.config.get<string>('MAIL_OUTBOX_DIR', '.local/mail-outbox'));
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, `order-${randomUUID()}.json`), JSON.stringify(message), { mode: 0o600, flag: 'wx' });
        return true;
      }
      if (!this.config.get('SMTP_HOST')) return false;
      const transport = nodemailer.createTransport({
        host: this.config.getOrThrow<string>('SMTP_HOST'), port: this.config.get<number>('SMTP_PORT', 587),
        secure: this.config.get<boolean>('SMTP_SECURE', false), requireTLS: !this.config.get<boolean>('SMTP_SECURE', false),
        auth: { user: this.config.getOrThrow<string>('SMTP_USER'), pass: this.config.getOrThrow<string>('SMTP_PASSWORD') },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      });
      try { await transport.sendMail(message); return true; } finally { transport.close(); }
    } catch {
      throw new ServiceUnavailableException('No se pudo enviar el aviso del pedido.');
    }
  }
}
