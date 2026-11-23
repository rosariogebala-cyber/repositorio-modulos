/* Pruebas del armador de landings en Node (las mismas funciones que usa el constructor).

   cd scripts && npm ci && node --test test-armador.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { armar } from "./armar-landing.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const leerJs = (ruta) => {
  const texto = readFileSync(join(ROOT, ruta), "utf8");
  return JSON.parse(texto.slice(texto.indexOf("=") + 1, texto.lastIndexOf(";")));
};
const landing = leerJs("tests/fixtures/datos/data/landings.js")[0];
const cliente = leerJs("tests/fixtures/datos/data/clientes.js").find((c) => c.id === landing.cliente_id);
const ids = [...new JSDOM(readFileSync(join(ROOT, "maquetas/index.html"), "utf8")).window.document
  .querySelectorAll(".lib-section .mq-block")].map((b) => b.id);

test("la biblioteca tiene módulos", () => {
  assert.ok(ids.length > 50, "se leyeron " + ids.length + " variantes");
});

test("una landing guardada se arma desde sus datos, igual cada vez", () => {
  const a = armar({ landing, cliente });
  const b = armar({ landing, cliente });
  assert.deepEqual(a.faltan, []);
  assert.equal(a.html, b.html);
  const doc = new JSDOM(a.html).window.document;
  assert.equal(doc.querySelectorAll("body > section.mq-block").length, landing.items.length);
  assert.equal(doc.documentElement.lang, "es");
  assert.ok(doc.querySelector('script[src="js/lanzate.js"]'), "carga lanzate.js");
});

test("los datos del cliente reemplazan a los de ejemplo", () => {
  const { html } = armar({ landing, cliente });
  if (cliente.nombre) assert.ok(!/Marca Ejemplo/i.test(html), "quedó «Marca Ejemplo»");
  if (cliente.email) assert.ok(!html.includes("hola@example.com"), "quedó el email de ejemplo");
});

test("cada variante de la biblioteca se arma sin errores", () => {
  const nav = ids.find((i) => i.startsWith("navegacion"));
  for (const id of ids) {
    const { html, faltan } = armar({ landing: { nombre: "Prueba " + id, items: [{ id: nav, width: "full" }, { id, width: "full" }] }, cliente });
    assert.deepEqual(faltan, []);
    assert.ok(html.includes('data-module="' + id + '"'), "falta la sección " + id);
  }
});

test("avisa los módulos que ya no están en la biblioteca", () => {
  const { faltan, html } = armar({ landing: { nombre: "Vieja", items: [...landing.items, { id: "modulo-retirado", width: "full" }] }, cliente });
  assert.deepEqual(faltan, ["modulo-retirado"]);
  assert.ok(!html.includes("modulo-retirado"));
});
