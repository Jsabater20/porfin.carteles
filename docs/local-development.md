# Prueba local con PostgreSQL

El backend usa actualmente Neon, configurado en `backend/.env`, fuera de Git. Se inicia con `npm run start` sin PostgreSQL local y requiere conexión a Internet. Ver [configuración externa](external-services-setup.md).

La base alternativa `porfin_pruebas` se conserva en PostgreSQL 16, en `127.0.0.1:15432`, con sus migraciones y metadata. Es independiente de `porfin_stage1`; sus datos no fueron borrados. La conexión local anterior quedó respaldada en `.local/backend-before-neon.env`. Para volver a ella, recuperar solamente DATABASE_URL y DIRECT_URL de ese archivo, conservando el resto de la configuración actual.

## Arrancar

En este equipo Windows, `npm run start` dentro de backend comprueba PostgreSQL y enciende automáticamente la instancia existente de `.local/postgres-stage1/data` si la conexión apunta a localhost:15432. No crea ni borra bases, no cambia migraciones y no actúa sobre Neon ni producción. PostgreSQL queda encendido al cerrar la API para poder volver a iniciarla.

Para iniciar la instancia manualmente, desde la raíz, si está detenida:

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

La base Neon comienza sin productos, pedidos ni administradores. Para gestionar datos, crear el primer OWNER con `npm run admin:bootstrap` desde backend, configurando BOOTSTRAP_OWNER_NAME, BOOTSTRAP_OWNER_EMAIL y BOOTSTRAP_OWNER_PASSWORD como explica [autenticación](backend-auth.md). Luego cargar el catálogo desde el panel.

La recuperación de contraseña sigue usando el buzón local de desarrollo hasta configurar Resend. Cloudinary ya está configurado para cargas reales. La API se ejecuta localmente y consulta Neon; todavía no se publicó en Railway.

## Producción y pruebas

El cambio de `start` aplica al desarrollo local. Se conservan `npm run start:prod` en backend y `npm run start:production` en Frontend para despliegue. Para servir un build local de Next se usa `npm run build` y después `npm run start:preview`.

Con PostgreSQL y ambos servidores activos, ejecutar `npm run test:smoke` desde Frontend para comprobar tienda, conexión, acceso protegido y sesión invitada.
