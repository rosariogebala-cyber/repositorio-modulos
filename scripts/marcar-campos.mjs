/* Marca cada texto, foto y enlace editable de los módulos (maquetas/index.html) con un nombre fijo:
   data-lz-campo="titulo", data-lz-foto="foto-2", data-lz-enlace="enlace". Las landings guardan sus contenidos por ese
   nombre, así un módulo se puede reordenar o ampliar sin que los textos guardados caigan en otro lugar.

   node scripts/marcar-campos.mjs           agrega las marcas que falten (no cambia las que ya existen)
   node scripts/marcar-campos.mjs --check   falla si falta alguna o hay nombres repetidos en un módulo (CI)

   Inserta solo el atributo en el texto del archivo, sin reformatear nada más. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const A = createRequire(import.meta.url)(join(ROOT, "maquetas/js/armador.js"));
const FILE = join(ROOT, "maquetas/index.html");

export const MARCAS = { campo: "data-lz-campo", foto: "data-lz-foto", enlace: "data-lz-enlace" };

function prefijoTexto(el) {
  if (el.matches(".nx-kicker, .plan-kicker")) return "antetitulo";
  if (el.matches("h1, h2, h3")) return "titulo";
  if (el.matches("h4, h5, h6")) return "subtitulo";
  if (el.matches(".badge")) return "etiqueta";
  if (el.matches("button, .btn, [class*='btn-nx']")) return "boton";
  if (el.matches("a")) return "texto-enlace";
  if (el.matches("li")) return "item";
  if (el.matches("blockquote")) return "cita";
  if (el.matches("figcaption")) return "epigrafe";
  if (el.matches("dt")) return "termino";
  if (el.matches("dd")) return "dato";
  if (el.matches("label")) return "rotulo";
  return "texto";
}

/* Nombres de un módulo: los que ya tiene se respetan; los nuevos toman el siguiente número libre. */
export function nombrar(frame) {
  const grupos = [
    [MARCAS.campo, A.editableNodes(frame), prefijoTexto],
    [MARCAS.foto, A.imageNodes(frame), () => "foto"],
    [MARCAS.enlace, A.linkNodes(frame), () => "enlace"]
  ];
  const nuevos = [];
  const problemas = [];
  for (const [attr, nodos, prefijo] of grupos) {
    const usados = new Set();
    for (const el of nodos) {
      const actual = el.getAttribute(attr);
      if (actual && usados.has(actual)) problemas.push(attr + '="' + actual + '" repetido');
      if (actual) usados.add(actual);
    }
    for (const el of nodos) {
      if (el.getAttribute(attr)) continue;
      const base = prefijo(el);
      let nombre = base;
      for (let n = 2; usados.has(nombre); n++) nombre = base + "-" + n;
      usados.add(nombre);
      nuevos.push([el, attr, nombre]);
    }
  }
  return { nuevos, problemas };
}

function main() {
  const check = process.argv.includes("--check");
  const src = readFileSync(FILE, "utf8");
  const dom = new JSDOM(src, { includeNodeLocations: true });
  const inserts = [];
  const errores = [];
  for (const block of dom.window.document.querySelectorAll(".lib-section .mq-block")) {
    const { nuevos, problemas } = nombrar(block.querySelector(".mq-frame"));
    problemas.forEach((p) => errores.push(block.id + ": " + p));
    for (const [el, attr, nombre] of nuevos) {
      if (check) { errores.push(block.id + ": sin " + attr + " en <" + el.tagName.toLowerCase() + "> «" + el.textContent.trim().slice(0, 30) + "»"); continue; }
      const at = dom.nodeLocation(el).startTag.startOffset + 1 + el.tagName.length;
      inserts.push([at, " " + attr + '="' + nombre + '"']);
    }
  }
  if (check) {
    if (errores.length) {
      console.error(errores.slice(0, 20).join("\n") + (errores.length > 20 ? "\n… y " + (errores.length - 20) + " más" : ""));
      console.error("\nCorré: node scripts/marcar-campos.mjs");
      process.exit(1);
    }
    console.log("Todos los textos, fotos y enlaces de los módulos tienen su nombre.");
    return;
  }
  if (errores.length) { console.error(errores.join("\n")); process.exit(1); }
  inserts.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [at, text] of inserts) out = out.slice(0, at) + text + out.slice(at);
  writeFileSync(FILE, out);
  console.log("Marcas nuevas: " + inserts.length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
