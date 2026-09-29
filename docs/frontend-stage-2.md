# Frontend F2 · Tienda y catálogo

Fecha de verificación: 28 de septiembre de 2026.

## Entrega

- Catálogo público con búsqueda, filtros por ocasión, carrera y tipo, orden por nombre o fecha y paginación de 12 productos.
- Filtros guardados en la URL, formularios GET, limpieza de búsqueda y regreso a páginas válidas si cambió la cantidad de resultados.
- Lectura de todas las páginas de categorías y carreras, sin limitar las opciones a los primeros 50 registros.
- Ficha por slug con galería, variantes seleccionables, atributos, fotos requeridas, materiales, medidas, tiempos, personalizaciones disponibles y componentes de combos.
- Precios en centavos de ARS: precio base, “Desde”, opciones a cotizar y adicionales presentados por separado.
- Inicio conectado al contenido publicado, categorías y productos destacados en el orden definido por administración.
- Nosotros, Contacto y Preguntas frecuentes; datos públicos de contacto y entrega, secciones editoriales y preguntas desplegables.
- Estados de carga, catálogo vacío, búsqueda sin resultados, error recuperable, imagen no disponible y producto inexistente u oculto.
- Metadatos de producto y páginas editoriales.

La personalización editable, la acción de agregar al carrito y el cálculo del pedido corresponden a **F3**. Elegir una variante en F2 permite consultar información; no crea un pedido ni guarda una selección de carrito.

## Integración y límites

La pasarela agrega únicamente lecturas de `products`, `products/:slug`, `categories`, `careers` y `content/{home,about,contact,faq}`. Los slugs y las páginas admitidas se validan antes de construir el destino. Las peticiones públicas no transportan cookies privadas.

Las búsquedas usan parámetros separados de la ruta y se normalizan antes de consultar NestJS. Los enlaces de paginación conservan los filtros. Las respuestas continúan sin caché; la autoridad sobre visibilidad y precios sigue siendo el backend.

Las imágenes aceptan HTTPS de `res.cloudinary.com/<cloud>/image/upload/…`, sin credenciales ni parámetros de consulta. Next Image administra tamaños y carga; si falta la imagen o falla, aparece un reemplazo explícito. Antes del despliegue se podrá restringir también al nombre de la cuenta Cloudinary configurada.

El contenido editorial se renderiza como texto, conservando saltos de línea. No se interpreta HTML. Un contenido no publicado muestra un estado inicial sin revelar borradores. Una caída del servicio se diferencia de ese estado. Los enlaces externos de contacto admiten HTTPS y usan protección al abrir otra pestaña.

## Verificaciones

- ESLint y TypeScript aprobados.
- **22 tests** aprobados: los 16 de F1 más filtros, conservación de parámetros, importes, imágenes, enlaces y nuevas rutas de la pasarela.
- Build de producción aprobado.
- `npm.cmd run test:storefront`: seis recorridos HTTP sobre el build con una API de contratos aislada. Incluye 52 categorías, búsqueda, paginación, precios fijos/a cotizar, combos, ficha inexistente, contenido escapado, FAQ, contacto, contenido no publicado y caída/recuperación.
- `npm.cmd run test:smoke`: conexión real a NestJS y PostgreSQL, páginas públicas, panel protegido y sesión invitada con CSRF.
- API real de productos, categorías y carreras: HTTP 200. Al revisar, la base local no tenía productos publicados; se verificó el estado vacío sin agregar productos ficticios.
- Chrome a 1440, 390 y 320 píxeles: sin desbordes horizontales. Se verificaron envío del buscador, cambio de variante y precio, cantidad de fotos, selección de imagen y apertura de FAQ, sin excepciones JavaScript.

Los ejemplos del recorrido poblado viven en `Frontend/test/fixtures/` y solo se sirven durante las pruebas. La comprobación visual intercepta las imágenes con un recurso local de prueba: no se configuró ni probó una cuenta real de Cloudinary. No se modificó el backend ni se crearon productos, pedidos o cuentas en la base local.

## Ejecutar

Desde la raíz: `npm.cmd run dev:frontend`, con NestJS y PostgreSQL encendidos para consultar datos reales. Abrir **http://localhost:3000/catalogo**.

Desde `Frontend/`:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:storefront
# Con NestJS, PostgreSQL y Next.js encendidos:
npm.cmd run test:smoke
```

`test:storefront` inicia y cierra sus propios servidores en los puertos 3100/3101. No requiere PostgreSQL ni proveedores externos. El workflow de frontend incorpora este recorrido después de compilar; su ejecución remota queda para cuando se publique el repositorio.

Siguiente etapa: **F3, personalización y carrito**. [Arquitectura general](frontend-architecture.md).

Referencias: [contrato de catálogo](backend-public-catalog.md), [contenido y configuración](backend-content.md), [Next Image](https://nextjs.org/docs/app/api-reference/components/image) y [parámetros de páginas](https://nextjs.org/docs/app/api-reference/file-conventions/page).
