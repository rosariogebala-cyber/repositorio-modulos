# Lanzate · Biblioteca actualizada

Abrí index.html en el navegador o la carpeta en Cursor. No requiere instalación ni compilación.

16 módulos y 48 imágenes de 800 px de ancho. Cada sección tiene su carpeta en assets/modulos/ con simple.png, media.png y compleja.png.

Se añadieron Productos, Promociones y Preguntas frecuentes. Se actualizaron las propuestas de contenido, se recuperó la imagen faltante y se corrigió la navegación repetida. Las portadas Hero y la Galería conservan el material del sitio recibido.

## Archivos

- index.html: estructura.
- css/styles.css: estilos responsive.
- js/app.js: búsqueda, categorías, visor y descarga individual.
- data/modules.json: catálogo editable.
- data/modules.js: copia del catálogo que carga el navegador para funcionar también sin servidor. Mantener ambos sincronizados.
- assets/modulos/: imágenes por sección.

Las tres propuestas de Servicios tienen estructuras similares.

Esta es una biblioteca visual. Los controles dibujados dentro de las imágenes son referencias, no widgets funcionales. El buscador, los filtros, el visor y la descarga del catálogo sí funcionan.

Validación: 48 rutas y dimensiones comprobadas, sintaxis JavaScript correcta; búsqueda y apertura del visor revisadas en navegador. No se publicó ni se modificó GitHub.

## Botonera actualizada

Navegación por las 16 secciones en el orden solicitado. Cada botón lleva a su sección. Si había una búsqueda activa, se limpia para mostrar el destino. Se retiró Productos / Promociones (antiguo punto 7) del catálogo y del paquete.

## Ubicación y Footer

Se añadieron Dónde nos encontramos y Footer al final de la botonera, cada una con tres variantes. Los mapas, direcciones y datos de contacto son ilustrativos. La biblioteca muestra PNG: Google Maps se integrará como mapa real al desarrollar el módulo elegido.

### Activación de los cambios de seguridad

- Prepará una base nueva con datos ficticios para Preview. Solo en esa base,
  creá `public.lanzate_preview_guard` con una columna `ambiente TEXT PRIMARY KEY`
  y una fila con el valor `preview`. Preview valida la marca antes de ejecutar
  migraciones o consultas de negocio. Producción rechaza una base con esa marca.
- Configurá `LANZATE_PREVIEW_DATABASE_URL`, `LANZATE_PREVIEW_ADMIN_KEY` y
  `LANZATE_PREVIEW_SESSION_SECRET` solo en Preview. Usá valores independientes
  de producción y un secreto de sesión de al menos 32 caracteres. Preview
  mantiene deshabilitados Resend y las llamadas de IA.
- En producción, configurá `RESEND_API_KEY`, `PORTAL_MAIL_FROM` con un remitente
  verificado y `PORTAL_PUBLIC_URL` con el origen HTTPS del portal. Confirmá
  que cada cliente tenga un correo de recuperación correcto.
- Al desplegar, los accesos del portal con contraseñas anteriores deben
  restablecerse. Los registros reversibles se eliminan y las cookies del portal
  emitidas por la versión anterior quedan invalidadas. Un administrador puede
  emitir una nueva credencial desde la ficha si el cliente necesita ayuda.
- Probá el ciclo completo en Preview con dos clientes ficticios antes de pasar
  a producción. Incluí aprobación parcial, reapertura del editor y restauración
  de la última publicación aprobada.
