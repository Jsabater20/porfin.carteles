# Etapa 5: catálogo público y precios

Implementada dentro de `backend`, con PostgreSQL local para las pruebas. La configuración de Railway, Neon, Cloudinary y SMTP queda para el final de las etapas, según lo acordado.

## Lectura pública

Estas rutas funcionan sin registro, cookies ni token CSRF:

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/v1/products` | Tarjetas de productos, paginadas. |
| GET | `/api/v1/products/:slug` | Ficha con galería, variantes, campos y componentes. |
| GET | `/api/v1/categories` | Categorías con productos visibles, paginadas. |
| GET | `/api/v1/careers` | Carreras con productos visibles, paginadas. |

**Visibilidad:** solo productos `PUBLISHED` con al menos una variante activa. Los `HIDDEN`, `UNAVAILABLE` y productos sin variantes activas no aparecen; su ficha devuelve 404, igual que un slug inexistente. Las variantes inactivas tampoco se exponen. Un producto sin imágenes sigue siendo visible, con `coverImage: null`.

Las categorías y carreras vacías o vinculadas únicamente a productos no visibles no se publican. La API administrativa continúa requiriendo sesión y permisos.

### Consultas y paginación

Todas las listas devuelven `{ items, total, page, limit }`.

- `page`: desde 1, máximo 100000; por defecto 1.
- `limit`: de 1 a 50; por defecto 24.
- Productos: `q` busca nombre/descripción sin distinguir mayúsculas, máximo 120 caracteres.
- Productos: `type` acepta `GENERIC`, `PREDEFINED`, `CUSTOM` o `COMBO`.
- Productos: `categoryId` y `careerId` usan los IDs de las listas públicas.
- Productos: `sort` acepta `newest` (predeterminado), `name-asc` o `name-desc`; los empates se ordenan por ID.
- Las listas de categorías/carreras se ordenan por nombre e ID.

Ejemplos:

```text
GET /api/v1/products?q=arquitectura&type=PREDEFINED&page=1&limit=12
GET /api/v1/products?categoryId=ID&careerId=ID&sort=name-asc
GET /api/v1/products/cartel-arquitectura
```

No se acepta un filtro `status` público: intentar consultar ocultos mediante parámetros devuelve 400. Las consultas inválidas o con propiedades adicionales también devuelven 400.

### Contrato del catálogo

Las tarjetas incluyen identificación, nombre, tipo, plazo, categorías, carreras, portada y resumen `basePrice`. Se evita devolver formularios y galerías completas en cada tarjeta.

La ficha agrega descripción, medidas, materiales, contenido del producto, imágenes ordenadas, variantes activas, campos con sus límites/opciones y componentes del combo.

Las proyecciones Prisma son explícitas. No se publican metadatos de cargas, asset IDs ni referencias internas de los componentes a otros productos. Un componente del combo puede mostrar su descripción comercial sin exponer el producto de referencia oculto.

Las listas y sus conteos se leen desde el mismo snapshot de PostgreSQL. Las respuestas usan la política actual `Cache-Control: no-store`; los cambios administrativos se reflejan en la siguiente consulta.

## Precio base para tarjetas y fichas

Todos los importes son **centavos enteros de ARS**. El único precio base persistido sigue siendo el de la variante.

```json
{
  "basePrice": {
    "currency": "ARS",
    "fromCents": 1800000,
    "toCents": 2400000,
    "hasQuoteVariants": false
  }
}
```

El rango comprende únicamente variantes activas `FIXED`, sin adicionales de personalización. Es un rango de **precios base**, no un presupuesto definitivo.

Si todas las variantes son `QUOTE`, ambos extremos son `null` y `hasQuoteVariants` es `true`. Un producto mixto informa el rango de sus variantes fijas y marca que también tiene variantes a cotizar. Un precio fijo de cero se conserva como cero y se distingue de una cotización pendiente.

## PricingService

`PricingModule` exporta `PricingService` para que la etapa 6 lo utilice en la validación de carrito. En esta etapa no se expone un nuevo POST público ni se crean sesiones invitadas, carritos o pedidos.

El método `calculate(input, transaction?)` recibe:

```typescript
{
  productId: '...',
  variantId: '...',
  quantity: 3,
  selections: [
    { fieldKey: 'color', optionKey: 'dorado' },
    { fieldKey: 'acabado', optionKey: 'brillo' }
  ]
}
```

`selections` representa exclusivamente opciones de campos `SELECT`; puede omitirse cuando no hay opciones seleccionadas.

El servicio:

1. Valida el contrato y rechaza importes enviados por el cliente, cantidades no enteras o fuera de 1–100, y más de 30 selecciones.
2. Consulta el producto publicado y la variante activa, verificando que pertenezca a ese producto.
3. Resuelve los adicionales desde las opciones persistidas; rechaza opciones ajenas, campos repetidos y selecciones obligatorias faltantes.
4. Calcula con centavos enteros y verifica que el resultado sea un entero seguro.
5. Conserva un snapshot consistente de las lecturas; si se le pasa una transacción, participa en ella. El llamador debe usar el aislamiento apropiado para su operación.

Fórmula por unidad vendible:

```text
unitPriceCents = baseUnitCents + additionalUnitCents
subtotalCents  = unitPriceCents × quantity
```

Por ejemplo: base 10000, adicionales 500 y 750, cantidad 3 → precio unitario 11250 y subtotal 33750.

Los adicionales se cobran una vez por unidad del producto/combo seleccionado. El combo usa el precio de su propia variante: no suma los precios ni multiplica los adicionales por las cantidades de sus componentes.

Resultado conocido:

```json
{
  "currency": "ARS",
  "pricingMode": "FIXED",
  "status": "PRICED",
  "quantity": 3,
  "baseUnitCents": 10000,
  "additionalUnitCents": 1250,
  "unitPriceCents": 11250,
  "subtotalCents": 33750
}
```

Además devuelve IDs y nombres de producto/variante y las opciones resueltas con sus adicionales actuales.

Para `QUOTE`: `status: "PENDING_QUOTE"` (pendiente de cotización), y `baseUnitCents`, `unitPriceCents`, `subtotalCents` son `null`. Los adicionales conocidos quedan informados por separado, sin convertirlos en un total definitivo ni tratar el producto como gratuito.

Un cambio de precio posterior a la consulta pública se considera en la siguiente llamada a `calculate`. Una variante desactivada o un producto ocultado dejan de ser válidos.

La validación completa de textos, números, fotos, datos del cliente y demás personalizaciones corresponde al preview de la etapa 6. Este servicio verifica disponibilidad y las selecciones que intervienen en el precio. No calcula envío, pagos ni un total final del pedido.

## Verificación local

```powershell
cd backend
npm.cmd run build
npm.cmd test
npm.cmd run test:public
npm.cmd run test:catalog
```

`test:public` crea un esquema PostgreSQL temporal, aplica las migraciones existentes y lo elimina al terminar. Comprueba acceso anónimo, filtros, privacidad, visibilidad, paginación, contrato Swagger, precios manipulados, cambios de catálogo, adicionales, combos, cotizaciones e importes grandes. No usa servicios externos ni modifica productos de trabajo.

La etapa no requiere migraciones ni dependencias nuevas. Swagger incluye los modelos de respuesta bajo la etiqueta **Catálogo público**.

La sesión invitada y `POST /orders/preview` ya están implementados en la [etapa 6](backend-preview.md), reutilizando este servicio de precios.

## Reorganización del catálogo: etapas 2 y 3

`Product.category` identifica CARTEL, PROP o COMBO. El `type` técnico anterior se conserva: PROP utiliza CUSTOM y COMBO utiliza COMBO. `Category.isOccasion` distingue ocasiones de las familias antiguas. Las tablas y relaciones mantienen sus IDs. La columna category continúa nullable por compatibilidad de migración; las escrituras del servicio y del importador siempre la completan.

- `GET /products?category=CARTEL&type=PREDEFINED&occasion=ID&career=ID`: filtros nuevos. `occasion` y `career` son IDs, no slugs.
- Categoría PROP/COMBO ignora tipo, ocasión y carrera. CARTEL sin tipo no aplica ocasión ni carrera; GENERIC aplica ocasión; PREDEFINED aplica ambos; CUSTOM no aplica ninguno.
- Consultas sin parámetros nuevos conservan la semántica anterior de `type`, `categoryId`, `careerId` y `sort`. Con categoría explícita, los padres gobiernan los filtros hijos. `occasion`/`career` prevalecen sobre sus alias antiguos.
- `GET /occasions`: únicamente ocasiones con carteles genéricos/predeterminados visibles. Admite category/type y paginación.
- `GET /careers?category=CARTEL&type=PREDEFINED&occasion=ID`: carreras disponibles en esa selección. Sin filtros mantiene el comportamiento anterior.
- `/categories` y los slugs de productos existentes se conservan. Las tarjetas agregan category y occasions; mantienen categories y type por compatibilidad.
- El backend administrativo acepta category y occasionIds opcionales. categoryIds continúa disponible para clientes anteriores. occasionIds reemplaza solo las ocasiones y conserva la familia interna. PROP/COMBO siguen enviando su type técnico; el editor visual se adaptará en la etapa 5.
- Un PATCH de nombre/precio conserva relaciones antiguas aunque no correspondan a los filtros nuevos. No se consolidan productos ni se alteran snapshots de pedidos.

La migración `20261001000100_catalog_classification` verifica que cada producto existente tenga exactamente una familia reconocida antes de clasificarlo. Si los datos difieren, aborta toda la transacción. Se probó con los nueve productos reales en ramas temporales antes de aplicarla.

Verificación: `npm run typecheck`, `npm run test:catalog`, `npm run test:public` y `npm run test:catalog-classification` desde backend. Las pruebas de integración usan esquemas temporales; para pruebas remotas, apuntar DATABASE_URL y DIRECT_URL a una rama aislada sin guardar esos valores en el entorno de producción.
