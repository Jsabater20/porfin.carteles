# Frontend F8 · Revisión integral

## Alcance

Cierre de las etapas del frontend. La revisión reúne los recorridos de tienda y administración, accesibilidad, adaptación a celular, metadatos, señales básicas de rendimiento y preparación de ejecución en un servidor Node.

No publica servicios ni configura Railway, Neon, Cloudinary o SMTP. La [guía de despliegue](frontend-deployment.md) separa los pasos pendientes fuera del entorno local.

## Preparación completada

- Metadatos públicos con título, descripción, URL canónica, Open Graph y Twitter; imagen de producto solo de Cloudinary permitido.
- Catálogo filtrado sin indexación; fichas no disponibles y contenido sin publicar también fuera de indexación.
- Administración, carrito y pedidos privados con noindex. La autorización depende de sesiones y guards, no de robots.
- SITE_INDEXABLE desactivado por defecto, también forzado a false para direcciones locales. robots.txt bloquea rastreo mientras no esté habilitado.
- sitemap.xml incluye inicio, catálogo, páginas editoriales publicadas y todas las páginas de productos; excluye rutas privadas. Ante catálogo incompleto o errores no presenta silenciosamente una lista parcial.
- Consulta de ficha compartida entre metadatos y contenido durante el render, para evitar duplicar esa lectura.
- Imagen principal de ficha con prioridad; restantes imágenes con carga diferida y tamaños responsivos.
- Enlace para saltar al contenido, destino enfocable y respeto de movimiento reducido.
- Arranque de producción con origen/backend HTTPS explícitos, puerto validado y escucha en 0.0.0.0.
- Endpoints de vida y disponibilidad, sin datos internos.
- Comando integral secuencial para no competir por los puertos de prueba.
- Workflow ampliado con PostgreSQL temporal, recorridos reales, navegador y artefactos de accesibilidad/capturas. Se preparó el archivo; su ejecución remota queda por comprobar al conectar el repositorio.

## Comandos

Desde Frontend, con PostgreSQL local activo y Chrome instalado:

```powershell
npm.cmd run test:release
```

Incluye lint, tipos, pruebas unitarias, build, recorridos HTTP, calidad, carrito, pedidos simulados, pedidos contra Nest/PostgreSQL, autenticación, catálogo e imágenes, y operación/contenido/cuentas.

Si check y build ya pasaron para el código actual, `npm.cmd run test:release -- --built` ejecuta solamente los recorridos. `npm.cmd run test:quality-browser` ejecuta la revisión de la tienda por separado. El modo integral agrega axe a los recorridos privados y de solicitud.

Se mantienen los requisitos de las etapas anteriores: Next de prueba en 3100, Chrome en 9232 y APIs de prueba o Nest en puertos aislados. Los tests crean datos exclusivamente en esquemas temporales que eliminan al terminar. Los proveedores se simulan; recuperación usa un buzón local.

Los resultados quedan en Frontend/.test-build: accessibility.jsonl, quality-measurements.json y capturas. Son archivos ignorados por Git. CHROME_PATH permite indicar otro navegador; TEST_BROWSER_NO_SANDBOX=1 se reserva para un perfil de prueba aislado en entornos restringidos.

## Resultado local verificado · 29/09/2026

- ESLint, TypeScript y las 75 pruebas pasaron; el build de producción terminó correctamente.
- Pasaron los ocho recorridos integrales: tienda HTTP, calidad en navegador, carrito, solicitudes, pedidos contra Next/Nest/PostgreSQL, acceso, catálogo y operación administrativa.
- Se registraron 71 evaluaciones de axe sin violaciones automáticas. Dos tablas vacías (categorías y carreras) quedaron señaladas para revisión manual por `th-has-data-cells`; el componente usa encabezados y celdas por columna al tener filas. Esto no sustituye una prueba con lector de pantalla.
- Se verificaron anchos de 1440, 390 y 320 px, navegación al contenido con teclado, movimiento reducido y ausencia de excepciones JavaScript en los recorridos de navegador.
- Se inspeccionaron las capturas móviles de inicio y detalle administrativo de pedido. Los datos, imágenes y textos de ejemplo no son contenido de producción.
- Máximo JavaScript inicial observado en la muestra pública: 530382 bytes decodificados (aproximadamente 530 KB). La medición usa recursos locales de Next y no equivale al peso transferido ni a resultados de producción.
- El flujo real usó esquemas temporales; no se configuraron proveedores externos ni se publicaron servicios.

## Límites de la revisión

axe revisa reglas automáticas WCAG 2 A/AA y 2.1 AA. Un resultado sin violaciones no equivale a una certificación ni reemplaza lector de pantalla o pruebas con personas.

Las mediciones de JavaScript y tiempos de carga se obtuvieron en equipo local con datos de prueba; no representan Core Web Vitals de producción. Falta medir imágenes y red reales.

La guía de despliegue conserva pendientes la configuración externa, cadena de proxies/IP, cookies bajo HTTPS real, SMTP, Cloudinary, dominio, primer OWNER, respaldo/alertas y auditoría remota de dependencias. El producto puede seguir ajustándose en diseño y detalles sin cambiar esta arquitectura.
