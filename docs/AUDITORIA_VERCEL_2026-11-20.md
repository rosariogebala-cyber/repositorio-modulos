# Auditoría integral — Lanzate (Vercel / constructor / portal)

**Fecha:** 20/11/2026  
**Sitio solicitado:** https://lanzate-mu.vercel.app/index.html  
**Repositorios revisados:** `repositorio-modulos` (constructor/backend), `lanzate` (web comercial) y estructura de `lanzate-datos` (sin copiar ni exponer datos personales).  
**Método:** inspección de código, rutas y workflows de GitHub. **Limitación:** no fue posible abrir la URL pública de Vercel en esta sesión, por lo que las comprobaciones visuales/Lighthouse live, autenticación real, Redis y funcionamiento desplegado quedan SIN VERIFICAR. No se alteró producción ni se realizó login.

## Hallazgos por prioridad

### P0 — Desajuste comercial entre web y constructor (confirmado en código)
El archivo `lanzate/js/config.js` presenta los precios:

| Plan | Web comercial: inicial / mensual | Constructor `repositorio-modulos/data/planes.js`: inicial / mensual |
| --- | ---: | ---: |
| Express | $99.000 / $19.900 | $149.000 / $15.000 |
| Negocio | $179.000 / $34.900 | $249.000 / $25.000 |
| Pro | $299.000 / $54.900 | $399.000 / $39.000 |

También difieren límites: el sitio comercial usa 4/7/10 secciones por plan y 10/30/ilimitados envíos de contenido, mientras el constructor conserva 6/8/12 secciones y 1/3/10 cambios mensuales. Se deben distinguir **envíos del portal**, **cambios asistidos** y **módulos adicionales** en UI y lógica del servidor. La documentación dice que los planes se sincronizan desde `Lanzate_site/js/config.js`, pero el estado de `data/planes.js` no coincide. **Antes de modificar precios o límites de clientes reales**, revisar historial de sincronización, compatibilidad de contratos y tests; unificar fuente de verdad, verificar sincronización en Vercel y agregar test de coherencia entre repos. **No modificar automáticamente contratos ni planes activos.**

### P1 — Desfase de biblioteca (confirmado en código)
`data/modules.js` define **26 módulos y 76 variantes**, pero `index.html` muestra en su footer **22 secciones y 65 propuestas**. `js/app.js` calcula variantes multiplicando `mostrados.length * 3` aunque los módulos tienen cantidades distintas de variantes. Usar conteo real (`reduce` sobre `variantes.length`) y actualizar el footer a partir del dataset. El PR #29 ya contiene trabajo sobre esta misma zona: evitar cambios en paralelo sin revisar conflicto.

### P1 — Seguridad y privacidad: cambios pendientes de integración
PR #29 `mejoras-auditoria` (no integrado al revisar) introduce medidas importantes: `LANZATE_SECRETO` obligatorio, sesiones revocables, AES-GCM para contraseñas del portal, protección de landings privadas y mejoras de privacidad. Su descripción requiere configurar variables en Vercel y recrear contraseñas de portal antes de integrarlo. **No fusionar sin migración controlada, backup de datos y verificación de accesos.**

El código de `main` ya usa cookies `HttpOnly; SameSite=Lax; Secure` en Vercel, validaciones de origen para escrituras y límites de intentos de login; no corresponde calificar el sistema como desprotegido sin ensayo de penetración. Revisar separación de sesiones del equipo/cliente, secretos, roles y comprobaciones de autorización por tenant. La capacidad de que el equipo vea y reenvíe contraseñas del portal aumenta el impacto potencial de una filtración, aunque el secreto no esté en el repositorio.

### P1 — QA de publicación aún incompleto
PR #30 `qa/validacion-landings-20261120` es expresamente un borrador: crea un reporte estático, pero no integra todavía Playwright, axe, Lighthouse ni bloqueo de publicación por fallos. `main` tiene tests unitarios de API y de HTML generado, pero **no equivalen** a QA visual y E2E del portal, editor y revisión antes/después. Diseñar QA por landing basado en datos de prueba, sin tocar clientes reales; exigir chequeo de publicación y estado de workflows.

### P2 — Datos de contacto de ejemplo (confirmados en código, alcance limitado)
`data/config.js` del constructor y `lanzate/js/config.js` conservan contacto de prueba (dominio `example.com` y teléfono demostrativo). Verificar si esa configuración se expone en páginas o acciones reales y reemplazarla **solo con datos de contacto confirmados**, nunca inventarlos.

### P2 — SEO e indexación
`repositorio-modulos/robots.txt` excluye `/maquetas/`, `/data/`, `/portal/`, y su sitemap apunta a GitHub Pages, mientras el panel se utiliza en Vercel. La biblioteca no está destinada necesariamente a buscadores; el PR #29 agrega `noindex`. Confirmar qué URLs deben indexarse (landings públicas sí, panel/portal/demos privadas no) y verificar canonical/sitemap en el dominio que realmente se use para cada landing. Evitar duplicación entre GitHub Pages y Vercel.

### P2 — UX, accesibilidad y responsive pendientes de verificación real
Probar biblioteca a 320/375/768/1024/1440 px y zoom 200/400%; navegación por teclado (incluido cierre y retorno del foco del visor), `prefers-reduced-motion`, formulario/login/recuperación, preview antes/después, aprobación, estado de publicaciones, mensajería y carga de imágenes. Correr axe + WCAG 2.2 AA y Lighthouse sobre la **versión desplegada**, no inferir puntuaciones a partir del código.

## Qué sí existe (comprobado en código)
- Backend Python `server.py` atendido en Vercel mediante `api/index.py`; datos privados en repositorio separado.
- Rutas para equipo, portales específicos por cliente, solicitudes, consultas, aprobación, publicación y métricas.
- Workflow `landing-quality.yml` que comprueba sintaxis Python/JS, calidad estática del HTML generado y pruebas de API.
- Archivos para ejecutar tests localmente: `scripts/test-api.py`, `scripts/check-landing-quality.py`.
- PR #29 y #30 contienen trabajo previo; **este informe no los fusiona ni altera.**

## Orden recomendado para cerrar la auditoría
1. Resolver fuente única de precios y límites, con revisión de contratos/clientes activos y tests de sincronización.
2. Preparar migración de seguridad del PR #29: variables Vercel, sesiones, contraseñas, respaldos y validación de permisos.
3. Completar PR #30 y automatizar E2E, axe, capturas y QA de publicación no destructivo.
4. Ajustar conteos de biblioteca; verificar SEO y URLs canónicas del dominio publicado.
5. Ejecutar pruebas reales en Vercel con usuario de prueba y datos sintéticos; medir rendimiento móvil y desktop; publicar solo tras aprobación.

**Estado:** informe técnico de inspección de repositorios completado, **auditoría integral de producción aún abierta** por limitaciones de acceso de navegador y credenciales. Sin cambios funcionales ni despliegues en este PR.

## Correcciones implementadas en rama QA (no publicadas)

- Sincronizada la instantánea de `data/planes.js` con `lanzate/js/config.js`: Express $99.000 + $19.900/mes (4 secciones, 10 envíos, 1 asistido), Negocio $179.000 + $34.900/mes (7, 30, 3) y Pro $299.000 + $54.900/mes (10, envíos ilimitados, 5 asistidos).
- El sincronizador del backend separa **envíos del portal** de **cambios asistidos** y no interpreta «Gestión de turnos a medida: Adicional» como beneficio incluido.
- El contador de envíos registra solamente pedidos de origen `cliente`; pedidos del equipo se contabilizan por separado, sin borrar registros anteriores.
- El portal diferencia visualmente envíos ilimitados y cambios asistidos; el contador de Pro representa ilimitados con ∞.
- Biblioteca: 26 módulos y 76 variantes; el recuento visible calcula cada variante real.
- Incorporadas pruebas de regresión y un paso específico en CI para evitar divergencias.

**Antes de integrar:** revisar si algún contrato previo tiene precios, cupos o módulos distintos; la actualización del catálogo cambia el comportamiento de los planes activos que no tengan condiciones históricas específicas. La rama no altera la base de datos privada ni modifica clientes existentes. Verificar en Vercel y portales de prueba. No mezclar automáticamente con los PR #29 y #30 sin reconciliar los cambios.
