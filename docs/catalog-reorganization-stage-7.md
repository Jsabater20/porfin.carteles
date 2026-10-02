# Reorganización del catálogo — etapa 7

Revisión final de las etapas 1 a 6, realizada el 2 de octubre de 2026. Se conserva la Home y no se agregan funciones comerciales ni migraciones en esta etapa.

## Cobertura

| Área | Comprobaciones |
| --- | --- |
| Catálogo público | Categoría, tipo, ocasión y carrera; limpieza de dependencias; búsqueda; ausencia de resultados; filtros inválidos y páginas fuera de rango. |
| Navegación | Paginación conservando filtros, regreso a página 1 al cambiar criterios, atrás/adelante, recarga conservando búsqueda y enlaces desde la Home. |
| Compatibilidad | categoryId/careerId/type/sort anteriores mantienen su consulta hasta cambiar filtros; enlace de tres imágenes muestra cuatro opciones y preselecciona cada variante. |
| Home | Contenido publicado, orden de destacados, cuatro pasos del pedido y enlaces de categorías. No se modificó su implementación. |
| Administración | Altas y ediciones, clasificación, variantes e IDs, personalización, precios a cotizar, publicación, conflictos, referencias de combos y permisos. Imágenes con Cloudinary simulado. |
| Carrito y pedidos | Personalizaciones separadas, persistencia, edición, cantidades, disponibilidad, precios actuales, expiración, reintentos idempotentes, permisos, historial y snapshots. |
| Presentación | Navegador real a 1440, 390 y 320 píxeles, sin desbordamiento en los recorridos comprobados ni excepciones JavaScript. |

## Corrección encontrada

Las consultas ORM de las pruebas usaban el esquema temporal, pero las consultas SQL sin calificar del contador de solicitudes resolvían contra public. Esto produjo un fallo reproducible: el contador preparado por la prueba no era el contador leído por la API.

Se corrigió únicamente backend/test/support/integration.ts: la conexión temporal fija search_path mediante options, conservando otras opciones de conexión. Antes de iniciar cada API de prueba se comprueba current_schema(); si no coincide con el esquema temporal, la prueba se detiene y limpia sus recursos. La preparación de migraciones admite hasta 60 segundos y sus fallos informan un código sin exponer la conexión. El contador de producción no se modificó. La prueba de límite de solicitudes conserva el resultado esperado 429 y ahora informa el estado del contador cuando falla.

Las pruebas remotas se realizaron en una rama temporal de Neon, sin escribir datos ficticios en la base principal. Los correos y Cloudinary estuvieron simulados según el soporte de pruebas.

## Repetición

- Frontend: npm run check y npm run build.
- Recorridos: npm run test:storefront, npm run test:catalog-filters-browser, npm run test:consolidation-browser y npm run test:cart-browser.
- Administración real: npm run test:catalog-browser con DATABASE_URL y DIRECT_URL de una rama de prueba.
- Backend: TypeScript y compilación Nest; npm run test:catalog-regression ejecuta en serie catalog-classification, catalog, public-catalog, preview, orders y content, usando una rama temporal. No usar la base principal como destino de pruebas.

La conservación durante la migración de tres imágenes se verificó en la etapa 6 con un pedido histórico ficticio antes de aplicar la migración; esta etapa vuelve a comprobar que las ediciones del catálogo conservan IDs, relaciones y snapshots históricos. Ver [etapa 6](catalog-reorganization-stage-6.md).

## Alcance del resultado

Esta revisión valida el código local, los recorridos en navegador y las integraciones con PostgreSQL. No constituye una publicación ni una prueba del entorno desplegado de Railway, ni de envíos reales de correo, WhatsApp o Cloudinary.

## Resultados de integración

Las seis suites del backend completaron sus 51 comprobaciones, contando casos y suites principales: clasificación (7), catálogo privado (8), catálogo público (11), invitados/preview (11), pedidos (8) y contenido (6). La comprobación de invitados se repitió después de corregir el aislamiento. Clasificación, catálogo privado y contenido se ejecutaron nuevamente en serie después de los fallos de preparación y tiempos de espera de la corrida concurrente.

Frontend: 82 pruebas, lint, TypeScript y build aprobados. Recorridos HTTP de tienda y pruebas Chrome de filtros/búsqueda/recarga, compatibilidad de tres imágenes y carrito aprobados.

La última pasada de Chrome con backend real también aprobó altas, variantes, personalización, publicación, IDs, conflictos, combos y gestión de imágenes con proveedor simulado. Esta pasada se ejecutó por separado con el aislamiento SQL corregido. Se eliminó la rama temporal catalog-final-regression al terminar. No quedaron cambios pendientes de esta revisión.
