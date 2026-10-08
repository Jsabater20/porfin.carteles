import { randomUUID } from 'node:crypto';

export async function replyOrder(request, response, state, settings, path) {
  const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  if (state.orderReadDenied || !request.headers.cookie?.includes('porfin_guest=fixture-guest')) return send(401, { message: 'Sesión vencida.' });
  if (request.method === 'GET') {
    const order = state.orders.get(path.slice(7));
    return order ? send(200, order) : send(404, { message: 'Pedido no encontrado.' });
  }
  if (request.headers['x-csrf-token'] !== 'fixture-csrf') return send(403, { message: 'CSRF inválido.' });
  let raw = ''; for await (const chunk of request) raw += chunk;
  const input = JSON.parse(raw), key = request.headers['idempotency-key'];
  state.orderCalls.push({ key, input });
  const previous = state.orderKeys.get(key);
  if (previous) return previous.raw === raw ? send(200, previous.order) : send(409, { message: 'La clave de idempotencia ya se usó con otro pedido.' });
  if (state.orderReject) { const rejection = state.orderReject; state.orderReject = null; return send(rejection.status, { message: rejection.message }); }
  const preview = [...state.previews.values()].find((entry) => entry.result.id === input.previewId)?.result;
  if (!preview) return send(404, { message: 'Validación no encontrada.' });
  if (Date.parse(preview.expiresAt) <= Date.now()) return send(410, { message: 'La validación venció.' });
  if (!input.customerFirstName || !input.customerLastName || !input.customerEmail || !input.customerBirthDate || !input.customerPhone || !input.requestedDate || !['PICKUP', 'SHIPPING'].includes(input.deliveryMethod) || input.deliveryMethod !== preview.summary.shipping.method) return send(400, { message: 'Datos incompletos.' });
  const reference = 'CAR-' + randomUUID().toUpperCase();
  const money = (cents) => (cents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  const purchase = preview.items.flatMap((item) => [
    item.quantity + ' × ' + item.productName + ' (' + item.variantName + '): ' + (item.subtotalCents === null ? 'A cotizar' : money(item.subtotalCents)),
    ...(item.type === 'CUSTOM' ? item.answers.filter((answer) => answer.fieldKey === 'idea').map((answer) => '  ' + answer.label + ': ' + answer.displayValue) : []),
  ]).join('\n');
  const message = 'Hola Por fin Carteles! Quisiera consultar este pedido:\n' + purchase + '\n\nNombre: ' + input.customerFirstName + '\nApellido: ' + input.customerLastName + '\nLo necesitaría para: ' + input.requestedDate.split('-').reverse().join('/') + '\nEntrega: ' + (input.deliveryMethod === 'PICKUP' ? 'Retiro' : 'Envío (correo)') + '\nSubtotal: ' + money(preview.summary.knownSubtotalCents);
  const order = {
    id: 'c' + randomUUID().replaceAll('-', '').slice(0, 24), reference, status: 'PENDING_CONFIRMATION',
    customerName: input.customerFirstName + ' ' + input.customerLastName, customerFirstName: input.customerFirstName, customerLastName: input.customerLastName, customerEmail: input.customerEmail, customerBirthDate: input.customerBirthDate || null, customerPhone: input.customerPhone || '', requestedDate: input.requestedDate + 'T00:00:00.000Z',
    deliveryMethod: input.deliveryMethod, deliveryAddress: input.deliveryAddress ?? null, notes: input.notes ?? null,
    knownSubtotalCents: preview.summary.knownSubtotalCents, pendingQuoteCount: preview.summary.pendingQuoteLines, shippingCents: preview.summary.shipping.amountCents,
    createdAt: new Date().toISOString(), idempotencyKey: key,
    items: preview.items.map((item, index) => ({ id: 'item-' + index, productId: item.productId, productName: item.productName, variantName: item.variantName, quantity: item.quantity, unitPriceCents: item.unitPriceCents, subtotalCents: item.subtotalCents,
      snapshot: { variant: { photoCount: item.photoCountPerUnit, photoDelivery: item.photoDelivery }, customization: { answers: item.answers }, components: item.components } })),
    whatsapp: { url: state.orderNoWhatsapp ? null : 'https://wa.me/' + settings.whatsappNumber + '?text=' + encodeURIComponent(message), message },
  };
  state.orders.set(order.id, order); state.orderKeys.set(key, { raw, order });
  if (state.orderLoseResponse) { state.orderLoseResponse = false; return send(503, { message: 'Respuesta perdida después de registrar.' }); }
  return send(200, order);
}
