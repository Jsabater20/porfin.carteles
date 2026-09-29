# Etapa 11: contenido y configuración

Endpoints con prefijo `/api/v1`. Los administradores OWNER y ADMIN editan contenido y datos públicos comerciales; las credenciales externas siguen exclusivamente en variables de entorno.

## Páginas

- `GET /content/:page`: página publicada; page es home, about, contact o faq. Una página sin publicar devuelve 404; una clave desconocida, 400.
- `GET /admin/content`: páginas, claves disponibles y orden de destacados.
- `PATCH /admin/content`: edición parcial. Cookie administrativa, `X-Requested-With: porfin-admin` y `X-CSRF-Token` obligatorios.

```json
{
  "page": "home",
  "title": "Por fin!",
  "subtitle": "Carteles y combos para celebrar",
  "body": "Texto de presentación",
  "sections": [{ "key": "personalizados", "heading": "A tu medida", "text": "Contanos tu idea." }],
  "featuredProductIds": ["ID_PRODUCTO_PUBLICADO"],
  "published": true
}
```

Los campos omitidos se conservan. Los textos son **texto plano**: React debe renderizarlos como texto, sin interpretar HTML. Los límites son 200 caracteres de título, 500 de subtítulo, 10.000 de cuerpo, 20 secciones y 30 preguntas. Publicar requiere título; FAQ requiere además una pregunta.

```json
{
  "page": "faq",
  "title": "Preguntas frecuentes",
  "faqItems": [{ "key": "fotos", "question": "¿Cómo envío las fotos?", "answer": "Por WhatsApp después de crear el pedido." }],
  "published": true
}
```

`sections`, `faqItems` y `featuredProductIds` reemplazan su lista completa; [] la vacía. Las claves de sección/pregunta deben ser únicas. Los destacados se editan únicamente en home, con máximo 12 productos distintos publicados y con variantes activas. La respuesta pública incluye tarjetas de catálogo en ese orden; si después se ocultan o quedan sin variantes activas, dejan de aparecer automáticamente.

La modificación de la página y su lista de destacados es atómica. Si un producto no es válido, no se guarda ninguna parte del cambio.

## Configuración de la tienda

- `GET /settings/public`: datos comerciales públicos, sin IDs internos, secretos o metadatos administrativos. Devuelve valores vacíos/defaults sin escribir en la base cuando todavía no se configuró.
- `GET /admin/settings`: configuración editable.
- `PATCH /admin/settings`: modificación parcial con los mismos permisos y encabezados privados.

```json
{
  "storeName": "Por fin!",
  "description": "Carteles y combos personalizados",
  "whatsappNumber": "5491123456789",
  "contactEmail": "contacto@example.com",
  "instagramUrl": "https://www.instagram.com/tu-cuenta",
  "facebookUrl": null,
  "tiktokUrl": null,
  "deliveryMethods": ["PICKUP", "SHIPPING"],
  "pickupAddress": "Consultar punto de retiro",
  "deliveryNotes": "Envío a confirmar",
  "leadTimeText": "Consultar disponibilidad para tu fecha",
  "businessHours": "Lunes a viernes"
}
```

El ejemplo es ilustrativo: no se cargaron contactos reales. WhatsApp usa de 8 a 15 dígitos internacionales, sin +. El email y las URLs admiten null para borrarlos. Las redes requieren HTTPS y no admiten credenciales embebidas. El número genera `whatsappUrl` y es el destinatario de los enlaces de pedidos nuevos. Cambiarlo no reescribe los pedidos históricos.

La entrega y los plazos son información comercial, no una reserva de fecha ni una tarifa automática. `deliveryMethods: []` significa aún sin restricción configurada; con una lista, los pedidos nuevos deben usar una modalidad de esa lista. Los textos de plazos no garantizan disponibilidad de producción.

No se aceptan campos arbitrarios de entorno, SMTP, Cloudinary, base de datos o autenticación. La configuración externa se realizará después de terminar las etapas.

## Pruebas

Desde backend: `npm.cmd run test:content`. Prueba con PostgreSQL real en un esquema aislado páginas borrador/publicadas, validación profunda, permisos y CSRF, destacados, datos públicos, edición parcial, rollback y sesiones revocadas. Swagger publica estos endpoints en `/api/v1/docs`.