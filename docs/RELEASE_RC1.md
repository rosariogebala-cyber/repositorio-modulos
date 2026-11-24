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
