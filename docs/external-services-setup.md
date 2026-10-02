# Configuración externa · 30/09/2026

Se siguió la [skill oficial de Neon](https://neon.com/.well-known/agent-skills/neon/SKILL.md), conservando NestJS, Prisma, la autenticación existente, Cloudinary y la base local.

## Neon

- Instalado globalmente el CLI oficial `neon` 7.0.1. La sesión anterior estaba vencida; se renovó con acceso en el navegador.
- `neon skills -y` instaló las ocho skills oficiales en `.agents/skills/`, con `skills-lock.json`. No había skills Neon en el proyecto antes de la instalación.
- Para instalar skills, el CLI exigió Node >=22.20.0. Se descargó Node 22 actualizado en `.local/neon-runtime/`, sin reemplazar la instalación global de Node ni la versión usada para ejecutar la aplicación.
- Se agregó `.codex/config.toml` con el MCP HTTPS oficial, OAuth y alcance limitado a `blue-snow-11449064`. No se encontró una configuración Neon previa en el proyecto ni se reemplazó la configuración global de Codex. El acceso OAuth del MCP se completa en el cliente al usarlo; no equivale a la sesión del CLI ni se verificó una llamada MCP en esta sesión.
- Directorio vinculado al proyecto `blue-snow-11449064`, rama `production` (`br-square-cherry-b6lfd0am`), mediante `.neon`, excluido de Git.
- `neon config init` agregó `@neon/config` y `@neon/env` al package.json raíz y creó package-lock.json. Los comandos existentes del proyecto se conservaron.
- `neon.ts` contiene exactamente `defineConfig({})`, como se solicitó.
- `neon config plan` y `neon deploy` terminaron correctamente, sin cambios remotos porque Postgres ya coincide con la política vacía.
- Las variables `DATABASE_URL`, `DATABASE_URL_UNPOOLED` y `NEON_BRANCH` se descargaron a `.env.local` en la raíz, fuera de Git.
- Se verificaron ambas conexiones mediante Prisma, con `sslmode=require` y `sslaccept=strict`. La base estaba vacía antes de aplicar el esquema del proyecto.

**La API ya está configurada para Neon.** Nest carga `backend/.env`, actualizado con DATABASE_URL pooled y DIRECT_URL directa, conservando TLS estricto y channel_binding=require. Next sigue consultando la API y no recibe credenciales de la base. Se guardó la configuración anterior en `.local/backend-before-neon.env`; la base `porfin_pruebas` local se conserva.

Las 10 migraciones se probaron en una rama temporal de production y luego se aplicaron con Prisma migrate deploy a la base remota vacía. Se inicializó únicamente la metadata de la aplicación. La rama temporal se eliminó al terminar. La API se verificó en un puerto temporal contra Neon: health/ready, products y settings/public respondieron HTTP 200. Se crearon el primer OWNER y un ADMIN solicitados, con inicio de sesión y permisos verificados. Todavía no hay productos ni pedidos. No se transfirieron datos de la base local.

Reiniciar los procesos Nest que estaban abiertos para cargar la nueva conexión. `npm run start` ya no necesita encender PostgreSQL local mientras DATABASE_URL apunte a Neon. Las suites que crean datos/esquemas de prueba deben ejecutarse con una base local o rama aislada, no con la conexión de production.

`neon deploy` con esta política no aplica migraciones Prisma ni despliega NestJS o Next.js; las migraciones se ejecutaron por separado como se describe arriba.

## Cloudinary

- Cloud name confirmado: `dszzkrokq`.
- Credenciales verificadas contra la API de Cloudinary y guardadas en `backend/.env`, fuera de Git. Se conservó una copia privada del archivo anterior en `.local/backend-before-cloudinary.env`.
- Creado un preset nuevo `porfin_carteles`, firmado, para JPG/PNG/WebP, con entrega pública, sin prefijos ni transformaciones de entrada y overwrite desactivado. Los presets e imágenes anteriores se conservaron.
- Corregida la validación de CloudinaryService: el proveedor no admite un límite de peso por preset. Antes se exigía un campo inexistente y las cargas reales quedaban bloqueadas. Se mantienen las restricciones de firma, formatos y entrega, y el rechazo de prefijos y transformaciones incompatibles.
- El frontend limita a 5 MiB antes de subir; el backend consulta los bytes reales antes de incorporar la imagen al catálogo. Un archivo mayor subido por un cliente modificado se rechaza y queda programado para limpieza; no se garantiza impedir su almacenamiento temporal en Cloudinary.
- Se verificaron el preset mediante el servicio real del backend, la carga firmada de un PNG temporal, su inspección y su eliminación. No se agregaron imágenes al catálogo.
- Scripts y archivos auxiliares privados de configuración/verificación están en `.local/`, excluida de Git; no contienen datos para publicar.

Referencia: [presets de Cloudinary y límites admitidos](https://cloudinary.com/documentation/upload_presets).

El secreto compartido en el chat debe rotarse antes de publicar y actualizarse en las variables privadas.

## Pendiente

- Configurar Resend en una etapa posterior, según la decisión del usuario. No se cambió el transporte de correo ni se enviaron mensajes.
- Cargar el catálogo en Neon; las dos cuentas administrativas ya están creadas.
- Configurar Railway, dominio y variables de producción; publicar y verificar los flujos completos bajo HTTPS.
- Completar el acceso OAuth del MCP en el cliente que lo vaya a usar.

Los archivos existentes de etapas documentan sus resultados históricos; este registro describe el estado de la configuración externa después de aquellas pruebas.

## Verificación del cambio de código

TypeScript y build del backend correctos. Pasaron las cuatro pruebas unitarias de media y las ocho comprobaciones de integración con PostgreSQL local en un esquema temporal. Incluyen rechazo de tamaño mayor a 5 MiB, metadatos incompatibles, permisos y limpieza. Las verificaciones remotas fueron las consultas de solo lectura en Neon y la imagen temporal de Cloudinary descritas arriba.
