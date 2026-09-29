import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';

@Injectable()
export class RecoveryMailer {
  constructor(private readonly config: ConfigService) {}

  assertAvailable() {
    if (this.config.get('MAIL_MODE') === 'disabled' || (this.config.get('MAIL_MODE') === 'smtp' && !this.config.get('SMTP_HOST'))) {
      throw new ServiceUnavailableException('Recuperación no disponible.');
    }
  }

  async send(email: string, token: string) {
    const url = new URL(this.config.getOrThrow<string>('PASSWORD_RESET_URL'));
    // El fragmento no llega a servidores web ni a logs de acceso.
    url.hash = new URLSearchParams({ token }).toString();
    const message = {
      from: this.config.get<string>('MAIL_FROM', 'Por fin! <no-reply@example.invalid>'),
      to: email,
      subject: 'Recuperar acceso a Por fin!',
      text: `Abrí este enlace para elegir una contraseña nueva:\n${url.toString()}\n\nVence en 30 minutos y solo se puede usar una vez. Si no lo solicitaste, ignorá este mensaje.`,
    };
    if (this.config.get('MAIL_MODE') === 'file') {
      if (this.config.get('NODE_ENV') === 'production') throw new Error('File mail is disabled in production');
      const directory = path.resolve(this.config.get<string>('MAIL_OUTBOX_DIR', '.local/recovery-outbox'));
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, `${randomUUID()}.json`), JSON.stringify(message), { mode: 0o600, flag: 'wx' });
      return;
    }
    const transport = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      requireTLS: !this.config.get<boolean>('SMTP_SECURE', false),
      auth: { user: this.config.getOrThrow<string>('SMTP_USER'), pass: this.config.getOrThrow<string>('SMTP_PASSWORD') },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
    try { await transport.sendMail(message); } finally { transport.close(); }
  }
}
