# Lanzate — flujo de armado, QA y publicación controlada

## Experiencia del equipo

1. **Identidad del negocio:** seleccionar cliente y plan por landing; aportar texto y/o imágenes. Las URL de Instagram y sitio web no se visitan automáticamente, no afirmarlo como hecho.
2. **Propuesta de estructura:** la IA propone secciones en su única consulta de identidad. Antes de generar, el equipo puede agregar, quitar, reordenar y cambiar variantes de módulos de la biblioteca sin nuevos tokens. Hero consume una sección; navegación y footer no.
3. **Editar y guardar borrador:** `POST /api/borradores` para una nueva landing, `PUT /api/landings/:id/borrador` para cambiarla. Guarda la estructura y el HTML en el repositorio privado `lanzate-datos/borradores/:id.json`, nunca genera `l/:cliente/:landing/index.html` ni añade la landing al sitemap.
4. **QA y vista previa:** `GET /api/landings/:id/qa` ofrece errores y advertencias; `GET /api/landings/:id/borrador/vista` sirve la vista previa bajo autenticación, `noindex`, sin analítica. Comparar contra la versión pública anterior.
5. **Revisión:** `POST /api/landings/:id/revision`, solo sobre un borrador guardado. El servidor comprueba reglas, contenido de ejemplo, cupo, SEO básico, alt y landmarks.
6. **Aprobación:** `POST /api/landings/:id/aprobar`. Si hay secciones extra, la persona del equipo debe confirmar explícitamente la aprobación comercial. Se conserva la revisión exacta que fue aprobada.
7. **Publicación:** `POST /api/landings/:id/publicar`, solo si la revisión aprobada coincide con la almacenada; valida otra vez y escribe el sitio público. El despliegue de Vercel/GitHub puede terminar después de esta respuesta.
8. **Descarte:** `DELETE /api/landings/:id/borrador` elimina el borrador sin cambiar la última página publicada. Si la landing nunca se publicó, se elimina también su registro provisional.

`Sincronizar publicadas` del panel despliega las **versiones ya publicadas** y no rearma ni aprueba borradores automáticamente.

## Importante: Preview y entornos aislados

Los despliegues de Vercel **Preview** son de solo lectura por defecto: el servidor rechaza las operaciones de escritura para evitar que pruebas en una rama modifiquen clientes o landings reales mediante un token compartido.

La variable `LANZATE_PREVIEW_SANDBOX=1` **solo debe habilitarse** si el proyecto Preview utiliza repositorios de datos y credenciales de pruebas totalmente separados de Production, y se ha verificado que los secretos y las URL de publicación nunca apuntan a producción. Tener un subdominio Preview diferente por sí solo NO equivale a tener datos aislados.

Para pruebas de creación/edición/publicación usar el servidor local sobre **copias de prueba de datos**, o un entorno de staging independiente. No ejecutar el flujo experimental sobre las landings reales hasta completar QA.

## Seguridad y mantenimiento

- Las rutas de borradores son privadas y necesitan sesión del equipo.
- El HTML del borrador nunca se expone como archivo público; las vistas previas incorporan CSP y `X-Robots-Tag: noindex`.
- `base_revision` y `revision` impiden pisar accidentalmente cambios de otra pestaña y publicar una versión diferente de la aprobada.
- Los cambios privados se almacenan en `lanzate-datos`; **no** incluirlos en el repositorio público.
- El historial anterior a una publicación se conserva por landing.
- Al borrar una landing se elimina también el borrador privado.
- Mantener el token GitHub, las claves de IA y la sesión exclusivamente en servidor.

## Pruebas automáticas

- `python3 scripts/test-api.py`: autenticación, sesiones, publicación, portal, borradores, concurrencia y aislamiento de archivos.
- `python3 scripts/check-landing-quality.py`: H1, main, alt, navegación, ids, colores y otras reglas estructurales.
- `python3 scripts/test-plan-consistency.py`: cantidad de secciones por plan.
- `python3 scripts/test-reference-assistant.py`: seguridad del análisis IA y prioridades.
- `node --test scripts/test-armador.mjs`: coherencia y armador compartido.
- `node --check maquetas/js/constructor.js` y `python3 -m py_compile server.py draft_workflow.py`.

## Criterios manuales para publicar

La validación automática **no certifica WCAG 2.2 AA**. Para una publicación real comprobar también con teclado y lector de pantalla, axe-core sobre las páginas desplegadas y contraste visual (texto al menos 4.5:1; texto grande 3:1), foco visible y sin ocultarse bajo elementos fijos, tamaño/espaciado de objetivos, zoom 200%/400%, errores y mensajes de formularios, orden de lectura y cierre de diálogos.

Probar escritorio, tablet y móvil real, enlaces, formularios, rutas y redirecciones, SEO técnico (canonical, sitemap, metadatos, datos estructurados válidos), carga inicial y Core Web Vitals. Objetivos orientativos para p75 de usuarios reales: LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1. Usar Lighthouse para diagnóstico y CrUX/RUM cuando haya datos suficientes.

Probar los 3 planes: Express 4, Negocio 7 y Pro 10 secciones, sin contar navegación/footer. Confirmar presupuesto de módulos extra antes de aprobar. Verificar que guardar, descartar y la sincronización global **no alteran el sitio público**.

## Actualizar en la Mac

Dentro de `Lanzate_modulos` y con cambios locales guardados:

```sh
git status
git switch main
git pull --ff-only origin main
python3 server.py
```

Si `git status` muestra archivos modificados, revisar antes de `git pull`; no usar `reset --hard` para resolverlo.
