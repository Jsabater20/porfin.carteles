import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const opaqueToken = () => randomBytes(32).toString('hex');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const csrfToken = (session: string) => tokenHash(`porfin-csrf:${session}`);
export const validToken = (token: unknown): token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export function equalTokens(a: unknown, b: string): boolean {
  return validToken(a) && validToken(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  const parts = stored?.split('$');
  const valid = parts?.length === 3 && parts[0] === 'scrypt-v1' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  // Una cuenta inexistente realiza el mismo trabajo criptográfico.
  const actual = await derive(password, valid ? parts[1] : '0'.repeat(32));
  const expected = Buffer.from(valid ? parts[2] : '0'.repeat(128), 'hex');
  return timingSafeEqual(actual, expected) && !!valid;
}
