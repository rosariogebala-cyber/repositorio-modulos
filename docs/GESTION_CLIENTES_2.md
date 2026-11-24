# Lanzate — Gestión de Clientes 2.0

## Estado y alcance

Implementación apilada sobre el nuevo workflow de borradores del PR #42, en la rama `feature/gestion-clientes-2-20261123`. No integrar hasta que el PR #42 pase los controles manuales de accesibilidad y de aislamiento de datos.

**Nueva pantalla:** `/maquetas/gestion-clientes.html`.

**Nuevo orden de la navegación:** Resumen → Clientes → Crear landing → Landings → Biblioteca → Maquetas → Reglas.

## Panorama operativo

- Número de clientes, clientes activos, landings publicadas, pedidos pendientes y clientes con pagos pendientes/vencidos.
- Tabla de cartera: cliente, fecha real de alta, inicio contractual registrado, planes de sus landings, cantidad de solicitudes, cobros pendientes, saldos por moneda (ARS y USD) y próximo vencimiento.
- Filtros de búsqueda y prioridad (pagos pendientes/vencidos, cambios pendientes y clientes sin registro comercial).
- CSV con importes en sus monedas originales. **No se combinan ARS y USD** ni se aplican cotizaciones implícitas.
- Un cliente puede tener varias landings con planes distintos. El cupo de solicitudes se deriva del plan de cada landing.

## Ficha comercial

- Inicio del contrato y próxima fecha de seguimiento, registrados manualmente.
- Notas internas.
- Resumen de landings y usos de solicitudes.
- Registro individual de movimientos: concepto, importe, moneda, vencimiento, estado (pendiente, pagado, anulado), fecha de cobro al marcar «pagado», y landing opcional.
- Datos nuevos en `lanzate-datos/gestion-clientes/<id>.json` (privado).
- Los pagos **no se cobran automáticamente** ni se verifican con banco. «Pagado» representa lo registrado manualmente por el equipo.
- No se inventan fechas de alta contractual, vencimientos, facturas, pagos o precios para clientes históricos. Las fechas de alta provienen del registro existente.

## Seguridad y QA

- Los endpoints `GET /api/gestion/clientes`, `GET/PUT /api/gestion/clientes/:id` y `POST /api/gestion/clientes/:id/movimientos` requieren sesión administrativa del equipo.
- Las rutas de gestión son inaccesibles sin login. Preview Vercel es de solo lectura por defecto.
- Validación de formato y calendario en fechas; importes positivos enteros en centavos; monedas ARS/USD; estados de pago autorizados; landing perteneciente al cliente.
- `revision` evita sobrescribir datos previamente cambiados desde otra pestaña.
- El CSV sale del panel autorizado y es un archivo con datos personales; no compartirlo públicamente.
- Los datos comerciales nunca entran en los repositorios públicos `repositorio-modulos` o `lanzate`, ni en páginas de landing.
- Verificación automatizada: API (autenticación, ausencia de cobros ficticios, alta y movimiento, concurrencia, separación por moneda), Python, JS y SEO/accesibilidad estructural.

## Accesibilidad

Se usan tabla HTML con `caption` y encabezados, formularios con etiquetas nativas, estados `aria-live`, controles de al menos 44 px y enfoque visible. La tabla horizontal ofrece desplazamiento con teclado y un nombre accesible. **Pendiente** una prueba práctica con teclado y lector de pantalla en Safari/VoiceOver y Chrome/NVDA, zoom 400 %, reflow y axe-core. No equivale a una certificación WCAG 2.2 AA.

## Próxima evolución

- Editar/anular movimientos históricos con auditoría de quién/ cuándo los cambió (en esta primera entrega los movimientos son de solo agregado, para evitar borrados accidentales).
- Registrar comprobantes y comprobación de cobro en pasarela bancaria/contable (requiere integración y autorización específica).
- Generar períodos mensuales de facturación con idempotencia, ajustados a cada contrato y sin crear deudas automáticamente por suposiciones.
- Conectar alertas y recordatorios a vencimientos explícitos cuando la cartera esté cargada.
