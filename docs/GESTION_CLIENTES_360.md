# Lanzate · Gestión de Clientes 360

**Alcance:** el panel web (`maquetas/clientes.html`, `maquetas/cliente.html`) muestra una cartera comercial por cliente y por landing, sin reemplazar el constructor ni las solicitudes existentes.

## Navegación

El menú principal pasa a: **Clientes → Crear landing → Landings → Biblioteca de módulos → Maquetas → Reglas**. La pantalla Clientes es el panorama de trabajo inicial, con indicadores y filtros.

## Vista general de Clientes

- Indicadores: clientes reales activos, landings publicadas, abonos del mes por revisar, vencidos y solicitudes de cambios pendientes.
- Tabla: cliente y contacto, planes de sus landings, cantidad publicada, inicio contractual, resumen de cobros y solicitudes.
- Búsqueda por nombre, rubro, contacto y email. Filtros de tipo, estado, cobros (vencidos, pendientes/parciales, al día, sin configurar) y pedidos pendientes.
- La cantidad de cambios se obtiene de los pedidos existentes del portal; se contabiliza por landing y también se muestra el total del cliente. Las solicitudes sin landing asignada permanecen en el total del cliente.

## Ficha de un cliente

Cada cliente puede tener varias landings, cada una con plan propio o heredado. La nueva sección comercial muestra:
- fecha de inicio de la relación comercial (ingresada manualmente, independiente de la fecha técnica de alta);
- para cada landing: plan actual y secciones, si está publicada, pedidos pendientes, envíos utilizados, fecha de inicio, día de vencimiento (1–28), **abono acordado y moneda (ARS/USD)** y notas internas;
- comparación con el precio mensual **de catálogo como referencia**, nunca como precio contratado supuesto;
- botón para **registrar pagos efectivamente recibidos**, con período AAAA-MM, fecha de pago, importe y referencia;
- historial de pagos y opción **Anular con motivo**, sin borrar la entrada histórica.

### Estados de cobro

- **Sin configurar**: faltan fecha de inicio o abono del cliente para esa landing. No se presenta como pago realizado.
- **Aún no iniciado**: fecha contractual futura.
- **Pendiente**: hay contrato activo y no se registró el total de ese período; el vencimiento no pasó.
- **Vencido**: vencimiento del período superado y saldo total sin pagar.
- **Parcial**: se registró parte del abono, pero falta saldo; no se equipara a pago completo.
- **Al día**: los pagos válidos del mes y moneda alcanzan el abono configurado.

Los pagos se calculan por **landing + período + moneda**; USD y ARS no se suman entre sí. La fecha de vencimiento no genera un cargo real ni solicita dinero: es una alerta local del panel.

Si un cliente tiene varias landings, el estado general prioriza vencido, parcial y pendiente. Los filtros evalúan las landings individualmente, para que un cliente con dos planes diferentes no pierda alertas.

## Datos y seguridad

Las condiciones comerciales y pagos se almacenan solo en el repositorio **privado** `lanzate-datos/gestion/clientes.json`. El repositorio público de módulos no contiene movimientos de pago, comprobantes ni datos contractuales.

API del equipo (requiere sesión y para escrituras validación de origen):
- `GET /api/gestion-clientes` — lista con indicadores;
- `GET /api/gestion-clientes/:cliente` — ficha detallada y movimientos;
- `PUT /api/gestion-clientes/:cliente/inicio` — fecha de inicio comercial;
- `PUT /api/gestion-clientes/:cliente/landings/:landing` — contrato por landing;
- `POST /api/gestion-clientes/:cliente/pagos` — registrar pago;
- `POST /api/gestion-clientes/:cliente/pagos/:pago/anular` — anulación auditada.

La API comprueba que una landing pertenece al cliente antes de cambiar condiciones o registrar cobros. Para reintentos de red, `request_id` previene cobros duplicados por el mismo envío. Se conserva el motivo de las anulaciones y estas dejan de sumar al saldo pagado.

Los datos comerciales no se incluyen en `/api/clientes`, en las landings públicas ni en los portales privados de los clientes. Vercel Preview sigue siendo de solo lectura salvo que se configure un entorno aislado.

## QA / accesibilidad

- Tabla semántica con `caption`, encabezados de columna y encabezados por fila.
- Región horizontal navegable por teclado si la tabla no cabe en móvil.
- Etiquetas visibles en formularios, `input type=date/month/number`, estados y errores anunciados por `role=status`, foco distinguible.
- Verificar manualmente, después de montar un staging aislado: Zoom 200/400 %, reflow 320 px, VoiceOver/Safari, NVDA/Chrome, y axe-core. Esta entrega no certifica WCAG 2.2 AA.

## Pruebas

```sh
python3 scripts/test-gestion-clientes.py
python3 scripts/test-api.py
python3 scripts/check-landing-quality.py
```

La CI también compila `gestion_clientes.py` y comprueba que no se guardan pagos en el repo público, que las rutas necesitan login, que no se registran pagos sin contrato, que una landing no se puede editar desde otro cliente y que la anulación mantiene el historial.

## Despliegue

La entrega depende del PR #42 (borradores y aprobación). **No fusionar a `main` sin validar primero la base del constructor y los datos comerciales en un entorno de ensayo aislado.** Para sincronizar la computadora después del merge, desde `Lanzate_modulos`, con `git status` limpio:

```sh
git switch main
git pull --ff-only origin main
python3 server.py
```
