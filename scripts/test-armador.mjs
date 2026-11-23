/* Pruebas del armador de landings en Node (las mismas funciones que usa el constructor).

   npm ci && node --test scripts/test-armador.mjs */
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

/* Campos con nombre: lo guardado sigue a su marca aunque el módulo cambie de orden o sume elementos. */
const A = (await import("node:module")).createRequire(import.meta.url)(join(ROOT, "maquetas/js/armador.js"));
const docDe = (html) => new JSDOM(html || "").window.document;
const biblioteca = A.leerBiblioteca(docDe(readFileSync(join(ROOT, "maquetas/index.html"), "utf8")));

test("cada texto, foto y enlace de los módulos tiene un nombre único", () => {
  const doc = docDe();
  for (const id of ids) {
    const tpl = doc.createElement("template");
    tpl.innerHTML = biblioteca.byId[id].html;
    const n = A.nombresDe(tpl.content);
    for (const key of Object.keys(n)) {
      assert.ok(n[key].every(Boolean), id + ": hay " + key + " sin nombre");
      assert.equal(new Set(n[key]).size, n[key].length, id + ": hay " + key + " con nombre repetido");
    }
  }
});

test("se guarda por nombre y se vuelve a abrir igual", () => {
  const doc = docDe();
  for (const it of landing.items) {
    const html = biblioteca.byId[it.id].html;
    const nombrado = A.aNombres(doc, it, html);
    const vuelta = A.aPosiciones(doc, { id: it.id, width: it.width, campos: nombrado.campos, fotos: nombrado.fotos, enlaces: nombrado.enlaces, ocultosEnlaces: nombrado.ocultosEnlaces }, html);
    assert.deepEqual(vuelta.perdidos, []);
    for (const [pos, nombre] of [["textos", "campos"], ["imagenes", "fotos"], ["links", "enlaces"], ["ocultos", "ocultosEnlaces"]]) {
      if (nombrado[nombre]) assert.deepEqual(vuelta.item[pos], it[pos], it.id + ": " + pos);
    }
  }
});

test("si el módulo suma un texto antes, lo guardado no se corre de lugar", () => {
  const doc = docDe();
  const id = ids.find((i) => {
    const tpl = doc.createElement("template");
    tpl.innerHTML = biblioteca.byId[i].html;
    return A.editableNodes(tpl.content).length >= 3;
  });
  const original = biblioteca.byId[id].html;
  const tpl = doc.createElement("template");
  tpl.innerHTML = original;
  const textos = {};
  A.editableNodes(tpl.content).forEach((el, k) => { textos[k] = "Texto propio " + k; });
  const guardado = A.aNombres(doc, { id, width: "full", textos }, original);

  // El módulo cambia: un texto nuevo al principio corre todas las posiciones un lugar.
  const nuevo = doc.createElement("template");
  nuevo.innerHTML = original;
  const primero = A.editableNodes(nuevo.content)[0];
  const extra = doc.createElement("p");
  extra.className = primero.className;
  extra.setAttribute(A.MARCAS.campos, "texto-nuevo");
  extra.textContent = "Texto nuevo del módulo";
  primero.before(extra);
  const moduloNuevo = nuevo.innerHTML;

  const { item, perdidos } = A.aPosiciones(doc, { id, width: "full", campos: guardado.campos }, moduloNuevo);
  assert.deepEqual(perdidos, []);
  const armado = doc.createElement("template");
  armado.innerHTML = moduloNuevo;
  const nodos = A.editableNodes(armado.content);
  nodos.forEach((el, k) => { if (item.textos[k] != null) el.innerHTML = item.textos[k]; });
  assert.equal(nodos[0].textContent, "Texto nuevo del módulo", "el texto nuevo del módulo queda como viene");
  Object.entries(guardado.campos).forEach(([nombre, texto]) => {
    assert.equal(armado.content.querySelector("[" + A.MARCAS.campos + '="' + nombre + '"]').innerHTML, texto, nombre);
  });
});

test("avisa lo guardado con un nombre que el módulo ya no tiene", () => {
  const doc = docDe();
  const id = ids.find((i) => /data-lz-campo=/.test(biblioteca.byId[i].html));
  const { perdidos } = A.aPosiciones(doc, { id, width: "full", campos: { "nombre-que-no-existe": "Hola" } }, biblioteca.byId[id].html);
  assert.deepEqual(perdidos, ["nombre-que-no-existe"]);
});

test("al repetir un ítem, la copia recibe nombres nuevos", () => {
  const doc = docDe();
  const tpl = doc.createElement("template");
  tpl.innerHTML = '<div><h3 data-lz-campo="titulo-2">A</h3><p data-lz-campo="texto">a</p></div>';
  const copia = tpl.content.firstChild.cloneNode(true);
  tpl.content.appendChild(copia);
  A.renombrarRepetidos(tpl.content);
  const nombres = [...tpl.content.querySelectorAll("[data-lz-campo]")].map((el) => el.getAttribute("data-lz-campo"));
  assert.deepEqual(nombres.slice(0, 2), ["titulo-2", "texto"], "el original conserva sus nombres");
  assert.equal(new Set(nombres).size, nombres.length, "sin nombres repetidos: " + nombres.join(", "));
});

test("la página publicada sale sin las marcas del editor", () => {
  const { html } = armar({ landing, cliente });
  assert.ok(!/data-lz-(campo|foto|enlace)=/.test(html));
});

test("una landing guardada por nombre se arma igual que por posición", () => {
  const doc = docDe();
  const porNombre = { ...landing, items: landing.items.map((it) => {
    const n = A.aNombres(doc, it, biblioteca.byId[it.id].html);
    // Solo queda por nombre lo que tiene nombre (una sección con estructura propia sin marcas sigue por posición).
    for (const [pos, nombre] of [["textos", "campos"], ["imagenes", "fotos"], ["links", "enlaces"], ["ocultos", "ocultosEnlaces"]]) {
      if (n[nombre]) delete n[pos];
    }
    return n;
  }) };
  assert.equal(armar({ landing: porNombre, cliente }).html, armar({ landing, cliente }).html);
});

test("los títulos de los módulos: sin h1 (lo pone el servidor), sin saltos de nivel y sin cifras sueltas", () => {
  const doc = docDe(readFileSync(join(ROOT, "maquetas/index.html"), "utf8"));
  for (const id of ids) {
    const hs = [...doc.getElementById(id).querySelectorAll(".mq-frame :is(h1, h2, h3, h4, h5, h6)")];
    const niveles = hs.map((h) => +h.tagName[1]);
    assert.ok(!niveles.includes(1), id + ": tiene h1");
    if (niveles.length) assert.equal(niveles[0], 2, id + ": el primer título es h" + niveles[0]);
    niveles.forEach((n, k) => { if (k) assert.ok(n <= niveles[k - 1] + 1, id + ": salta de h" + niveles[k - 1] + " a h" + n); });
    hs.forEach((h) => assert.ok(!/^[+\-]?\d[\d.,]*\s*(h|%|años|k)?$/i.test(h.textContent.trim()), id + ": la cifra «" + h.textContent.trim() + "» es un título"));
  }
});

test("los colores propios de un módulo salen con !important, igual que en el navegador", () => {
  const items = landing.items.map((it, i) => i === 1 ? { ...it, coloresModulo: { titulo: "#AA0000", texto: "#0a0" } } : it);
  const { html } = armar({ landing: { ...landing, items }, cliente });
  const section = new JSDOM(html).window.document.querySelectorAll("body > section.mq-block")[1];
  const painted = [...section.querySelectorAll("[style*='rgb(170, 0, 0)']")];
  assert.ok(painted.length, "no se pintó ningún título");
  for (const el of painted) assert.match(el.getAttribute("style"), /rgb\(170, 0, 0\) !important/);
});
