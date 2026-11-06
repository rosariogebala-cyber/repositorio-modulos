/* Reglas de calidad de las landings: valores recomendados, carga/guardado (data/reglas.json vía /api/reglas)
   y el validador que revisa una landing ya renderizada (textos, imágenes y estructura). */
(function () {
  "use strict";

  var DEFAULTS = {
    version: 1,
    general: { bloquear: false },
    estructura: {
      obligatorios: ["navegacion", "hero-full-imagen", "footer"],
      nivelObligatorios: "error",
      reglas: [
        { id: "inicio-navegacion", label: "Empieza con la Navegación", activo: true, nivel: "error" },
        { id: "hero-segundo", label: "La portada va justo después de la Navegación", activo: true, nivel: "error" },
        { id: "fin-footer", label: "Termina con el Footer", activo: true, nivel: "error" },
        { id: "whatsapp", label: "Incluye el botón de WhatsApp", activo: true, nivel: "aviso" },
        { id: "sin-repetidos", label: "No repite el mismo tipo de sección", activo: true, nivel: "aviso" },
        { id: "min-modulos", label: "Cantidad mínima de secciones", activo: true, nivel: "aviso", valor: 5, unidad: "secciones" },
        { id: "max-modulos", label: "Cantidad máxima de secciones", activo: true, nivel: "aviso", valor: 12, unidad: "secciones" },
        { id: "max-menu", label: "Ítems máximos en el menú", activo: true, nivel: "error", valor: 6, unidad: "ítems" },
        { id: "nombre-max", label: "Largo máximo del nombre de la landing", activo: true, nivel: "aviso", valor: 60, unidad: "caracteres" }
      ]
    },
    textos: {
      viudas: true,
      ejemplos: true,
      listaEjemplos: ["example.com", "5491123456789", "lorem ipsum", "Marca Ejemplo", "Tu marca", "Nombre Apellido"],
      roles: [
        { id: "kicker", label: "Antetítulo", selector: ".nx-kicker, .plan-kicker", min: 0, max: 32, activo: true },
        { id: "faq", label: "Pregunta frecuente", selector: ".accordion-button", min: 10, max: 90, activo: true },
        { id: "hero-titulo", label: "Título de portada", selector: ".nx-hero h1, .nx-hero h2, .nx-hero .nx-display", min: 10, max: 60, activo: true },
        { id: "hero-bajada", label: "Bajada de portada", selector: ".nx-hero p", min: 0, max: 150, activo: true },
        { id: "titulo-seccion", label: "Título de sección", selector: "h1, h2", min: 4, max: 70, activo: true },
        { id: "bajada", label: "Bajada de sección", selector: ".nx-lead", min: 0, max: 180, activo: true },
        { id: "boton", label: "Botón", selector: ".btn-nx, .btn-nx-outline, .btn", min: 2, max: 24, activo: true },
        { id: "menu", label: "Ítem de menú", selector: ".nav-link", min: 2, max: 18, activo: true },
        { id: "titulo-tarjeta", label: "Título de tarjeta", selector: "h3, h4, h5, h6, .h4, .h5, .h6", min: 3, max: 48, activo: true },
        { id: "testimonio", label: "Testimonio", selector: ".quote-card p, blockquote", min: 0, max: 260, activo: true },
        { id: "parrafo", label: "Párrafo", selector: "p", min: 0, max: 320, activo: true }
      ]
    },
    imagenes: {
      formatos: ["webp", "avif", "jpg", "jpeg", "png", "svg"],
      altObligatorio: true,
      altMax: 125,
      nitidez: 1.5,
      roles: [
        { id: "logo", label: "Logo", selector: ".nx-brand img, img[alt*='logo' i], img[src*='logo' i]", minAncho: 0, minAlto: 80, proporcion: "", maxKB: 60, activo: true },
        { id: "avatar", label: "Foto de persona (avatar)", selector: ".nx-avatar", minAncho: 400, minAlto: 400, proporcion: "1:1", maxKB: 80, activo: true },
        { id: "equipo", label: "Foto de equipo", selector: ".person-card img", minAncho: 800, minAlto: 800, proporcion: "", maxKB: 200, activo: true },
        { id: "producto", label: "Foto de producto", selector: ".prod-card img, .prod-feature img", minAncho: 1000, minAlto: 1000, proporcion: "", maxKB: 250, activo: true },
        { id: "galeria", label: "Galería", selector: ".gal-card img, .bento-tile img, .fw-bleed img", minAncho: 1600, minAlto: 0, proporcion: "", maxKB: 350, activo: true },
        { id: "portada", label: "Portada y carrusel", selector: ".nx-hero", minAncho: 1920, minAlto: 1080, proporcion: "", maxKB: 450, activo: true },
        { id: "general", label: "Imagen general", selector: "img, [style*='background-image']", minAncho: 1200, minAlto: 0, proporcion: "", maxKB: 300, activo: true }
      ]
    }
  };

  var PROPORCIONES = ["", "16:9", "3:2", "4:3", "1:1", "4:5", "2:3", "9:16", "21:9"];
  var GRUPO_HERO = "hero-full-imagen";

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function mergeRoles(defs, saved) {
    if (!Array.isArray(saved)) return clone(defs);
    var byId = {};
    saved.forEach(function (r) { if (r && r.id) byId[r.id] = r; });
    var custom = saved.filter(function (r) { return r && r.custom; }).map(function (r) { return Object.assign({}, r); });
    return custom.concat(defs.map(function (d) { return Object.assign(clone(d), byId[d.id] || {}, { id: d.id }); }));
  }

  function merge(saved) {
    var r = clone(DEFAULTS);
    if (!saved || typeof saved !== "object") return r;
    Object.assign(r.general, saved.general || {});
    ["textos", "imagenes"].forEach(function (k) {
      var s = saved[k] || {};
      Object.keys(s).forEach(function (key) { if (key !== "roles") r[k][key] = s[key]; });
      r[k].roles = mergeRoles(DEFAULTS[k].roles, s.roles);
    });
    var e = saved.estructura || {};
    if (Array.isArray(e.obligatorios)) r.estructura.obligatorios = e.obligatorios.slice();
    if (e.nivelObligatorios) r.estructura.nivelObligatorios = e.nivelObligatorios;
    if (Array.isArray(e.reglas)) {
      var byId = {};
      e.reglas.forEach(function (x) { if (x && x.id) byId[x.id] = x; });
      r.estructura.reglas = r.estructura.reglas.map(function (d) {
        var s = byId[d.id] || {};
        return Object.assign(d, { activo: s.activo !== undefined ? s.activo : d.activo, nivel: s.nivel || d.nivel },
          s.valor !== undefined ? { valor: Number(s.valor) } : {});
      });
    }
    if (saved.actualizado) r.actualizado = saved.actualizado;
    if (saved.local) r.local = true;
    return r;
  }

  function strip(rules) {
    var out = clone(rules);
    delete out.local;
    delete out.actualizado;
    return out;
  }

  function api(method, url, body) {
    if (window.Lanzate && window.Lanzate.api) return window.Lanzate.api(method, url, body);
    return Promise.reject(new Error("Sin conexión"));
  }

  function load() {
    return api("GET", "/api/reglas").then(merge, function () {
      return fetch("../data/reglas.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }).then(merge);
    });
  }

  function save(rules) {
    return api("PUT", "/api/reglas", strip(rules)).then(merge);
  }

  /* ---------- Validador ---------- */

  function norm(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
  function cut(text, n) { text = norm(text); return text.length > (n || 70) ? text.slice(0, (n || 70) - 1) + "…" : text; }
  function ratioOf(text) {
    var m = /^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/.exec(String(text || "").trim());
    return m ? Number(m[1]) / Number(m[2]) : 0;
  }
  function ratioLabel(w, h) {
    var best = "", diff = 1;
    PROPORCIONES.forEach(function (p) {
      var r = ratioOf(p);
      if (r && Math.abs(w / h / r - 1) < diff) { diff = Math.abs(w / h / r - 1); best = p; }
    });
    return diff < 0.04 ? best : (w / h).toFixed(2) + ":1";
  }
  function safeMatches(el, sel) {
    try { return el.matches(sel) || !!el.closest(sel); } catch (e) { return false; }
  }
  function safeAll(root, sel) {
    try { return Array.prototype.slice.call(root.querySelectorAll(sel)); } catch (e) { return []; }
  }
  function ignored(el) {
    return !!el.closest(".lp-tools, .visually-hidden, [aria-hidden='true'], script, style, noscript");
  }

  function textOf(el, taken) {
    var doc = el.ownerDocument;
    var walker = doc.createTreeWalker(el, 4);
    var out = "";
    var node;
    while ((node = walker.nextNode())) {
      var p = node.parentElement;
      var skip = false;
      while (p && p !== el) {
        if (taken.has(p) || p.matches(".visually-hidden, [aria-hidden='true']")) { skip = true; break; }
        p = p.parentElement;
      }
      if (!skip) out += node.nodeValue;
    }
    return norm(out);
  }

  function isWidow(el) {
    if (!el.getClientRects().length) return false;
    var doc = el.ownerDocument;
    var walker = doc.createTreeWalker(el, 4);
    var words = [];
    var node;
    while ((node = walker.nextNode())) {
      var re = /\S+/g, m;
      while ((m = re.exec(node.nodeValue))) words.push([node, m.index, m.index + m[0].length]);
    }
    if (words.length < 3) return false;
    function top(w) {
      var range = doc.createRange();
      range.setStart(w[0], w[1]);
      range.setEnd(w[0], w[2]);
      var r = range.getClientRects()[0];
      return r ? r.top : null;
    }
    var a = top(words[words.length - 2]);
    var b = top(words[words.length - 1]);
    return a !== null && b !== null && b - a > 4;
  }

  var sizeCache = {};
  function imageSize(url) {
    if (!sizeCache[url]) {
      sizeCache[url] = new Promise(function (resolve) {
        var img = new Image();
        var timer = setTimeout(function () { resolve(null); }, 10000);
        img.onload = function () { clearTimeout(timer); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
        img.onerror = function () { clearTimeout(timer); resolve(null); };
        img.src = url;
      });
    }
    return sizeCache[url];
  }

  var weightCache = {};
  function imageWeight(url, win) {
    if (/^data:/.test(url)) return Promise.resolve(Math.round(url.length * 0.75));
    try {
      var entry = win.performance.getEntriesByName(url)[0];
      if (entry && (entry.encodedBodySize || entry.transferSize)) return Promise.resolve(entry.encodedBodySize || entry.transferSize);
    } catch (e) { /* sin performance */ }
    if (!weightCache[url]) {
      weightCache[url] = fetch(url, { method: "HEAD", cache: "force-cache" }).then(function (r) {
        var len = Number(r.headers.get("content-length"));
        return r.ok && len ? len : null;
      }).catch(function () { return null; });
    }
    return weightCache[url];
  }

  function formatOf(url) {
    var m = /^data:image\/([\w+.-]+)/i.exec(url);
    if (m) return m[1].replace("svg+xml", "svg").replace("jpeg", "jpg").toLowerCase();
    m = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url.split("?")[0]);
    return m ? m[1].toLowerCase() : "";
  }

  function bgUrl(el) {
    var m = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(el.style.backgroundImage || "");
    return m ? m[1] : "";
  }

  function check(opts) {
    var rules = opts.rules || merge(null);
    var doc = opts.doc;
    var win = opts.win || (doc && doc.defaultView) || window;
    var items = opts.items || [];
    var issues = [];
    function add(level, area, module, text, detail, el, extra) {
      issues.push(Object.assign({ level: level, area: area, module: module, text: text, detail: detail || "", el: el || null }, extra || {}));
    }

    /* Estructura */
    var est = {};
    rules.estructura.reglas.forEach(function (r) { if (r.activo) est[r.id] = r; });
    var flow = items.map(function (it, i) { return { groupId: it.groupId, group: it.group, index: i }; })
      .filter(function (x) { return x.groupId !== "whatsapp"; });
    var has = {};
    items.forEach(function (it) { has[it.groupId] = (has[it.groupId] || 0) + 1; });
    function groupName(id) {
      var it = items.filter(function (x) { return x.groupId === id; })[0];
      return it ? it.group : (opts.groupNames && opts.groupNames[id]) || id;
    }
    if (items.length) {
      rules.estructura.obligatorios.forEach(function (id) {
        if (!has[id]) add(rules.estructura.nivelObligatorios || "error", "estructura", null, "Falta la sección «" + groupName(id) + "».", "Es obligatoria en todas las landings.", null, { regla: "obligatorio", grupo: id });
      });
      if (est["inicio-navegacion"] && has.navegacion && flow[0] && flow[0].groupId !== "navegacion") {
        add(est["inicio-navegacion"].nivel, "estructura", flow[0].index, "La landing empieza con «" + flow[0].group + "».", "Subí la Navegación al primer lugar.", null, { regla: "orden" });
      }
      if (est["hero-segundo"] && has[GRUPO_HERO] && flow.length > 1) {
        var navAt = flow.findIndex(function (x) { return x.groupId === "navegacion"; });
        var heroAt = flow.findIndex(function (x) { return x.groupId === GRUPO_HERO; });
        if (heroAt !== (navAt === -1 ? 0 : navAt + 1)) {
          add(est["hero-segundo"].nivel, "estructura", flow[heroAt].index, "La portada está en el lugar " + (flow[heroAt].index + 1) + ".", "Ubicala justo después de la Navegación.", null, { regla: "orden" });
        }
      }
      if (est["fin-footer"] && has.footer && flow.length && flow[flow.length - 1].groupId !== "footer") {
        add(est["fin-footer"].nivel, "estructura", flow[flow.length - 1].index, "La landing termina con «" + flow[flow.length - 1].group + "».", "Bajá el Footer al último lugar.", null, { regla: "orden" });
      }
      if (est.whatsapp && !has.whatsapp) add(est.whatsapp.nivel, "estructura", null, "Falta el botón de WhatsApp.", "Sumalo desde «WhatsApp» en la lista de módulos.", null, { regla: "obligatorio", grupo: "whatsapp" });
      if (est["sin-repetidos"]) {
        Object.keys(has).forEach(function (id) {
          if (has[id] > 1) add(est["sin-repetidos"].nivel, "estructura", null, "«" + groupName(id) + "» aparece " + has[id] + " veces.", "Dejá una sola sección de ese tipo.", null, { regla: "orden" });
        });
      }
      if (est["min-modulos"] && flow.length < est["min-modulos"].valor) {
        add(est["min-modulos"].nivel, "estructura", null, "Tiene " + flow.length + " secciones y el mínimo es " + est["min-modulos"].valor + ".", "Sumá secciones para contar la propuesta completa.", null, { regla: "sumar" });
      }
      if (est["max-modulos"] && flow.length > est["max-modulos"].valor) {
        add(est["max-modulos"].nivel, "estructura", null, "Tiene " + flow.length + " secciones y el máximo es " + est["max-modulos"].valor + ".", "Quitá las que repiten información.", null, { regla: "orden" });
      }
    }
    var name = norm(opts.name);
    if (est["nombre-max"] && name.length > est["nombre-max"].valor) {
      add(est["nombre-max"].nivel, "estructura", null, "El nombre tiene " + name.length + " caracteres y el máximo es " + est["nombre-max"].valor + ".", "Usá un nombre más corto.", null, { regla: "nombre" });
    }
    if (!doc || !doc.body) return Promise.resolve(report(issues));

    var sections = Array.prototype.slice.call(doc.querySelectorAll("body > section.mq-block"));
    var imageJobs = [];

    sections.forEach(function (section, mi) {
      var root = section.querySelector(".mq-frame") || section;
      var item = items[mi] || {};

      if (est["max-menu"] && item.groupId === "navegacion") {
        var seen = {};
        safeAll(root, ".nav-link").forEach(function (a) { var t = norm(a.textContent).toLowerCase(); if (t) seen[t] = true; });
        var count = Object.keys(seen).length;
        if (count > est["max-menu"].valor) {
          add(est["max-menu"].nivel, "estructura", mi, "El menú tiene " + count + " ítems y el máximo es " + est["max-menu"].valor + ".", "Agrupá o quitá ítems del menú.", null, { regla: "menu" });
        }
      }

      /* Textos */
      var taken = new Set();
      var checked = [];
      rules.textos.roles.forEach(function (role) {
        if (!role.activo || !role.selector) return;
        safeAll(root, role.selector).forEach(function (el) {
          if (taken.has(el) || ignored(el)) return;
          for (var p = el.parentElement; p && p !== root; p = p.parentElement) { if (taken.has(p)) return; }
          taken.add(el);
          checked.push({ el: el, role: role });
        });
      });
      checked.forEach(function (c) {
        var text = textOf(c.el, new Set(Array.from(taken).filter(function (t) { return t !== c.el && c.el.contains(t); })));
        if (!text) return;
        var len = text.length;
        var role = c.role;
        if (role.max && len > role.max) {
          add("error", "textos", mi, role.label + ": " + len + " caracteres, el máximo es " + role.max + ".", "«" + cut(text) + "»", c.el);
        } else if (role.min && len < role.min) {
          add("aviso", "textos", mi, role.label + ": " + len + " caracteres, el mínimo es " + role.min + ".", "«" + cut(text) + "»", c.el);
        }
        if (rules.textos.viudas && role.id !== "boton" && role.id !== "menu" && isWidow(c.el)) {
          add("aviso", "textos", mi, role.label + ": queda una palabra sola en la última línea.", "«" + cut(text) + "»", c.el, { viuda: true });
        }
      });

      if (rules.textos.ejemplos && rules.textos.listaEjemplos.length) {
        var haystack = [norm(root.textContent)];
        safeAll(root, "[href], [src], [alt], [title], [placeholder]").forEach(function (el) {
          if (ignored(el)) return;
          ["href", "src", "alt", "title", "placeholder"].forEach(function (a) { if (el.getAttribute(a)) haystack.push(el.getAttribute(a)); });
        });
        var hay = haystack.join(" ");
        var hayLow = hay.toLowerCase();
        rules.textos.listaEjemplos.forEach(function (s) {
          s = norm(s);
          var loose = s.indexOf(" ") === -1 || s === s.toLowerCase();
          var found = s && (loose ? hayLow.indexOf(s.toLowerCase()) !== -1 : hay.indexOf(s) !== -1);
          if (found) {
            add("error", "textos", mi, "Dato de ejemplo «" + s + "».", "Reemplazalo por el dato real del cliente.", null, { ejemplo: s });
          }
        });
      }

      /* Imágenes */
      var urls = {};
      safeAll(root, "img, [style*='background-image']").forEach(function (el) {
        if (ignored(el)) return;
        var isImg = el.tagName === "IMG";
        var raw = isImg ? (el.currentSrc || el.getAttribute("src") || "") : bgUrl(el);
        if (!raw) return;
        var url;
        try { url = new URL(raw, doc.baseURI).href; } catch (e) { return; }
        var role = rules.imagenes.roles.filter(function (r) { return r.activo && r.selector && safeMatches(el, r.selector); })[0];
        if (isImg && rules.imagenes.altObligatorio) {
          var alt = el.getAttribute("alt");
          if (alt === null || (!norm(alt) && !el.closest("a, button"))) {
            add("aviso", "imagenes", mi, "Imagen sin texto alternativo (alt).", "Describí la foto en pocas palabras: ayuda a Google y a la accesibilidad.", el);
          } else if (rules.imagenes.altMax && norm(alt).length > rules.imagenes.altMax) {
            add("aviso", "imagenes", mi, "Texto alternativo de " + norm(alt).length + " caracteres, el máximo es " + rules.imagenes.altMax + ".", "«" + cut(alt) + "»", el);
          }
        }
        if (urls[url]) return;
        urls[url] = true;
        imageJobs.push(checkImage(el, url, role, mi));
      });
    });

    function checkImage(el, url, role, mi) {
      var label = role ? role.label : "Imagen";
      var fmt = formatOf(url);
      var formats = rules.imagenes.formatos || [];
      if (fmt && formats.length && formats.indexOf(fmt) === -1) {
        add("aviso", "imagenes", mi, label + ": formato " + fmt.toUpperCase() + ".", "Usá " + formats.map(function (f) { return f.toUpperCase(); }).join(", ") + ".", el);
      }
      return Promise.all([imageSize(url), imageWeight(url, win)]).then(function (res) {
        var size = res[0];
        var bytes = res[1];
        var file = decodeURIComponent(url.split("/").pop().split("?")[0]);
        if (!size) { add("error", "imagenes", mi, label + ": la imagen no carga.", file, el); return; }
        if (!role) return;
        var vector = fmt === "svg";
        var small = !vector && ((role.minAncho && size.w < role.minAncho) || (role.minAlto && size.h < role.minAlto));
        if (small) {
          var need = role.minAncho && role.minAlto ? role.minAncho + "×" + role.minAlto + " px"
            : role.minAncho ? role.minAncho + " px de ancho" : role.minAlto + " px de alto";
          add("error", "imagenes", mi, label + ": mide " + size.w + "×" + size.h + " px, el mínimo es " + need + ".", file, el);
        }
        var target = ratioOf(role.proporcion);
        if (target && !vector && Math.abs(size.w / size.h / target - 1) > 0.03) {
          add("aviso", "imagenes", mi, label + ": proporción " + ratioLabel(size.w, size.h) + " y la pedida es " + role.proporcion + ".", file, el);
        }
        if (bytes && role.maxKB && bytes / 1024 > role.maxKB) {
          add("aviso", "imagenes", mi, label + ": pesa " + Math.round(bytes / 1024) + " KB, el máximo es " + role.maxKB + " KB.", file + " · Comprimila o pasala a WEBP.", el);
        }
        var factor = Number(rules.imagenes.nitidez) || 0;
        if (factor && !small && !vector) {
          var box = el.getBoundingClientRect();
          var shown = box.width || ((el.closest(".carousel, .nx-hero") || el).getBoundingClientRect().width);
          var need = Math.round(shown * factor);
          if (shown && size.w < need) {
            add("aviso", "imagenes", mi, label + ": se ve borrosa en esta pantalla.", file + " · Se muestra a " + Math.round(shown) + " px y mide " + size.w + " px; necesita " + need + " px.", el);
          }
        }
      });
    }

    return Promise.all(imageJobs).then(function () { return report(issues); });
  }

  function report(issues) {
    var order = { estructura: 0, textos: 1, imagenes: 2 };
    issues.sort(function (a, b) {
      return (a.level === b.level ? 0 : a.level === "error" ? -1 : 1) ||
        (order[a.area] - order[b.area]) || ((a.module == null ? -1 : a.module) - (b.module == null ? -1 : b.module));
    });
    var errors = issues.filter(function (i) { return i.level === "error"; }).length;
    var warnings = issues.length - errors;
    return { issues: issues, errors: errors, warnings: warnings, score: Math.max(0, 100 - errors * 8 - warnings * 2) };
  }

  /* Resumen en texto (para pasarle a una IA o al equipo) */
  function toPrompt(rules, groupNames) {
    groupNames = groupNames || {};
    var L = [];
    var name = function (id) { return groupNames[id] || id; };
    L.push("Reglas de calidad para landings Lanzate");
    L.push("");
    L.push("ESTRUCTURA");
    if (rules.estructura.obligatorios.length) L.push("- Secciones obligatorias: " + rules.estructura.obligatorios.map(name).join(", ") + ".");
    rules.estructura.reglas.forEach(function (r) {
      if (r.activo) L.push("- " + r.label + (r.valor !== undefined ? ": " + r.valor + " " + (r.unidad || "") : "") + (r.nivel === "error" ? " (obligatorio)" : " (recomendado)") + ".");
    });
    L.push("");
    L.push("TEXTOS (caracteres, contando espacios)");
    rules.textos.roles.forEach(function (r) {
      if (r.activo) L.push("- " + r.label + ": " + (r.min ? "entre " + r.min + " y " + r.max : "hasta " + r.max) + " caracteres.");
    });
    if (rules.textos.viudas) L.push("- Sin palabras solas en la última línea de un texto: uní las dos últimas palabras con un espacio duro.");
    if (rules.textos.ejemplos && rules.textos.listaEjemplos.length) L.push("- Ningún dato de ejemplo: " + rules.textos.listaEjemplos.join(", ") + ".");
    L.push("");
    L.push("IMÁGENES");
    rules.imagenes.roles.forEach(function (r) {
      if (!r.activo) return;
      var parts = [];
      if (r.minAncho && r.minAlto) parts.push("mínimo " + r.minAncho + "×" + r.minAlto + " px");
      else if (r.minAncho) parts.push("mínimo " + r.minAncho + " px de ancho");
      else if (r.minAlto) parts.push("mínimo " + r.minAlto + " px de alto");
      if (r.proporcion) parts.push("proporción " + r.proporcion);
      if (r.maxKB) parts.push("hasta " + r.maxKB + " KB");
      L.push("- " + r.label + ": " + parts.join(", ") + ".");
    });
    if (rules.imagenes.formatos.length) L.push("- Formatos: " + rules.imagenes.formatos.join(", ").toUpperCase() + ".");
    if (rules.imagenes.altObligatorio) L.push("- Toda imagen lleva texto alternativo (alt) de hasta " + rules.imagenes.altMax + " caracteres.");
    if (Number(rules.imagenes.nitidez)) L.push("- Cada imagen mide al menos " + rules.imagenes.nitidez + "× el ancho con el que se muestra, para verse nítida.");
    return L.join("\n");
  }

  function textRole(el, rules) {
    var root = el.closest(".mq-frame") || el.ownerDocument.body;
    var roles = (rules || merge(null)).textos.roles;
    for (var i = 0; i < roles.length; i++) {
      var role = roles[i];
      if (!role.activo || !role.selector) continue;
      for (var p = el; p && p !== root; p = p.parentElement) {
        try { if (p.matches(role.selector)) return role; } catch (e) { break; }
      }
    }
    return null;
  }

  function imageRole(el, rules) {
    return (rules || merge(null)).imagenes.roles.filter(function (r) { return r.activo && r.selector && safeMatches(el, r.selector); })[0] || null;
  }

  window.LanzateReglas = {
    defaults: function () { return clone(DEFAULTS); },
    merge: merge,
    load: load,
    save: save,
    check: check,
    textRole: textRole,
    imageRole: imageRole,
    norm: norm,
    toPrompt: toPrompt,
    proporciones: PROPORCIONES
  };
})();
