# Reorganización del catálogo — etapa 6

Las opciones con tres imágenes se administran como variantes de los carteles genérico y predeterminado. No se agrega un tipo técnico.

## Datos y compatibilidad

- Migración: 20261002000000_consolidate_three_image_variants. Conserva los cuatro IDs, claves, atributos, precios, modalidad de cotización y photoCount=3. Cada destino mantiene sus dos variantes originales y recibe dos adicionales.
- El producto cartel-tres-imagenes queda HIDDEN, sin variantes, conservando ID, campos y relaciones. La API administrativa bloquea su edición y eliminación; el editor enlaza a los destinos.
- /productos/cartel-tres-imagenes ofrece las cuatro opciones. Cada enlace selecciona la variante mediante ?variante=ID. Un ID inválido usa la primera variante; editar un renglón del carrito conserva su selección.
- GET /api/v1/products/cartel-tres-imagenes devuelve 410 tras la migración, con instrucciones para encontrar los destinos.
- Los pedidos históricos conservan sus snapshots, nombres e IDs. No se recalculan ni se reescriben.
- Un carrito previo que contenga el producto archivado debe quitar ese renglón y agregar la variante nueva. La página anterior lo explica; no se cambia silenciosamente la personalización ni el precio.
- Se copian las indicaciones opcionales de imágenes a ambos destinos y la temática opcional al genérico. Los campos son por producto: estas indicaciones también aparecen como opcionales al elegir variantes sin fotos. La carrera del predeterminado sigue siendo obligatoria.
- El catálogo de referencia para instalaciones nuevas contiene ocho productos y dieciocho variantes. El producto histórico solo permanece en bases que ya lo tenían.

## Aplicación y comprobación

La migración transaccional verifica productos publicados, las cuatro variantes previstas, reglas de personalización compatibles, relaciones y ausencia de imágenes, destacados o combos que requieran reconciliación. Si el inventario cambió, aborta. Una base vacía no necesita consolidación y continúa con la importación actualizada.

Antes de aplicar a la base principal se utiliza una rama temporal de Neon. Desde backend, scripts/test-three-image-consolidation.cjs requiere CONSOLIDATION_TEST_URL de una copia previa a la migración y rechaza el host de producción configurado. Comprueba rollback ante inventario alterado, conservación de IDs/precios/campos y pedidos de prueba, API 410, protección administrativa 409 y deploy repetido. Crea datos de prueba únicamente en esa rama descartable.

Frontend/scripts/consolidation-browser-smoke.mjs usa una API ficticia y Chrome: enlace anterior, cuatro destinos, preselección, parámetro inválido y anchos 1440/390/320. Requiere un build previo del frontend.

## Recuperación

application_metadata, clave catalog:three-images:v1, conserva el producto original, las variantes previas y los destinos. No borrar este registro: también identifica el archivo administrativo. Una reversión requiere revisar pedidos y ediciones posteriores; no ejecutar un movimiento inverso automático sobre datos que puedan haber cambiado. La migración no borra productos ni modifica pedidos.

## Resultado de esta etapa

Migración aplicada a la base principal el 2 de octubre de 2026, después de probarla en una rama aislada. Verificación posterior: genérico y predeterminado publicados con cuatro variantes cada uno; producto anterior oculto sin variantes; dieciocho variantes totales. La base principal no tenía pedidos al aplicar; la conservación histórica se comprobó con un pedido de prueba en la rama aislada.

Verificaciones: 82 pruebas frontend, 26 pruebas backend, TypeScript, lint, build frontend, navegador con fixtures, migración sobre copia existente y carga desde cero (8 productos/18 variantes). Los servidores locales 3000/3001 no estaban ejecutándose durante la comprobación final; no se verificó una publicación en Railway.
