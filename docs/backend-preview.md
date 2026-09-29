# Etapa 6: sesión invitada y validación del carrito

Implementación en `backend/src/modules/guest-sessions` y `backend/src/modules/orders`. La validación guarda un resumen temporal; **no crea un pedido, no reserva disponibilidad y no confirma precios finales ni pagos**.

Railway, Neon, Cloudinary y SMTP se configurarán al terminar las etapas. Las pruebas de esta etapa usan únicamente PostgreSQL local.

## Sesión de invitado

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | `/api/v1/guest-session` | Crea o recupera la sesión; devuelve `expiresAt` y `csrfToken`. Enviar `{}`. |
| DELETE | `/api/v1/guest-session` | Revoca la sesión, elimina sus previews y borra su cookie (204). Enviar `{}`. |
| POST | `/api/v1/orders/preview` | Valida y guarda un resumen temporal (200). |
| GET | `/api/v1/orders/previews/:id` | Recupera un resumen vigente de la sesión actual. |

La cookie contiene un token aleatorio de 256 bits. PostgreSQL guarda únicamente su hash SHA-256. La cookie es `HttpOnly`, `Path=/`, sin dominio y `Secure` en producción. Se llama `porfin_guest` en desarrollo y `__Host-porfin_guest` en producción; usa `SESSION_SAME_SITE` (por defecto `lax`).

La sesión dura **7 días desde su creación**, sin prolongación automática. Repetir el POST con una cookie válida conserva la sesión y permite recuperar el CSRF. Una cookie vencida, revocada, ambigua o desconocida produce una nueva sesión, con un token generado por el servidor.

La sesión invitada y la administrativa son independientes. Ninguna permite acceder a las operaciones de la otra.

### Encabezados

Las escrituras de la tienda requieren:

```text
Content-Type: application/json
X-Requested-With: porfin-storefront
```

Después de crear la sesión, DELETE de sesión y POST de preview requieren además:

```text
X-CSRF-Token: <csrfToken recibido>
```

El POST de preview también requiere:

```text
Idempotency-Key: <UUID v4>
```

El navegador debe usar `credentials: 'include'`. No leerá la cookie HttpOnly. Mantener el CSRF en memoria y recuperarlo mediante el POST de sesión si se recarga la aplicación.

Los orígenes se comprueban con `ALLOWED_ORIGINS` y `API_ORIGIN`. El encabezado de administración continúa siendo `porfin-admin`; no se modifican sus permisos ni su CSRF.

## Entrada del preview

```json
{
  "deliveryMethod": "SHIPPING",
  "items": [
    {
      "lineId": "cartel-ana",
      "productId": "ID_DEL_PRODUCTO",
      "variantId": "ID_DE_LA_VARIANTE",
      "quantity": 2,
      "answers": [
        { "fieldKey": "nombre", "value": "Ana" },
        { "fieldKey": "edad", "value": 25 },
        { "fieldKey": "color", "value": "dorado" }
      ]
    }
  ]
}
```

- Entre 1 y 30 renglones; cantidad entera entre 1 y 100 por renglón.
- `lineId` identifica el renglón del carrito: entre 1 y 80 letras ASCII, números, guiones o guiones bajos. Debe ser único en el pedido de validación.
- El mismo producto puede aparecer varias veces con nombres o frases diferentes. Los renglones se conservan separados.
- Hasta 30 respuestas por renglón, con claves únicas. `answers` puede omitirse si no se necesita personalización.
- `value` acepta texto o número; no objetos, archivos, listas ni booleanos.
- `deliveryMethod`: `UNDECIDED` (por defecto), `PICKUP` o `SHIPPING`.
- Se rechazan propiedades adicionales, incluidos precios, subtotales, IDs de sesión o URLs de fotos enviados por el navegador.
- Se mantiene el límite global de cuerpo JSON de 1 MiB.

El backend consulta el catálogo y comprueba producto publicado, variante activa y perteneciente al producto, cantidad y personalización. Todos los renglones se leen dentro del mismo snapshot de PostgreSQL.

### Personalización

- Solo se aceptan campos definidos en ese producto.
- Los obligatorios deben estar presentes y no pueden contener solo espacios.
- Textos: normalización Unicode NFC, recorte de espacios externos y límites configurados. Máximos generales: 240 caracteres para `SHORT_TEXT` y 2000 para `LONG_TEXT`.
- Números: valores JSON numéricos finitos, dentro de los límites configurados. Cero es válido cuando los límites lo permiten; un texto como `"25"` no se convierte automáticamente.
- Selecciones: `value` es la clave de una opción del campo. El backend obtiene su etiqueta y adicional actuales.
- Los campos opcionales vacíos se omiten. Las claves desconocidas o repetidas se rechazan.
- Se rechazan NUL y sustitutos Unicode aislados que PostgreSQL no puede representar.
- La vinculación con componentes de combos proviene del catálogo, nunca de un dato proporcionado por el cliente.

Se devuelven los errores de personalización y disponibilidad indicando `lineId`. Si algún renglón falla, no se guarda una validación parcial ni se consume su clave idempotente.

**Fotos y referencias:** según el documento original, el cliente las enviará por WhatsApp. El preview informa `photoCountPerUnit`, `photoCountTotal` y `photoDelivery: "WHATSAPP"` o `"NONE"`. No se exige ni se autoriza una carga de archivos del cliente en esta etapa.

## Resultado y precios

Cada renglón contiene nombres e IDs de producto/variante, cantidad, respuestas normalizadas y sus etiquetas, componentes del combo, adicionales resueltos y precios actuales calculados por `PricingService`.

```json
{
  "id": "UUID_DE_LA_VALIDACION",
  "expiresAt": "2026-09-24T18:15:00.000Z",
  "currency": "ARS",
  "items": [],
  "summary": {
    "knownSubtotalCents": 4000000,
    "pendingQuoteLines": 1,
    "pendingQuoteQuantity": 2,
    "totalQuantity": 4,
    "shipping": {
      "method": "SHIPPING",
      "status": "TO_CONFIRM",
      "amountCents": null
    },
    "finalTotalCents": null,
    "status": "PENDING_CONFIRMATION"
  }
}
```

En este ejemplo se omitió el contenido de `items` para mostrar el resumen.

Los importes son centavos enteros de ARS. El subtotal conocido suma únicamente renglones `FIXED`. Los `QUOTE` mantienen sus importes finales en `null` y se cuentan por separado. El combo usa el precio de su propia variante.

Con retiro, `shipping.amountCents` es 0 y su estado es `NOT_REQUIRED`. Con envío o entrega aún no definida, el importe es `null` y el estado `TO_CONFIRM`. El total final siempre es `null`: el resumen no equivale a una confirmación comercial.

La validación vence a los **15 minutos**, o antes si vence la sesión. El frontend puede comparar la respuesta con el carrito que tenía guardado para mostrar cambios de precio antes de continuar.

## Reintentos y privacidad

Generar un UUID v4 nuevo al validar una versión del carrito y reutilizarlo exclusivamente para reintentar esa misma operación.

- Misma sesión, clave y contenido: devuelve exactamente el preview original, incluso con solicitudes simultáneas.
- Misma clave con un carrito o modalidad de entrega diferentes: 409.
- El orden de las propiedades JSON y de las respuestas de un renglón no altera la clave lógica. Los textos se normalizan antes de calcular el hash.
- La misma clave en dos sesiones pertenece a operaciones distintas.
- Si el preview venció: 410; recalcular con una clave nueva.
- Un cambio de precio posterior no modifica el resultado de un reintento. **Una clave nueva vuelve a leer el catálogo.** Al crear el pedido en la etapa 7 se deberá revalidar todo, aunque exista un preview.
- GET de preview exige la sesión propietaria. Una sesión ajena obtiene 404.
- Revocar la sesión elimina sus previews y claves asociadas. Una sesión nueva no puede consultar los anteriores.

Las tablas `GuestSession`, `OrderPreview`, `IdempotentRequest` y `GuestRateLimit` permiten que estas reglas funcionen entre réplicas y sobrevivan a reinicios. No se almacenan tokens en claro ni IPs en claro.

La limpieza automática se ejecuta cada 15 minutos con la API activa: elimina sesiones vencidas/revocadas, contadores vencidos y previews que llevan más de 24 horas vencidos. Ese margen conserva las claves para detectar reintentos tardíos; tras la purga dejan de existir. Cerrar sesión elimina sus datos temporales inmediatamente.

## Límites y errores

- Inicio/recuperación de sesión: 30 solicitudes por IP y hora.
- Preview: 120 solicitudes por IP y 60 por sesión cada 15 minutos.
- 400: contrato, encabezado idempotente o tipos inválidos.
- 401: falta la sesión o dejó de ser válida.
- 403: origen, encabezado de cliente o CSRF incorrectos.
- 404: preview inexistente o ajeno.
- 409: conflicto de clave o demasiadas operaciones concurrentes sobre el mismo carrito.
- 410: validación vencida.
- 422: renglones con productos/variantes no disponibles o personalizaciones inválidas.
- 429: límite de solicitudes.

Las respuestas mantienen el formato de errores de la API, sin exponer datos internos ni valores de personalización en los logs. Los mensajes de 422 identifican renglones y campos, sin repetir los textos del cliente.

## Verificación local

```powershell
cd backend
npm.cmd run prisma:deploy
npm.cmd run build
npm.cmd test
npm.cmd run test:preview
npm.cmd run test:auth
npm.cmd run test:public
```

Las pruebas usan esquemas PostgreSQL temporales. Cubren cookies, CSRF, permisos, formularios, precios manipulados, combos, cotizaciones, fotos por WhatsApp, idempotencia concurrente, vencimiento, limpieza y límites. No crean pedidos ni contactan servicios externos.

Siguiente etapa: registrar pedidos con sus snapshots, revalidar el catálogo y preparar el resumen para continuar por WhatsApp.
