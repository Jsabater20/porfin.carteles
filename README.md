# Por fin Carteles

Tienda online de carteles, props y combos personalizados. El repositorio contiene dos aplicaciones:

- `backend/`: API NestJS con TypeScript, Prisma y PostgreSQL.
- `Frontend/`: tienda y panel administrativo con Next.js y React.

Producción: [porfin-carteles.vercel.app](https://porfin-carteles.vercel.app/).

## Requisitos

- Node.js 22.14 o superior.
- PostgreSQL local o una base Neon.
- Credenciales de Cloudinary para administrar imágenes.
- Credenciales de Resend para recuperar contraseñas por correo.

## Instalación

Desde la raíz:

```powershell
npm.cmd ci
npm.cmd --prefix backend ci
npm.cmd --prefix Frontend ci
```

Crear los archivos locales de variables:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item Frontend/.env.example Frontend/.env.local
```

No se deben guardar contraseñas, tokens ni URLs privadas en Git.

## Base de datos

Configurar en `backend/.env`:

- `DATABASE_URL`: conexión PostgreSQL usada por la aplicación. En Neon debe ser la URL pooled.
- `DIRECT_URL`: conexión directa usada para migraciones.

Aplicar el esquema y cargar los datos iniciales:

```powershell
npm.cmd --prefix backend run prisma:deploy
npm.cmd --prefix backend run prisma:seed
```

## Ejecución local

Backend, en una terminal:

```powershell
npm.cmd run start
```

Frontend, en otra terminal:

```powershell
npm.cmd run start:frontend
```

- Tienda: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- Swagger local: `http://localhost:3001/api/v1/docs`
- Salud de la API: `http://localhost:3001/api/v1/health/ready`

También se puede ejecutar `npm.cmd run start` dentro de cada una de las dos carpetas.

## Variables del backend

La lista completa y los valores locales de ejemplo están en `backend/.env.example`.

| Variable | Uso |
| --- | --- |
| `NODE_ENV`, `PORT`, `API_ORIGIN` | Entorno y dirección pública de la API. |
| `DATABASE_URL`, `DIRECT_URL` | Conexiones pooled y directa de PostgreSQL. |
| `ALLOWED_ORIGINS` | Orígenes permitidos, separados por coma. |
| `SESSION_TTL_HOURS`, `SESSION_SAME_SITE`, `TRUST_PROXY_HOPS` | Sesiones administrativas y proxy. |
| `PASSWORD_RESET_URL` | Página del frontend para restablecer contraseñas. |
| `MAIL_MODE`, `RESEND_API_KEY`, `EMAIL_FROM` | Envío de recuperación mediante Resend. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET` | Gestión de imágenes. |
| `SWAGGER_ENABLED` | Documentación de la API. |

Para crear el primer propietario:

```powershell
$env:BOOTSTRAP_OWNER_NAME="Nombre"
$env:BOOTSTRAP_OWNER_EMAIL="correo@ejemplo.com"
$env:BOOTSTRAP_OWNER_PASSWORD="una-contraseña-segura"
npm.cmd --prefix backend run admin:bootstrap
```

## Variables del frontend

Definidas en `Frontend/.env.example`:

| Variable | Uso |
| --- | --- |
| `BACKEND_API_URL` | URL de NestJS terminada en `/api/v1`. |
| `WEB_ORIGIN` | Origen público exacto del frontend. |
| `SITE_INDEXABLE` | Habilita o deshabilita la indexación. |
| `NEXT_TELEMETRY_DISABLED` | Deshabilita la telemetría de Next.js. |

## Verificación

```powershell
npm.cmd --prefix backend run build
npm.cmd --prefix backend test
npm.cmd --prefix Frontend run check
npm.cmd --prefix Frontend run build
```

Las pruebas de integración del backend requieren una base con permiso para crear y eliminar esquemas temporales.

## Despliegue

- **Railway:** Root Directory en la raíz del repositorio; usa `railway.json`, instala y compila `backend`, ejecuta las migraciones y publica NestJS.
- **Neon:** `DATABASE_URL` pooled para ejecución y `DIRECT_URL` directa para migraciones.
- **Vercel:** Root Directory `Frontend`; requiere `BACKEND_API_URL` y `WEB_ORIGIN` de producción.
- **Cloudinary:** almacena las imágenes del catálogo.
- **Resend:** envía los correos de recuperación desde un dominio verificado.

Antes de desplegar el backend:

```powershell
npm.cmd --prefix backend run check:production
```

Antes de desplegar el frontend:

```powershell
npm.cmd --prefix Frontend run check:production
```

Los workflows de `.github/workflows/` verifican backend y frontend en cada cambio relevante.
