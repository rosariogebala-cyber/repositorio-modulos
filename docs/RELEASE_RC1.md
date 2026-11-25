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

### Regresión de contexto independiente
- SHA a6f8e16: API 45464637834 success; Browser 45464637657 failure. WebKit conserva 401 en inicio con sitio correcto incluso tras sesión autenticada y reintentos. Contexto independiente no resuelve.
- 04f96a5: sondas GET aisladas de QA, URL original frente a URL única, sin registrar cuerpo ni credenciales. Pendiente CI; distinguir caché de autorización antes de modificar backend.
- NO-GO; no merge, producción ni datos reales modificados.


### QA TLS local — 24/11/2026
La fixture API establece VERCEL=1 y emite cookies Secure, pero la matriz de navegador usaba HTTP en 127.0.0.1. Se incorporó un proxy HTTPS de loopback con certificado efímero y se exigió HTTPS en Playwright (36d9a02, d7a6e3c). No se modificó la política de cookies de producción. La hipótesis de diferencias entre motores sigue pendiente de confirmación por CI. NO-GO hasta obtener evidencia.

### Resultado de QA TLS
- SHA bafbf981ab420b60db1d6834dd5992828cffa686: API 45522192345 y Browser RC 45522192269 completados con success. Se supera el gate automatizado de navegador; no implica conformidad WCAG manual ni verificación del portal desplegado.
- Pendientes: aislamiento Preview, migración histórica hash-only con respaldo/restauración, E2E comercial, pagos reales, rendimiento/SEO y accesibilidad manual. NO-GO producción. No se modificaron datos reales.


### Cierre parcial de controles — 25/11/2026
- SHA a3beb0719b7009eed7d59ca70bd89043e8bc87fd: runs 45522789507 y 45522788768 success; logs de jobs 138898575760 y 138898572395 revisados. API 27 tests OK, armador 13 OK, migración hash-only 2 OK. Migración ficticia conserva hash y versión, elimina copia recuperable, es idempotente y aborta ante hash inválido. No se ejecutó migración real.
- Matriz browser: 78 registros, 0 con violaciones axe confirmadas, 0 con overflow, 0 con errores JS, 34 con comprobaciones axe incompletas. Artefacto 14981166469. Gate automatizado aprobado; WCAG manual sigue abierto.
- API verifica publicación controlada, límites, privacidad, CSP, credenciales hash-only y sitemap en fixture. No equivale a validación de pagos reales, aislamiento integral entre clientes ni E2E de ficha 360.
- RC1 acumulada contiene PR #42/#44/#45/#46; comparación con main: 123 commits ahead, 0 behind antes de este cambio documental. Sin merge a main.
- Pendientes bloqueantes: aislamiento Preview, respaldo/restauración y procedimiento de migración real, contratación/pagos, permisos y ficha 360 E2E, revisión manual de 34 registros axe, rendimiento y SEO desplegado. NO-GO producción. No se accedió a entorno local ni se modificaron datos reales. Esta revisión no ejecutó nuevos tests; evidencia corresponde al SHA indicado.

### Auditoría estática SEO y rendimiento — 25/11/2026
- Web comercial main: canonical, descripción, OG, viewport, preconnect de fuentes presentes. No se ejecutó Lighthouse en esta revisión.
- Portal y editor: meta robots noindex/nofollow presente. Se agregó X-Robots-Tag a rutas /portal/ y /maquetas/ en configuración Vercel. Verificación HTTP y CI pendientes.
- Armador compartido: genera title y viewport; revisar metadatos finales en publicación del servidor antes de modificar el armador. No se midieron LCP, CLS, INP ni Lighthouse. NO-GO permanece; sin datos reales ni cambios locales.
