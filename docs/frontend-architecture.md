# Arquitectura general del frontend

Estado: F1–F8 implementadas. [Entrega de F1](frontend-stage-1.md) · [Entrega de F2](frontend-stage-2.md) · [Entrega de F3](frontend-stage-3.md) · [Entrega de F4](frontend-stage-4.md) · [Entrega de F5](frontend-stage-5.md). Esta numeración corresponde al frontend y es independiente de las 12 etapas del backend.

## 1. Objetivo y alcance

Construir una aplicación con **Next.js + React + TypeScript**, pensada primero para celular, con dos áreas: tienda pública y administración. NestJS sigue siendo la única autoridad para precios, permisos, validaciones comerciales y pedidos; PostgreSQL se consulta exclusivamente desde el backend.

El recorrido principal será: **catálogo → producto y personalización → carrito → datos del pedido → solicitud registrada → WhatsApp**. El cliente compra como invitado. Guardar la solicitud u abrir WhatsApp no confirma el pedido ni registra un pago.

La primera versión incluye formularios de personalización, combos y registro administrativo de pagos. El editor visual, las cuentas de compradores, la carga de fotos del cliente y los pagos online quedan fuera del alcance inicial, según el documento original. Las fotos del cliente se envían por WhatsApp.

## 2. Tres partes dentro del frontend

| Parte | Responsabilidad |
| --- | --- |
| Tienda | Mostrar el catálogo y contenido, personalizar productos y preparar solicitudes. |
| Administración | Gestionar catálogo, imágenes, pedidos, presupuestos, pagos y contenido. |
| Base compartida | Componentes visuales, formularios, conexión con la API, errores, sesiones y formatos. |

Ambas áreas tendrán navegación y diseños propios dentro de la misma aplicación. Compartirán componentes pequeños y contratos de datos; las funciones administrativas quedarán separadas de las de compra.

## 3. Organización del proyecto

La nueva aplicación está en `Frontend/`. La carpeta existente `docs/reference/frontend-prototype/` se conserva como referencia del prototipo. El backend mantiene su ubicación y sus comandos actuales. No hace falta introducir un monorepo con herramientas adicionales para empezar.

```text
backend/                         # API existente
docs/reference/frontend-prototype/ # Prototipo conservado
Frontend/                             # Aplicación Next.js; F1–F8 implementadas
  src/
    app/                         # Rutas, layouts y estados de carga/error
      (store)/                   # Tienda pública
      admin/
        (auth)/                  # Acceso y recuperación de contraseña
        (panel)/                 # Páginas administrativas protegidas
      api/backend/[...path]/     # Pasarela controlada hacia NestJS
    features/                    # Funciones de negocio de la interfaz
      catalog/
      personalization/
      cart/
      orders/                    # Solicitud y gestión; presupuestos y pagos
      auth/
      content/
      settings/
      media/
      admins/
    components/
      ui/                        # Botones, campos, avisos y diálogos
      layout/                    # Encabezado, pie y navegación administrativa
    lib/
      api/                       # Clientes separados para servidor y navegador
      contracts/                 # Tipos de los contratos HTTP
      format/                    # Moneda y fechas
    styles/                      # Variables visuales y estilos globales
  public/                        # Recursos estáticos propios
docs/
```

Esta estructura es una guía; las carpetas se crean cuando tengan contenido. Cada función agrupa sus componentes, formularios y llamadas a la API. Las páginas componen esas funciones sin concentrar toda su lógica. Los grupos entre paréntesis organizan layouts y no agregan segmentos a la URL.

Los tipos describirán respuestas HTTP reales, sin importar Prisma ni código interno de NestJS al navegador. Swagger será una referencia; antes de automatizar tipos habrá que completar las respuestas que todavía no estén documentadas.

## 4. Mapa inicial de pantallas

| Área | Ruta propuesta | Contenido |
| --- | --- | --- |
| Tienda | `/` | Presentación, destacados, categorías y cómo pedir. |
| Tienda | `/catalogo` | Productos, búsqueda, filtros y paginación. |
| Tienda | `/productos/[slug]` | Galería, variantes, componentes del combo y personalización. |
| Tienda | `/carrito` | Cantidades, personalizaciones y resumen validado. |
| Tienda | `/pedido` | Datos de contacto, fecha solicitada y entrega. |
| Tienda | `/pedido/[id]` | Solicitud registrada y botón para continuar a WhatsApp. |
| Contenido | `/nosotros`, `/contacto`, `/preguntas-frecuentes` | Contenido publicado y configuración del negocio. |
| Acceso | `/admin/login`, `/admin/recuperar`, `/admin/reset-password` | Sesión y recuperación de contraseña. |
| Panel | `/admin` | Accesos a la operación diaria, sin métricas que la API no proporcione. |
| Panel | `/admin/productos` | Productos, variantes, personalizaciones, combos y sus imágenes. |
| Panel | `/admin/categorias`, `/admin/carreras` | Clasificaciones del catálogo. |
| Panel | `/admin/pedidos`, `/admin/pedidos/[id]` | Pedidos, historial, presupuestos, cobros y devoluciones. |
| Panel | `/admin/contenido`, `/admin/configuracion` | Páginas, destacados, contacto y entrega. |
| Panel | `/admin/administradores` | Gestión de cuentas, exclusiva del rol OWNER. |

Los combos usan la misma ficha de producto y el mismo carrito. Su formulario muestra los componentes correspondientes. El resumen de un pedido solo estará disponible para su sesión invitada; no será un enlace público de seguimiento permanente.

## 5. Conexión con el backend

Usaremos App Router. Las páginas públicas podrán obtener su contenido inicial desde el servidor; los formularios, filtros interactivos y carrito serán componentes de cliente. La separación evita convertir toda la aplicación en un único componente interactivo.

```text
Navegador → Next.js /api/backend/* → NestJS /api/v1/* → PostgreSQL
Servidor de Next.js ─────────────→ NestJS /api/v1/*
```

La pasarela permite que el navegador use las sesiones desde el mismo origen que la web. Solo transporta peticiones autorizadas: no calcula precios ni accede a la base de datos. Las lecturas hechas por el servidor de Next.js consultan directamente NestJS para evitar una vuelta por su propia pasarela.

Al implementarla:

- El destino será una URL fija de configuración, con rutas y métodos permitidos explícitamente; nunca una URL elegida por el usuario.
- Se conservarán estados HTTP, errores, cookies, cabeceras CSRF e idempotencia. Las cookies `HttpOnly` seguirán siendo inaccesibles al JavaScript del navegador.
- Se validará el origen de las escrituras y se conservará la protección CSRF de NestJS. No se agregarán credenciales automáticamente a solicitudes de orígenes arbitrarios.
- El cliente de servidor será exclusivo del servidor y reenviará únicamente las cookies necesarias. Las respuestas privadas no se compartirán mediante caché.
- Al principio las consultas serán explícitamente sin caché. La caché del catálogo se evaluará después junto con su invalidación al editar productos.
- La IP del cliente y los proxies confiables se verificarán al configurar el alojamiento, para que los límites del backend no agrupen a todos los visitantes bajo la IP de Next.js ni confíen en cabeceras falsificadas.

La sesión administrativa se comprueba con `/auth/me`, separando el layout protegido de las pantallas de acceso. Cada operación sigue autorizada por NestJS. Los tokens CSRF se mantienen en memoria y se recuperan al restablecer la sesión; no se guardan credenciales en `localStorage`. La recuperación respetará el token en el fragmento del enlace que genera el backend.

## 6. Estado, formularios y reglas de compra

| Información | Dónde vive |
| --- | --- |
| Filtros, búsqueda y página del catálogo | URL, para conservar y compartir la navegación. |
| Catálogo, configuración y pedidos registrados | Backend; el frontend muestra sus respuestas. |
| Carrito en preparación | Estado React con persistencia local versionada. |
| Formularios, selección temporal y diálogos | Estado local de cada función. |
| Sesiones | Cookies seguras administradas por el backend. |

F3 usa Context para compartir un almacén pequeño y useSyncExternalStore para suscribirse a cambios, sin agregar una librería de estado. Persiste productos, variantes, cantidades y personalizaciones en localStorage versionado, durante siete días desde el último cambio, con opción de vaciar y sincronización entre pestañas. Los datos de contacto y dirección no se persisten. La lectura del almacenamiento se realiza después de la hidratación. Previews, credenciales y claves de idempotencia de previews se mantienen solo en memoria. F4 guarda en sessionStorage la referencia del intento de registro y hashes para recuperarlo tras una recarga sin persistir datos de contacto; después de confirmar guarda el ID del recibo.

Las reglas que debe respetar la interfaz:

- Cada renglón tendrá identidad propia: dos carteles con personalizaciones diferentes permanecen separados.
- El formulario se construye con los campos y opciones del producto. Validará para ayudar al usuario; NestJS vuelve a validar todo.
- Los importes se manejan en centavos de ARS y se formatean al mostrarlos. El precio local es orientativo: `/orders/preview` entrega el resumen autorizado para solicitar el pedido.
- Se distinguen subtotal conocido, productos a cotizar y envío por confirmar. Un valor pendiente no se muestra como cero ni como total final.
- Un cambio de carrito o entrega requiere un nuevo resumen. Si vence o cambia el catálogo, se solicita revisión antes de enviar.
- Un reintento de la misma operación conserva su clave de idempotencia para evitar duplicados. Una solicitud modificada usa una nueva clave.
- El pedido se registra antes de ofrecer el enlace de WhatsApp. El usuario debe enviar el mensaje; la interfaz no afirmará que ya lo envió.
- Si vence la sesión, se muestra una explicación y una recuperación adecuada. Recuperar el carrito local no restaura el acceso a pedidos de una sesión anterior.

## 7. Base visual y calidad

Primero definiremos espaciados, tipografía, colores funcionales y componentes reutilizables; después ajustaremos la identidad visual. F1 usa CSS con variables compartidas; las bibliotecas de formularios se evaluarán cuando se implementen, evitando instalar herramientas sin uso inmediato.

Todas las pantallas contemplarán carga, vacío, error y éxito. Los formularios tendrán etiquetas, errores junto al campo, foco visible y uso con teclado. El diseño se revisará en celular y escritorio.

Las imágenes usarán tamaños adecuados y una lista explícita de orígenes permitidos. La carga administrativa seguirá el flujo de firma y confirmación del backend con Cloudinary; las credenciales privadas nunca llegarán al navegador. El contenido editorial actual es texto: se renderiza escapado, sin interpretarlo como HTML.

Las pruebas se centrarán en los recorridos críticos: sesión y recuperación, personalización, persistencia del carrito, precios cambiados, reintentos de pedido, permisos y operación administrativa. Cada etapa deberá compilar y funcionar contra los contratos existentes antes de continuar.

## 8. Etapas del frontend

| Etapa | Entrega verificable |
| --- | --- |
| F1. Base (implementada) | Proyecto Next.js, estructura, layouts de tienda/panel, estilos iniciales, configuración local y conexión controlada con la API. |
| F2. Tienda y catálogo (implementada) | Inicio, catálogo, búsqueda, filtros, paginación, ficha y contenido público con carga/vacío/error. |
| F3. Personalización y carrito (implementada) | Variantes, formularios dinámicos, combos, persistencia y resumen validado por el backend. |
| F4. Solicitud y WhatsApp (implementada) | Contacto, entrega, registro sin duplicados, resumen propio y apertura del mensaje preparado. |
| F5. Acceso administrativo (implementada) | Login, logout, recuperación, sesión vencida y navegación por permisos. |
| F6. Administración del catálogo (implementada) | Productos, categorías, carreras, variantes, formularios, combos e imágenes. |
| F7. Operación y contenido (implementada) | Pedidos, estados, presupuestos, pagos manuales, contenido, configuración y cuentas OWNER. |
| F8. Revisión integral (implementada) | Recorridos completos, celular, accesibilidad, metadatos, rendimiento y preparación para despliegue. |

F1–F8 ya están implementadas. La revisión integral y la preparación local para despliegue están documentadas en [F8](frontend-stage-8.md) y la [guía de despliegue](frontend-deployment.md). El diseño detallado de cada pantalla se ajustará durante su etapa. La configuración real de servicios externos y el alojamiento del frontend quedan para después, según lo acordado; por ahora se trabaja localmente.

## Referencias

- Documento original de la tienda aportado por el usuario y [etapas del backend](backend-roadmap.md).
- Contratos existentes: [catálogo](backend-public-catalog.md), [carrito y preview](backend-preview.md), [pedidos y pagos](backend-orders.md), [autenticación](backend-auth.md), [contenido](backend-content.md) e [imágenes](backend-media.md).
- Documentación oficial: [Server y Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) y [pasarela hacia un backend](https://nextjs.org/docs/app/guides/backend-for-frontend).
