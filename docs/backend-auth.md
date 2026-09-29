# Etapa 2 — Auth y administradores

Todas las rutas están bajo `/api/v1`. No hay registro público de administradores ni cuentas de compradores.

## Primer OWNER

Aplicar migraciones (`npm.cmd run prisma:deploy`) y ejecutar desde `backend`:

```powershell
$env:BOOTSTRAP_OWNER_NAME = 'Tu nombre'
$env:BOOTSTRAP_OWNER_EMAIL = 'tu-email@example.com'
$env:BOOTSTRAP_OWNER_PASSWORD = 'elegi-una-clave-de-12-o-mas-caracteres'
npm.cmd run admin:bootstrap
Remove-Item Env:\BOOTSTRAP_OWNER_PASSWORD
```

El comando crea solamente el primer OWNER. Si ya existe alguno, se detiene sin cambiar cuentas. No hay contraseña predeterminada. El seed de infraestructura no crea administradores.

## Rutas

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | /auth/login | Público, limitado por IP y email |
| GET | /auth/me | Sesión activa |
| POST | /auth/logout | Sesión y CSRF |
| POST | /auth/recovery | Público, respuesta genérica |
| POST | /auth/reset | Público, token de un uso |
| GET | /admin/admins?page=1&limit=25 | OWNER |
| POST | /admin/admins | OWNER y CSRF |
| PATCH | /admin/admins/:id | OWNER y CSRF |

En toda solicitud de escritura usar `Content-Type: application/json` y `X-Requested-With: porfin-admin`. Las escrituras autenticadas necesitan además `X-CSRF-Token`, obtenido del login o de `/auth/me`. La web Next.js usa una pasarela del mismo origen con `credentials: 'same-origin'`; la pasarela conserva únicamente las cookies de la sesión correspondiente.

Login recibe `{ "email": "...", "password": "..." }`. Devuelve administrador, vencimiento y token CSRF; la sesión opaca se entrega solamente mediante cookie HttpOnly. Logout recibe un objeto JSON vacío.

Crear un administrador requiere `name`, `email` y `password`; `role` puede ser ADMIN (predeterminado) u OWNER. PATCH permite `name`, `email`, `password`, `role` y `active`. Solo OWNER puede gestionar cuentas, incluida la propia. El último OWNER activo no puede desactivarse ni perder su rol; la regla se comprueba dentro de una transacción serializada entre procesos.

Los cambios de contraseña, email, rol o desactivación revocan todas las sesiones y enlaces de recuperación pendientes de esa cuenta. Rehabilitar una cuenta no restaura sesiones antiguas.

## Cookies y permisos

La cookie es HttpOnly, sin Domain y con Path=/. En producción se llama `__Host-porfin_session` y siempre usa Secure; localmente se llama `porfin_session`. SameSite por defecto: Lax. Si frontend y API se publican en sitios distintos, configurar SameSite=None y HTTPS; la protección CSRF sigue siendo obligatoria.

La duración absoluta se configura con SESSION_TTL_HOURS (1–24; predeterminado 8). No se almacena el token en claro en PostgreSQL: solo SHA-256. Los permisos y el estado activo se consultan en cada petición. Las nuevas rutas Nest son privadas por defecto; solo `@Public()` permite acceso sin sesión.

Los passwords usan scrypt con salt aleatorio. No aparecen hashes de passwords ni de tokens en las respuestas. Los errores conservan el contrato uniforme de la etapa 1.

## Recuperación y SMTP

- `MAIL_MODE=file`: solo desarrollo/test. El mensaje queda en `backend/.local/recovery-outbox/`, fuera de Git. No se envía correo.
- `MAIL_MODE=smtp`: configurar SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD y MAIL_FROM.
- `MAIL_MODE=disabled`: recuperación responde 503 para todas las cuentas. Es el valor predeterminado de producción hasta configurar SMTP.

Puerto 587 usa STARTTLS obligatorio; puerto 465 normalmente usa SMTP_SECURE=true. Para Gmail se necesitan las credenciales SMTP apropiadas de la cuenta. Ningún secret se expone al navegador.

PASSWORD_RESET_URL es una URL fija del frontend; en desarrollo, `http://localhost:3000/admin/reset-password`. El mensaje agrega `#token=...`; ese fragmento evita enviar el token en solicitudes de navegación o logs del servidor web. El frontend de F5 lo lee después de hidratar, lo retira de la URL y envía `{ "token": "...", "password": "..." }` a `/auth/reset`. La pantalla está implementada; [entrega y pruebas de F5](frontend-stage-5.md).

El enlace vence en 30 minutos. Un nuevo enlace invalida el anterior; un reset exitoso invalida todos los enlaces y sesiones de la cuenta. Incluso con solicitudes simultáneas, el token solo se consume una vez. La respuesta de recovery no informa si el email existe; no incluye el enlace ni el token. Los fallos de entrega se registran sin direcciones ni credenciales y no cambian esa respuesta.

## Límites y despliegue

Los contadores viven en PostgreSQL, por lo que son compartidos por las réplicas y persisten tras reiniciar:

- Login: 50 intentos por IP y 10 por email cada 15 minutos.
- Recovery: 20 por IP y 3 por email cada 15 minutos.
- Reset: 20 por IP cada 15 minutos.

Configurar API_ORIGIN con el origen exacto de la API y ALLOWED_ORIGINS con el frontend. TRUST_PROXY_HOPS queda en 0 localmente; en Railway debe corresponder al número real de proxies confiables. No se confía en X-Forwarded-For arbitrario.

## Pruebas

`npm.cmd test` prueba utilidades y contrato HTTP. `npm.cmd run test:auth` crea un esquema PostgreSQL aleatorio aislado, aplica migraciones y prueba el flujo completo sin mandar emails. Al terminar elimina únicamente ese esquema y su buzón temporal. No crea un OWNER en la base de desarrollo habitual.
