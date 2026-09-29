export interface ApiConfig {
  backendUrl: string;
  webOrigin: string;
}

export function readApiConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  const backend = new URL(env.BACKEND_API_URL ?? 'http://127.0.0.1:3001/api/v1');
  const origin = new URL(env.WEB_ORIGIN ?? 'http://localhost:3000');
  for (const url of [backend, origin]) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Configuración HTTP del frontend inválida.');
    }
  }
  if (origin.pathname !== '/' || backend.pathname.replace(/\/$/, '') !== '/api/v1') {
    throw new Error('WEB_ORIGIN debe ser un origen y BACKEND_API_URL debe terminar en /api/v1.');
  }
  // next start también se usa localmente; fuera de loopback se exige HTTPS.
  for (const url of [backend, origin]) {
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Las conexiones fuera del equipo local requieren HTTPS.');
    }
  }
  return { backendUrl: backend.href.replace(/\/$/, ''), webOrigin: origin.origin };
}
