/* Arma el HTML de una landing desde sus datos guardados, con el mismo armador que usa el constructor.

   node scripts/armar-landing.mjs < pedido.json > landing.html
   pedido.json = { "landing": { nombre, items, estilo, animacion }, "cliente": { ...ficha del cliente como la da /api/clientes } }

   node scripts/armar-landing.mjs --lote < pedidos.json > resultados.json
   pedidos.json = [{ "id": 1, "landing": {...}, "cliente": {...} }, ...]
   resultados.json = [{ "id": 1, "html": "...", "faltan": [...], "perdidos": [...], "items": [...] }, ...]
   (lo usa el servidor al publicar; en Vercel, la función api/armar.mjs)

   Si algún módulo de la landing ya no está en la biblioteca, o un texto guardado tiene un nombre que el módulo ya no
   tiene, lo avisa: así no se publica una landing a la que le falta contenido. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Armador = require(join(ROOT, "maquetas/js/armador.js"));

let cache = null;
/* La biblioteca se lee una vez por proceso (o por función en Vercel) y se vuelve a leer si cambió el archivo. */
function entorno() {
  const fuente = readFileSync(join(ROOT, "maquetas/index.html"), "utf8");
  if (cache && cache.fuente === fuente) return cache;
  const { window } = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const biblioteca = Armador.leerBiblioteca(new window.DOMParser().parseFromString(fuente, "text/html"));
  cache = { fuente, window, biblioteca };
  return cache;
}

export function armar(pedido) {
  const { window, biblioteca } = entorno();
  return Armador.armarLanding(window.document, biblioteca, pedido.landing, pedido.cliente);
}

export function armarVarias(pedidos) {
  return pedidos.map((pedido) => {
    try {
      return { id: pedido.id, ...armar(pedido) };
    } catch (error) {
      return { id: pedido.id, error: String(error && error.message || error) };
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entrada = JSON.parse(readFileSync(0, "utf8"));
  if (process.argv.includes("--lote")) {
    process.stdout.write(JSON.stringify(armarVarias(entrada)));
  } else {
    const out = armar(entrada);
    const avisos = [];
    if (out.faltan.length) avisos.push("Módulos que ya no están en la biblioteca: " + out.faltan.join(", "));
    if (out.perdidos.length) avisos.push("Textos o fotos con nombres que el módulo ya no tiene: " + out.perdidos.join("; "));
    if (avisos.length) {
      process.stderr.write(avisos.join("\n") + "\n");
      process.exitCode = 2;
    }
    process.stdout.write(out.html);
  }
}
