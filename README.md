# Lanzate · Módulos, landings y panel

Biblioteca de módulos, constructor de landings y panel de clientes. No usa base de datos ni Vercel:
todo vive en este repositorio y se publica con git en GitHub Pages.

## Cómo se usa

1. Abrí la Terminal en esta carpeta y corré:

   ```sh
   python3 server.py
   ```

   (la primera vez, si falta lxml: `python3 -m pip install -r requirements.txt`)

2. Entrá a http://127.0.0.1:8877/maquetas/clientes.html. El panel corre solo en tu computadora, sin usuario ni contraseña.
3. Creá o editá clientes y landings. Al guardar, la landing queda lista en `l/<cliente>/<landing>/`.
4. Tocá **Publicar** (arriba a la derecha). Hace commit y push de este repositorio y del sitio de venta
   (`../Lanzate_site`). En un par de minutos se ve online.

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
