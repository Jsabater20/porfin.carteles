# Revisión de etapas 6 a 11

Fecha: 24/09/2026. Referencia: títulos principales de [backend-roadmap.md](backend-roadmap.md), según lo solicitado. La lista alternativa de 13 pasos al final de ese archivo no es la numeración de implementación.

## Resultado de la revisión

La etapa 6 ya tenía validación del carrito, sesiones invitadas e idempotencia. Las etapas 7 a 10 tenían una base funcional, pero faltaban controles de integridad y partes del flujo. Se corrigieron durante esta revisión. La etapa 11 quedó implementada con persistencia, permisos, validación y pruebas.

| Etapa | Hallazgo | Resultado |
| --- | --- | --- |
| 6. Invitados y preview | Faltaban atributos de variante en el resumen que luego se convierte en snapshot. Una prueba todavía esperaba que POST /orders no existiera. | El preview incluye atributos, y la prueba ahora comprueba que el payload de preview no crea un pedido. Se conserva la validación de personalizaciones, límites, propiedad, expiración e idempotencia. |
| 7. Pedidos + WhatsApp | Se confiaba en un preview sin verificar cambios de catálogo. WhatsApp apuntaba al teléfono del cliente. Faltaba consultar un pedido propio y validar datos de entrega. | Revalidación transaccional; 409 si cambian condiciones; GET por sesión propietaria; snapshots con atributos y fotos; fecha/dirección/teléfono validados. Enlace al número configurado de la tienda y resumen útil; null si falta configurar. |
| 8. Operación | Se podía cancelar un pedido entregado. Las escrituras podían competir y el actor registrado era el ID de sesión. Faltaban lecturas administrativas. | Transiciones controladas, motivo de cancelación, estados terminales, listado paginado y detalle. Bloqueo y revalidación de sesión dentro de la escritura; eventos con ID del administrador. |
| 9. Presupuestos | Existían revisiones pero faltaba el flujo de aceptación; crear versiones simultáneas podía fallar. | Versiones serializadas, líneas/importe históricos inmutables, DRAFT → SENT → ACCEPTED/REJECTED y control de última revisión. No se acepta un total menor al neto cobrado sin devolución previa. |
| 10. Pagos | Se aceptaban cobros sobre borradores, faltaba idempotencia, la concurrencia podía fallar y no se podía devolver tras cancelar. | Clave obligatoria por movimiento, presupuesto aceptado vigente para cobrar, saldo consistente, consulta de movimientos y devoluciones tras cancelación. Registra administrador real y permite reintentar sin duplicar. |
| 11. Contenido/configuración | Faltaba completar el módulo y su persistencia verificable. | Home, Nosotros, Contacto, FAQ, borrador/publicación, destacados ordenados, WhatsApp, redes, entrega y plazos. Proyección pública explícita y escrituras protegidas con CSRF. |

## Corrección transversal de importes

Los totales de pedidos y presupuestos usaban INTEGER PostgreSQL (32 bits), aunque los límites de cantidad/precio permitían superar ese rango. Se migraron a DECIMAL(16,0), con restricciones de integridad. La API mantiene centavos como números enteros seguros, sin redondeo flotante en la persistencia. Se probaron pedidos de 100.000.000.000 centavos y presupuestos de 10.000.000.000.000 centavos.

La migración agrega claves de idempotencia a movimientos anteriores sin eliminarlos. Si un actor histórico corresponde al ID de una sesión aún existente, lo convierte al administrador de esa sesión. No inventa identidades para sesiones ya eliminadas ni acepta automáticamente presupuestos legados.

## Verificación

- Compilación de NestJS y cliente Prisma: correcta.
- Esquema Prisma: válido.
- Diez migraciones aplicadas a PostgreSQL local; comparación de esquema sin diferencias.
- Ejecución completa: **78 pruebas aprobadas, 0 fallos**. Incluye autenticación, catálogo privado/público, imágenes, invitados/preview, pedidos, presupuestos, pagos, contenido, configuración y contrato HTTP. Las integraciones usan PostgreSQL real en esquemas temporales; Cloudinary usa un proveedor simulado.
- La ejecución completa de regresión se registra en `backend/.local/review-tests.log` (archivo local, excluido de Git).

Las pruebas nuevas verifican revalidación ante cambios de precio/atributos/disponibilidad, rechazos de precios enviados por el cliente, pedido ajeno, CSRF, estados inválidos, doble pedido concurrente, versiones simultáneas, presupuesto aceptado, doble cobro, sobrecobro, devolución excesiva, devolución tras cancelar, importes grandes, snapshots históricos, revocación de sesión, páginas públicas/privadas, edición parcial, rollback y destacados que dejan de ser visibles.

## Límites y próximo paso

La revisión cubre comportamiento local y regresiones del código; no reemplaza la etapa 12 de seguridad y preparación integral de producción. Los bloqueos administrativos priorizan consistencia para esta tienda y serializan escrituras; no se hicieron pruebas de carga de producción.

No se configuraron cuentas, credenciales ni servicios reales de Railway, Neon, Cloudinary o SMTP. No se enviaron mensajes ni se realizaron pagos reales. WhatsApp y los movimientos de pago son, respectivamente, un enlace preparado para el cliente y un registro administrativo.

Contratos: [pedidos/presupuestos/pagos](backend-orders.md), [contenido/configuración](backend-content.md), [invitados/preview](backend-preview.md).