# Seguimiento automático de clientes — Lanzate

## Qué cambia

La pantalla `/maquetas/gestion-clientes.html` muestra una **bandeja de alertas** que se calcula con los registros existentes, sin IA ni llamadas a servicios externos. Las alertas se actualizan al abrir el panel, cuando se pulsa «Actualizar alertas» y cada 5 minutos mientras la pantalla está abierta.

### Reglas activas

| Tipo | Condición | Prioridad |
| --- | --- | --- |
| Pago vencido | Movimiento con estado `pendiente`, vencimiento anterior a hoy | Alta |
| Pago que vence hoy | Movimiento pendiente, vencimiento hoy | Alta |
| Pago próximo | Movimiento pendiente que vence en los próximos 7 días | Normal |
| Solicitud demorada | Pedido del portal aún `pendiente` con más de 48 horas | Alta |
| Solicitud pendiente | Pedido del portal `pendiente` con menos de 48 horas, o sin fecha válida | Normal |
| Seguimiento atrasado | Fecha de próximo contacto registrada anterior a hoy | Alta |
| Seguimiento hoy | Fecha de próximo contacto registrada igual a hoy | Normal |
| Seguimiento próximo | Fecha de próximo contacto registrada dentro de 7 días | Normal |

Las fechas se calculan en `America/Argentina/Buenos_Aires`. Los pagos `pagado` y `anulado`, las solicitudes ya resueltas y las fechas no registradas **no generan alertas falsas**.

## Alcance y privacidad

- Las alertas se muestran **solo al equipo autenticado**; nunca se publican en una landing ni en el portal de un cliente.
- Cada alerta tiene acceso directo a la ficha del cliente, a su sección de cobros, seguimiento o pedidos para atender.
- Un pago solo se considera realizado si fue **marcado manualmente** como `pagado`. Lanzate no consulta bancos ni envía facturas automáticamente.
- No se envían WhatsApp, emails, push ni mensajes al cliente sin una integración y una autorización explícitas. Esta primera versión ofrece alertas **dentro del panel**, no notificaciones fuera de la plataforma.
- No se agregan tablas, trabajos cron, tokens de IA ni costos por consultas de modelo. El backend deriva las alertas de los datos existentes.
- Sin datos comerciales, los clientes conservan el estado «Sin datos», nunca se inventan cuotas o saldos.

## Accesibilidad y calidad

- Las prioridades se expresan por texto («Prioritaria»/«Próxima»), no únicamente mediante colores.
- Las alertas usan lista HTML, enlaces con destino identificado y filtros con etiquetas.
- La bandeja se adapta a móvil, tiene foco visible y una región de estado para anunciar el total.
- Pruebas en `scripts/test-client-alerts.py`: vencimientos, pagos cerrados, ventana de 7 días, pedidos demorados y ausencia de alertas con datos vacíos.
- Pendiente un pase manual por teclado y lector de pantalla en Vercel Preview con datos de prueba aislados; no se declara certificación WCAG 2.2 AA.

## Dependencias

Esta rama parte de Gestión de Clientes 2.0 (PR #44), que depende del flujo de borradores PR #42. No fusionar en `main` antes de validarlos; mantener producción sin cambios hasta que terminen las pruebas.
