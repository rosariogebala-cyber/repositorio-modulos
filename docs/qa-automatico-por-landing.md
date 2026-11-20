# QA automático por landing — implementación incremental

## Alcance de esta rama
Se incorporó `landing_qa_report(markup)` en `server.py`, que devuelve `version`, `html_sha256`, `passed`, `blocking_errors`, `checks` y `pending_external`. Los controles estáticos cubren landmark principal/H1, atributos alt, enlaces, botones e IDs duplicados. Las pruebas viven en `scripts/check-landing-quality.py`.

**Estado:** primera etapa. El guardado/publicación existente invoca `published_structure_errors` solo cuando la regla general `bloquear` está habilitada. Todavía NO existe una compuerta de QA obligatoria para todas las landings, ni historial persistido, interfaz de QA, ni ejecución de Lighthouse/axe/Playwright en el backend.

## Siguientes entregables
1. Endpoint autenticado de QA por ID de landing y almacenamiento privado del informe asociado a la versión/hash del HTML.
2. Ejecución asíncrona aislada de navegador en URL de previsualización, con límites de tiempo y recursos. Axe-core, Playwright (320–1440 px), Lighthouse mobile y desktop.
3. Panel «QA y publicación»: progreso, errores por gravedad, evidencia, fecha, versión, volver a ejecutar.
4. Bloqueo transaccional de publicación si el hash cambió o hay hallazgos críticos/altos; excepciones manuales auditadas para advertencias no bloqueantes.
5. Verificación post-deploy de URL y recursos, más pruebas de regresión en CI.

No exponer datos privados de clientes ni tokens en informes o artefactos públicos.
