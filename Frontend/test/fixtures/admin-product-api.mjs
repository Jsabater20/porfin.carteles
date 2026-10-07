// Fixture local para crear productos y confirmar imágenes, sin base de datos ni proveedor real.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

export async function startAdminProductApi(port = 3101) {
  let sequence = 0;
  const id = () => 'c' + String(++sequence).padStart(24, '0');
  const state = { products: new Map(), uploads: new Map(), creates: 0, completes: [], failCompleteOnce: false, signatureUnavailable: false };
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname.replace('/api/v1/', '');
    const send = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); };
    if (path === 'health') return send(200, { status: 'ok' });
    if (!request.headers.cookie?.includes('porfin_session=fixture-admin')) return send(401, { message: 'Sesión requerida.' });
    if (path === 'auth/me') return send(200, { admin: { id: 'fixture-admin', name: 'Administradora', email: 'admin@example.test', role: 'OWNER', active: true }, csrfToken: 'fixture-csrf', expiresAt: new Date(Date.now() + 3600000).toISOString() });
    if (path === 'admin/categories' || path === 'admin/careers') return send(200, { items: [], page: 1, limit: 100, total: 0 });
    if (request.method !== 'GET' && request.headers['x-csrf-token'] !== 'fixture-csrf') return send(403, { message: 'CSRF requerido.' });
    let raw = ''; for await (const chunk of request) raw += chunk;
    const input = raw ? JSON.parse(raw) : {};
    if (path === 'admin/products' && request.method === 'POST') {
      state.creates++;
      const product = { ...input, id: id(), categories: [], careers: [], images: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        variants: input.variants.map((variant, position) => ({ ...variant, id: id(), position })), fields: [], components: [] };
      state.products.set(product.id, product);
      return send(201, product);
    }
    if (path === 'admin/media/upload-signature') {
      if (state.signatureUnavailable) return send(503, { message: 'Cargas temporalmente no disponibles.' });
      const uploadId = randomUUID();
      state.uploads.set(uploadId, { productId: input.productId });
      return send(201, { uploadId, expiresAt: new Date(Date.now() + 600000).toISOString(), maxBytes: 5242880, formats: ['png'], uploadUrl: 'https://api.cloudinary.com/v1_1/test-cloud/image/upload', apiKey: 'fixture-key', signature: 'fixture-signature', params: { timestamp: Math.floor(Date.now()/1000), public_id: uploadId, upload_preset: 'fixture', overwrite: false, allowed_formats: 'jpg,png,webp' } });
    }
    if (path === 'admin/media/complete') {
      state.completes.push(input);
      if (state.failCompleteOnce) { state.failCompleteOnce = false; return send(503, { message: 'Verificación temporalmente no disponible.' }); }
      const upload = state.uploads.get(input.uploadId);
      if (!upload) return send(404, { message: 'Carga inexistente.' });
      const product = state.products.get(upload.productId);
      if (!upload.image) {
        upload.image = { id: id(), url: 'https://res.cloudinary.com/test-cloud/image/upload/fixture.png', altText: input.altText, shape: input.shape, position: product.images.length, cover: product.images.length === 0, width: 1, height: 1 };
        product.images.push(upload.image);
      }
      return send(200, upload.image);
    }
    const match = /^admin\/products\/(c[a-z0-9]{24})(\/images)?$/.exec(path);
    if (match && request.method === 'GET') {
      const product = state.products.get(match[1]);
      return product ? send(200, match[2] ? product.images : product) : send(404, { message: 'Producto inexistente.' });
    }
    return send(404, { message: 'Ruta no simulada: ' + path });
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { state, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
