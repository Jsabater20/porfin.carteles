import { BadGatewayException, BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';

type Tokens = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
type UserInfo = { email?: string; email_verified?: boolean };
type CalendarOrder = Prisma.OrderGetPayload<{ include: { items: true } }>;

@Injectable()
export class CalendarIntegrationService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private settings() {
    const clientId = String(this.config.get('GOOGLE_CALENDAR_CLIENT_ID') ?? '');
    const clientSecret = String(this.config.get('GOOGLE_CALENDAR_CLIENT_SECRET') ?? '');
    const redirectUrl = String(this.config.get('GOOGLE_CALENDAR_REDIRECT_URL') ?? '');
    const accountEmail = String(this.config.get('GOOGLE_CALENDAR_ACCOUNT_EMAIL') ?? '').toLowerCase();
    const encryptionKey = String(this.config.get('INTEGRATION_ENCRYPTION_KEY') ?? '');
    return { clientId, clientSecret, redirectUrl, accountEmail, encryptionKey, configured: Boolean(clientId && clientSecret && redirectUrl && accountEmail && encryptionKey) };
  }

  async status() {
    const config = this.settings();
    const stored = await this.prisma.storeSettings.findUnique({ where: { id: 1 }, select: { googleCalendarEmail: true, googleCalendarRefreshToken: true, googleCalendarConnectedAt: true, googleCalendarLastSyncedAt: true } });
    return { configured: config.configured, connected: Boolean(config.configured && stored?.googleCalendarRefreshToken), email: stored?.googleCalendarEmail ?? (config.accountEmail || null), connectedAt: stored?.googleCalendarConnectedAt ?? null, lastSyncedAt: stored?.googleCalendarLastSyncedAt ?? null };
  }

  start(sessionId: string, administratorId: string) {
    const config = this.requireConfig();
    const payload = Buffer.from(JSON.stringify({ sessionId, administratorId, exp: Date.now() + 10 * 60_000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
    const state = payload + '.' + this.sign(payload, config.encryptionKey);
    const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUrl, response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', login_hint: config.accountEmail, scope: 'openid email https://www.googleapis.com/auth/calendar.events', state });
    return { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?' + query.toString() };
  }

  async complete(code: string, state: string, sessionId: string, administratorId: string) {
    const config = this.requireConfig();
    this.verifyState(state, sessionId, administratorId, config.encryptionKey);
    const tokenResponse = await this.google<Tokens>('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUrl, grant_type: 'authorization_code' }) });
    if (!tokenResponse.access_token) throw new BadGatewayException('Google no devolvió un acceso válido. Intentá vincular la cuenta nuevamente.');
    const user = await this.google<UserInfo>('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + tokenResponse.access_token } });
    if (!user.email_verified || user.email?.toLowerCase() !== config.accountEmail) throw new BadRequestException(`Vinculá la cuenta ${config.accountEmail}.`);
    const current = await this.prisma.storeSettings.findUnique({ where: { id: 1 }, select: { googleCalendarRefreshToken: true } });
    const refresh = tokenResponse.refresh_token ? this.encrypt(tokenResponse.refresh_token, config.encryptionKey) : current?.googleCalendarRefreshToken;
    if (!refresh) throw new BadRequestException('Google no entregó permiso permanente. Quitá el acceso anterior y volvé a vincular la cuenta.');
    await this.prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1, googleCalendarEmail: user.email.toLowerCase(), googleCalendarAccessToken: this.encrypt(tokenResponse.access_token, config.encryptionKey), googleCalendarRefreshToken: refresh, googleCalendarTokenExpiresAt: new Date(Date.now() + Math.max(60, tokenResponse.expires_in ?? 3600) * 1000), googleCalendarId: 'primary', googleCalendarConnectedAt: new Date() }, update: { googleCalendarEmail: user.email.toLowerCase(), googleCalendarAccessToken: this.encrypt(tokenResponse.access_token, config.encryptionKey), googleCalendarRefreshToken: refresh, googleCalendarTokenExpiresAt: new Date(Date.now() + Math.max(60, tokenResponse.expires_in ?? 3600) * 1000), googleCalendarId: 'primary', googleCalendarConnectedAt: new Date() } });
    return this.status();
  }

  async disconnect() {
    await this.prisma.storeSettings.updateMany({ where: { id: 1 }, data: { googleCalendarEmail: null, googleCalendarAccessToken: null, googleCalendarRefreshToken: null, googleCalendarTokenExpiresAt: null, googleCalendarId: null, googleCalendarConnectedAt: null, googleCalendarLastSyncedAt: null } });
    return this.status();
  }

  async sync(orderIds: string[]) {
    const stored = await this.prisma.storeSettings.findUnique({ where: { id: 1 } });
    if (!stored?.googleCalendarRefreshToken) throw new ConflictException('Primero vinculá Google Calendar.');
    const accessToken = await this.accessToken(stored);
    const orders = await this.prisma.order.findMany({ where: { id: { in: orderIds } }, include: { items: true } });
    const failures: { id: string; message: string }[] = [];
    let synced = 0;
    for (const order of orders) {
      try { await this.upsertEvent(order, stored.googleCalendarId ?? 'primary', accessToken); synced++; }
      catch (error) { failures.push({ id: order.id, message: error instanceof Error ? error.message : 'No se pudo sincronizar.' }); }
    }
    if (synced) await this.prisma.storeSettings.update({ where: { id: 1 }, data: { googleCalendarLastSyncedAt: new Date() } });
    return { requested: orderIds.length, synced, missing: orderIds.filter(id => !orders.some(order => order.id === id)), failures };
  }

  private async upsertEvent(order: CalendarOrder, calendarId: string, accessToken: string) {
    const eventId = createHash('sha256').update('porfin-carteles:' + order.id).digest('hex').slice(0, 32);
    const date = order.scheduledDate.toISOString().slice(0, 10), end = new Date(date + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 1);
    const status: Record<string, string> = { PENDING_CONFIRMATION: 'Por confirmar', CONFIRMED: 'Confirmado', IN_PRODUCTION: 'En producción', READY: 'Listo', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };
    const frontend = String(this.config.get('ALLOWED_ORIGINS') ?? '').split(',')[0];
    const body = { summary: `Pedido · ${order.customerName} · ${status[order.status] ?? order.status}`, description: [`Referencia: ${order.reference}`, `Estado: ${status[order.status] ?? order.status}`, `Entrega: ${order.deliveryMethod === 'SHIPPING' ? 'Envío por correo' : 'A coordinar en Santa Fe Capital'}`, '', ...order.items.map(item => `${item.quantity} × ${item.productName}`), '', `${frontend}/admin/pedidos/${order.id}`].join('\n'), start: { date }, end: { date: end.toISOString().slice(0, 10) }, extendedProperties: { private: { porfinOrderId: order.id } } };
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const update = await fetch(`${base}/${eventId}`, { method: 'PUT', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id: eventId }), signal: AbortSignal.timeout(12_000) });
    if (update.ok) return;
    if (update.status !== 404) throw new Error('Google Calendar rechazó el pedido ' + order.reference + '.');
    const insert = await fetch(base, { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id: eventId }), signal: AbortSignal.timeout(12_000) });
    if (!insert.ok) throw new Error('Google Calendar no pudo crear el pedido ' + order.reference + '.');
  }

  private async accessToken(stored: { googleCalendarAccessToken: string | null; googleCalendarRefreshToken: string | null; googleCalendarTokenExpiresAt: Date | null }) {
    const config = this.requireConfig();
    if (stored.googleCalendarAccessToken && stored.googleCalendarTokenExpiresAt && stored.googleCalendarTokenExpiresAt.getTime() > Date.now() + 60_000) return this.decrypt(stored.googleCalendarAccessToken, config.encryptionKey);
    if (!stored.googleCalendarRefreshToken) throw new ConflictException('Volvé a vincular Google Calendar.');
    const refreshed = await this.google<Tokens>('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: this.decrypt(stored.googleCalendarRefreshToken, config.encryptionKey), grant_type: 'refresh_token' }) });
    if (!refreshed.access_token) throw new ConflictException('Google Calendar perdió la autorización. Volvé a vincularlo.');
    await this.prisma.storeSettings.update({ where: { id: 1 }, data: { googleCalendarAccessToken: this.encrypt(refreshed.access_token, config.encryptionKey), googleCalendarTokenExpiresAt: new Date(Date.now() + Math.max(60, refreshed.expires_in ?? 3600) * 1000) } });
    return refreshed.access_token;
  }

  private requireConfig() { const value = this.settings(); if (!value.configured) throw new ServiceUnavailableException('La integración con Google Calendar todavía no está configurada.'); return value; }
  private sign(value: string, key: string) { return createHmac('sha256', Buffer.from(key, 'hex')).update(value).digest('base64url'); }
  private verifyState(state: string, sessionId: string, administratorId: string, key: string) {
    const [payload, signature, extra] = state.split('.');
    const provided = Buffer.from(signature ?? '');
    const expected = Buffer.from(payload ? this.sign(payload, key) : '');
    if (!payload || !signature || extra || provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new BadRequestException('La vinculación de Google venció o no es válida.');
    try { const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sessionId: string; administratorId: string; exp: number }; if (parsed.sessionId !== sessionId || parsed.administratorId !== administratorId || parsed.exp < Date.now()) throw new Error(); }
    catch { throw new BadRequestException('La vinculación de Google venció o no es válida.'); }
  }
  private encrypt(value: string, key: string) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv), encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.'); }
  private decrypt(value: string, key: string) { const [version, iv, tag, encrypted] = value.split('.'); if (version !== 'v1' || !iv || !tag || !encrypted) throw new ConflictException('Las credenciales guardadas no son válidas. Volvé a vincular Google Calendar.'); const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'base64url')); decipher.setAuthTag(Buffer.from(tag, 'base64url')); return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'); }
  private async google<T>(url: string, init: RequestInit): Promise<T> { let response: Response; try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) }); } catch { throw new BadGatewayException('No pudimos comunicarnos con Google. Intentá nuevamente.'); } const data = await response.json().catch(() => ({})) as T; if (!response.ok) throw new BadGatewayException('Google rechazó la vinculación. Intentá nuevamente.'); return data; }
}
