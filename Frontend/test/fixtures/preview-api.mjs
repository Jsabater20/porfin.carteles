import { randomUUID } from 'node:crypto';

export async function replyPreview(request, response, state, products, path) {
  const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  if (path === 'guest-session') {
    state.guestBootstraps++;
    response.setHeader('Set-Cookie', 'porfin_guest=fixture-guest; Path=/; HttpOnly; SameSite=Lax');
    return send(200, { csrfToken: 'fixture-csrf', expiresAt: new Date(Date.now() + 3600_000).toISOString() });
  }
  if (!request.headers.cookie?.includes('porfin_guest=fixture-guest')) return send(401, { message: 'Sesión vencida.' });
  if (request.headers['x-csrf-token'] !== 'fixture-csrf') return send(403, { message: 'CSRF inválido.' });
  let raw = ''; for await (const chunk of request) raw += chunk;
  const input = JSON.parse(raw), key = request.headers['idempotency-key'];
  state.previewCalls.push({ key, input });
  if (state.previewFailures > 0) { state.previewFailures--; return send(503, { message: 'Interrupción simulada.' }); }
  const previous = state.previews.get(key);
  if (previous) {
    if (previous.input !== raw) return send(409, { message: 'Clave con otro contenido.' });
    if (Date.parse(previous.result.expiresAt) <= Date.now()) return send(410, { message: 'Venció.' });
    return send(200, previous.result);
  }
  const errors = [];
  const items = input.items.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    const variant = product?.variants.find((item) => item.id === line.variantId);
    if (!product || !variant || state.unavailableProducts.has(line.productId)) { errors.push('Línea ' + line.lineId + ': Producto o variante no disponible.'); return []; }
    const answers = line.answers.map((answer) => {
      const field = product.fields.find((field) => field.key === answer.fieldKey);
      return { ...answer, label: field?.label ?? answer.fieldKey, type: field?.type ?? 'SHORT_TEXT', componentKey: field?.componentKey ?? null, displayValue: field?.options.find((option) => option.key === answer.value)?.label ?? answer.value };
    });
    const selectedOptions = answers.filter((answer) => answer.type === 'SELECT').flatMap((answer) => {
      const field = product.fields.find((field) => field.key === answer.fieldKey), option = field?.options.find((option) => option.key === answer.value);
      return option ? [{ fieldKey: field.key, optionKey: option.key, label: option.label, additionalCents: option.additionalCents }] : [];
    });
    const additionalUnitCents = selectedOptions.reduce((sum, option) => sum + option.additionalCents, 0);
    const baseUnitCents = variant.priceCents === null ? null : variant.priceCents + state.priceDelta;
    const unitPriceCents = baseUnitCents === null ? null : baseUnitCents + additionalUnitCents;
    return [{
      lineId: line.lineId, productId: product.id, productName: product.name, slug: product.slug, type: product.type,
      variantId: variant.id, variantName: variant.name, variantAttributes: variant.attributes, quantity: line.quantity, currency: 'ARS',
      pricingMode: variant.pricingMode, status: unitPriceCents === null ? 'PENDING_QUOTE' : 'PRICED',
      baseUnitCents, additionalUnitCents, unitPriceCents, subtotalCents: unitPriceCents === null ? null : unitPriceCents * line.quantity,
      selectedOptions, answers, components: product.components, photoCountPerUnit: variant.photoCount, photoCountTotal: variant.photoCount * line.quantity,
      photoDelivery: !variant.photoCount ? 'NONE' : product.category === 'CARTEL' && ['GENERIC', 'PREDEFINED'].includes(product.type) && variant.photoCount === 3 ? 'EMAIL' : 'WHATSAPP',
    }];
  });
  if (errors.length) return send(422, { message: errors });
  const result = { id: randomUUID(), expiresAt: new Date(Date.now() + state.previewTtl).toISOString(), currency: 'ARS', items,
    summary: { knownSubtotalCents: items.reduce((sum, item) => sum + (item.subtotalCents ?? 0), 0), pendingQuoteLines: items.filter((item) => item.unitPriceCents === null).length, pendingQuoteQuantity: items.filter((item) => item.unitPriceCents === null).reduce((sum, item) => sum + item.quantity, 0), totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      shipping: { method: input.deliveryMethod, status: input.deliveryMethod === 'PICKUP' ? 'NOT_REQUIRED' : 'TO_CONFIRM', amountCents: input.deliveryMethod === 'PICKUP' ? 0 : null }, finalTotalCents: null, status: 'PENDING_CONFIRMATION' } };
  state.previews.set(key, { input: raw, result });
  return send(200, result);
}
