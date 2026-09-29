export function validateEnvironment(env: Record<string, unknown>) {
  const nodeEnv = String(env.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV debe ser development, test o production.');
  }
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un puerto válido.');
  }
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    try {
      const url = new URL(String(env[name] ?? ''));
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error();
      if (nodeEnv === 'production' && (url.searchParams.getAll('sslmode').length !== 1 || url.searchParams.get('sslmode') !== 'require' || url.searchParams.getAll('sslaccept').length !== 1 || url.searchParams.get('sslaccept') !== 'strict')) throw new Error();
    } catch {
      throw new Error(`${name} debe ser una URL de PostgreSQL con una base de datos; en producción requiere sslmode=require y sslaccept=strict.`);
    }
  }
  const origins = String(env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error('Configurá ALLOWED_ORIGINS con los orígenes exactos del frontend.');
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || (nodeEnv === 'production' && url.protocol !== 'https:')) throw new Error();
    } catch {
      throw new Error('ALLOWED_ORIGINS debe contener orígenes exactos; en producción deben usar HTTPS.');
    }
  }
  const swagger = String(env.SWAGGER_ENABLED ?? (nodeEnv === 'production' ? 'false' : 'true'));
  if (!['true', 'false'].includes(swagger)) throw new Error('SWAGGER_ENABLED debe ser true o false.');
  if (nodeEnv === 'production' && !env.API_ORIGIN) throw new Error('Configurá API_ORIGIN explícitamente en producción.');
  const apiOrigin = String(env.API_ORIGIN ?? (nodeEnv === 'production' ? origins[0] : `http://localhost:${port}`));
  const resetUrl = String(env.PASSWORD_RESET_URL ?? `${origins[0]}/admin/reset-password`);
  for (const [name, value] of [['API_ORIGIN', apiOrigin], ['PASSWORD_RESET_URL', resetUrl]]) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (nodeEnv === 'production' && url.protocol !== 'https:') || (name === 'API_ORIGIN' && url.origin !== value) || (name === 'PASSWORD_RESET_URL' && (url.hash || url.search))) throw new Error();
    } catch { throw new Error(`${name} debe ser una URL válida; HTTPS en producción.`); }
  }
  if (!origins.includes(new URL(resetUrl).origin)) throw new Error('PASSWORD_RESET_URL debe pertenecer a un origen permitido del frontend.');
  const sessionTtl = Number(env.SESSION_TTL_HOURS ?? 8);
  if (!Number.isInteger(sessionTtl) || sessionTtl < 1 || sessionTtl > 24) throw new Error('SESSION_TTL_HOURS debe estar entre 1 y 24.');
  const sameSite = String(env.SESSION_SAME_SITE ?? 'lax');
  if (!['lax', 'strict', 'none'].includes(sameSite) || (sameSite === 'none' && nodeEnv !== 'production')) throw new Error('SESSION_SAME_SITE inválido; none requiere HTTPS en producción.');
  const proxyHops = Number(env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 2) throw new Error('TRUST_PROXY_HOPS debe estar entre 0 y 2.');
  const mailMode = String(env.MAIL_MODE ?? (nodeEnv === 'production' ? 'disabled' : 'file'));
  if (!['file', 'smtp', 'disabled'].includes(mailMode) || (nodeEnv === 'production' && mailMode === 'file')) throw new Error('MAIL_MODE inválido; el buzón local está prohibido en producción.');
  const smtpPort = Number(env.SMTP_PORT ?? 587);
  const smtpSecure = String(env.SMTP_SECURE ?? 'false');
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535 || !['true', 'false'].includes(smtpSecure)) throw new Error('Configuración SMTP inválida.');
  if (mailMode === 'smtp' && ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'].some(key => !String(env[key] ?? '').trim())) throw new Error('Configurá SMTP_HOST, SMTP_USER, SMTP_PASSWORD y MAIL_FROM.');
  if (nodeEnv === 'production' && env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('No se permite desactivar la verificación TLS en producción.');
  const cloudKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_UPLOAD_PRESET'];
  const cloudValues = cloudKeys.map(key => String(env[key] ?? '').trim());
  if (cloudValues.some(Boolean) && cloudValues.some(value => !value)) throw new Error('Configurá las cuatro variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET y CLOUDINARY_UPLOAD_PRESET, o dejá todas vacías.');
  if (cloudValues[0] && (!/^[a-zA-Z0-9_-]+$/.test(cloudValues[0]) || !/^[a-zA-Z0-9_-]+$/.test(cloudValues[3]))) throw new Error('El nombre de Cloudinary y del preset deben usar letras, números, guiones o guiones bajos.');

  return { ...env, CLOUDINARY_CLOUD_NAME: cloudValues[0], CLOUDINARY_API_KEY: cloudValues[1], CLOUDINARY_API_SECRET: cloudValues[2], CLOUDINARY_UPLOAD_PRESET: cloudValues[3], NODE_ENV: nodeEnv, PORT: port, ALLOWED_ORIGINS: origins.join(','), SWAGGER_ENABLED: swagger === 'true', API_ORIGIN: apiOrigin, PASSWORD_RESET_URL: resetUrl, SESSION_TTL_HOURS: sessionTtl, SESSION_SAME_SITE: sameSite, TRUST_PROXY_HOPS: proxyHops, MAIL_MODE: mailMode, SMTP_PORT: smtpPort, SMTP_SECURE: smtpSecure === 'true' };
}
