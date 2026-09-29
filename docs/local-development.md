# Prueba local con PostgreSQL

La base `porfin_pruebas` está en PostgreSQL 16, en `127.0.0.1:15432`. Tiene las migraciones del backend y metadata inicial. Es independiente de `porfin_stage1`; sus datos no fueron borrados. La conexión está en `backend/.env`, fuera de Git.

## Arrancar

PostgreSQL debe estar encendido. En este equipo, desde la raíz, si está detenido:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D '.local\postgres-stage1\data' -l '.local\postgres-stage1\server.log' -o '-h 127.0.0.1 -p 15432' -w start
```

Si el entorno restringido no permite ese arranque en segundo plano, ejecutar en una terminal dedicada y mantenerla abierta:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\postgres.exe' -D '.local\postgres-stage1\data' -h 127.0.0.1 -p 15432
```

En una terminal para el backend:

```sh
cd backend
npm run start
```

En otra terminal para el frontend, partiendo de la raíz del proyecto:

```sh
cd Frontend
npm run start
```

En PowerShell, si la política bloquea `npm.ps1`, usar `npm.cmd run start`, que ejecuta el mismo comando sin cambiar la política del equipo.

- Tienda: http://localhost:3000
- Panel: http://localhost:3000/admin/login
- API: http://localhost:3001/api/v1
- Disponibilidad de la base: http://localhost:3001/api/v1/health/ready
- Swagger: http://localhost:3001/api/v1/docs

Ambos servidores observan cambios en desarrollo. Detenerlos con Ctrl+C. Desde la raíz también se puede usar `npm run start:backend` y `npm run start:frontend`, en dos terminales; `npm run start` en la raíz inicia solamente el backend.

## Datos y proveedores

La base comienza sin productos, pedidos ni administradores. Para gestionar datos, crear el primer OWNER con `npm run admin:bootstrap` desde backend, configurando BOOTSTRAP_OWNER_NAME, BOOTSTRAP_OWNER_EMAIL y BOOTSTRAP_OWNER_PASSWORD como explica [autenticación](backend-auth.md). Luego cargar el catálogo desde el panel.

La recuperación de contraseña usa el buzón local de desarrollo. Las imágenes requieren Cloudinary para cargas reales. Esta configuración no publica servicios ni conecta Neon o SMTP.

## Producción y pruebas

El cambio de `start` aplica al desarrollo local. Se conservan `npm run start:prod` en backend y `npm run start:production` en Frontend para despliegue. Para servir un build local de Next se usa `npm run build` y después `npm run start:preview`.

Con PostgreSQL y ambos servidores activos, ejecutar `npm run test:smoke` desde Frontend para comprobar tienda, conexión, acceso protegido y sesión invitada.
