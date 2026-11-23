/* Arma el HTML de una landing desde sus datos guardados, con el mismo armador que usa el constructor.

   node scripts/armar-landing.mjs < pedido.json > landing.html
   pedido.json = { "landing": { nombre, items, estilo, animacion }, "cliente": { ...ficha del cliente como la da /api/clientes } }

   Si algún módulo de la landing ya no está en la biblioteca, lo avisa por stderr y sale con código 2 (no se publica una
   landing a la que le faltan secciones). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Armador = require(join(ROOT, "maquetas/js/armador.js"));

export function armar(pedido) {
  const { window } = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const biblioteca = Armador.leerBiblioteca(
    new window.DOMParser().parseFromString(readFileSync(join(ROOT, "maquetas/index.html"), "utf8"), "text/html"));
  return Armador.armarLanding(window.document, biblioteca, pedido.landing, pedido.cliente);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pedido = JSON.parse(readFileSync(0, "utf8"));
  const out = armar(pedido);
  if (out.faltan.length) {
    process.stderr.write("Módulos que ya no están en la biblioteca: " + out.faltan.join(", ") + "\n");
    process.exitCode = 2;
  }
  process.stdout.write(out.html);
}
