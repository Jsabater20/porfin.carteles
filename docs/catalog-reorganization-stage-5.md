# Reorganización del catálogo — etapa 5

La administración del catálogo usa Categoría (Cartel, Prop, Combo), Tipo de cartel (Genérico, Predeterminado, Personalizado), Ocasiones y Carreras.

- El editor muestra tipo solo para Cartel, ocasiones para Genérico/Predeterminado y carreras para Predeterminado.
- Props y combos se pueden crear sin ocasiones. El editor envía internamente CUSTOM para props y COMBO para combos.
- Las ocasiones se obtienen de la entidad existente Category, excluyendo registros con isOccasion=false. Los slugs de familias antiguas se reconocen como compatibilidad cuando falta ese campo.
- `/admin/categorias` conserva su ruta y ahora se presenta como Ocasiones. Sus listas y paginación excluyen familias antes de dividir en páginas. No se ofrecen carteles/props/combos como ocasiones editables.
- Los filtros del listado separan categoría de tipo y muestran ocasión/carrera según corresponda. Se conserva visibilidad, búsqueda y paginación.
- El editor envía occasionIds, conservando categoryIds internamente para comparar cambios. Un PATCH de nombre/precio no borra relaciones antiguas ocultas. Cambiar explícitamente la clasificación limpia las asociaciones incompatibles.
- Predeterminado a Genérico conserva ocasiones y elimina carreras. Personalizado/Prop/Combo eliminan ambas selecciones.
- Salir de Combo solicita confirmación para retirar sus componentes y asociaciones de campos; conserva campos, variantes y sus claves. Cancelar conserva el borrador completo.
- Continúa la protección contra cambios concurrentes, cambios sin guardar y operaciones sin sesión.

Pruebas: lint, TypeScript, build de producción y 82 tests del frontend. `test:catalog-browser` utiliza un backend real en un esquema aislado y Chrome; cubre altas, edición, props sin ocasión, combos, claves e IDs estables, conflictos, categorías/ocasiones, permisos, variantes y galería con Cloudinary simulado. Las pruebas remotas se ejecutan en una rama temporal de Neon sin modificar productos reales.

No se consolidaron productos ni variantes. Esa operación corresponde a la etapa 6.
