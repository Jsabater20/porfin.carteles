# Reorganización del catálogo — etapa 4

Implementada en el catálogo público. Home y el editor administrativo mantienen su comportamiento anterior.

## Filtros y navegación

- Categoría fija: Todos, Carteles, Props y Combos.
- Tipo de cartel aparece únicamente para Carteles: Todos, Genérico, Predeterminado y Personalizado.
- Ocasión aparece para Genérico/Predeterminado; Carrera únicamente para Predeterminado.
- Las opciones se consultan en `/occasions` y `/careers` con el tipo y la ocasión correspondientes. No hay restricciones comerciales codificadas para Baby Shower.
- Cambiar categoría limpia tipo, ocasión, carrera y página. Cambiar a Genérico conserva la ocasión únicamente si existe entre sus opciones disponibles; siempre limpia carrera. Cambiar ocasión limpia carrera.
- Los cambios se guardan en la URL con navegación push. Atrás/adelante restaura controles y resultados. El formulario se identifica por sus parámetros para restaurar también la búsqueda.
- La búsqueda se aplica con Enter o Aplicar filtros. Las selecciones se aplican al cambiarlas y se deshabilitan durante la navegación pendiente.
- No se muestra Ordenar por. Las nuevas URLs usan q/category/type/occasion/career/page y el orden estable del backend.
- Si falla una consulta de taxonomía, se informa el problema y no se borra una selección basándose en una lista que no pudo cargarse.

## Enlaces anteriores

Los enlaces con type/categoryId/careerId/sort sin parámetros nuevos conservan exactamente su consulta anterior, incluidos resultados y paginación. Se muestra un aviso de enlace anterior. Al aplicar o cambiar un filtro, pasan al formato nuevo y se limpian los filtros incompatibles. Así se preservan combinaciones antiguas que no pueden representarse fielmente con los controles nuevos.

Los enlaces de Home y de fichas existentes siguen funcionando con esa compatibilidad. `filters.ts` conserva el contrato anterior; `store-filters.ts` concentra el estado del catálogo reorganizado. No se consolidaron productos ni variantes.

## Verificación

Desde Frontend:

- `npm run check`: lint, TypeScript y 78 tests.
- `npm run build`: compilación de producción.
- `npm run test:catalog-filters-browser`: Chrome, API de pruebas sin base real; categorías, tipos, ocasiones, carreras, limpieza, paginación, atrás/adelante, URLs antiguas y anchos 1440/390/320.
- `npm run test:storefront`: recorridos HTTP existentes, Home, catálogo, fichas, contenido y recuperación ante fallos de API.

Las pruebas de navegador requieren Chrome instalado y un build previo. Los scripts usan los puertos locales 3100/3101 y 9232 para depuración de Chrome; cierran sus procesos al terminar.
