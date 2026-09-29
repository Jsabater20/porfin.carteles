# Etapa 12: seguridad, pruebas y preparación de producción

Fecha: 25/09/2026. Esta etapa prepara y verifica el backend localmente. La configuración de cuentas, dominios, credenciales y servicios externos queda para el paso siguiente.

## Seguridad implementada

- Sesiones opacas de administrador e invitado: solo el hash se guarda en PostgreSQL. Cookies HttpOnly, Secure y prefijo __Host- en producción, sin Domain y con Path=/.
- CSRF asociado a cada sesión, comprobación de Origin, JSON y X-Requested-With. OWNER administra cuentas; OWNER/ADMIN gestionan catálogo, pedidos y contenido. El acceso invitado se limita a sus propios pedidos y previews.
- El logout administrativo ahora comparte el bloqueo transaccional de las escrituras. Una sesión revocada se rechaza también dentro de las operaciones privadas.
- DTOs estrictos, campos adicionales rechazados, cálculo de precios en servidor, idempotencia de pedidos y pagos, snapshots e historial, según [la revisión anterior](backend-review-6-11.md).
- Cabeceras nosniff, DENY, Content-Security-Policy, Referrer-Policy y Permissions-Policy. HSTS de un año solo en producción. Swagger tiene una política que permite sus recursos locales cuando está habilitado; la comprobación previa al despliegue exige deshabilitarlo.
- Todas las respuestas usan no-store y un X-Request-Id generado por el servidor. Los errores no devuelven stacks, cuerpos, cookies o cadenas de conexión. Los fallos de arranque muestran un mensaje propio sin credenciales.
- Cuerpos limitados a 1 MiB; cuerpos comprimidos rechazados con 415. El servidor limita el tiempo para recibir encabezados/cuerpo y las solicitudes por conexión.
- Producción exige API_ORIGIN explícito, orígenes HTTPS exactos y PASSWORD_RESET_URL dentro de los orígenes autorizados del frontend. DATABASE_URL y DIRECT_URL requieren sslmode=require y sslaccept=strict. Se rechaza NODE_TLS_REJECT_UNAUTHORIZED=0.
- Limpieza cada 15 minutos de sesiones/tokens administrativos vencidos o usados hace más de 24 horas, además de la limpieza de invitados y previews existente. Las cuentas, pedidos y movimientos no se eliminan por esta limpieza.

### Límites persistentes

Los contadores son atómicos y viven en PostgreSQL, compartidos entre réplicas. Una respuesta 429 incluye Retry-After. El valor indica una espera conservadora del intervalo completo.

| Operación | Límite |
| --- | --- |
| Lecturas públicas GET/HEAD | 300 por IP por minuto, compartidas entre rutas |
| Crear/reutilizar sesión invitada | 30 por IP por hora |
| Preview | 120 por IP y 60 por sesión cada 15 minutos |
| Crear pedido | 120 por IP y 60 por sesión por hora |
| Login | 50 por IP y 10 por email cada 15 minutos |
| Recuperación | 20 por IP y 3 por email cada 15 minutos |
| Reset de contraseña | 20 por IP cada 15 minutos |

Los healthchecks quedan fuera del límite de lecturas. Los endpoints inexistentes y los recursos estáticos de Swagger no pasan por ese guard. Estos controles no sustituyen las protecciones de tráfico del proveedor.

TRUST_PROXY_HOPS permanece en 0 localmente. Al publicar se debe establecer la cantidad real de proxies confiables; aceptar encabezados reenviados sin comprobar la topología permitiría falsear la IP. Las pruebas verifican que con 0 no se pueda eludir el límite cambiando X-Forwarded-For.

## Resultado local

- Prisma válido y compilación de API/herramientas correcta.
- Ejecución final: **88 pruebas aprobadas, 0 fallos, 0 canceladas**. Log local: `backend/.local/stage12-final.log`, excluido de Git.
- Arranque del binario compilado comprobado con PostgreSQL local: readiness, autenticación, cabeceras y Swagger cerrado correctos.
- Preflight probado con variables ficticias: acepta una configuración completa y rechaza configuraciones inseguras sin conectarse a proveedores.
- Workflow YAML validado y lockfile coherente; CI remoto y despliegue real todavía no ejecutados.

Una ejecución inicial tuvo un fallo de conexión local en autenticación. La suite aislada y la ejecución completa posterior pasaron; no se modificaron ni omitieron esas pruebas para lograr el resultado.

## Verificación reproducible

Desde backend, con PostgreSQL de desarrollo disponible, migraciones y seed aplicados:

```powershell
npm.cmd run check
```

Este comando valida Prisma, genera el cliente, compila la API y las herramientas y ejecuta todas las pruebas con concurrencia limitada. `npm.cmd run test:all` repite solo las pruebas; requiere una compilación previa para las pruebas de artefactos de despliegue. `npm.cmd run test:security` ejecuta las pruebas específicas de seguridad.

Las integraciones crean y eliminan esquemas aleatorios de prueba. Usar una base de desarrollo con permiso CREATE SCHEMA, nunca la base de clientes. La prueba de base general solo lee metadata/health de la base configurada. Cloudinary usa un proveedor simulado; no se envían correos ni movimientos bancarios reales.

Las pruebas HTTP de producción usan cookies/cabeceras/configuración de producción con la conexión local de pruebas. No representan una verificación de TLS de Neon ni del proxy de Railway.

El workflow `.github/workflows/backend.yml` prepara PostgreSQL 16, Node 22 y ejecuta el mismo comando. Está escrito y validado localmente; su ejecución en GitHub queda pendiente de subir/conectar el repositorio. No contiene credenciales reales: la contraseña del servicio PostgreSQL es exclusiva de su contenedor de pruebas.

## Despliegue preparado

Railway debe usar `backend` como raíz y `backend/railway.json` como configuración. Se dejó preparado:

1. Build: `npm ci --include=dev --no-audit && npm run build`.
2. Predeploy: `npm run predeploy`, que valida configuración y ejecuta `prisma migrate deploy`.
3. Arranque: `node dist/main.js`.
4. Readiness: `/api/v1/health/ready`, con 120 segundos de espera y reinicio ante fallo.

Prisma CLI es dependencia de producción para que las migraciones sigan disponibles si el entorno excluye herramientas de desarrollo. La creación del OWNER también tiene un comando compilado que no depende de ts-node:

```powershell
npm.cmd run admin:bootstrap:prod
```

Recibe BOOTSTRAP_OWNER_NAME, BOOTSTRAP_OWNER_EMAIL y BOOTSTRAP_OWNER_PASSWORD por variables de entorno, crea solamente el primer OWNER y nunca reemplaza cuentas. Quitar esas variables después de usarlo. No se ejecuta automáticamente al desplegar. `npm.cmd run seed:prod` inicializa únicamente metadata de la aplicación, sin usuarios ni productos de ejemplo.

`npm.cmd run check:production` valida las variables ya cargadas, sin conectarse a proveedores. Exige NODE_ENV=production, TLS estricto para PostgreSQL, Swagger deshabilitado, SMTP configurado y las cuatro variables de Cloudinary. Pasar este control no demuestra que las credenciales funcionen. Con el .env local de desarrollo debe fallar; no se debe cambiar ese archivo solo para forzar un resultado positivo.

La API escucha en PORT sobre 0.0.0.0 y tiene hooks de cierre para desconectar Prisma y finalizar tareas de limpieza. No se agregaron migraciones de datos en esta etapa.

## Pasos externos pendientes

1. Crear/configurar Neon; separar URL pooled de ejecución y URL directa de migraciones, con TLS verificado.
2. Configurar Railway, dominio HTTPS, variables, raíz del servicio y proxy confiable. Usar el mismo sitio para frontend/API cuando sea posible; las cookies entre sitios pueden ser bloqueadas por navegadores incluso con SameSite=None.
3. Configurar Cloudinary y su preset firmado con límites, y SMTP; probar una imagen y una recuperación de contraseña reales.
4. Ejecutar predeploy, crear el primer OWNER, cargar los datos comerciales reales y comprobar health/readiness, login/logout, pedido y WhatsApp desde el navegador.
5. Configurar copias de seguridad/restauración, alertas de disponibilidad y retención de logs. Antes de migraciones futuras, respaldar y ensayar restauración; no usar migrate reset en producción. Para volver a una versión, comprobar compatibilidad del esquema antes de revertir el código.

### Auditoría de dependencias pendiente

La revisión automática de permisos rechazó npm audit porque enviaría los nombres y versiones de las dependencias a registry.npmjs.org sin autorización explícita. Se solicitó autorización y no se eludió el bloqueo. No se afirma que las dependencias estén libres de vulnerabilidades.

Tras autorizar ese envío, ejecutar `npm audit --omit=dev` y luego `npm audit` para revisar también las herramientas de build. Corregir los avisos aplicables y repetir las pruebas antes de publicar. Las instalaciones preparadas usan --no-audit para no enviar ese informe automáticamente.

Referencias oficiales consultadas: [configuración de Railway](https://docs.railway.com/config-as-code/reference), [predeploy de Railway](https://docs.railway.com/deployments/pre-deploy-command), [opciones PostgreSQL de Prisma](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql) y [cabeceras de seguridad](https://helmet.js.org/).