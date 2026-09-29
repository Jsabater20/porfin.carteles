# Preparación del frontend para despliegue

Todavía no se publicó ningún servicio ni se configuraron cuentas externas. El frontend necesita un alojamiento con Node.js y ejecución de servidor Next.js; no es una exportación estática.

## Build y arranque

Raíz de la aplicación: `Frontend/`. Node.js 22.14 o superior.

```sh
npm ci --include=dev
npm run check
npm run build
npm run start:production
```

El arranque de producción valida variables y escucha en `0.0.0.0`, usando `PORT` proporcionado por el alojamiento. La validación se puede ejecutar sin iniciar el servidor con `NODE_ENV=production npm run check:production`. Estos comandos reciben las variables del entorno; no cargan archivos de secretos por su cuenta.

La compilación no necesita acceder a NestJS ni PostgreSQL. No subir `.env.local`, perfiles de Chrome, capturas de pruebas ni `.test-build`. Los chequeos necesitan dependencias de desarrollo; conservarlas durante la compilación.

## Variables del frontend

| Variable | Valor esperado |
| --- | --- |
| NODE_ENV | production |
| WEB_ORIGIN | Origen HTTPS público exacto, sin rutas, por ejemplo https://tienda.example.com |
| BACKEND_API_URL | HTTPS de NestJS, terminado en /api/v1 |
| PORT | Puerto asignado por el alojamiento, 3000 por defecto |
| SITE_INDEXABLE | false en preparación; true solamente cuando el dominio y contenido estén listos |
| NEXT_TELEMETRY_DISABLED | 1 |

No se usan variables NEXT_PUBLIC para secretos. Credenciales de Neon, Cloudinary o SMTP pertenecen exclusivamente al backend. El control de producción exige HTTPS también hacia NestJS; si se elige una red interna con otra topología, habrá que adaptar y verificar ese contrato explícitamente.

## Salud y operación

- `GET /api/health/live`: comprueba que Next responde.
- `GET /api/health/ready`: consulta la disponibilidad de NestJS/PostgreSQL; devuelve 503 si no están disponibles.
- Ninguna respuesta de salud expone credenciales o direcciones internas.
- Usar el endpoint de vida para reinicios de la instancia; una caída de la base no debería provocar un ciclo de reinicios del frontend.
- Conservar el artefacto anterior para volver atrás. Desplegar las migraciones del backend según su propia guía; Next no las ejecuta.

El frontend conserva lecturas sin caché para evitar datos privados compartidos y mostrar los cambios del catálogo. Las imágenes Cloudinary usan tamaños responsivos, carga diferida salvo la principal de la ficha y un origen permitido explícito.

## Integración que falta configurar afuera

1. Elegir alojamiento Node para la web y definir dominio/HTTPS.
2. Publicar NestJS en Railway y PostgreSQL en Neon, con migraciones y conexión TLS verificadas.
3. Configurar WEB_ORIGIN en ALLOWED_ORIGINS del backend y el enlace de recuperación PASSWORD_RESET_URL hacia /admin/reset-password.
4. Verificar cookies Secure/HttpOnly, SameSite y CSRF pasando por el dominio real de Next.
5. Configurar SMTP y probar un enlace real de recuperación.
6. Configurar Cloudinary con preset firmado y probar carga, confirmación y eliminación reales.
7. Crear el primer OWNER mediante el bootstrap documentado, sin credenciales predeterminadas.
8. Verificar datos comerciales, WhatsApp, precios, modalidades de entrega y contenido publicado.
9. Hacer pruebas desde otro dispositivo, medir rendimiento con imágenes reales y comprobar alertas/backups.
10. Habilitar SITE_INDEXABLE y revisar /robots.txt y /sitemap.xml.

Los límites por IP requieren revisar la cadena real de proxies. La pasarela no confía ni reenvía sin validar las cabeceras X-Forwarded-For enviadas por el navegador; en el estado actual Nest puede agrupar solicitudes bajo la IP de Next. Resolver la atribución con el proveedor antes de abrir tráfico público, sin simplemente confiar en cabeceras externas.

Las mediciones locales y axe detectan problemas concretos, pero no sustituyen lector de pantalla, pruebas con usuarios ni Core Web Vitals con tráfico real. El workflow preparado ejecuta la revisión local en CI; hay que confirmar su ejecución cuando el repositorio esté conectado.

No se hizo una auditoría remota de vulnerabilidades de dependencias ni pruebas contra proveedores reales en esta etapa.
