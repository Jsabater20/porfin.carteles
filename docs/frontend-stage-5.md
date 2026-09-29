# Frontend F5 · Acceso administrativo

Fecha de verificación: 28 de septiembre de 2026.

## Entrega

- `/admin/login`: correo y contraseña, validación, errores genéricos de credenciales, mostrar/ocultar contraseña y bloqueo temporal ante HTTP 429.
- `/admin/recuperar`: solicitud de enlace con respuesta genérica, sin revelar si la cuenta existe.
- `/admin/reset-password`: lectura del token desde `#token=...`, retirada del fragmento de la URL, contraseña nueva de 12 a 128 caracteres y confirmación. Admite abrir otro enlace en la misma pestaña y explica enlaces ausentes, vencidos o utilizados.
- Panel protegido desde el servidor, tanto en su layout como en la página. Cada lectura consulta la sesión real mediante `/auth/me`.
- Identidad y rol visibles; la opción de administrar cuentas aparece únicamente para OWNER. Catálogo, pedidos, contenido y cuentas conservan su estado “Próximamente”, según las etapas F6 y F7.
- Cierre de sesión autenticado con CSRF actual. Un fallo de conexión no se presenta como un cierre exitoso.
- Sesión vencida: se retira el contenido del panel y se vuelve al acceso con una explicación.
- Revisión al cargar, recuperar foco, volver a la pestaña y cada 60 segundos, más vencimiento absoluto en memoria. BroadcastChannel comunica cambios entre pestañas sin transportar credenciales; donde no esté disponible continúan las revisiones por foco y temporizador.

## Organización y seguridad

`features/auth/` separa validación, formularios, sesión del servidor y coordinación de sesión del navegador. `AdminProvider` comparte el estado solamente dentro del panel. Su cliente de operaciones privadas agrega CSRF, reacciona a 401/403 y nunca repite automáticamente una escritura.

La cookie opaca permanece HttpOnly. Contraseñas, token de recuperación y CSRF no se guardan en localStorage ni sessionStorage. Cerrar la sesión administrativa no elimina el carrito ni la sesión invitada.

Los formularios usan POST y permanecen deshabilitados hasta que React esté listo; las contraseñas nunca se envían como parámetros de navegación. La contraseña se mantiene exactamente como se escribe, sin recortarla. El correo se normaliza de acuerdo con el contrato del backend.

El token de recuperación solo se conserva en memoria y se envía en el cuerpo de `POST /auth/reset`. Al recargar después de retirarlo de la URL, hace falta volver a abrir el enlace del correo. Las páginas administrativas están fuera de indexación y usan una política de referencia restrictiva. El reset no inicia sesión automáticamente.

La navegación por rol ayuda a usar el panel; los permisos efectivos siguen siendo responsabilidad de los guards de NestJS. No se habilitaron endpoints nuevos de gestión ni se implementaron todavía las pantallas de F6/F7.

## Verificaciones

- **55 pruebas** de frontend aprobadas: contratos, pasarela, carrito/pedidos y nueve pruebas nuevas de acceso, tokens, roles, reintentos, cierre y vencimiento.
- ESLint y TypeScript aprobados, sin advertencias. Build de producción aprobado.
- Suite `test:auth` del backend: **8 tests** con PostgreSQL real aprobados, incluidos CSRF, roles, recuperación de un uso, revocación y límites.
- Chrome → Next.js → NestJS → PostgreSQL: acceso anónimo rechazado, validación y foco, credenciales incorrectas, login OWNER/ADMIN, cookie HttpOnly y navegación por rol.
- Logout con CSRF, preservación de cookie invitada y almacenamiento local, expiración de sesión y regreso al login.
- Recuperación genérica para correo existente y desconocido; lectura del buzón local aislado, token retirado de la URL, contraseña y confirmación, cambio exitoso, rechazo al reutilizar el enlace y acceso con la clave nueva.
- Anchos de 1440, 390 y 320 píxeles sin desbordes horizontales ni excepciones JavaScript. Capturas de acceso y panel revisadas.

El recorrido real crea administradores y buzón únicamente en un esquema temporal. El esquema y el buzón se eliminan al terminar. No se crearon cuentas en la base habitual ni se enviaron correos por SMTP.

## Ejecutar

Desde `Frontend/`:

```powershell
npm.cmd run check
npm.cmd run build
# Requiere Chrome, PostgreSQL y dependencias de backend:
npm.cmd run test:auth-browser
```

El recorrido usa Next en 3100, Nest en un puerto temporal y Chrome en 9232. Inicia y cierra sus procesos y utiliza un perfil aislado. `CHROME_PATH` permite indicar el ejecutable. En un entorno local restringido se puede usar `TEST_BROWSER_NO_SANDBOX=1` exclusivamente para ese navegador de prueba. Ejecutarlo separado de los otros recorridos que usan los mismos puertos.

Las capturas quedan en `Frontend/.test-build/login-{1440,390}.png` y `Frontend/.test-build/admin-{1440,390}.png`. Desde `backend/`, `npm.cmd run test:auth` repite la suite de autenticación. El CI existente sigue ejecutando los chequeos del frontend; este recorrido con Chrome y PostgreSQL se ejecutó localmente.

Para usar la base habitual se necesita un administrador existente o crear el primer OWNER mediante el procedimiento de [autenticación del backend](backend-auth.md). No hay credenciales predeterminadas. El acceso local está en **http://localhost:3000/admin/login**.

`PASSWORD_RESET_URL` debe apuntar a `http://localhost:3000/admin/reset-password` en desarrollo. Con `MAIL_MODE=file`, los enlaces quedan en el buzón local configurado por NestJS. SMTP, Railway, Neon y Cloudinary siguen pendientes de configuración externa, según lo acordado.

Siguiente etapa: **F6, administración del catálogo**. [Arquitectura general](frontend-architecture.md).
