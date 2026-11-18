# Lanzate · Módulos, landings y panel

Biblioteca de módulos, constructor de landings y panel de clientes. No usa base de datos:
lo público (módulos y landings publicadas) vive en este repositorio y se publica con GitHub Pages. Lo privado
(clientes, accesos al portal, landings con sus borradores y fotos de los pedidos) vive en el repo **privado**
`lanzate-datos`. El panel corre online en Vercel o en tu computadora.

## Panel online para el equipo (Vercel)

El panel está online en Vercel con una sola clave para todo el equipo. No hay base de datos: cada vez que alguien
guarda, Vercel hace un commit en GitHub (en este repo y, si hace falta, en el del sitio de venta) y GitHub Pages
publica las landings en un par de minutos. En el historial de GitHub queda cada cambio y se puede volver atrás.

Variables de entorno en Vercel (Settings → Environment Variables):

| Variable | Qué es |
| --- | --- |
| `LANZATE_USUARIO` | Usuario del equipo |
| `LANZATE_CLAVE` | Clave del equipo |
| `LANZATE_SECRETO` | Texto largo al azar para firmar las sesiones (32 caracteres o más) |
| `GITHUB_TOKEN` | Token de GitHub con permiso de escritura (Contents: Read and write) en `repositorio-modulos`, `lanzate` y `lanzate-datos` |
| `LANZATE_DATOS_REPO` | Opcional: el repo privado de datos, si no es `rosariogebala-cyber/lanzate-datos` |
| `ANTHROPIC_API_KEY` | Opcional: clave de la IA del constructor |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Las crea Vercel al conectar Upstash Redis (Storage). Guardan visitas y consultas |

Los guardados de datos no vuelven a desplegar Vercel (`ignoreCommand` en `vercel.json`): solo los cambios de código.

## Cómo se usa en tu computadora

0. La primera vez, cloná el repo privado de datos al lado de esta carpeta (queda `Lanzate/Lanzate_datos`):

   ```sh
   cd .. && git clone https://github.com/rosariogebala-cyber/lanzate-datos.git Lanzate_datos
   ```

1. Abrí la Terminal en esta carpeta y corré:

   ```sh
   python3 server.py
   ```

   (la primera vez, si falta lxml: `python3 -m pip install -r requirements.txt`)

2. Entrá a http://127.0.0.1:8877/maquetas/clientes.html. Te pide la clave del equipo si está cargada en
   `~/.lanzate/lanzate.env` (`LANZATE_USUARIO` y `LANZATE_CLAVE`).
3. Creá o editá clientes y landings. Al guardar, la landing queda lista en `l/<cliente>/<landing>/`.
4. Tocá **Publicar** (arriba a la derecha). Rearma las landings con los módulos actuales y hace commit y push
   de este repositorio y del sitio de venta (`../Lanzate_site`). En un par de minutos se ve online.

## Dónde está cada cosa

| Qué | Dónde |
| --- | --- |
| Datos generales (WhatsApp, URL pública) | `data/config.js` → `window.LANZATE_CONFIG` |
| Planes (Express, Negocio, Pro) | `data/planes.js` → se copian solos de `Lanzate_site/js/config.js` |
| Clientes (y accesos al portal) | `lanzate-datos`: `data/clientes.js` → `window.LANZATE_CLIENTES` |
| Landings con sus módulos | `lanzate-datos`: `data/landings.js` → `window.LANZATE_LANDINGS` |
| Fotos de los pedidos de cambios | `lanzate-datos`: `pedidos/<cliente>/` |
| Reglas de calidad | `data/reglas.js` → `window.LANZATE_REGLAS` |
| Landing publicada | `l/<cliente>/<landing>/index.html` |
| Logo del cliente | `l/<cliente>/logo.png` (o .jpg, .webp, .svg) |
| Editor de pedidos del cliente | `editar/` |
| Módulos y plantillas por rubro | `maquetas/` (`maquetas/js/plantillas.js`) |

Los archivos de `data/` tienen la misma forma que `js/config.js` del sitio de venta: `window.X = {...};`.
Los escribe el panel. Si los editás a mano, que el contenido siga siendo JSON válido.

## El sitio de venta usa lo mismo

- **Planes:** se editan en `Lanzate_site/js/config.js`. El panel los copia a `data/planes.js` y los usa en la ficha del cliente.
- **Proyectos:** en Landings, la estrella marca una landing como «Ejemplo en el sitio». El panel escribe
  `Lanzate_site/js/ejemplos.js` y el sitio muestra esas landings en la sección Proyectos.

## Planes y límites

Los planes y lo que incluye cada uno salen de la tabla «comparar» de `Lanzate_site/js/config.js`. El panel los aplica así:

- **Secciones:** no deja guardar una landing con más secciones que las del plan (no cuentan la navegación, el footer ni el botón de WhatsApp).
- **Reserva de turnos:** solo se puede usar si el plan la incluye (hoy, Pro).
- **Analytics, Tag Manager y Píxel de Meta:** solo se cargan en la landing si el plan los incluye (hoy, Pro).
- **Pedidos de cambios por mes:** en la ficha registrás cada pedido que aplicás. La ficha y el editor del cliente muestran cuántos le quedan en el mes.
- **Vencimiento:** la lista de clientes y la ficha avisan cuando faltan 15 días o menos, o si ya venció. El editor del cliente también lo muestra.

Un cliente sin plan no tiene límites: sirve para demos y pruebas.

## Las landings se arman desde los módulos

Cada landing guarda sus módulos (`items`: qué módulo, textos, fotos y links). Al tocar **Publicar**, el panel vuelve a armar
todas las landings en el constructor con las plantillas actuales de `maquetas/` y los datos actuales de cada cliente,
y recién después sube los cambios. Si arreglás un módulo o cambiás el teléfono de un cliente, se refleja en todas sus landings.

## Portal del cliente

Cada cliente tiene su propio portal, https://lanzate-mu.vercel.app/portal/<cliente>/ (el link está en su ficha), y entra con su
usuario y contraseña. Un usuario no sirve en el portal de otro cliente. Tiene estas secciones:

- **Resumen:** visitas de los últimos 30 días, consultas nuevas, pedidos en revisión y pedidos disponibles del mes.
- **Mi web:** sus páginas, para verlas o pedir cambios.
- **Pedidos de cambios:** marca los cambios sobre su web (textos, fotos que sube desde la compu o el celular, botones)
  y los manda. Quedan «pendientes» en la ficha del cliente; vos los aceptás o rechazás con una respuesta, y él ve el estado.
- **Visitas:** gráfico por día, de dónde llegan (Google, Instagram, WhatsApp…) y por página. Si su plan incluye
  Google Analytics, un acceso directo.
- **Consultas:** lo que le escriben desde los formularios y reservas; puede marcarlas como atendidas.
- **Plan, Marca y medición, Contacto y Mi cuenta** (con cambio de contraseña).

Acceso: usuario y contraseña se definen en la ficha. Si se olvida la contraseña, toca «Me olvidé la contraseña»,
en el panel aparece el aviso y se la reenviás con «Copiar acceso».

Seguridad: el repo es público, así que la contraseña se guarda como hash y en una copia cifrada con `LANZATE_SECRETO`.
Las visitas y consultas (con datos de personas) no van al repo: se guardan en Upstash Redis.
Las fotos de los pedidos sí quedan en el repo, en `pedidos/<cliente>/`.

## Formularios de las landings

El formulario de contacto y la reserva de turnos guardan la consulta (la ve el cliente en su portal) y abren el
WhatsApp del negocio con el mensaje armado. Si no tiene teléfono, abren un mail. Cada visita a una landing también
se cuenta (sin cookies ni datos personales).

## Traer los datos de Supabase (una sola vez)

```sh
python3 -m pip install "psycopg[binary]"
python3 scripts/migrar-datos.py
```

Lee `DATABASE_URL` de `~/.lanzate/lanzate.env`, escribe `data/clientes.js` y `data/landings.js`
y genera todas las páginas de `l/`. Con `python3 scripts/migrar-datos.py db.json` usa la copia local `data/db.json`.

## Control de calidad

`python3 scripts/check-landing-quality.py` revisa las landings de `l/`, los archivos de `data/` y las páginas del panel.
GitHub lo corre en cada push.

## IA

La clave se guarda en tu computadora (`~/.lanzate/ia.json`), desde «Configurar IA» en el constructor.

## Seguridad

- **Datos privados:** clientes, accesos, landings y fotos de pedidos están en el repo privado `lanzate-datos`.
  El panel los muestra solo con la clave del equipo; las fotos de un pedido las ve también el cliente dueño, con su sesión del portal.
- **Guardados al mismo tiempo:** antes de hacer el commit, el panel compara cada archivo con lo que leyó. Si alguien
  guardó en el medio, vuelve a hacer el pedido con lo último (hasta 3 veces) en lugar de pisar el cambio del otro.
- **Límite de intentos:** 5 ingresos fallidos por usuario o 20 por conexión bloquean 15 minutos (panel y portal).
  «Olvidé mi contraseña» acepta 10 pedidos por conexión cada 15 minutos. Online se cuentan en Upstash Redis.
