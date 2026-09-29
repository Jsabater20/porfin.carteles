# Frontend F6 · Administración del catálogo

## Entrega

- Panel en `/admin/productos`, con búsqueda, filtros de tipo, visibilidad, categoría y carrera, y paginación conservada en la URL.
- Altas y edición en `/admin/productos/nuevo` y `/admin/productos/[id]`. Los productos nuevos se crean ocultos; luego pueden publicarse o marcarse no disponibles.
- Categorías y carreras: altas, edición, eliminación y listados paginados. El backend impide eliminar elementos utilizados.
- Variantes con precio fijo en ARS o a cotizar, atributos, cantidad de fotos del cliente y activación. Los precios se convierten a centavos enteros sin redondeos ambiguos.
- Campos de texto corto/largo, número y selección, límites, obligatoriedad y adicionales por opción.
- Combos con cantidades de componentes y referencias opcionales a productos. Se pueden vincular campos a cada componente; su precio se define en las variantes del combo.
- Orden de variantes, campos, opciones y componentes mediante controles accesibles. Sus claves se conservan al editar y reordenar, para que NestJS conserve los IDs.
- Galería en `/admin/productos/[id]/imagenes`: carga firmada, confirmación, descripción accesible, portada, orden y eliminación.

## Integración

Las páginas verifican la sesión desde el servidor. Las escrituras usan el cliente administrativo existente, CSRF y la pasarela de mismo origen. Se habilitan únicamente las rutas y métodos necesarios, incluido PATCH. Las cookies administrativas e invitadas continúan separadas; las respuestas privadas no se almacenan en caché.

`features/admin-catalog/` contiene contratos de edición, validación/serialización, consultas, controles, formularios y galería. El frontend manda DTOs explícitos; no devuelve al backend IDs internos de variantes, posiciones, timestamps ni datos de imágenes dentro del PATCH de producto.

El formulario envía solo las propiedades modificadas y consulta el estado actual antes de guardar. Si otro administrador modificó una propiedad que se intenta cambiar, solicita recargar. Esta comprobación reduce sobrescrituras, pero **no es un bloqueo atómico**: el backend todavía no ofrece versiones o ETags para resolver una escritura entre la lectura y el PATCH.

Los formularios permanecen deshabilitados hasta que React está listo. Se avisa al recargar o seguir un enlace con cambios sin guardar. No se persisten borradores en el navegador; usar atrás/adelante del navegador o perder la sesión puede descartarlos.

## Imágenes

1. Validar JPG/PNG/WebP, tamaño máximo de 5 MiB y dimensiones máximas de 40 millones de píxeles.
2. Solicitar autorización a NestJS.
3. Enviar multipart únicamente al endpoint HTTPS de imágenes de Cloudinary, sin cookies administrativas ni CSRF.
4. Confirmar el uploadId con NestJS, que consulta al proveedor y valida el recurso.

La respuesta directa del proveedor no define la imagen final. Ante una interrupción se conserva la autorización en memoria: **Verificar carga** repite la confirmación idempotente. **Cancelar carga** libera la reserva según el contrato del backend. Salir de la pantalla descarta la referencia local; las reservas abandonadas quedan a cargo de la limpieza del backend.

Se muestran hasta 12 imágenes por producto. Reordenar envía todos sus IDs; si otra operación cambió la galería, el backend rechaza el orden desactualizado y se puede actualizar la lista. Borrar un producto requiere ocultarlo, quitar sus imágenes y resolver referencias desde combos.

Sin Cloudinary configurado, el panel explica que las cargas no están disponibles. Las credenciales y el preset real siguen pendientes, según lo acordado.

## Resultados de verificación

- ESLint y TypeScript aprobados; build de producción aprobado.
- **63 pruebas de frontend** aprobadas, incluidas 8 nuevas de serialización del catálogo, precios, validación, rutas privadas y carga de archivos.
- **16 pruebas de backend** aprobadas en las suites de catálogo e imágenes, con PostgreSQL real y proveedor simulado.
- Chrome → Next → Nest → PostgreSQL: protección de rutas, creación de categorías/carreras y productos, validación y foco, cotización, personalizaciones, publicación visible en la tienda, IDs de variantes estables, conflicto de edición y combo referenciado.
- Galería: rechazo de formato inválido antes de reservar, envío firmado sin credenciales administrativas, recuperación de confirmación fallida sin repetir la carga, portada/orden, descripción y eliminación.
- Editor y galería sin desbordes horizontales a 1440, 390 y 320 píxeles; capturas revisadas. Sin excepciones JavaScript en el recorrido.
- Ningún servicio externo configurado ni archivo enviado a Cloudinary real.

## Verificar localmente

Desde `Frontend/`:

```powershell
npm.cmd run check
npm.cmd run build
# Requiere Chrome, PostgreSQL local y dependencias de backend:
npm.cmd run test:catalog-browser
```

El recorrido de navegador usa Next en 3100, Chrome en 9232 y Nest en un puerto temporal. Crea administradores y productos únicamente en un esquema PostgreSQL aislado y elimina ese esquema al finalizar. Cloudinary se sustituye por un proveedor simulado, con interceptación del envío en Chrome. No se suben archivos a cuentas externas. Ejecutar separado de otros recorridos que usan esos puertos.

Se puede indicar `CHROME_PATH`. En entornos de pruebas restringidos, `TEST_BROWSER_NO_SANDBOX=1` aplica exclusivamente al perfil aislado de este recorrido. Capturas en `Frontend/.test-build/catalog-editor-{1440,390}.png` y `catalog-gallery-320.png`.

Desde `backend/`, `npm.cmd run test:catalog` y `npm.cmd run test:media` verifican permisos, contratos, restricciones, integridad y recuperación contra PostgreSQL temporal.

El acceso habitual está en **http://localhost:3000/admin/login**. Se necesita un administrador existente o el bootstrap del primer OWNER; no hay credenciales predeterminadas ni se crean cuentas de producción mediante estas pruebas.

Siguiente etapa: **F7, operación y contenido**. [Arquitectura y etapas](frontend-architecture.md).
