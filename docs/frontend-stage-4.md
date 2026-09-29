# Frontend F4 · Solicitud y WhatsApp

Fecha de verificación: 28 de septiembre de 2026.

## Entrega

El recorrido público ahora llega desde el carrito a una solicitud registrada:

1. `/pedido` pide nombre, teléfono internacional, fecha solicitada, modalidad de entrega, dirección si hay envío y observaciones opcionales.
2. La interfaz consulta las modalidades y los avisos públicos de la tienda. Cambiar la entrega exige validar nuevamente el carrito.
3. El cliente revisa productos, personalizaciones, subtotal conocido y pendientes, y confirma esa revisión antes de registrar.
4. `POST /orders` registra el pedido con cookie invitada, CSRF y clave de idempotencia. NestJS revalida el catálogo y la vigencia del resumen.
5. `/pedido/[id]` muestra la referencia, estado, snapshots de productos, datos de contacto y entrega e importes de la solicitud original.
6. Se ofrece abrir WhatsApp o copiar el mensaje generado por el backend. Si no hay número configurado, la solicitud se conserva y se muestran copia y contacto.

La fecha es solicitada y queda a coordinar. El total final, la disponibilidad y el pago no se consideran confirmados por registrar una solicitud. Abrir WhatsApp no envía mensajes automáticamente.

## Organización y contratos

`features/orders/` reúne validaciones, coordinación de escrituras, formulario, resumen y acciones de WhatsApp. Los contratos HTTP están en `lib/contracts/orders.ts`. El proveedor de tienda conserva la operación en curso durante la navegación interna.

La pasarela agrega únicamente `POST orders` y `GET orders/:id` con ID CUID válido. Filtra cookies administrativas, mantiene CSRF e idempotencia y evita caché. La página de resumen obtiene el pedido desde NestJS con la cookie invitada correspondiente; el ID por sí solo no da acceso. Las páginas de solicitud llevan metadatos de no indexación y política de referencia restrictiva.

Las validaciones contemplan Unicode, límites de texto, teléfono de 8 a 15 dígitos con código de país, fechas reales desde el día actual en Argentina y dirección obligatoria para envío. La dirección se omite al retirar. La API vuelve a validar todos los datos y recibe únicamente la referencia del preview y datos del cliente, nunca importes calculados en el navegador.

## Reintentos y persistencia

- El doble clic no inicia otra escritura. Una pérdida de respuesta conserva la clave y el cuerpo lógico de la solicitud.
- Un registro en `sessionStorage`, limitado a la pestaña, guarda clave, ID de preview, modalidad, fecha del intento y hashes SHA-256 de la solicitud y del carrito. No guarda nombre, teléfono, dirección, observaciones ni credenciales.
- Después de recargar, el usuario reingresa los mismos datos. Se verifica su hash y se recupera el resultado con la misma clave, incluso si el preview venció después de crear el pedido.
- Mientras un resultado sea incierto, modificar los datos no dispara otra solicitud. La pantalla ofrece contactar a la tienda si no se pueden recuperar.
- Los errores 409 conocidos de catálogo/entrega y 410 exigen otro preview y una nueva revisión. Los conflictos transitorios conservan la clave. Un límite 429 bloquea temporalmente el botón.
- Si la sesión ya no permite recuperar el resultado, se explica la limitación y se evita recrear automáticamente el pedido.
- Tras una confirmación se guarda solo el ID del recibo y el hash del carrito. El carrito se vacía únicamente si sigue coincidiendo con el enviado; si cambió durante el registro, se conserva.
- Si el almacenamiento está deshabilitado, la operación sigue en memoria y la pantalla pide mantener la página abierta. Un registro corrupto se señala y bloquea otra escritura para evitar duplicados inciertos.

La recuperación depende de conservar la sesión y el registro de la pestaña. Cerrar la pestaña o borrar el almacenamiento puede perder esa referencia; no hay historial público de pedidos ni recuperación por identidad del cliente. Estas restricciones se explican sin atribuir acceso permanente al enlace del resumen.

## Verificaciones

- ESLint, TypeScript y **46 pruebas** de frontend aprobadas.
- Build de producción con `/pedido` y `/pedido/[id]` aprobado.
- Suite de pedidos del backend con PostgreSQL real: **8 tests** aprobados, incluidos permisos, idempotencia concurrente, revalidación y WhatsApp sin configurar.
- Recorrido interactivo con Chrome y API de contratos: validaciones y foco, envío/retiro, pedido registrado con respuesta perdida, recarga y recuperación con la misma clave, revisión por 409/410, cotización, copia del mensaje y falta de WhatsApp.
- Carrito vacío y conservación de cambios realizados durante una solicitud pendiente; limpieza después de un registro que sí coincide con el carrito.
- Resumen sin información privada ante sesión vencida, y anchos de 1440, 390 y 320 píxeles sin desbordes ni excepciones JavaScript.
- Recorrido HTTP real **Next.js → NestJS → PostgreSQL**: sesión y CSRF por la pasarela, preview, creación, repetición después de vencer el preview sin duplicar, consulta privada, página del recibo y denegación a otra sesión y a visitantes anónimos.

Las pruebas del navegador usan fixtures aislados. La prueba HTTP real crea un esquema temporal, aplica migraciones y elimina ese esquema al finalizar. No se poblaron productos ni se crearon pedidos o administradores en la base de desarrollo habitual. No se enviaron mensajes ni se conectaron proveedores externos.

## Ejecutar

Desde `Frontend/`:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:orders-browser
# Requiere PostgreSQL y dependencias del backend:
npm.cmd run test:orders-real
```

El recorrido de navegador requiere Chrome (`CHROME_PATH` si no está en la ruta habitual), usa 3100/3101 y 9232 e inicia y cierra sus procesos. En un entorno local restringido puede utilizarse `TEST_BROWSER_NO_SANDBOX=1` solo para el perfil aislado de prueba. Capturas: `.test-build/checkout-{1440,390}.png` y `.test-build/order-{1440,390}.png`.

El recorrido real usa Next en 3102 y Nest en un puerto temporal. Aprovecha el soporte de integración y las dependencias ya instaladas en `backend/`, sin agregar paquetes. PostgreSQL debe permitir crear esquemas de prueba. Ejecutar los recorridos de navegador de catálogo/carrito/pedidos secuencialmente porque comparten puertos.

Desde `backend/`: `npm.cmd run test:orders`. El CI existente sigue ejecutando checks, build y recorrido HTTP del catálogo; las verificaciones con Chrome y PostgreSQL se ejecutaron localmente.

Siguiente etapa: **F5, acceso administrativo**. [Arquitectura](frontend-architecture.md) · [Contrato de pedidos](backend-orders.md).
