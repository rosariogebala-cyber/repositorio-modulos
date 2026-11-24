# Ficha 360° de cliente — Lanzate

## Propósito

Mostrar en una sola pantalla toda la actividad operativa y comercial de un cliente: identidad, landings y planes individuales, solicitudes de cambios, cobros en ARS/USD, alertas y cronología. Reutiliza datos existentes de Gestión de Clientes 2.0 (PR #44), Seguimiento Automático (PR #45) y la ficha operativa previa.

## Qué se muestra

- **Encabezado:** nombre comercial, rubro y medios de contacto que ya figuran en la ficha, botón «Nueva landing».
- **Navegación interna:** Resumen, Alertas, Landings y planes, Solicitudes, Pagos, Actividad y Seguimiento. Son anclas dentro de la **misma página**.
- **Indicadores:** landings, publicadas, solicitudes pendientes, cobros registrados pendientes, alertas urgentes y saldos pendientes por separado en ARS y USD.
- **Alertas:** derivados de vencimientos y pedidos existentes, con links a la sección correspondiente. No se crean facturas ni cuotas.
- **Solicitudes de cambios:** últimas 40 solicitudes (incluyendo pendientes y resueltas). Su gestión detallada continúa en la propia ficha, en la sección de revisión existente.
- **Actividad reciente:** últimos 60 eventos combinados y ordenados por fecha, filtrables por landings, solicitudes y pagos. Incluye alta de cliente, creación/edición de landings, pedidos y registros comerciales.
- **Gestión comercial existente:** formulario de fechas/seguimiento y tabla de movimientos. No se duplican formularios de edición.

## Datos y seguridad

`GET /api/gestion/clientes/:id` incorpora campos `cliente` (identidad limitada, **sin credenciales**), `alertas`, `solicitudes`, `actividad` y `resumen_360`, conservando el contrato previo de `movimientos` y `landings`.

La ruta requiere sesión administrativa. Nunca exponer `portal`, contraseña ni claves. La línea de tiempo se calcula a partir de datos existentes, por lo que **no añade gasto de IA** ni persistencia de actividad duplicada.

Las fechas de eventos reflejan registros disponibles; «Landing actualizada» indica edición registrada, no prueba independiente del despliegue de Vercel. «Cobro registrado» significa anotación del equipo, no confirmación bancaria. Sin movimientos comerciales aparece el aviso **«Sin movimientos registrados»**, nunca «Al día» automático.

## QA y aceptación

- Validación API: contrato previo, resúmenes, suma por moneda, estado vacío, actividad tras registrar pago y ausencia de credenciales.
- HTML semántico: un solo H1, navegación interna, listas y cronología ordenada; el foco visible permanece al navegar por anclas.
- Probar manualmente 320px, zoom 200/400 %, teclado/VoiceOver y NVDA, lector de tablas y orden de encabezados.
- Casos: cliente sin landings, cliente con múltiples planes, con 40+ pedidos, histórico con pagos, mezcla ARS/USD y alerta vencida.

## Dependencias

Este PR se basa en #45, que depende de #44 y #42. Mantener en revisión y probar en staging aislado antes de fusionar en `main` y sincronizar la Mac.
