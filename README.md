# Lanzate · Módulos, landings y panel

Biblioteca de módulos, constructor de landings y panel de clientes. No usa base de datos:
todo vive en este repositorio y se publica con GitHub Pages. El panel corre online en Vercel o en tu computadora.

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
| `GITHUB_TOKEN` | Token de GitHub con permiso de escritura (Contents: Read and write) en `repositorio-modulos` y `lanzate` |
| `ANTHROPIC_API_KEY` | Opcional: clave de la IA del constructor |

Los guardados de datos no vuelven a desplegar Vercel (`ignoreCommand` en `vercel.json`): solo los cambios de código.

## Cómo se usa en tu computadora

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
| Clientes | `data/clientes.js` → `window.LANZATE_CLIENTES` |
| Landings con sus módulos | `data/landings.js` → `window.LANZATE_LANDINGS` |
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

## Cambios que pide el cliente

El cliente no tiene usuario. Desde la ficha copiás el link del editor (`/editar/?l=<cliente>/<landing>`) y se lo pasás.
Ahí toca los textos de su web y escribe encima, marca las fotos o botones a cambiar, y te lo manda por WhatsApp
al número de `data/config.js`. Vos aplicás los cambios en el constructor y publicás.

## Formularios de las landings

Las landings son páginas estáticas: el formulario de contacto y la reserva de turnos arman el mensaje
y abren el WhatsApp del negocio (el teléfono del cliente). Si no tiene teléfono, abren un mail.

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
