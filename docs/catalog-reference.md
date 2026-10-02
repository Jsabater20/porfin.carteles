# Catálogo de referencia de Por fin

Primera adaptación del PDF compartido el 30/09/2026:
https://drive.google.com/file/d/1HJoegONC-lh2nrX06f-kG4ZL1gs4bwhF/view

## Propuestas

| Propuesta | Página | Opciones |
| --- | --- | --- |
| Cartel genérico | 2 | Rectangular 60 × 100 cm / circular de 70 cm; texto y colores |
| Cartel predeterminado por carrera | 3 | Rectangular 60 × 100 cm / circular de 70 cm; carrera, texto y colores |
| Cartel con 3 imágenes | 4 | Base genérica o por carrera; 3 imágenes coordinadas por WhatsApp |
| Baby shower | 5 | Circular de 50 cm; nombre, bienvenida y colores |
| Cartel personalizado | 6 | Rectangular, circular o XXL de 50 × 100 cm; visualización previa a impresión |
| Props personalizados | 7 | Carteles chicos de 12 × 17 cm, por unidad |
| Combo 1 | 9 | Cartel personalizado + 6 props |
| Combo 2 | 10 | Cartel personalizado + remera Alta Remera + 2 cartelitos de regalo |
| Combo 3 | 11 | Cartel personalizado + remera Alta Remera + 6 props + bengala de regalo |

El PDF no indica precios, materiales ni plazos. Los productos usan precio **A cotizar**, materiales vacíos y plazo a consultar. Los formatos de la opción de tres imágenes se heredan de sus bases genérica y predeterminada. En los combos 2 y 3, el formato del cartel y el talle se coordinan; no se inventa una lista de talles disponibles.

Props se organiza como categoría y conserva el tipo técnico CUSTOM. Esto permite usar los filtros y formularios existentes sin cambiar la base de datos. Las categorías principales son Carteles, Props y Combos, junto con Recibidas y Baby shower.

## Carga y mantenimiento

Los datos están en `backend/prisma/data/catalog-reference.json`. Cada producto conserva la página de origen. Las propuestas se crean en ocho productos publicados (las opciones de tres imágenes son variantes del genérico y predeterminado) para poder probarlas en la tienda; su estado, textos, variantes y campos se pueden ajustar desde administración.

Desde `backend`:

```powershell
npm run catalog:reference
npm run catalog:reference -- --apply
```

El primer comando valida el documento y muestra una vista previa. El segundo crea las categorías y productos faltantes en una transacción. Los productos que ya existen con el mismo slug se conservan completos; no se actualizan ni se borran. Repetir el comando no duplica registros ni pisa cambios del panel. El importador no forma parte del arranque ni del seed general.

## Imágenes y logo

Las imágenes originales se renderizaron desde el PDF en `Frontend/public/catalogo/referencia/`. La web encuadra esas páginas mediante SVG, sin generar dibujos nuevos ni alterar los ejemplos. El logo usa el dibujo de la portada del PDF con los colores de la marca; su resolución está limitada por el documento de origen.

Las referencias se muestran cuando uno de los productos de referencia todavía no tiene imágenes cargadas. Una imagen de Cloudinary cargada en administración tiene prioridad. La asociación de referencia utiliza el slug inicial: si se cambia ese slug, conviene cargar la fotografía propia. Los ejemplos del PDF no se registran como cargas de Cloudinary ni ocupan su almacenamiento.

La navegación por Carteles, Props y Combos usa las categorías reales de la API. Las fichas y el carrito siguen consultando el backend; no se simulan productos en el frontend.
Desde la etapa 6, la consolidación de bases existentes se aplica mediante la migración documentada en [catalog-reorganization-stage-6.md](catalog-reorganization-stage-6.md). El importador conserva los registros existentes y no realiza esa transformación.
