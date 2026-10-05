// Contratos de prueba locales; nunca se escriben en la base de datos.
import { createServer } from 'node:http';
import { replyPreview } from './preview-api.mjs';
import { replyOrder } from './orders-api.mjs';

export const settings = {
  storeName: 'Por fin Carteles · Pruebas', description: 'Celebraciones de prueba',
  whatsappNumber: '5491112345678', whatsappUrl: 'https://wa.me/5491112345678', contactEmail: 'pruebas@example.test',
  instagramUrl: null, facebookUrl: null, tiktokUrl: null, pickupAddress: 'Dirección de prueba',
  deliveryMethods: ['PICKUP', 'SHIPPING'], deliveryNotes: 'Entrega a coordinar.', leadTimeText: 'Fecha a confirmar.', businessHours: 'Lunes a viernes',
};
const categories = Array.from({ length: 52 }, (_, index) => ({ id: 'cat-' + index, name: index === 0 ? 'Recibidas' : 'Ocasión ' + index, slug: 'ocasion-' + index }));
const career = { id: 'career-1', name: 'Medicina', slug: 'medicina' };
const variant = (id, mode, price) => ({ id, key: id, name: mode === 'QUOTE' ? 'Diseño especial' : 'Modelo clásico', pricingMode: mode, priceCents: price, attributes: { Tamaño: 'Grande' }, photoCount: mode === 'QUOTE' ? 3 : 0 });
export const products = Array.from({ length: 25 }, (_, index) => ({
  id: 'product-' + index, slug: 'producto-' + index, name: ['Cartel de recibida', 'Cartel personalizado', 'Combo de celebración'][index] ?? 'Cartel ' + String(index).padStart(2, '0'),
  category: index === 2 ? 'COMBO' : 'CARTEL',
  type: index === 1 ? 'CUSTOM' : index === 2 ? 'COMBO' : 'PREDEFINED', leadTime: 'Consultar disponibilidad',
  categories: [categories[0]], careers: [career], coverImage: null,
  basePrice: { currency: 'ARS', fromCents: index === 1 ? null : 12345, toCents: index === 1 ? null : 12345, hasQuoteVariants: index <= 1 },
  description: 'Una propuesta de prueba para celebrar.', measurements: '60 × 40 cm', materials: 'Material de prueba', includes: 'Cartel y detalles',
  images: [], variants: index === 1 ? [variant('quote', 'QUOTE', null)] : [variant('fixed', 'FIXED', 12345), ...(index === 0 ? [variant('quote', 'QUOTE', null)] : [])],
  fields: [{ key: 'name', label: 'Nombre para el cartel', type: 'SHORT_TEXT', required: true, position: 0, componentKey: index === 2 ? 'cartel' : null, minLength: 1, maxLength: 80, minValue: null, maxValue: null, options: [] }],
  components: index === 2 ? [{ key: 'cartel', name: 'Cartel principal', quantity: 1, position: 0 }, { key: 'props', name: 'Accesorios', quantity: 3, position: 1 }] : [],
}));
export const editorial = (page) => ({
  page, title: { home: 'Celebraciones con tu toque', about: 'Nuestra historia', contact: 'Hablemos de tu celebración', faq: 'Preguntas frecuentes' }[page],
  subtitle: 'Información publicada de prueba.', body: page === 'about' ? '<script>alert("contenido")</script> se muestra como texto.' : '',
  sections: [{ key: 'info', heading: 'Detalles para vos', text: 'Primera línea.\nSegunda línea.' }],
  faqItems: page === 'faq' ? [{ key: 'fotos', question: '¿Cómo envío mis fotos?', answer: 'Las fotos se coordinan por WhatsApp.' }] : [],
  featuredProducts: page === 'home' ? [products[2], products[1]] : [],
});

export async function startFixtureApi(port = 3101) {
  const state = { unavailable: false, unpublished: false, requests: [], guestBootstraps: 0, previewFailures: 0, priceDelta: 0, previewTtl: 900000, previewCalls: [], previews: new Map(), unavailableProducts: new Set(), orders: new Map(), orderKeys: new Map(), orderCalls: [], orderLoseResponse: false, orderReject: null, orderReadDenied: false, orderNoWhatsapp: false };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    state.requests.push(url.pathname + url.search);
    const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
    if (state.unavailable || url.searchParams.get('q') === 'api-caida') return send(503, { message: 'No disponible.' });
    const path = url.pathname.replace('/api/v1/', '');
    if (path === 'guest-session' || path === 'orders/preview') return replyPreview(request, response, state, products, path);
    if (path === 'orders' || /^orders\/c[a-z0-9]{24}$/.test(path)) return replyOrder(request, response, state, settings, path);
    if ((path === 'health' || path === 'health/ready')) return send(200, { status: 'ok' });
    if (path === 'settings/public') return send(200, settings);
    if (path === 'categories' || path === 'careers' || path === 'occasions') {
      const all = path !== 'careers' ? categories : [career];
      const limit = Number(url.searchParams.get('limit') || 24), page = Number(url.searchParams.get('page') || 1);
      return send(200, { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit });
    }
    if (path === 'products') {
      let all = products.filter((item) => !url.searchParams.get('q') || item.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase()));
      if (url.searchParams.get('category')) all = all.filter(item => item.category === url.searchParams.get('category'));
      for (const key of ['type', 'categoryId', 'careerId', 'occasion', 'career']) {
        const value = url.searchParams.get(key);
        if (value) all = all.filter((item) => key === 'type' ? item.type === value : item[key === 'categoryId' || key === 'occasion' ? 'categories' : 'careers'].some((taxonomy) => taxonomy.id === value));
      }
      const sort = url.searchParams.get('sort');
      if (sort?.startsWith('name-')) all = [...all].sort((a, b) => a.name.localeCompare(b.name) * (sort === 'name-desc' ? -1 : 1));
      const limit = Number(url.searchParams.get('limit') || 24), page = Number(url.searchParams.get('page') || 1);
      return send(200, { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit });
    }
    if (path.startsWith('products/')) {
      const item = products.find((item) => item.slug === path.slice(9));
      return item ? send(200, item) : send(404, { message: 'No encontrado.' });
    }
    if (/^content\/(home|about|contact|faq)$/.test(path)) return state.unpublished ? send(404, { message: 'No publicado.' }) : send(200, editorial(path.slice(8)));
    return send(404, { message: 'No encontrado.' });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { state, close: () => new Promise((resolve) => server.close(resolve)) };
}
