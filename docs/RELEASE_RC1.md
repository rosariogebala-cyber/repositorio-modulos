# Lanzate v1.0.0 RC1 — 24/11/2026
**NO-GO provisional.** No merge ni despliegue de producción.
Base acumulada: PR #46, 1498d903fb39b36e280445a56f0186aae1d142f7.
CI de los PR #42, #44, #45 y #46: success, runs 45305399514, 45308581687, 45369889404, 45370759032.
Nuevo harness: Playwright Chromium/Firefox/WebKit, 320/1440 px, axe-core, errores JS, foco inicial, overflow, acceso anónimo. Usa fixtures existentes y servicios simulados; no constituye prueba completa de flujos ni certificación WCAG. Ejecución pendiente de evidencia CI.
## Bloqueos
- Revisar almacenamiento recuperable de claves de portal: scripts/test-api.py exige que el equipo pueda leer la clave. Evaluar migración a hash y restablecimiento; no exponer credenciales en reportes.
- Completar E2E de creación, cambios, aprobación, publicación simulada, pagos, alertas, ficha 360, aislamiento entre dos clientes y recuperación.
- Revisar axe incompletos, teclado completo, VoiceOver/NVDA, zoom real 200/400%, contraste, foco y modales.
- Medir Lighthouse, revisar SEO de landing pública, noindex del panel, sitemap y canonical.
- Verificar Preview aislado, SSL, backup restaurable de datos privados y plan de rollback; no usar producción para escrituras de prueba.
## Integración
Tras aprobar gates: respaldo de código y datos, fusionar #42, retarget #44 a main y verificar diff/CI, fusionar #44; repetir #45 y #46, luego incorporar QA aprobado. Revisar cada SHA y despliegue; detener ante errores. En local comprobar git status antes de actualizar, nunca reset/force. No sincronizado aún.

## Evidencias adicionales — 24/11/2026
- Run 45375313005: instalación de los tres motores correcta; browser gate fallido; artefacto 14911096718.
- fc33eeb: corrección de literal JS mal cerrado en portal/index.html; 5858f4a: control de sintaxis inline.
- Run 45376392224: regresión API aprobada después de corregir portal; run 45376392265 pendiente de resultado en el momento de revisión.
- 26a8869: generación automática de contraseña con secrets.token_urlsafe(18), 144 bits aleatorios; no modifica claves existentes. Pendiente regresión y migración de copia recuperable.


### 2026-11-24 — Portal autenticado y credenciales

- API/landings: ejecución 45388789003 aprobada. Browser RC 45388789083 falló: 62 registros de 78 esperados; dos flujos no llegaron a mostrar la aplicación aunque el fetch de sesión autenticada pasó. No es evidencia de pérdida de cookie.
- Se serializa la carga inicial anónima y el login (9aa5c0b) para evitar que una respuesta 401 anterior oculte la aplicación después de autenticar. Hipótesis pendiente de regresión; no se debilitan cookies ni permisos.
- Las nuevas credenciales se guardan sin copia recuperable; API aprobada. Pendiente migración controlada de copias históricas, respaldo y prueba de restauración. No se modificaron datos reales.
- NO-GO: navegador completo, accesibilidad manual, rendimiento, SEO, integración y verificación local pendientes.

### Diagnóstico WebKit y corrección RC
- API 45436520788: success. Browser 45436520855: failure, 62/78 registros; artefacto 14940967490. WebKit recibe login 200, inicio 401 y posteriormente sesión autenticada. Sin errores JS registrados.
- 36588dc: reintento acotado de lectura de inicio únicamente después de login exitoso y ante 401 (hasta cuatro reintentos, 2250 ms acumulados). No modifica permisos, cookies ni credenciales. Hipótesis de propagación de cookie pendiente de confirmación por CI.
- NO-GO hasta regresión completa y demás controles bloqueantes. Sin merge, cambios de datos reales ni sincronización local.


## Auditoría comercial y técnica — 2026-11-24

- CI `45446683591`: Calidad de landings y API aprobada. CI `45446683521`: Browser RC fallida; 62/78 registros, WebKit conserva HTTP 401 en portal/inicio incluso después del login 200. Artefacto 14944029918. No se aprueba autenticación ni WCAG integral.
- Cambio `dedcc241bab5f70db431feb5823ee810024dcf8c`: Cache-Control: no-store en respuestas JSON si no existe directiva previa, incluido HTTP 401. Mitigación de caché de respuestas de sesión; causa raíz aún no confirmada. Regresión pendiente.
- Revisión estática de la web comercial (repositorio lanzate): canonical, descripción, OG, sitemap, robots, textos legales y ALT de imágenes de proyectos presentes. Los tres enlaces Mercado Pago están vacíos y el CTA dice pagar pero abre mailto. Corregir etiqueta y FAQ o configurar enlaces reales; no simular pagos. Validación real de contacto, navegación, rendimiento, teclado y lector de pantalla pendiente.
- Preview Vercel: GITHUB_TOKEN solo producción y variables KV compartidas. Crear repositorios y Redis independientes, restringir token, verificar aislamiento antes de habilitar escrituras. No modificar producción.
- Dictamen: NO-GO plataforma RC1; web comercial pendiente de corregir contratación y verificar experiencia real. No se accedió a entorno local ni se fusionaron PR.


### Seguimiento comercial
- PR comercial https://github.com/rosariogebala-cyber/lanzate/pull/5: smoke y sintaxis aprobados (run 45453693523).
- Se incorporó matriz comercial Playwright/axe de 27 casos en commit 282ac35f38a53847dd667f57f7c8cb8ff8637458 del repo lanzate. Pendiente de ejecución, no equivale a conformidad WCAG ni validación real de entrega de contactos.
- RC1 plataforma: API run 45453458789 aprobada; browser run 45453458866 fallida. No fusionar ni publicar hasta resolver.


### Seguimiento de autenticación — 2026-11-24
- API y landings: run 45458281700 aprobada.
- Navegador: run 45458281533 fallida (62/78 registros, 2 fallos de autenticación WebKit, 0 registros con violaciones axe confirmadas, 28 con comprobaciones incompletas). El diagnóstico confirma sitio correcto en login, sesión e inicio; inicio responde 401 incluso tras login 200. No está confirmada la causa raíz.
- Commit 920b993c17fc2cc075b8583eb5496bab8d2634af: contexto de navegador independiente para el flujo autenticado del cliente; regresión pendiente. No se modifica autenticación de producción ni se reducen controles.
- Bloqueos comerciales: correo y WhatsApp ficticios; no habilitar contratación hasta configurar datos reales y verificar entrega. Preview sigue pendiente de aislamiento. NO-GO.
