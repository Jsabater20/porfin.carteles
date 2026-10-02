# Por fin! · Backend

NestJS + TypeScript + Prisma + PostgreSQL, siguiendo la organización de AgroManager. El código permanece en `backend`. Infraestructura prevista: Railway, Neon y Cloudinary. La base del frontend Next.js + React está en `Frontend/`.

## Estado

- **Etapa 1 completada:** infraestructura, `/api/v1`, DatabaseModule, HealthModule, validaciones, errores uniformes y Swagger.
- **Etapa 2 implementada:** administradores OWNER/ADMIN, sesiones opacas con cookies, CSRF, recuperación por SMTP configurable y gestión privada de cuentas. [Uso y configuración](docs/backend-auth.md).
- **Etapa 3 implementada:** catálogo privado, categorías, carreras, variantes, formularios dinámicos y combos. [Endpoints y ejemplos](docs/backend-catalog.md).

- **Etapa 4 implementada:** carga firmada con Cloudinary, validación de archivos, galería, portada, orden y limpieza con reintentos. [Configuración y endpoints](docs/backend-media.md).

- **Etapa 5 implementada:** catálogo público con filtros y paginación, fichas seguras y cálculo de precios desde variantes y adicionales. [Contrato y ejemplos](docs/backend-public-catalog.md).

- **Etapa 6 implementada:** sesión invitada con cookie segura, validación completa de personalización, resumen del carrito e idempotencia. [Contrato y ejemplos](docs/backend-preview.md).

- **Etapa 7 implementada:** registro idempotente de pedidos, revalidación del catálogo, snapshots históricos y resumen para WhatsApp.
- **Etapa 8 implementada:** consulta administrativa, estados controlados e historial con administrador y motivo.
- **Etapa 9 implementada:** presupuestos por revisiones inmutables y registro de aceptación.
- **Etapa 10 implementada:** cobros/devoluciones idempotentes y saldo calculado. [Contrato de pedidos, presupuestos y pagos](docs/backend-orders.md).
- **Etapa 11 implementada:** páginas publicables, FAQ, destacados ordenados y configuración pública de contacto/entrega. [Contrato y ejemplos](docs/backend-content.md).

- **Etapa 12 implementada:** controles HTTP, límites persistentes, limpieza de sesiones, comprobaciones de producción, comandos de verificación y CI. Auditoría remota de dependencias pendiente de autorización. [Seguridad y preparación de producción](docs/backend-security-production.md).

[Revisión de las etapas 6 a 11](docs/backend-review-6-11.md).

**Servicios externos:** Neon vinculado y Cloudinary configurado/verificado. La API ya usa Neon con las 10 migraciones aplicadas; Railway y Resend quedan pendientes. [Registro de cambios y verificación](docs/external-services-setup.md).

Cloudinary tiene credenciales privadas y preset firmado verificados con una carga temporal real. Las suites automáticas siguen simulando el proveedor.

El envío SMTP real requiere configurar el proveedor y sus credenciales. Las pruebas usan un buzón de desarrollo y no envían correos. No se creó una cuenta administrativa de producción ni se publicó ningún servicio externo.

El [documento de etapas](docs/backend-roadmap.md) sigue siendo la referencia. Seguimos los títulos principales del documento: 7 pedidos + WhatsApp, 8 operación, 9 presupuestos, 10 pagos, 11 contenido/configuración y 12 seguridad, pruebas y producción. La lista alternativa al final del original no se usa para numerar el trabajo.

## Estructura

```text
backend/
  src/
    common/{filters,guards,decorators,utils}/
    config/
    database/
    modules/{health,auth,admins,catalog,media,pricing,guest-sessions,orders,payments,content,settings}/
    app.module.ts
    main.ts
  prisma/{schema.prisma,migrations,seed.ts}
  scripts/create-owner.ts
  test/
  .env.example
  package.json
```

NestJS 11 y Prisma 5.22 mantienen las versiones base de AgroManager. Prisma y su cliente usan la misma versión. El precio existe exclusivamente en las variantes; los importes son centavos enteros de ARS.

## Prueba local

Para probar la página con PostgreSQL y arrancar cada aplicación con `npm run start`, seguir [la guía local](docs/local-development.md).

## Instalación y ejecución

Requiere Node.js 22.14 o superior y PostgreSQL. Desde PowerShell:

```powershell
cd backend
npm.cmd ci
# Solo en una instalación nueva y si no existe .env:
Copy-Item .env.example .env
# Configurar DATABASE_URL y DIRECT_URL para una base de desarrollo.
npm.cmd run prisma:deploy
npm.cmd run prisma:seed
npm.cmd run build
npm.cmd run start
```

Desde la raíz también funcionan `npm.cmd start`, `npm.cmd run build` y `npm.cmd test`. Usar `npm.cmd` evita el bloqueo de scripts PowerShell de este equipo.

La API usa por defecto el puerto 3001. Swagger: `http://localhost:3001/api/v1/docs`. OpenAPI JSON: `/api/v1/docs-json`. Salud: `/api/v1/health`; disponibilidad de PostgreSQL: `/api/v1/health/ready`.

Para el primer OWNER, seguir el comando `admin:bootstrap` de [autenticación](docs/backend-auth.md). No hay usuario ni contraseña predeterminados. Los administradores creados en las pruebas pertenecen a esquemas temporales y se eliminan al terminar.

## Base local de este equipo

La instancia PostgreSQL 16 de desarrollo es independiente del servicio existente:

- Datos/logs: `.local/postgres-stage1/`, fuera de Git.
- Base de prueba actual: `porfin_pruebas`, puerto local 15432. `porfin_stage1` se conserva.
- Credenciales: `backend/.env`, fuera de Git.

Desde la raíz, si la instancia está detenida:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D '.local\postgres-stage1\data' -l '.local\postgres-stage1\server.log' -o '-h 127.0.0.1 -p 15432' -w start
```

Para detener solo esta instancia:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D '.local\postgres-stage1\data' -m fast -w stop
```

## Verificación

Desde `backend`:

```powershell
npm.cmd run prisma:validate
npm.cmd run build
npm.cmd test
npm.cmd run test:database
npm.cmd run test:auth
npm.cmd run test:catalog
npm.cmd run test:media
npm.cmd run test:public
npm.cmd run test:preview
npm.cmd run test:orders
npm.cmd run test:content
npm.cmd run test:security
# Verificación completa: esquema, build y todas las pruebas
npm.cmd run check
```

Las pruebas de auth, catálogo, imágenes y catálogo público/precios, preview, pedidos y contenido requieren una conexión PostgreSQL con permiso para crear esquemas. Crean esquemas aleatorios aislados, aplican las migraciones y eliminan solo esos esquemas al terminar. La prueba `test:database` comprueba la base configurada, migrada y con seed sin modificar datos de negocio.

Migraciones futuras: `npm.cmd run prisma:migrate -- --name nombre`. Para aplicar migraciones revisadas: `npm.cmd run prisma:deploy`.

## Próximo paso

Configurar los servicios externos y verificar el despliegue real siguiendo la [guía de producción](docs/backend-security-production.md). La auditoría de dependencias requiere la autorización pendiente.

La configuración de Railway, Neon, Cloudinary y SMTP no se realizó durante las etapas de desarrollo.

Cada etapa debe compilar y poder probarse antes de continuar. Las protecciones se implementan con cada funcionalidad.

Railway puede usar la raíz del repositorio con `railway.json`; esa configuración instala y compila solamente `backend`, aplica sus migraciones antes del arranque y ejecuta `backend/dist/main.js`. También se conserva `backend/railway.json` para servicios que configuren `backend` como Root Directory. Configurar HTTPS, orígenes exactos y proxy confiable según el entorno real.

`backend/legacy/`, `docs/reference/frontend-prototype/` y `docs/reference/schema-before-stages.prisma` conservan prototipos anteriores, fuera de la API y de la compilación.

Referencias oficiales utilizadas: [guards NestJS](https://docs.nestjs.com/guards), [filtros de excepciones](https://docs.nestjs.com/exception-filters), [SMTP de Nodemailer](https://nodemailer.com/smtp).

## Frontend: etapas F1–F8 implementadas

La aplicación usa **Next.js + React + TypeScript** en `Frontend/`, con la base de tienda pública, panel administrativo y componentes compartidos. La carpeta `docs/reference/frontend-prototype/` conserva el prototipo existente.

La [arquitectura general y las etapas F1–F8](docs/frontend-architecture.md) definen las pantallas, la integración con NestJS, el carrito y el orden de implementación. F1–F8 ya están implementadas y verificadas: base, catálogo, filtros, fichas, contenido público, personalización y carrito persistente con resumen validado por NestJS, registro de solicitudes, continuación a WhatsApp y acceso administrativo con recuperación. F6 agrega gestión de productos, categorías, carreras, variantes, personalizaciones, combos e imágenes. F7 incorpora pedidos, presupuestos, cobros/devoluciones, páginas, configuración comercial y cuentas de propietarios/administradores. F8 completa los recorridos integrales, accesibilidad automática, SEO y preparación de producción. Sigue la configuración externa y validación bajo el dominio real.

Arrancar el frontend con `npm.cmd run dev:frontend` y abrir **http://localhost:3000**. [Instalación y comandos](Frontend/README.md) · [Entrega y verificaciones de F1](docs/frontend-stage-1.md).

[Entrega y verificaciones de F2](docs/frontend-stage-2.md) · [Entrega y verificaciones de F3](docs/frontend-stage-3.md) · [Entrega y verificaciones de F4](docs/frontend-stage-4.md) · [Entrega y verificaciones de F5](docs/frontend-stage-5.md) · [Entrega y verificaciones de F6](docs/frontend-stage-6.md) · [Entrega y verificaciones de F7](docs/frontend-stage-7.md) · [Revisión integral F8](docs/frontend-stage-8.md) · [Preparación para despliegue](docs/frontend-deployment.md).
