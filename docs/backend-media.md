# Etapa 4: imágenes del catálogo

El módulo `backend/src/modules/media` autoriza cargas directas a Cloudinary y guarda la galería en PostgreSQL. Los endpoints requieren sesión OWNER/ADMIN. Todas las escrituras usan JSON, cookie de sesión, `X-Requested-With: porfin-admin` y `X-CSRF-Token`.

## Configuración

En `backend/.env` (y luego en las variables del servicio Railway):

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=
```

Dejar las cuatro vacías permite desarrollar el resto del backend: solicitar una firma devuelve 503. Una configuración parcial impide iniciar, con un error que no imprime valores. El secret permanece exclusivamente en el servidor.

Crear en Cloudinary un **upload preset firmado** para este catálogo, con:

- Signing mode: **Signed**, nunca Unsigned.
- Allowed formats: `jpg,png,webp`.
- El límite de la aplicación es **5242880 bytes (5 MiB)**. Cloudinary no admite `max_file_size` como límite por preset; no configurar ese parámetro.
- Sin folder, public ID prefix, uso de asset folder como prefijo ni transformaciones de entrada. El backend genera el identificador completo.
- Mantener los archivos públicos, con delivery type `upload`.

El backend consulta el preset antes de autorizar una carga y rechaza configuraciones incompatibles. El frontend limita el peso antes de enviar y el backend comprueba los bytes reales consultados a Cloudinary antes de incorporar la imagen. Un cliente que omita la validación del navegador puede subir temporalmente un archivo mayor al proveedor: la API rechaza su confirmación y programa su limpieza. El límite de 5 MiB no es una cuota de almacenamiento impuesta por el preset. Para usar una cuenta con dominio de entrega personalizado habría que adaptar la comprobación de URL, que actualmente admite `res.cloudinary.com`.

## Flujo para el futuro panel

1. Crear el producto y obtener su ID.
2. `POST /api/v1/admin/media/upload-signature` con `{ "productId": "..." }`.
3. El servidor devuelve `uploadId`, `expiresAt`, `uploadUrl`, `apiKey`, `signature`, `params`, `maxBytes` y `formats`.
4. Enviar el archivo como multipart directamente a `uploadUrl`, incluyendo todos los `params`, `api_key` y `signature`. La cookie administrativa y los encabezados CSRF corresponden solo a nuestra API.
5. Cuando Cloudinary confirme la carga, `POST /api/v1/admin/media/complete` con `{ "uploadId": "...", "altText": "Cartel de recibida" }`.
6. El backend consulta Cloudinary con sus credenciales, comprueba el recurso y devuelve la imagen guardada.

Ejemplo de la solicitud directa del paso 4:

```javascript
const form = new FormData();
for (const [key, value] of Object.entries(authorization.params)) {
  form.append(key, String(value));
}
form.append('api_key', authorization.apiKey);
form.append('signature', authorization.signature);
form.append('file', file);
const uploaded = await fetch(authorization.uploadUrl, {
  method: 'POST',
  body: form,
  credentials: 'omit',
});
if (!uploaded.ok) throw new Error('No se pudo cargar la imagen');
// Después confirmar authorization.uploadId en nuestra API.
```

La confirmación acepta únicamente el ID de autorización y texto alternativo. No acepta URLs, asset IDs ni tamaños proporcionados por el navegador. Dos confirmaciones concurrentes devuelven la misma imagen. Reintentar una confirmación ya exitosa tampoco modifica su texto.

## Endpoints

Todos relativos a `/api/v1/admin`:

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | `/media/upload-signature` | Reservar una imagen y obtener firma (201). |
| POST | `/media/complete` | Verificar y guardar; reintentos idempotentes (200). |
| DELETE | `/media/uploads/:uploadId` | Cancelar una carga pendiente (204), enviar `{}`. |
| GET | `/products/:productId/images` | Galería ordenada. |
| PATCH | `/products/:productId/images/order` | Enviar `{ "imageIds": ["id2", "id1"] }`; debe incluir toda la galería actual. |
| PATCH | `/products/:productId/images/:id` | Modificar `{ "altText": "..." }`. |
| DELETE | `/products/:productId/images/:id` | Quitar de la galería y programar limpieza (204), enviar `{}`. |

La primera imagen es la portada. Reordenar permite cambiarla; al borrar la portada, la siguiente ocupa su lugar. La base impide dos portadas simultáneas. La API de productos ya incluye `images` ordenadas; editar otros datos del producto conserva la galería.

Cada `ProductImage` guarda producto, carga original, asset ID, public ID, URL HTTPS, formato, bytes, dimensiones, texto alternativo, posición, portada y fecha. Para eliminar un producto, primero vaciar su galería y ocultarlo. Una carga pendiente de un producto eliminado conserva su registro para poder limpiar el archivo.

## Límites y errores

- JPG, PNG o WebP; hasta 5 MiB y 40 megapíxeles. SVG, PDF y video no se incorporan al catálogo.
- Hasta 12 imágenes por producto, contando reservas pendientes sin vencer. El límite se comprueba bajo el mismo lock transaccional que protege las escrituras administrativas.
- Hasta 60 autorizaciones por administrador en una hora, contando las canceladas: 429 al exceder.
- Confirmar dentro de 15 minutos y con el mismo administrador que pidió la autorización.
- IDs y `overwrite=false` fijados por el backend: una firma no permite reemplazar fotos existentes.
- 400 para archivos o DTOs inválidos; 401/403 para acceso; 404 para recurso inexistente o autorización ajena; 409 para conflictos o archivo aún no disponible; 410 para autorización vencida; 503 si Cloudinary no está configurado o no responde.
- Tras un 503 de confirmación se puede reintentar dentro del plazo. Al vencer, solicitar una nueva autorización.

## Limpieza y recuperación

`MediaUpload` conserva la tarea de limpieza en PostgreSQL. Eliminar una imagen la desvincula inmediatamente y programa el borrado remoto en la misma transacción. No se depende de que Cloudinary esté disponible en ese momento.

Un trabajador dentro de la API revisa cada minuto hasta 20 tareas, usa un lease compartido entre réplicas y reintenta con espera creciente hasta una hora. Las tareas sobreviven a reinicios. Cargas abandonadas, canceladas, rechazadas y productos eliminados se limpian por este mecanismo. Las imágenes vigentes se excluyen.

Cloudinary acepta firmas durante una hora; nuestra confirmación vence a los 15 minutos. La limpieza espera al menos **65 minutos desde la autorización** para evitar recrear un archivo con una firma todavía vigente. Después, el borrado solicita invalidar la caché; la propagación del proveedor no es instantánea. La firma ya entregada no puede revocarse al cerrar sesión, pero la confirmación exige una sesión activa y vuelve a comprobarla después de consultar Cloudinary.

El trabajador solo limpia registros correspondientes al cloud name configurado. Antes de cambiar de cuenta, vaciar y limpiar sus recursos. Los registros se conservan como trazabilidad; no se implementó aún una política de purga histórica. Mantener al menos una instancia de API activa para procesar tareas.

## Verificación

```powershell
cd backend
npm.cmd run prisma:deploy
npm.cmd run build
npm.cmd test
npm.cmd run test:media
```

Las pruebas de integración usan PostgreSQL real con un esquema temporal y simulan únicamente el proveedor Cloudinary. Cubren permisos, CSRF, confirmaciones concurrentes, peso/formato/dimensiones/URL, portada y orden, límites, referencias cruzadas, vencimiento, cancelación y limpieza con fallos y reintentos. No suben ni eliminan archivos reales en Cloudinary.

La validación final con una cuenta real requiere sus cuatro variables y una carga desde Swagger o el futuro panel siguiendo el flujo anterior.

Referencias: [presets de Cloudinary](https://cloudinary.com/documentation/upload_presets), [firmas de carga](https://cloudinary.com/documentation/upload_images#generating_authentication_signatures), [API de carga y eliminación](https://cloudinary.com/documentation/image_upload_api_reference).
