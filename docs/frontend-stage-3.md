# Frontend F3 · Personalización y carrito

Fecha de verificación: 28 de septiembre de 2026.

## Entrega

- Formularios construidos desde los campos publicados por NestJS: texto corto/largo, números y selección, con requeridos, límites y errores junto al campo. El primer campo inválido recibe foco.
- Variantes, adicionales orientativos por unidad y campos agrupados por componente de combo. Se conserva el precio propio de la variante del combo.
- Cada personalización crea un renglón independiente, incluso para el mismo producto. Se puede editar conservando su identidad, cambiar cantidad, quitar o vaciar con confirmación.
- Ruta `/carrito` y contador en la navegación. Persistencia versionada en el navegador durante siete días desde el último cambio, sincronización entre pestañas y recuperación segura ante datos corruptos o vencidos.
- Si el navegador bloquea el almacenamiento, se conserva el carrito en memoria y se avisa de la limitación.
- Validación mediante sesión invitada, cookie HttpOnly, CSRF y `POST /orders/preview`. El resumen distingue subtotal conocido, productos a cotizar, entrega y total final pendientes.
- Cambiar cantidades, opciones o entrega invalida el resumen. También se detecta su vencimiento y se permite actualizar precios.
- Avisos por cambios de precio y errores de disponibilidad o personalización por renglón. Los reintentos de una misma solicitud conservan la clave de idempotencia; los cambios generan otra.
- Avisos de cantidad de fotos para enviar por WhatsApp; no se cargan fotos del cliente en esta etapa.

## Organización y límites

`features/personalization` agrupa formulario, validaciones y estimaciones. `features/cart` separa modelo persistido, almacén, coordinación de previews, proveedor React e interfaz. Context comparte las instancias y `useSyncExternalStore` conecta sus snapshots inmutables con React. El almacenamiento se lee después de la hidratación.

Solo se envían al backend IDs, cantidades, modalidad de entrega y respuestas. Los nombres e importes locales ayudan a mostrar el carrito, pero nunca autorizan un precio. NestJS vuelve a validar el catálogo completo.

El carrito admite hasta 30 renglones y cantidades de 1 a 100 por renglón, respetando el límite de petición de 1 MiB. Los números aceptan cero y decimales; las selecciones transmiten claves, no etiquetas. Se normaliza texto Unicode y se descartan campos opcionales vacíos.

Las cookies de sesión permanecen inaccesibles al JavaScript. CSRF, claves de idempotencia y previews viven solo en memoria; no se guardan en localStorage. La pasarela permite explícitamente el POST de preview y filtra las cookies según el ámbito invitado. Las respuestas obsoletas se descartan si cambia el carrito durante una consulta.

La etapa no registra pedidos. El registro de la solicitud, los datos de contacto y el mensaje de WhatsApp corresponden a **F4**. Un preview no reserva disponibilidad, confirma un pedido ni acredita un pago.

## Verificaciones

- ESLint, TypeScript y **37 pruebas** de frontend aprobadas.
- Build de producción aprobado, incluida la ruta del carrito.
- Recorrido de catálogo `test:storefront` aprobado con API de contratos aislada.
- `test:preview` del backend aprobado con PostgreSQL real y esquema temporal: sesión, CSRF, importes, cotización, combos, validación, disponibilidad, idempotencia, vencimiento y límites.
- Chrome con API de contratos: campos requeridos y foco; dos personalizaciones del mismo producto; edición conservando identidad; persistencia al recargar; combos, adicionales y número cero.
- Reintento tras error de red conservando clave, cambio de precios, resumen mixto con cotización, invalidación por cantidad/entrega, vencimiento y errores 422 por renglón.
- Vaciado confirmado, cancelación del vaciado y recuperación de almacenamiento corrupto.
- Comprobación de anchos de 1440, 390 y 320 píxeles sin desbordes horizontales ni excepciones JavaScript. Capturas de escritorio y celular revisadas.

El navegador utiliza ejemplos locales en `Frontend/test/fixtures/`; no es una prueba integral del navegador contra NestJS real. El contrato de pasarela y la lógica del backend se verifican en sus pruebas respectivas. La base de desarrollo no tiene productos publicados; no se agregaron productos, pedidos ni cuentas para poblarla. Las pruebas PostgreSQL usan y eliminan un esquema temporal.

## Repetir las pruebas

Desde `Frontend/`:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:storefront
npm.cmd run test:cart-browser
```

Los dos recorridos inician y cierran sus servidores en 3100/3101; ejecutarlos de forma secuencial. El recorrido de carrito requiere Chrome y utiliza el puerto 9232 y un perfil aislado dentro de `.test-build/`. Se puede indicar su ejecutable con `CHROME_PATH`. En un entorno local restringido, `TEST_BROWSER_NO_SANDBOX=1` permite ejecutar únicamente este navegador de pruebas sin su sandbox; no es una configuración del producto. Las capturas quedan en `.test-build/cart-1440.png` y `.test-build/cart-390.png`.

Desde `backend/`, con PostgreSQL iniciado:

```powershell
npm.cmd run test:preview
```

El CI existente ejecuta chequeos, build y recorrido HTTP de catálogo. El recorrido interactivo con Chrome y la prueba real de preview se ejecutaron localmente. No se configuraron servicios externos ni se agregaron dependencias de frontend.

Siguiente etapa: **F4, solicitud y WhatsApp**. [Arquitectura general](frontend-architecture.md) · [Contrato del preview](backend-preview.md).

Referencia de React: [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore).
