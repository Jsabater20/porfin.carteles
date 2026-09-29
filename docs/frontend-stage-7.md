# Frontend F7 · Operación y contenido

## Pantallas

- `/admin/pedidos`: listado paginado, más recientes primero, cliente, referencia, estado y fecha solicitada.
- `/admin/pedidos/[id]`: cliente, entrega, snapshots de productos, variantes, personalizaciones, fotos y componentes; estados e historial.
- Presupuestos dentro del pedido: renglones, cantidades, precios en ARS, notas y total revisable antes de crear una revisión inmutable.
- Envío, aceptación y rechazo se registran manualmente. Marcar enviado no manda mensajes; aceptar registra lo acordado con el cliente.
- Cobros y devoluciones con confirmación previa, saldo, total aceptado, pendiente e historial. Son registros de movimientos ya realizados: no ejecutan transferencias.
- `/admin/contenido`: Inicio, Nosotros, Contacto y FAQ, publicación, secciones, preguntas y destacados ordenados.
- `/admin/configuracion`: nombre, presentación, contactos, redes HTTPS, retiro, modalidades de entrega y plazos.
- `/admin/administradores`: exclusiva de OWNER, alta y edición de cuentas, roles, activación y cambio de contraseña.

El panel inicial y su navegación incorporan estas secciones. La gestión de cuentas se comprueba también en la página del servidor; NestJS vuelve a autorizar todas las operaciones.

## Pedidos y presupuestos

Los datos solicitados se muestran desde sus snapshots, sin depender del catálogo actual. El subtotal conocido no se presenta como total final: se distinguen cotizaciones y envío pendientes.

Solo se ofrecen transiciones válidas. Cancelar requiere motivo; entregado y cancelado son terminales. El historial conserva fechas, motivos e identificación del administrador.

Se puede iniciar un presupuesto con los productos del pedido o agregar renglones manualmente. Un precio a cotizar queda vacío y debe completarse. El envío se incluye como renglón si corresponde. Cada revisión conserva sus propios importes; un nuevo borrador no sustituye la revisión aceptada vigente. Solo se ofrece aceptar la revisión más reciente; NestJS verifica que el nuevo total no sea menor al saldo cobrado.

Crear un presupuesto no tiene idempotencia en el backend. Ante una respuesta incierta se bloquea la repetición directa y se pide consultar las revisiones antes de habilitar otra creación.

## Recuperación de pagos

El importe se transforma de pesos a centavos enteros. Antes de escribir se conserva en sessionStorage una clave UUID, un hash de los datos y el ID del presupuesto, separados por administrador y pedido. No se guardan el importe, medio, referencia, contacto ni credenciales en ese registro local.

Un doble clic se bloquea en memoria. Ante una respuesta perdida, el reintento usa exactamente la misma clave y datos; NestJS devuelve el movimiento existente y el saldo actual. Al recargar, se pide reingresar los mismos datos. Cambiarlos mientras queda un intento sin confirmar bloquea el envío.

La referencia se retira tras una respuesta confirmada o un rechazo definitivo de validación. Errores de sesión, conexión, límite de solicitudes o conflicto de clave conservan el intento. Si el almacenamiento está bloqueado o corrupto, no se habilita un registro nuevo sin resolverlo. Un fallo al actualizar el resumen después de registrar no vuelve a escribir el pago.

La recuperación es por pestaña. Cerrar esa pestaña, borrar almacenamiento o empezar desde otra no conserva su clave: antes de repetir un movimiento hay que revisar el historial. El backend controla sobrecobros, saldo de devoluciones y presupuesto vigente. Los pedidos cancelados admiten devoluciones, pero no nuevos cobros.

## Contenido, configuración y cuentas

Los textos se renderizan como texto plano, sin interpretar HTML. Se validan longitudes y listas; las secciones, preguntas y destacados tienen controles de orden y eliminación. El editor busca productos publicados con variantes activas para destacarlos. Si luego dejan de estar disponibles, el backend los excluye del inicio público.

Contenido y configuración mandan solo campos modificados y consultan el estado actual antes de guardar, para detectar conflictos conocidos. Esto no sustituye un control de versión atómico del backend: sigue existiendo una ventana entre lectura y escritura.

Contactos vacíos se envían como null para borrarlos. No elegir modalidades mantiene la entrega sin restricción configurada. Los cambios de WhatsApp afectan los pedidos nuevos; los anteriores conservan su destinatario.

Las cuentas requieren revisión antes de guardar. Cambiar correo, contraseña, rol o desactivar revoca las sesiones de esa cuenta. El backend impide quitar al último OWNER activo. Editar la propia cuenta puede cerrar el acceso. No se envían contraseñas ni mensajes automáticamente.

Los formularios se habilitan al estar listo React y avisan al salir por un enlace o recargar con cambios sin guardar. Los borradores no se persisten; atrás/adelante del navegador o perder la sesión puede descartarlos.

## Resultados verificados

- ESLint, TypeScript y build de producción aprobados.
- **72 pruebas de frontend** aprobadas, incluidas transiciones, presupuestos, recuperación de claves de pago, almacenamiento bloqueado, contenido, configuración, pasarela y formato estable de fechas.
- **22 pruebas de backend** aprobadas: pedidos/presupuestos/pagos (8), contenido/configuración (6) y autenticación/cuentas (8), con PostgreSQL real en esquemas temporales.
- Recorrido Chrome → Next → Nest → PostgreSQL aprobado: configuración, borrado de contacto, FAQ publicada, texto HTML escapado, destacados, alta/desactivación de cuentas y protección del último OWNER.
- Datos históricos del pedido, cambio de estado, presupuesto aceptado, cobro con respuesta perdida, recarga y mismo intento, rechazo de importe modificado, rechazo de sobrecobro y devolución tras cancelar.
- Permisos OWNER/ADMIN comprobados en navegación, página del servidor y API.
- Pedidos sin desbordes horizontales a 1440, 390 y 320 píxeles; configuración y cuentas revisadas a 320. Capturas de escritorio y celular revisadas.
- Cero excepciones JavaScript en el recorrido final. Fechas y horas tienen formato numérico estable para evitar diferencias de hidratación entre Node y Chrome.

## Verificación local

Desde `Frontend/`:

```powershell
npm.cmd run check
npm.cmd run build
# Chrome, PostgreSQL y dependencias de backend instalados:
npm.cmd run test:operations-browser
```

El recorrido usa Next en 3100, Chrome en 9232 y Nest en un puerto temporal. Crea cuentas, productos y pedidos exclusivamente en un esquema PostgreSQL aislado; lo elimina al terminar y cierra sus procesos. Ejecutarlo separado de otros recorridos que usan los mismos puertos.

`CHROME_PATH` permite indicar otro ejecutable. `TEST_BROWSER_NO_SANDBOX=1` es una opción exclusiva para el perfil de pruebas en entornos locales restringidos. Las capturas se guardan en `Frontend/.test-build/operations-*.png`.

Desde `backend/`: `npm.cmd run test:orders`, `npm.cmd run test:content` y `npm.cmd run test:auth`.

No se configuran Railway, Neon, Cloudinary ni SMTP, ni se crean cuentas en la base habitual. El siguiente paso es **F8: revisión integral**. [Arquitectura y etapas](frontend-architecture.md).
