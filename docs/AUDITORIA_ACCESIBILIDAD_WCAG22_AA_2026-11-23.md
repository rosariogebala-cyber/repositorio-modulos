# Auditoría técnica de accesibilidad — Lanzate (WCAG 2.2 AA)

**Fecha:** 23 de noviembre de 2026  
**Alcance auditado:** constructor `maquetas/constructor.html`, asistente de identidad y estructura, editor `maquetas/js/constructor.js`, estados de guardar/revisar/aprobar/publicar, comparador de vistas, estilos `maquetas/css/lanzate.css`, y controles de calidad del servidor. Revisión sobre PR #42, **sin publicar en producción**.

**Método:** inspección de HTML/CSS/JS/Python del repositorio; comprobaciones de estructura automatizadas en GitHub Actions; contraste calculado para colores concretos de los nuevos componentes. **No se ejecutó** una sesión manual con VoiceOver/NVDA, un navegador interactivo con teclado real ni una auditoría completa axe-core/Playwright sobre las páginas desplegadas. Por tanto **no se declara conformidad WCAG 2.2 AA**.

## Hallazgos y correcciones

| Prioridad | Hallazgo | Criterios orientativos | Estado |
|---|---|---|---|
| Alta | El renderizado recreaba los botones y `select` al subir/bajar/quitar módulos, con riesgo de pérdida del foco de teclado. | 2.1.1 Teclado, 2.4.3 Orden del foco, 2.4.7 Foco visible | **Corregido en PR:** recuperar el foco sobre el control equivalente o la selección disponible. |
| Alta | Reordenar módulos no anunciaba el cambio a usuarios de lectores de pantalla. | 4.1.3 Mensajes de estado | **Corregido en PR:** actualización en región `role=status`. Pendiente evaluar calidad del anuncio en VoiceOver/NVDA. |
| Media | Los diálogos nuevos requerían instrucciones y un punto de foco inicial inequívoco. | 1.3.1 Información y relaciones, 2.4.3 Orden del foco, 4.1.2 Nombre/función/valor | **Corregido en PR:** `aria-labelledby`, `aria-describedby`, título `tabindex=-1` y `focus()` al abrir; el elemento nativo `<dialog>` gestiona la modalidad. |
| Media | Algunos controles de reordenamiento podían seguir habilitados cuando no existía un movimiento posible. | 3.2.4 Identificación consistente, 4.1.2 | **Corregido en PR:** botones límite deshabilitados y nombres de variantes más comprensibles. |
| Media | Se necesitaba asegurar un foco visible y tamaño táctil consistente en los controles nuevos. | 2.4.7, 2.4.11 Foco no oculto, 2.5.8 Tamaño del objetivo | **Corregido en PR:** outline sólido de 3 px, separación, botones de al menos 44 px, estilos reducidos de movimiento. Pendiente verificar contra fondos variables y zoom. |
| Alta | Las verificaciones de imágenes pueden tratar `alt=""` como error incluso cuando una imagen sea decorativa, mientras que el backend añade `alt=""` automáticamente a imágenes sin atributo. Esto impide distinguir el uso decorativo legítimo de una imagen informativa no descrita. | 1.1.1 Contenido no textual | **Corrección técnica aplicada en PR:** se exige que exista atributo `alt`, pero se admite `alt=""` para imágenes decorativas y se añade advertencia de revisión editorial. **Pendiente manual:** verificar que las imágenes informativas tengan descripciones útiles; el código no puede decidir su función por sí solo. |
| Media | Comprobaciones de color en módulos editables, placeholders y elementos sticky requieren pruebas visuales por contexto. | 1.4.3 Contraste, 1.4.11 Contraste no textual, 2.4.11 | **Pendiente de navegador real**. |
| Media | Reflow a 320 CSS px y zoom 200/400%, secuencia de tabulación y uso con lector de pantalla requieren pruebas funcionales. | 1.4.10 Reajuste de texto, 1.4.12 Espaciado, 2.1.1, 2.4.3 | **Pendiente de navegador real**. |

### Contraste revisado (cálculo estático)

- Indicador de foco nuevo `#4935B5` sobre blanco: **8,54:1**.
- Texto secundario del nuevo diálogo `#566076` sobre blanco: **6,31:1**.
- Estado del flujo `#25334A` sobre blanco: **12,72:1**.

Estos cálculos solo cubren las combinaciones declaradas; **no** certifican el contraste real de todos los estados, sobreimpresiones o fondos de las landings.

## Pruebas que sí ejecuta CI

- Reglas de estructura: `main`, `h1`, `alt`, navegación y `id` repetidos.
- HTML semántico y componentes del constructor.
- Comportamiento de API y separación entre borrador/publicación.
- Verificación estática adicional para nombres/descripciones de diálogos, restauración de foco en JS y tamaños/estilo del foco.

Una comprobación estática o un test unitario superado **no demuestra** que la interacción de teclado, el foco real o el lector de pantalla funcionen correctamente.

## Matriz de aceptación manual previa a fusionar

1. **Teclado:** desde Crear landing hasta Publicar, recorrido solo con Tab/Shift+Tab/Enter/Espacio/Escape. El foco permanece visible, no desaparece tras renderizados, no salta al documento principal ni queda atrapado fuera de un diálogo.
2. **Asistente:** abrir propuesta; Tab a select; cambiar variante; subir/bajar y quitar; confirmar que el foco queda en un control lógico y que la actualización de orden se comunica.
3. **Diálogos:** al abrir, el lector anuncia título e instrucciones; Tab se limita al modal; Escape cierra la propuesta sin realizar cambios; al cerrar el foco vuelve a un control significativo.
4. **Vistas previas:** verificar si `iframe` con borrador/publicada anuncia sus títulos, permite volver al diálogo y cerrar con Escape.
5. **Formularios:** todos los campos con etiqueta; mensajes de error asociados a controles; errores persistentes y recuperación posible sin ratón.
6. **Zoom y móvil:** 320 CSS px, 200 % y 400 %; sin scroll horizontal de la página ni pérdida de acciones, salvo contenido que necesite disposición bidimensional.
7. **Contrastes:** aplicar paletas claras/oscuras y cambios manuales; al menos 4.5:1 texto normal, 3:1 texto grande y controles/estados según WCAG.
8. **Objetivos:** al menos 24 × 24 CSS px o separación equivalente WCAG 2.2 AA; objetivo de diseño preferente 44 × 44 px; verificar sobre todo iconos del editor anteriores a PR #42.
9. **Contenido generado:** verificar `alt` útil en fotos informativas y `alt=""` solo en decorativas; estructura de títulos, botones y enlaces.
10. **Tecnologías:** axe-core en editor/diálogos/landing publicada y pruebas manuales con VoiceOver + Safari y NVDA + Chrome/Firefox.
11. **Foco no oculto:** header sticky, barras inferiores, paneles laterales y modales no deben cubrir el control enfocado.
12. **Estabilidad:** durante recargas, validación y cambios de estado el mensaje debe anunciarse de forma clara sin romper la secuencia de teclado.

## Criterio de salida

El PR #42 puede pasar **automatización** y seguir necesitando **revisión manual**. No etiquetar Lanzate como “WCAG 2.2 AA validado” hasta cerrar y documentar la matriz en navegadores reales. No mezclar una auditoría de accesibilidad con una medición de Lighthouse: son controles complementarios.

Norma de referencia: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), especialmente criterios 1.1.1, 1.4.3, 1.4.10, 2.1.1, 2.4.3, 2.4.7, 2.4.11, 2.5.7, 2.5.8 y 4.1.3.
