# Etapas 7 a 10: pedidos, presupuestos y pagos

Se usa la numeración de los títulos del documento original. Todos los endpoints llevan `/api/v1`. Los importes HTTP son números enteros de centavos ARS; los totales y snapshots monetarios se guardan en PostgreSQL como `DECIMAL(16,0)`, con límites de enteros seguros de JavaScript.

## Solicitud del cliente

1. Crear/reutilizar la sesión invitada y validar el carrito según [etapa 6](backend-preview.md).
2. `POST /orders`: cookie invitada, `X-Requested-With: porfin-storefront`, `X-CSRF-Token` e `Idempotency-Key` UUID v4.

```json
{
  "previewId": "UUID devuelto por el preview",
  "customerName": "Ana Pérez",
  "customerPhone": "+5491123456789",
  "requestedDate": "2026-12-01",
  "deliveryMethod": "SHIPPING",
  "deliveryAddress": "Dirección de entrega",
  "notes": "Observaciones opcionales"
}
```

La fecha debe existir, usar YYYY-MM-DD y no estar en el pasado en Argentina. PICKUP o SHIPPING debe coincidir con el preview; SHIPPING requiere dirección. Si se configuraron modalidades en la tienda, la elegida debe seguir habilitada.

La creación revalida productos, variantes, atributos, personalizaciones, adicionales y precios en una transacción. Un cambio invalida el resumen con 409; se debe generar un nuevo preview y confirmar nuevamente. Un preview vencido devuelve 410 y uno ajeno 404. El frontend nunca envía importes.

La misma clave y los mismos datos devuelven el mismo pedido, incluso en solicitudes simultáneas. Cambiar los datos con esa clave devuelve 409. Reutilizar la clave después de perder una respuesta evita duplicados. El límite de creación es 60 solicitudes por sesión y 120 por IP por hora, contando reintentos.

`GET /orders/:id` exige la sesión invitada propietaria. Al vencer o revocarse, se pierde este acceso; el historial administrativo se conserva. Los datos del producto, variante, atributos, fotos, respuestas, opciones, componentes e importes quedan copiados en el pedido.

`whatsapp.url` apunta al número de la tienda configurado en la etapa 11. Sin número devuelve null y conserva `whatsapp.message`; no inventa un destinatario. El mensaje resume productos, subtotal conocido, pendientes, entrega y fecha. Abrir el enlace no registra un envío: el cliente debe tocar Enviar en WhatsApp. No existe integración de envío automático.

## Administración y estados

Cookie administrativa, roles OWNER/ADMIN. Toda escritura exige `X-Requested-With: porfin-admin` y `X-CSRF-Token`.

- `GET /admin/orders?page=1`: páginas de 25 pedidos.
- `GET /admin/orders/:id`: datos del cliente, snapshots, eventos, presupuestos y pagos.
- `PATCH /admin/orders/:id/status`: `{ "status": "CONFIRMED", "reason": "Revisado con el cliente" }`.

Transiciones: PENDING_CONFIRMATION → CONFIRMED → IN_PRODUCTION → READY → DELIVERED. CANCELLED es una salida desde cualquiera de los primeros cuatro estados, con motivo obligatorio. DELIVERED y CANCELLED son terminales. Los eventos guardan estado anterior/nuevo, ID del administrador, fecha y motivo.

Las escrituras privadas revalidan la sesión dentro de la transacción y comparten un bloqueo con autenticación y catálogo. Dos operaciones simultáneas no sobrescriben versiones, estados o saldos calculados a partir de datos anteriores.

## Presupuestos

`POST /admin/orders/:id/quotes` crea una revisión nueva, nunca modifica las líneas o importes anteriores:

```json
{
  "items": [{ "productName": "Cartel", "quantity": 2, "unitPriceCents": 35000 }],
  "notes": "Incluye personalización"
}
```

El presupuesto contiene el total final acordado; agregar una línea para el envío cuando corresponda. No se cobra automáticamente el subtotal del catálogo ni se convierte un pendiente de cotización en cero.

`PATCH /admin/orders/:id/quotes/:quoteId/status` recibe `{ "status": "SENT" }` o ACCEPTED/REJECTED según la transición:

- DRAFT → SENT o REJECTED.
- SENT → ACCEPTED o REJECTED.
- ACCEPTED y REJECTED son terminales para esa revisión.

Solo la última revisión puede aceptarse. Una revisión nueva en borrador no reemplaza la aceptada vigente. El presupuesto vigente es la revisión ACCEPTED de mayor versión; las aceptaciones anteriores conservan su historial. Si el nuevo total es menor al saldo cobrado, primero hay que devolver el excedente. La aceptación es registrada manualmente por el administrador después de acordarla con el cliente; no se envían mensajes.

## Movimientos de pago

`POST /admin/payments`, con **Idempotency-Key UUID v4 obligatorio**:

```json
{
  "orderId": "ID del pedido",
  "quoteId": "ID del presupuesto aceptado",
  "type": "CHARGE",
  "amountCents": 30000,
  "method": "TRANSFER",
  "reference": "Referencia opcional"
}
```

`quoteId` puede omitirse para usar el presupuesto aceptado vigente. Los cobros deben corresponder a ese presupuesto; se rechazan cobros sobre borradores o versiones anteriores. REFUND permite devolver como máximo el saldo neto cobrado, también tras cancelar un pedido. Los pedidos cancelados no admiten cobros nuevos. Cada movimiento guarda el administrador y la fecha del registro.

La clave identifica un movimiento en toda la administración: al repetirla con los mismos datos no se registra otro; cambiar los datos devuelve 409. La respuesta de un reintento conserva el movimiento y muestra el **saldo actual**.

`GET /admin/payments/orders/:orderId` devuelve movimientos, chargedCents, refundedCents, balanceCents, quoteTotalCents, outstandingCents y paymentStatus (PENDING/PARTIAL/PAID). El saldo es cobros menos devoluciones; el estado de pago no modifica el estado de producción. Son registros administrativos: no se ejecutan transferencias ni devoluciones bancarias.

Las migraciones conservan pagos existentes, les asignan claves irrepetibles y corrigen referencias a sesiones como actores cuando la sesión todavía existe. Un presupuesto legado que tenga pagos pero siga en DRAFT requiere revisar y registrar su aceptación antes de agregar movimientos.