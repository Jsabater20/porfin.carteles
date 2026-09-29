# Por fin! · Frontend

F1–F8 implementadas con Next.js 16.3.6, React 19.3 y TypeScript 5.9. Las dependencias quedan fijadas en `package-lock.json`.

## Ejecutar localmente

Requiere Node.js 22.14 o superior. Desde esta carpeta, en PowerShell:

```powershell
npm.cmd ci --no-audit --no-fund
# Solo si todavía no existe .env.local:
Copy-Item .env.example .env.local
npm.cmd run start
```

Abrir **http://localhost:3000**. NestJS debe estar en el puerto 3001 y PostgreSQL debe estar iniciado para consultar datos reales. Desde la raíz, `npm.cmd start` inicia el backend y `npm.cmd run start:frontend` inicia el frontend en otra terminal. La configuración de la base local está en el [README principal](../README.md).

Si NestJS está apagado, la portada conserva la navegación y muestra un aviso. Para las escrituras, abrir el origen exacto configurado en `WEB_ORIGIN`: `localhost` y `127.0.0.1` no son intercambiables.

## Configuración

| Variable | Uso |
| --- | --- |
| `BACKEND_API_URL` | URL del servidor de NestJS, terminada en `/api/v1`. Predeterminado: `http://127.0.0.1:3001/api/v1`. |
| `WEB_ORIGIN` | Origen exacto del navegador; debe estar en `ALLOWED_ORIGINS` de NestJS. Predeterminado: `http://localhost:3000`. |
| `NEXT_TELEMETRY_DISABLED` | Desactiva la telemetría de Next.js en desarrollo y compilación. |

Estas variables son de servidor. No se copian credenciales de PostgreSQL, SMTP ni Cloudinary al frontend. La conexión HTTP está permitida únicamente en loopback; fuera del equipo local se exige HTTPS. El alojamiento y la cadena de proxies se configurarán más adelante.

## Base, catálogo y carrito

- Portada inicial adaptable, navegación y estilos compartidos con variables CSS.
- Layouts separados de tienda, acceso y panel; metadatos y administración fuera de indexación.
- Catálogo con filtros, búsqueda, orden y paginación.
- Fichas con galería, variantes, precios base y opciones a cotizar.
- Personalización con texto, números, selecciones y componentes de combos.
- Carrito editable, persistencia local durante siete días y sincronización entre pestañas.
- Resumen validado por NestJS, con reintentos idempotentes, vencimiento y avisos por cambios de precios.
- Inicio publicado, destacados, Nosotros, Contacto y FAQ.
- Estados de carga, error, sin resultados y producto no disponible.
- Configuración pública real desde NestJS mediante componentes de servidor.
- Cliente HTTP de navegador y cliente exclusivo de servidor, ambos sin caché.
- Pasarela con rutas explícitas, filtrado de cookies, origen exacto, JSON limitado a 1 MiB y conservación de CSRF, idempotencia, errores y cookies.
- Login, logout, recuperación y reset de contraseña, con navegación según rol.
- Verificación administrativa mediante `/auth/me`, también en la página privada, con manejo de sesión vencida.
- Gestión privada de productos, categorías y carreras, variantes, campos de personalización y combos.
- Galería con carga firmada, confirmación recuperable, portada, orden, descripciones y eliminación.
- Pedidos, estados, presupuestos por revisión y registro manual de cobros/devoluciones con recuperación del intento.
- Páginas, destacados, configuración comercial y administración de cuentas exclusiva de OWNER.
- Chequeos automáticos y workflow de CI.

La base local todavía no tiene productos publicados. El catálogo muestra el estado vacío hasta que haya productos visibles. El registro de solicitudes y la continuación a WhatsApp están implementados. Login, logout y recuperación están implementados. La gestión del catálogo está implementada en F6 y la operación, contenido, configuración y cuentas están disponibles desde F7. La sesión invitada permite validar el carrito y registrar/consultar sus pedidos. El acceso está en /admin/login. Para la base habitual se requiere un administrador existente o el bootstrap del primer OWNER; las cuentas usadas por los tests se eliminan con sus esquemas temporales.

## Verificación

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:storefront
# Con PostgreSQL, NestJS y Next.js encendidos:
npm.cmd run test:smoke
```

`check` ejecuta ESLint, TypeScript y 75 pruebas de contratos, pasarela, personalización, persistencia, validación del carrito, registro de pedidos y acceso/edición administrativa. Se compilan con TypeScript y se ejecutan con Node, sin dependencias adicionales de testing. `test:smoke` comprueba las rutas reales, protección del panel, conexión a PostgreSQL y una sesión invitada temporal que revoca al finalizar; no crea productos, cuentas ni pedidos. La compilación no requiere backend ni base de datos.

Para probar el build: `npm.cmd run start:preview`, con el servidor de desarrollo detenido. El workflow `frontend.yml` comprueba instalación, código, tipos, pruebas y build; también incluye recorridos integrales con APIs aisladas y Nest/PostgreSQL. El workflow incorpora PostgreSQL temporal y los recorridos de navegador; su ejecución remota debe confirmarse al conectar el repositorio.

`test:storefront` requiere un build previo e inicia sus propios servidores en 3100/3101. Usa ejemplos aislados, sin escribir en PostgreSQL ni conectar proveedores externos.

Se conserva ESLint 9 porque los plugins de React/accesibilidad incluidos por la configuración de Next instalada declaran compatibilidad hasta esa versión. npm muestra su aviso de fin de soporte; revisar la compatibilidad del conjunto antes de migrar a ESLint 10. No se ejecutó una auditoría remota de dependencias.

Más detalle: [registro de F1](../docs/frontend-stage-1.md), [entrega de F2](../docs/frontend-stage-2.md), [entrega de F3](../docs/frontend-stage-3.md), [entrega de F4](../docs/frontend-stage-4.md), [entrega de F5](../docs/frontend-stage-5.md), [entrega de F6](../docs/frontend-stage-6.md), [entrega de F7](../docs/frontend-stage-7.md), [revisión F8](../docs/frontend-stage-8.md) y [arquitectura y etapas](../docs/frontend-architecture.md).

El recorrido interactivo del carrito se ejecuta después del build con:

```powershell
npm.cmd run test:cart-browser
```

Requiere Chrome instalado; usar CHROME_PATH si está en otra ubicación. Inicia servidores propios en 3100/3101 y un navegador aislado en 9232; los cierra al terminar. Comprueba personalización, persistencia, edición, cotización, precios cambiados, reintentos, vencimiento y tamaños de pantalla. Usa una API de contratos de prueba; el backend se verifica por separado con PostgreSQL mediante test:preview. En entornos locales restringidos que lo necesiten puede usarse TEST_BROWSER_NO_SANDBOX=1 exclusivamente para este navegador de pruebas con perfil aislado. Las capturas se guardan en .test-build/.
F4 agrega dos comprobaciones después del build:

```powershell
npm.cmd run test:orders-browser
# Con PostgreSQL y las dependencias de backend instaladas:
npm.cmd run test:orders-real
```

El primer comando prueba el flujo de solicitud y WhatsApp en Chrome con una API aislada (3100/3101 y 9232). El segundo conecta Next en 3102 con NestJS y PostgreSQL reales, crea un esquema temporal y lo elimina al finalizar. Ambos cierran sus servidores. Ejecutar los recorridos de navegador secuencialmente. No envían mensajes ni configuran proveedores.

Los datos de contacto no se guardan en localStorage ni sessionStorage. Para recuperar un envío sin respuesta al recargar, se conserva por pestaña la clave del intento, la referencia del preview y hashes; se pide reingresar los mismos datos. El resumen registrado requiere la sesión invitada original.
Para verificar F5 con Chrome, NestJS y PostgreSQL reales, después del build:

```powershell
npm.cmd run test:auth-browser
```

Requiere Chrome instalado, PostgreSQL activo y las dependencias de backend. Usa Next en 3100 y Chrome en 9232; crea y elimina un esquema y un buzón de pruebas aislados. No envía correos reales ni crea administradores en la base habitual. Detalle, requisitos y capturas en [F5](../docs/frontend-stage-5.md).

Para verificar F6 con catálogo e imágenes, después del build:

```powershell
npm.cmd run test:catalog-browser
```

Usa Chrome, Next y NestJS reales con PostgreSQL en un esquema temporal. Comprueba creación, edición, publicación, combos, conflictos e imágenes; el proveedor de imágenes está simulado y no recibe archivos reales. Comparte los puertos 3100/9232 con los otros recorridos, por lo que deben ejecutarse por separado. [Detalle de F6](../docs/frontend-stage-6.md).

Para verificar F7 (operación, contenido y cuentas), después del build:

```powershell
npm.cmd run test:operations-browser
```

Requiere Chrome, PostgreSQL y las dependencias del backend. Usa Next en 3100 y Chrome en 9232, con datos en un esquema temporal que elimina al terminar. Incluye un cobro cuya respuesta se interrumpe: recarga la página y verifica que reintentar conserve un solo movimiento. También comprueba presupuestos, devoluciones, contenido público, cuentas y permisos. No ejecuta transferencias ni envía mensajes. [Detalle de F7](../docs/frontend-stage-7.md).

Para cerrar F8, `npm.cmd run test:release` ejecuta check, build y los ocho recorridos integrales de forma secuencial. Requiere Chrome, PostgreSQL y dependencias de ambos proyectos; utiliza esquemas temporales y cierra sus servidores. Si check y build ya pasaron para el código actual, usar `npm.cmd run test:release -- --built`.

La [guía de despliegue](../docs/frontend-deployment.md) documenta las variables, `check:production`, `start:production`, los endpoints de salud y los pasos externos pendientes. La indexación permanece desactivada por defecto hasta preparar el dominio y el contenido público.
