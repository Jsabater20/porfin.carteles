# Revisión general del backend — 27/09/2026

Revisión solicitada para comprobar la base actual y dejar los retoques posteriores separados. Se inspeccionaron autenticación/permisos, catálogo público y privado, invitados, pedidos, presupuestos, pagos, contenido, configuración, arranque y migraciones. No se modificaron las reglas de negocio ni se configuraron proveedores externos.

## Conclusión

No se encontraron fallos bloqueantes en el alcance revisado para continuar el desarrollo local. Esto no equivale a una certificación de seguridad ni a una validación del despliegue real.

## Comprobaciones

- Compilación de API, cliente Prisma y herramientas: correcta.
- Diez migraciones aplicadas; el esquema PostgreSQL local coincide con schema.prisma.
- Pruebas completas: **90 aprobadas, 0 fallos y 0 canceladas**. Resultado registrado en `backend/.local/backend-review-20260927.log`.
- Consultas públicas con NUL se rechazan con 400, antes de llegar a PostgreSQL.
- Con el puerto ocupado en la interfaz de escucha, el binario compilado termina con código 1 y mensaje controlado.

## Retoques para después

1. **Completar los contratos Swagger de pedidos y pagos antes de generar un cliente frontend.** El pedido devuelve datos de cliente/entrega que aún no están todos declarados en OrderResponseDto. GET del pedido y varios endpoints administrativos no describen completamente sus respuestas. El comportamiento HTTP existe; la documentación tipada está incompleta.
2. **Alinear el tipo de retorno de moneyJson con los datos serializados.** Convierte Prisma.Decimal a números, pero su firma conserva T. Hoy se usa como salida HTTP; conviene corregir ese tipo antes de reutilizar el resultado en cálculos TypeScript.
3. **Medir concurrencia con uso real antes de optimizar.** El bloqueo compartido mantiene consistentes escrituras, estados y saldos. Una prueba de carga determinará si conviene reducir su alcance; no se cambió sin evidencia de un problema de rendimiento.

## Antes de publicar

Continúan pendientes la configuración y las pruebas reales de Railway, Neon, Cloudinary y SMTP, y la auditoría remota de dependencias. npm audit no se reintentó: la autorización para enviar nombres/versiones al registro npm sigue pendiente según el bloqueo de permisos anterior. Ver [guía de producción](backend-security-production.md).