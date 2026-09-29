# Etapa 3 — Catálogo administrable

API privada bajo `/api/v1/admin`, accesible a OWNER y ADMIN. La lectura pública está implementada en la [etapa 5](backend-public-catalog.md); la carga y gestión de imágenes está implementada en la [etapa 4](backend-media.md).

## Endpoints

| Recurso | Operaciones |
| --- | --- |
| `/categories` | GET paginado, POST |
| `/categories/:id` | PATCH, DELETE |
| `/careers` | GET paginado, POST |
| `/careers/:id` | PATCH, DELETE |
| `/products` | GET paginado y filtrado, POST |
| `/products/:id` | GET, PATCH, DELETE |

Las variantes, campos, opciones y componentes se administran dentro del producto mediante POST/PATCH. De esta manera se validan y guardan juntos en una transacción. Las claves `key` son únicas dentro de cada colección; mientras no cambie la clave se conserva el identificador de la variante, campo, opción o componente.

Todas las escrituras requieren la cookie de sesión, `X-Requested-With: porfin-admin`, `X-CSRF-Token` y `Content-Type: application/json`. Para DELETE enviar `{}`. Consultar [autenticación](backend-auth.md).

## Ejemplo de producto

Primero crear una categoría y, opcionalmente, una carrera. Luego:

```json
{
  "name": "Cartel de recibida",
  "slug": "cartel-de-recibida",
  "description": "Cartel personalizado para celebrar.",
  "type": "PREDEFINED",
  "categoryIds": ["ID_CATEGORIA"],
  "careerIds": [],
  "measurements": "60 × 40 cm",
  "materials": "Cartón rígido",
  "includes": "Un cartel. Accesorios no incluidos.",
  "leadTime": "A coordinar",
  "variants": [
    {
      "key": "sin-fotos",
      "name": "Sin fotos",
      "pricingMode": "FIXED",
      "priceCents": 1800000,
      "attributes": { "size": "60x40" },
      "photoCount": 0,
      "active": true
    },
    {
      "key": "tres-fotos",
      "name": "Con tres fotos",
      "pricingMode": "FIXED",
      "priceCents": 2100000,
      "photoCount": 3
    }
  ],
  "fields": [
    {
      "key": "nombre",
      "label": "Nombre",
      "type": "SHORT_TEXT",
      "required": true,
      "minLength": 1,
      "maxLength": 80
    },
    {
      "key": "color",
      "label": "Color",
      "type": "SELECT",
      "options": [
        { "key": "rosa", "label": "Rosa", "additionalCents": 0 },
        { "key": "dorado", "label": "Dorado", "additionalCents": 30000 }
      ]
    }
  ]
}
```

`1800000` centavos equivale a ARS 18.000. El producto no tiene campos de precio: cada variante guarda su precio completo. `QUOTE` exige `priceCents: null`; nunca cero para representar una cotización pendiente. PostgreSQL también aplica esta regla.

## Actualizaciones y publicación

Los productos nacen HIDDEN. Para publicar: `PATCH /products/:id` con `{ "status": "PUBLISHED" }`. Deben conservar al menos una variante y, al publicar, una activa. `UNAVAILABLE` permite marcar indisponibilidad temporal.

PATCH modifica únicamente propiedades enviadas. Si se envía una colección (`variants`, `fields`, `components`, `categoryIds`, `careerIds`), se reemplaza su contenido completo; los elementos con la misma clave mantienen sus IDs. Si se omite una colección, se conserva. Un error en cualquier parte revierte todos los cambios del producto.

Las categorías y carreras en uso no se pueden borrar. Para borrar un producto primero debe estar oculto, y no puede estar referenciado por un combo. Como alternativa cotidiana se recomienda ocultarlo.

Filtros disponibles: `q`, `type`, `status`, `categoryId`, `careerId`, `page` y `limit` (máximo 100). La búsqueda por nombre/descripción ignora mayúsculas.

## Tipos y campos

Tipos de producto: GENERIC, PREDEFINED, CUSTOM, COMBO. Ocasión y carrera son relaciones independientes.

Campos dinámicos:

- SHORT_TEXT: longitud máxima 240; configurar minLength/maxLength.
- LONG_TEXT: longitud máxima 2000; configurar minLength/maxLength.
- NUMBER: minValue/maxValue opcionales.
- SELECT: lista no vacía de opciones con key, label y additionalCents.

Las opciones solamente se admiten en SELECT, y los límites deben corresponder al tipo. El orden lo determina la posición en la lista enviada. Estos son datos de configuración del formulario; la validación de respuestas de compradores se implementará con el preview de pedido.

## Combos

Un producto COMBO exige una lista `components`:

```json
[
  { "key": "cartel", "name": "Cartel", "quantity": 1, "referenceProductId": "ID_PRODUCTO" },
  { "key": "props", "name": "Props", "quantity": 6 }
]
```

La referencia a otro producto es opcional. No puede apuntar al mismo combo ni a otro combo. Tampoco se permite convertir en combo un producto ya referenciado por otro. La validación está serializada para impedir inconsistencias por cambios simultáneos.

El precio del conjunto se define en sus variantes, independiente de sus componentes. Los campos de personalización pueden usar `componentKey` para identificar el elemento al que pertenecen.

## Verificación

Desde `backend`: `npm.cmd run test:catalog`.

Las pruebas crean un esquema PostgreSQL temporal, aplican las migraciones y usan HTTP real con una cuenta ADMIN. Comprueban permisos, publicación, campos dinámicos, actualizaciones atómicas, categorías/carreras, cotizaciones nulas, restricciones en PostgreSQL y combos. El esquema y la cuenta de prueba se eliminan al terminar.
