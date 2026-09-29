# Frontend F1 · Base implementada

Fecha de verificación: 27 de septiembre de 2026.

## Entrega

Aplicación independiente en `Frontend/`, con Next.js App Router, React, TypeScript estricto y CSS compartido. Conserva `backend/` y el prototipo `docs/reference/frontend-prototype/`. No se modificó código ni esquema del backend.

| Ruta | Estado en F1 |
| --- | --- |
| `/` | Portada y explicación del recorrido; lee nombre y descripción reales de la configuración pública. |
| `/catalogo` | Pantalla inicial pendiente de implementar el catálogo en F2. |
| `/admin/login` | Layout de acceso con aviso; formulario pendiente de F5. |
| `/admin` | Panel inicial protegido: comprueba sesión, redirige si falta o es inválida. |
| `/api/backend/*` | Pasarela limitada a las operaciones indicadas abajo. |

Se incluyen encabezado, pie, navegación administrativa, botón, estado vacío, carga, error y 404. La portada usa una composición tipográfica propia, sin fotografías de catálogo ficticias. Los colores, tipografías y espaciados son una base editable.

## Integración

Las lecturas de servidor consultan NestJS directamente mediante un módulo `server-only`. El navegador consulta el mismo origen mediante Route Handlers. La configuración pública se comparte solo dentro del render de una solicitud; no se reutilizan datos privados entre visitantes.

La pasarela permite únicamente:

- `GET health`, `GET health/ready`, `GET settings/public`.
- `GET auth/me`.
- `POST auth/login`, `auth/logout`, `auth/recovery` y `auth/reset`.
- `POST guest-session` y `DELETE guest-session`.

Las operaciones de las etapas siguientes deberán agregarse explícitamente junto con sus contratos y pruebas. La pasarela no expone automáticamente todos los endpoints del backend.

Las escrituras exigen el origen configurado, JSON y el encabezado de cliente correspondiente. El límite de 1 MiB se comprueba sobre el cuerpo real, incluso sin Content-Length. NestJS sigue validando la sesión y CSRF. Solo se reenvían cookies administrativas o invitadas según la operación; las consultas públicas no reciben cookies. Las cookies devueltas se preservan por separado, incluyendo HttpOnly y las eliminaciones. No se siguen redirecciones ni se propagan Authorization, Host o cabeceras de IP aportadas por el navegador.

Las consultas y respuestas son `no-store`. El cliente conserva errores HTTP, identificador de solicitud y Retry-After; las caídas de conexión muestran mensajes sin datos internos. La portada funciona como estructura navegable cuando la API está apagada.

## Validación realizada

- Instalación con versiones resueltas en lockfile, sin auditoría remota.
- ESLint y TypeScript sin errores.
- 16 pruebas aprobadas: restricciones de rutas y métodos, origen, JSON, tamaño, filtrado de cookies, CSRF transportado, idempotencia transportada, respuestas 204, errores, redirecciones y caídas.
- Build de producción de Next.js aprobado.
- Smoke contra NestJS y PostgreSQL reales aprobado: configuración, páginas, 404, panel sin sesión, disponibilidad de base, bloqueo de origen externo y creación/revocación de sesión invitada con comprobación de CSRF.
- Chrome a 1440, 390 y 320 píxeles: sin desbordes horizontales ni excepciones JavaScript; redirección administrativa verificada.
- Portada con backend apagado: respuesta correcta, navegación y aviso de indisponibilidad.

Las pruebas locales no crean pedidos ni cuentas administrativas. Las sesiones invitadas de verificación se revocan.

## Límites de esta etapa

F1 no incorpora todavía el catálogo interactivo, carrito, formularios de acceso ni operaciones de gestión. El panel se podrá abrir con una sesión válida del backend, pero su contenido es inicial. Las secciones pendientes de la navegación administrativa no son enlaces falsos.

La cadena de proxies y la IP real del visitante deben resolverse antes de publicar: el gateway local no confía en X-Forwarded-For recibido del navegador, por lo que NestJS ve la conexión de Next.js. No configurar límites de producción suponiendo que ya distinguen visitantes detrás de esta pasarela.

El workflow de frontend queda escrito, sin publicar ni configurar servicios externos. La verificación visual corresponde a la base actual; se ampliará al implementar las pantallas reales. El aviso de npm sobre ESLint 9 queda documentado en `Frontend/README.md` por compatibilidad con los plugins actuales.

El siguiente paso es **F2: tienda y catálogo**, según la [arquitectura general](frontend-architecture.md).
