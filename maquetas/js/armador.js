/* Armador de landings de Lanzate: convierte los módulos de la biblioteca, con los textos, fotos, enlaces y
   colores de cada landing, en el HTML final. Lo usan el constructor (en el navegador) y, con un DOM de Node,
   las pruebas y el armado desde los datos guardados. Así hay una sola forma de armar una landing. */
(function (global) {
  "use strict";

  var SOCIAL_HOSTS = { instagram: "instagram.com", facebook: "facebook.com", linkedin: "linkedin.com/company" };
  function socialUrl(network, value) {
    /* En el panel se usa la de plataforma.js (la misma regla para todo el panel). */
    if (global.Lanzate && global.Lanzate.socialUrl) return global.Lanzate.socialUrl(network, value);
    var v = String(value || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(v)) return "https://" + v;
    return "https://" + SOCIAL_HOSTS[network] + "/" + v.replace(/^@/, "");
  }

  var FONTS = "css/fonts.css";

  var BOOTSTRAP_CSS = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

  var ICONS_CSS = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";

  var BOOTSTRAP_JS = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js";

  var SAMPLE = {
    nombre: "Marca Ejemplo", email: "hola@example.com", telefono: "+54 11 2345 6789", wa: "5491123456789",
    direccion: "Calle Ejemplo 123, Buenos Aires", mapa: "query=Calle+Ejemplo+123,+Buenos+Aires"
  };

  var SAMPLE_HOURS = /Lun a Vie,? 9 a 18 h/g;

  var SAMPLE_HOURS_TEXT = /de lunes a viernes, de 9 a 18 h/g;

  var SOCIAL = ["instagram", "facebook", "linkedin"];

  var DEFAULT_COLORS = { c1: "#1b5e42", c2: "#e7f3ee" };

  var CORTES = {
    curva: { name: "Curva", path: "M0 80 L0 58 Q720 -6 1440 58 L1440 80 Z" },
    ola: { name: "Ola", path: "M0 80 L0 44 C240 4 480 84 720 44 S1200 4 1440 44 L1440 80 Z" },
    diagonal: { name: "Diagonal", path: "M0 80 L1440 14 L1440 80 Z" }
  };

  var LANDING_FONTS = {
    editorial: ["Fraunces, Georgia, serif", "Manrope, system-ui, sans-serif"],
    moderna: ["Manrope, system-ui, sans-serif", "Manrope, system-ui, sans-serif"],
    clasica: ["Georgia, serif", "Manrope, system-ui, sans-serif"]
  };

  var AMBIENTES = {
    claro: { name: "Claro", hint: "Blanco y gris suave", bg: "#ffffff", paper: "#f6f5f2", cream: "#f2f0eb", sage: 0.93 },
    calido: { name: "Cálido", hint: "Crema y arena", bg: "#fbf8f3", paper: "#f3ebdf", cream: "#efe6d8", sage: 0.9, tint: "#f6efe4" },
    marca: { name: "Marca", hint: "Tonos de tu color", bg: "#ffffff", sage: 0.88, paperMix: 0.8 },
    oscuro: { name: "Oscuro", hint: "Fondo oscuro, texto claro", bg: "#15130f", paper: "#1f1c18", cream: "#24201b", card: "#25211c", dark: true }
  };

  var COMMON_MODULE_COLORS = {
    fondo: ["Fondo de sección", ".nx", "background-color", "#f7f4ef"],
    titulo: ["Títulos", "h1, h2, h3, h4, .stat-n, .hero-stat-n, .nx-display, .nx-display .em", "color", "#17352c"],
    texto: ["Textos", "p:not(.stat-n, .hero-stat-n), li, dd, blockquote, figcaption", "color", "#5f6f68"],
    etiqueta: ["Etiquetas", ".nx-kicker, .plan-kicker, .badge, .k", "color", "#17352c"],
    enlace: ["Enlaces", "a:not(.btn-nx, .btn-nx-light, .btn-nx-outline, .nx-wa)", "color", "#1b5e42"],
    boton: ["Fondo del botón principal", ".btn-nx, .nx-wa", "background-color", "#1b5e42"],
    botonTexto: ["Texto del botón principal", ".btn-nx, .btn-nx .bi, .nx-wa, .nx-wa .bi", "color", "#ffffff"],
    secundario: ["Fondo del botón secundario", ".btn-nx-outline, .btn-nx-light", "background-color", "#ffffff"],
    secundarioTexto: ["Texto del botón secundario", ".btn-nx-outline, .btn-nx-light, .btn-nx-outline .bi, .btn-nx-light .bi", "color", "#17352c"],
    secundarioBorde: ["Borde del botón secundario", ".btn-nx-outline, .btn-nx-light", "border-color", "#17352c"],
    tarjeta: ["Fondo de tarjetas", ".nx-hero-card, .ben-card, .prod-card, .prod-card-xl, .plan-card, .quote-card, .person-card, .svc-card", "background-color", "#ffffff"],
    tarjetaTexto: ["Texto de tarjetas", ":is(.nx-hero-card, .ben-card, .prod-card, .prod-card-xl, .plan-card, .quote-card, .person-card, .svc-card) :is(h2, h3, h4, p, li)", "color", "#17352c"],
    campo: ["Fondo de campos", "input:not([type=hidden], [type=radio], [type=checkbox]), select, textarea", "background-color", "#ffffff"],
    campoTexto: ["Texto de campos", "input:not([type=hidden], [type=radio], [type=checkbox]), select, textarea", "color", "#17352c"],
    icono: ["Íconos", ".bi:not(.btn-nx *, .btn-nx-outline *, .btn-nx-light *, .nx-wa *)", "color", "#1b5e42"]
  };

  var MODULE_COLOR_FIELDS = {
    hero: {
      titulo: ["Título", ".nx-display, .nx-display .em", "color", "#17352c"],
      texto: ["Texto", ".nx-lead", "color", "#5f6f68"],
      boton: ["Fondo del botón", ".btn-nx", "background-color", "#1b5e42"],
      botonTexto: ["Texto del botón", ".btn-nx, .btn-nx .bi", "color", "#ffffff"],
      tarjeta: ["Fondo de tarjetas", ".nx-hero-card", "background-color", "#ffffff"],
      tarjetaTexto: ["Texto de tarjetas", ".nx-hero-card h3, .nx-hero-card p", "color", "#17352c"],
      icono: ["Íconos de tarjetas", ".nx-hero-card .bi", "color", "#1b5e42"]
    },
    footer: {
      fondo: ["Fondo", "footer.nx, .nx-footer-dark, .foot-main", "background-color", "#f7f4ef"],
      texto: ["Texto", ".nx-footer :is(p, small, strong, .nx-footer-label):not(.foot-cta *)", "color", "#17352c"],
      enlace: ["Enlaces", ".nx-footer a:not(.btn-nx, .btn-nx-outline, .btn-nx-light, .nx-socials *)", "color", "#17352c"],
      icono: ["Íconos de redes", ".nx-footer .nx-socials .bi", "color", "#17352c"]
    }
  };

  var EDIT_SEL = "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, dt, dd, a, button, label, .nx-kicker, .plan-kicker, .badge";

  var IMG_SEL = "img, [style*='background-image']";

  function slugify(text) {
    return (text || "landing").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "landing";
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  function normalizeHex(value) {
    var hex = String(value || "").trim();
    if (hex.charAt(0) !== "#") hex = "#" + hex;
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : "";
  }

  function shade(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    return "#" + [16, 8, 0].map(function (s) {
      var v = Math.round(((n >> s) & 255) * (1 + amount));
      return ("0" + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    }).join("");
  }

  function mix(hex, other, weight) {
    function ch(color, shift) { return parseInt(color.slice(1), 16) >> shift & 255; }
    return "#" + [16, 8, 0].map(function (shift) {
      var v = Math.round(ch(hex, shift) * weight + ch(other, shift) * (1 - weight));
      return ("0" + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    }).join("");
  }

  function waNumber(tel) {
    var d = String(tel || "").replace(/\D/g, "");
    if (d.indexOf("00") === 0) d = d.slice(2);
    if (!d) return "";
    if (d.indexOf("54") === 0) d = d.slice(2).replace(/^9/, "");
    else if (d.length > 11) return d;
    return "549" + d.replace(/^0/, "");
  }

  function logoSrc(c, preview) {
    if (!c || !c.logo_url) return "";
    return preview ? c.logo_url : "lzlogo:";
  }

  function logoMode(c) {
    if (!c || !c.logo_url) return "texto";
    return c.logo_modo || "imagen";
  }

  function clientStyle(c) {
    if (!c) return "";
    var vars = [];
    var c1 = String(c.color_primario || "").toLowerCase();
    var c2 = String(c.color_secundario || "").toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(c1) && c1 !== DEFAULT_COLORS.c1) vars.push("--green: " + c1, "--green-deep: " + shade(c1, -0.28));
    if (/^#[0-9a-f]{6}$/.test(c2) && c2 !== DEFAULT_COLORS.c2) vars.push("--sage: " + c2, "--sage-2: " + c2);
    return vars.length ? ":root { " + vars.join("; ") + "; }" : "";
  }

  function corteMarkup(kind) {
    return '<div class="lz-corte" aria-hidden="true"><svg viewBox="0 0 1440 80" preserveAspectRatio="none" focusable="false"><path d="' + CORTES[kind].path + '"/></svg></div>';
  }

  function moduleColorFields(item) {
    if (item.id === "hero-full-imagen-compleja") return Object.assign({}, COMMON_MODULE_COLORS, MODULE_COLOR_FIELDS.hero);
    if (item.id.indexOf("footer-") === 0) return Object.assign({}, COMMON_MODULE_COLORS, MODULE_COLOR_FIELDS.footer);
    return COMMON_MODULE_COLORS;
  }

  function paintModuleColors(root, item, sharedColors, ownColors, touched) {
    var fields = moduleColorFields(item);
    var shared = Object.assign({}, sharedColors || {});
    if (item.fondo && !ownColors) delete shared.fondo;
    var colors = Object.assign(shared, ownColors || item.coloresModulo);
    Object.keys(fields).forEach(function (key) {
      var color = normalizeHex(colors[key]);
      if (!color) return;
      var field = fields[key];
      root.querySelectorAll(field[1]).forEach(function (element) {
        if (field[1] === ".nx" && element.parentElement && element.parentElement.closest(".nx")) return;
        if (touched && !touched.has(element)) touched.set(element, element.getAttribute("style"));
        if (key === "fondo" && element.classList.contains("nx-footer-dark")) {
          element.style.setProperty("background-image", "none", "important");
        }
        element.style.setProperty(field[2], color, "important");
      });
    });
  }

  function paintFondoNodes(root, color) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll(".nx").forEach(function (el) {
      if (el.parentElement && el.parentElement.closest(".nx")) return;
      el.style.backgroundColor = color || "";
    });
  }

  function ambientStyle(colors) {
    var a = AMBIENTES[colors.ambiente];
    if (!a) return "";
    var brand = colors.marca || colors.acento;
    var sage = a.dark ? mix(brand, a.bg, 0.16) : mix(brand, a.tint || "#ffffff", 1 - a.sage);
    var paper = a.paperMix ? mix(brand, "#ffffff", 1 - a.paperMix) : a.paper;
    var css = ":root { --nx-bg: " + a.bg + "; --paper: " + paper + "; --cream: " + (a.cream || paper) + "; --sage: " + sage + "; --sage-2: " + sage +
      "; --line: " + (a.dark ? "#3a342d" : mix(brand, "#e6e3dc", 0.12)) + "; }" +
      ".landing-page { background-color: " + a.bg + "; }";
    if (a.dark) {
      css += ".landing-page .nx :is(.nx-hero-card, .ben-card, .prod-card, .prod-card-xl, .plan-card, .quote-card, .person-card, .svc-card, .card, .bk-card, .accordion-item, .accordion-button, .bg-white) { background-color: " + a.card + " !important; color: " + colors.titulos + "; border-color: #3a342d; box-shadow: none; }" +
        ".landing-page .nx :is(input:not([type=radio], [type=checkbox]), select, textarea, .bk-day, .bk-slot, .bk-input) { background-color: #2e2923; border-color: #463f37; color: " + colors.titulos + "; }" +
        ".landing-page .nx :is(input, textarea)::placeholder { color: #a39b90; }" +
        ".landing-page .nx .bk-slot:disabled { background-color: #221e1a; color: #8a8278; }" +
        ".landing-page .nx :is(.text-secondary, .text-muted, .small) { color: " + colors.parrafos + " !important; }";
    }
    return css;
  }

  // Only use bundled or standard system families; never interpolate arbitrary CSS from a manual.
  function brandFont(value) {
    var key = String(value || "").trim().toLowerCase().replace(/[-_ ]?(regular|bold|medium|semibold|light|italic|variable|black|thin)$/i, "").replace(/[-_ ]/g, "");
    var families = {fraunces:"Fraunces, Georgia, serif",manrope:"Manrope, system-ui, sans-serif",georgia:"Georgia, serif",arial:"Arial, sans-serif",verdana:"Verdana, sans-serif",tahoma:"Tahoma, sans-serif",timesnewroman:"Times New Roman, serif",helvetica:"Helvetica, Arial, sans-serif",couriernew:"Courier New, monospace",trebuchetms:"Trebuchet MS, sans-serif"};
    return Object.hasOwn(families,key) ? families[key] : "";
  }
  function brandTypography(colors, fallback) {
    var fonts = fallback || LANDING_FONTS.moderna;
    return [brandFont(colors.fuenteTitulos) || fonts[0], brandFont(colors.fuenteTextos) || fonts[1]];
  }
  function colorStyle(colors) {
    if (!colors) return "";
    var fonts = Object.hasOwn(LANDING_FONTS, colors.tipografia) && LANDING_FONTS[colors.tipografia];
    if (colors.fuenteTitulos || colors.fuenteTextos) fonts = brandTypography(colors, fonts);
    var typography = fonts ?
      ".landing-page, .landing-page .nx, .landing-page .nx :is(input, select, textarea, button) { font-family:" + fonts[1] + "; }" +
      ".landing-page .nx :is(h1, h2, h3, .nx-display, .stat-n, .hero-stat-n) { font-family:" + fonts[0] + "; }" : "";
    if (!colors.acento) return typography;
    return typography + ":root { --ink: " + colors.titulos + "; --muted: " + colors.parrafos + "; --lz-label: " + colors.etiquetas +
      "; --green: " + colors.acento + "; --green-deep: " + shade(colors.acento, -0.28) + "; --lz-icon: " + colors.iconos +
      "; --dark: " + shade(colors.acento, -0.55) + "; --sage: " + mix(colors.acento, "#ffffff", 0.16) +
      "; --paper: " + mix(colors.acento, "#f7f4ef", 0.22) + "; }" +
      ".landing-page { color: var(--ink); }" +
      ".landing-page :is(p, li, blockquote, figcaption, dd):not(.stat-n, .hero-stat-n) { color: var(--muted); }" +
      ".landing-page :is(.nx-kicker, .plan-kicker, .badge, .k) { color: var(--lz-label); }" +
      ".landing-page .bi { color: var(--lz-icon); }" +
      (colors.nav ? '.landing-page [data-module^="navegacion"] :is(a, span, strong, p, li, button, .bi):not(:is(.btn-nx, .btn-nx-outline, .btn-nx-light, .btn-nx *, .btn-nx-outline *, .btn-nx-light *)) { color: ' + colors.nav + "; }" : "") +
      (colors.hero ? '.landing-page [data-module^="hero"] :is(h1, h2, h3, p, li, span, .nx-kicker):not(:is(.btn-nx, .btn-nx-outline, .btn-nx-light, .btn-nx *, .btn-nx-outline *, .btn-nx-light *)) { color: ' + colors.hero + "; }" : "") +
      ".landing-page :is(.btn-nx, .btn-nx-outline, .btn-nx-light) .bi { color: inherit; }" +
      ambientStyle(colors) + (normalizeHex(colors.fondoMarca) ? ":root { --nx-bg:" + normalizeHex(colors.fondoMarca) + "; } .landing-page {background-color:" + normalizeHex(colors.fondoMarca) + ";}" : "") + (normalizeHex(colors.secundarioMarca) ? ":root { --sage:" + normalizeHex(colors.secundarioMarca) + "; --sage-2:" + normalizeHex(colors.secundarioMarca) + "; }" : "");
  }

  function ownText(el) {
    return Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && /\S/.test(n.nodeValue); });
  }

  function editableNodes(root) {
    var all = Array.prototype.filter.call(root.querySelectorAll(EDIT_SEL), function (el) {
      return /\S/.test(el.textContent) && !el.closest(".nx-brand, .lp-tools, script, style, svg, select, .visually-hidden");
    });
    var set = new Set(all);
    var nodes = all.filter(function (el) {
      for (var p = el.parentElement; p; p = p.parentElement) { if (set.has(p) && ownText(p)) return false; }
      return ownText(el) || !all.some(function (o) { return o !== el && el.contains(o); });
    });
    /* El resto va al final para no correr los textos ya guardados: precios, ítems, celdas y cualquier texto suelto. */
    Array.prototype.forEach.call(root.querySelectorAll("*"), function (el) {
      if (!ownText(el)) return;
      if (el.closest(".nx-brand, .lp-tools, script, style, svg, select, option, .visually-hidden")) return;
      if (nodes.some(function (n) { return n === el || n.contains(el) || el.contains(n); })) return;
      nodes.push(el);
    });
    return nodes;
  }

  function imageNodes(root) {
    return Array.prototype.filter.call(root.querySelectorAll(IMG_SEL), function (el) {
      return !el.closest(".nx-brand, .lp-tools, script, style, svg");
    });
  }

  function linkNodes(root) {
    return Array.prototype.filter.call(root.querySelectorAll("a[href]"), function (el) {
      return !el.closest(".lp-tools, [data-bs-slide], [data-bs-slide-to], [data-bs-toggle]");
    });
  }

  function imageData(el) {
    if (el.tagName === "IMG") return { src: el.getAttribute("src") || "", alt: el.getAttribute("alt") || "" };
    var m = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(el.style.backgroundImage || "");
    return { src: m ? m[1] : "", alt: el.getAttribute("data-lz-background-alt") || "" };
  }

  function setImage(el, data) {
    if (data.src) {
      if (el.tagName === "IMG") {
        el.setAttribute("src", data.src);
        el.removeAttribute("srcset");
        el.removeAttribute("sizes");
        el.removeAttribute("width");
        el.removeAttribute("height");
      } else {
        el.style.backgroundImage = 'url("' + data.src + '")';
      }
    }
    if (el.tagName === "IMG" && Number.isInteger(data.width) && data.width > 0 && Number.isInteger(data.height) && data.height > 0) {
      el.setAttribute("width", String(data.width));
      el.setAttribute("height", String(data.height));
    }
    if (data.alt != null) {
      /* Sin descripción queda vacío: el control de calidad lo marca para que se describa (no se rellena con «imagen») */
      if (el.tagName === "IMG") el.setAttribute("alt", String(data.alt).trim());
      else if (el.closest(".nx-hero, .nx-hero-slide")) el.setAttribute("data-lz-background-alt", String(data.alt).trim());
    }
  }

  function setHref(el, href) {
    el.setAttribute("href", href);
    if (/^https?:/.test(href)) { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
    else if (/^#/.test(href)) el.removeAttribute("target");
  }

  function applyClient(root, c, preview) {
    if (!c) return;
    function literal(s) { return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"); }
    var pairs = [[literal(" · Datos de ejemplo"), ""]];
    if (c.nombre) pairs.push([new RegExp(SAMPLE.nombre, "gi"), c.nombre]);
    if (c.email) pairs.push([literal(SAMPLE.email), c.email]);
    if (c.telefono) pairs.push([literal(SAMPLE.telefono), c.telefono]);
    if (c.direccion) pairs.push([literal(SAMPLE.direccion), c.direccion]);
    if (c.horario) pairs.push([SAMPLE_HOURS, c.horario], [SAMPLE_HOURS_TEXT, "en este horario: " + c.horario]);
    root.querySelectorAll("p, span, dd").forEach(function (el) {
      var html = el.innerHTML.trim();
      if (c.direccion && /^Calle Ejemplo 123<br>\s*Buenos Aires$/.test(html)) el.textContent = c.direccion;
      else if (c.horario && /^Lun a Vie<br>\s*9 a 18 h$/.test(html)) el.textContent = c.horario;
      else if (c.direccion && el.querySelector(".bi-geo-alt") && el.textContent.trim() === "Buenos Aires") {
        el.lastChild.nodeValue = " " + c.direccion;
      }
    });
    function swap(text) {
      pairs.forEach(function (p) { text = text.replace(p[0], function () { return p[1]; }); });
      return text;
    }
    var walker = (root.ownerDocument || document).createTreeWalker(root, 4);
    var node;
    while ((node = walker.nextNode())) node.nodeValue = swap(node.nodeValue);
    var wa = waNumber(c.telefono);
    root.querySelectorAll("[href], [alt], [title], [aria-label]").forEach(function (el) {
      ["alt", "title", "aria-label"].forEach(function (a) { if (el.hasAttribute(a)) el.setAttribute(a, swap(el.getAttribute(a))); });
      var href = el.getAttribute("href");
      if (!href) return;
      if (c.email) href = href.replace("mailto:" + SAMPLE.email, "mailto:" + c.email);
      if (wa) href = href.replace("wa.me/" + SAMPLE.wa, "wa.me/" + wa);
      if (c.nombre) href = href.replace("q=" + SAMPLE.nombre.replace(/ /g, "+"), "q=" + encodeURIComponent(c.nombre).replace(/%20/g, "+"));
      if (c.direccion) href = href.replace(SAMPLE.mapa, "query=" + encodeURIComponent(c.direccion));
      el.setAttribute("href", href);
    });
    SOCIAL.forEach(function (k) {
      root.querySelectorAll('a[href="https://' + k + '.com"]').forEach(function (a) {
        if (a.closest(".person-card")) return;
        if (c[k]) a.setAttribute("href", socialUrl(k, c[k]));
        else a.remove();
      });
    });
    if (c.nombre) root.querySelectorAll("[data-template-brand]").forEach(function (brand) { brand.textContent = c.nombre; });
    var logo = logoSrc(c, preview);
    var mode = logoMode(c);
    if (logo && mode !== "texto") {
      root.querySelectorAll(".nx-brand").forEach(function (el) {
        var module = el.closest("[data-module], #navegacion-media, #media");
        var moduleId = module ? (module.getAttribute("data-module") || module.id) : "";
        if (moduleId === "navegacion-media" || moduleId === "media") return;
        var name = el.textContent.replace(/\s+/g, " ").trim() || c.nombre;
        el.classList.toggle("has-name", mode === "imagen-texto");
        el.innerHTML = mode === "imagen-texto"
          ? '<img class="nx-brand-logo" src="' + escapeHtml(logo) + '" alt="Logo de ' + escapeHtml(name) + '"><span class="nx-brand-name">' + escapeHtml(name) + "</span>"
          : '<img class="nx-brand-logo" src="' + escapeHtml(logo) + '" alt="' + escapeHtml(c.nombre) + '">';
      });
    }
  }

  function syncFooterMenu(root, menuLinks) {
    root.querySelectorAll(".nx-footer").forEach(function (footer) {
      var menus = footer.querySelectorAll(".foot-links, nav[aria-label='Navegación del pie']");
      if (!menus.length) return;
      menus.forEach(function (menu, index) {
        if (!index) {
          var list = menu.matches("ul, ol");
          menu.replaceChildren();
          menu.hidden = !menuLinks.length;
          var heading = menu.previousElementSibling;
          if (heading && heading.classList.contains("nx-footer-label")) heading.hidden = menu.hidden;
          menuLinks.forEach(function (source) {
            var link = menu.ownerDocument.createElement("a");
            link.textContent = source.textContent.trim();
            link.setAttribute("href", source.getAttribute("href"));
            ["target", "rel", "aria-label"].forEach(function (name) {
              if (source.hasAttribute(name)) link.setAttribute(name, source.getAttribute(name));
            });
            if (list) {
              var item = menu.ownerDocument.createElement("li");
              item.appendChild(link);
              menu.appendChild(item);
            } else menu.appendChild(link);
          });
          return;
        }
        var label = menu.previousElementSibling;
        if (label && label.classList.contains("nx-footer-label")) label.remove();
        menu.remove();
      });
    });
  }

  var COLOR_MARK = /\/\*lz-colores (\{[\s\S]*?\})\*\//;

  function readLandingColors(estilo) {
    var match = COLOR_MARK.exec(estilo || "");
    if (!match) return null;
    try {
      var data = JSON.parse(match[1]);
      if (data.texto && !data.titulos) data.titulos = data.texto;
      delete data.coloresManuales;
      if (!Object.hasOwn(LANDING_FONTS, data.tipografia)) delete data.tipografia;
      ["fuenteTitulos","fuenteTextos"].forEach(function(k){if (!brandFont(data[k])) delete data[k];});
      ["fondoMarca","secundarioMarca"].forEach(function(k){if (!normalizeHex(data[k])) delete data[k];});
      if (["titulos", "acento", "iconos"].every(function (key) { return /^#[0-9a-f]{6}$/i.test(data[key] || ""); })) return data;
      return data.tipografia ? { tipografia: data.tipografia } : null;
    } catch (e) {
      return null;
    }
  }

  function stripLandingColors(estilo) {
    return (estilo || "").replace(COLOR_MARK, "").replace(/^\n+/, "");
  }

  /* La biblioteca: cada .mq-block de maquetas/index.html es una variante de módulo */
  function leerBiblioteca(doc) {
    var library = [];
    var byId = {};
    doc.querySelectorAll(".lib-section").forEach(function (section) {
      var group = {
        id: section.id,
        name: section.querySelector(".lib-title h2").textContent.trim(),
        modules: []
      };
      section.querySelectorAll(".mq-block").forEach(function (block) {
        var spans = block.querySelectorAll(".mq-caption > span");
        var frameEl = block.querySelector(".mq-frame");
        var nx = frameEl.querySelector(".nx");
        var variant = block.id.indexOf(section.id + "-") === 0 ? block.id.slice(section.id.length + 1) : block.id;
        var mod = {
          id: block.id,
          group: group.name,
          groupId: section.id,
          variant: spans[0] ? spans[0].textContent.trim() : variant,
          note: spans[1] ? spans[1].textContent.trim() : "",
          thumb: "../assets/modulos/" + section.id + "/" + variant + ".webp",
          width: nx && nx.getAttribute("data-width") === "full" ? "full" : "contained",
          html: frameEl.innerHTML
        };
        group.modules.push(mod);
        byId[mod.id] = mod;
      });
      if (group.modules.length) library.push(group);
    });
    return { library: library, byId: byId };
  }

  /* Campos con nombre fijo (data-lz-campo / data-lz-foto / data-lz-enlace, ver scripts/marcar-campos.mjs).
     Las landings guardan sus contenidos por nombre; las posiciones (textos[0], imagenes[1]…) se recalculan con el módulo
     actual, así un módulo se puede reordenar o ampliar sin que lo guardado caiga en otro lugar. */
  var MARCAS = { campos: "data-lz-campo", fotos: "data-lz-foto", enlaces: "data-lz-enlace" };

  function nombresDe(root) {
    function names(nodes, attr) { return nodes.map(function (el) { return el.getAttribute(attr) || ""; }); }
    return {
      campos: names(editableNodes(root), MARCAS.campos),
      fotos: names(imageNodes(root), MARCAS.fotos),
      enlaces: names(linkNodes(root), MARCAS.enlaces)
    };
  }

  function plantillaDe(doc, html) {
    var tpl = doc.createElement("template");
    tpl.innerHTML = html;
    return tpl.content;
  }

  function copia(value) { return JSON.parse(JSON.stringify(value)); }

  /* Agrega a la sección sus contenidos por nombre (campos, fotos, enlaces, ocultos), a partir de los de posición. */
  function aNombres(doc, it, moduleHtml) {
    var n = nombresDe(plantillaDe(doc, it.html || moduleHtml));
    var out = Object.assign({}, it);
    var nombrados = {
      campos: [n.campos, it.textos], fotos: [n.fotos, it.imagenes], enlaces: [n.enlaces, it.links], ocultosEnlaces: [n.enlaces, it.ocultos]
    };
    Object.keys(nombrados).forEach(function (key) {
      var names = nombrados[key][0], store = nombrados[key][1];
      delete out[key];
      if (!store) return;
      var map = {};
      Object.keys(store).forEach(function (k) {
        var name = names[+k];
        if (name) map[name] = copia(store[k]);
      });
      if (Object.keys(map).length) out[key] = map;
    });
    return out;
  }

  /* Recalcula las posiciones desde los nombres con el módulo actual. Devuelve la sección y los nombres que ya no están. */
  function aPosiciones(doc, it, moduleHtml) {
    if (!it.campos && !it.fotos && !it.enlaces && !it.ocultosEnlaces) return { item: it, perdidos: [] };
    var n = nombresDe(plantillaDe(doc, it.html || moduleHtml));
    var out = Object.assign({}, it);
    var perdidos = [];
    var pares = [["campos", n.campos, "textos"], ["fotos", n.fotos, "imagenes"], ["enlaces", n.enlaces, "links"], ["ocultosEnlaces", n.enlaces, "ocultos"]];
    pares.forEach(function (par) {
      var named = it[par[0]];
      /* Sin nombres en el módulo (una sección con estructura propia guardada sin marcas): valen las posiciones. */
      if (!named || !par[1].some(Boolean)) return;
      var map = {};
      /* Lo que está en un lugar sin nombre (una sección guardada antes de las marcas) se deja donde estaba. */
      Object.keys(it[par[2]] || {}).forEach(function (k) { if (!par[1][+k]) map[k] = copia(it[par[2]][k]); });
      Object.keys(named).forEach(function (name) {
        var index = par[1].indexOf(name);
        if (index < 0) { perdidos.push(name); return; }
        map[index] = copia(named[name]);
      });
      if (Object.keys(map).length) out[par[2]] = map; else delete out[par[2]];
    });
    return { item: out, perdidos: perdidos };
  }

  /* Al repetir un ítem (agregar una tarjeta, un producto…) la copia lleva los mismos nombres: se renombran las copias. */
  function renombrarRepetidos(root) {
    Object.keys(MARCAS).forEach(function (key) {
      var attr = MARCAS[key];
      var seen = {};
      root.querySelectorAll("[" + attr + "]").forEach(function (el) { seen[el.getAttribute(attr)] = (seen[el.getAttribute(attr)] || 0) + 1; });
      var used = {};
      root.querySelectorAll("[" + attr + "]").forEach(function (el) {
        var name = el.getAttribute(attr);
        if (!used[name]) { used[name] = true; return; }
        var base = name.replace(/-\d+$/, "");
        var next = base;
        for (var i = 2; seen[next] || used[next]; i++) next = base + "-" + i;
        used[next] = true;
        el.setAttribute(attr, next);
      });
    });
  }

  /* Imágenes subidas que todavía son data: URL quedan como «lzimg:sección:posición» (el servidor las guarda como archivos) */
  function imageTokens(html, items) {
    items.forEach(function (it, i) {
      Object.keys(it.imagenes || {}).forEach(function (k) {
        var src = it.imagenes[k].src;
        if (src && src.indexOf("data:") === 0) html = html.split(src).join("lzimg:" + i + ":" + k);
      });
    });
    return html;
  }

  /* Arma la página final de una landing guardada (los mismos datos que manda el constructor al guardar). */
  function armarLanding(doc, biblioteca, landing, cliente) {
    var estilo = landing.estilo || "";
    var perdidos = [];
    var estado = {
      name: landing.nombre || "",
      items: (landing.items || []).filter(function (it) { return biblioteca.byId[it.id]; }).map(function (it) {
        var placed = aPosiciones(doc, it, biblioteca.byId[it.id].html);
        if (placed.perdidos.length) perdidos.push(biblioteca.byId[it.id].group + " (" + placed.perdidos.join(", ") + ")");
        return placed.item;
      }),
      estilo: stripLandingColors(estilo),
      colores: readLandingColors(estilo),
      animacion: landing.animacion == null ? "suave" : landing.animacion
    };
    var faltan = (landing.items || []).filter(function (it) { return !biblioteca.byId[it.id]; }).map(function (it) { return it.id; });
    var armador = crear({
      document: doc,
      byId: biblioteca.byId,
      estado: function () { return estado; },
      cliente: function () { return cliente || null; },
      colores: function () { return estado.colores && estado.colores.rolesModulo || {}; }
    });
    /* items: las secciones como las guarda el constructor (por nombre y por posición) */
    return {
      html: imageTokens(armador.buildDocument({ prefix: "" }), estado.items),
      faltan: faltan,
      perdidos: perdidos,
      items: estado.items.map(function (it) { return aNombres(doc, it, biblioteca.byId[it.id].html); })
    };
  }

  /* Lo que depende de la landing que se está armando: la biblioteca (byId), el estado de la landing, el cliente,
     los colores compartidos por módulo y, en la vista previa, las herramientas de cada sección. */
  function crear(entorno) {
    var document = entorno.document;
    var byId = entorno.byId;
    function estado() { return entorno.estado(); }
    function colores() { return entorno.colores ? entorno.colores() || {} : {}; }
    function herramientas(it, i) { return entorno.herramientas ? entorno.herramientas(it, i) : ""; }

    function isMenu(it) { return !!(byId[it.id] && byId[it.id].groupId === "navegacion"); }

    function corteAplica(it, i) {
      return !!(it && CORTES[it.corte] && i < estado().items.length - 1 && !isMenu(it) && byId[it.id] && byId[it.id].groupId !== "whatsapp");
    }

    function moduleTemplate(it, preview, withTexts) {
      var tpl = document.createElement("template");
      tpl.innerHTML = it.html || byId[it.id].html;
      var nodes = editableNodes(tpl.content);
      var images = imageNodes(tpl.content);
      var links = linkNodes(tpl.content);
      var linkText = links.map(function (el) { return el.textContent.replace(/\s+/g, " ").trim().toLowerCase(); });
      links.forEach(function (el, k) { el.setAttribute("data-lb-l", k); });
      applyClient(tpl.content, entorno.cliente(), preview);
      paintFondoNodes(tpl.content, it.fondo);
      var textos = withTexts && it.textos || {};
      nodes.forEach(function (el, k) {
        if (textos[k] != null) el.innerHTML = textos[k];
        if (preview) el.setAttribute("data-lb-t", k);
      });
      var imagenes = withTexts && it.imagenes || {};
      images.forEach(function (el, k) {
        if (imagenes[k]) setImage(el, imagenes[k]);
        if (preview) el.setAttribute("data-lb-i", k);
      });
      paintModuleColors(tpl.content, it, colores());
      var hrefs = withTexts && it.links || {};
      Object.keys(hrefs).forEach(function (k) {
        tpl.content.querySelectorAll('[data-lb-l="' + k + '"]').forEach(function (el) { setHref(el, hrefs[k]); });
      });
      var hidden = withTexts && it.ocultos || {};
      Object.keys(hidden).forEach(function (k) {
        links.forEach(function (el, j) {
          if (linkText[j] === linkText[k] && el.classList.contains("nav-link")) (el.closest("li") || el).remove();
        });
      });
      if (!preview) tpl.content.querySelectorAll("[data-lb-l]").forEach(function (el) { el.removeAttribute("data-lb-l"); });
      return { tpl: tpl, nodes: nodes, images: images, links: links };
    }

    function sectionAnchors() {
      var used = {};
      return estado().items.map(function (it) {
        var base = slugify(byId[it.id].group);
        var id = base;
        for (var n = 2; used[id]; n++) id = base + "-" + n;
        used[id] = true;
        return id;
      });
    }

    function moduleMarkup(it, prefix, i, preview, menuLinks) {
      var tpl = moduleTemplate(it, preview, true).tpl;
      tpl.content.querySelectorAll(".nx").forEach(function (el) {
        if (!el.parentElement || !el.parentElement.closest(".nx")) el.setAttribute("data-width", it.width);
      });
      if (it.id.indexOf("navegacion-media") === 0) {
        tpl.content.querySelectorAll("nav.nx-nav").forEach(function (nav) {
          nav.classList.add("nx-nav-media");
          nav.style.setProperty("background-image", "none");
          nav.style.setProperty("background-color", "#fff");
        });
        tpl.content.querySelectorAll(".nx-brand img, [style*='background-image']").forEach(function (el) {
          if (el.tagName === "IMG") el.remove();
          else el.style.setProperty("background-image", "none");
        });
      }
      if (menuLinks && byId[it.id].groupId === "footer") {
        syncFooterMenu(tpl.content, menuLinks);
        paintModuleColors(tpl.content, it, colores());
      }
      /* Las marcas de los campos son para el editor: la página publicada sale sin ellas. */
      if (preview !== true) {
        Object.keys(MARCAS).forEach(function (key) {
          tpl.content.querySelectorAll("[" + MARCAS[key] + "]").forEach(function (el) { el.removeAttribute(MARCAS[key]); });
        });
      }
      var html = tpl.innerHTML;
      if (prefix) {
        html = html
          .replace(/(src|href|data-src)="(img|css|js)\//g, '$1="' + prefix + "$2/")
          .replace(/(src|href)="\.\.\/assets\//g, '$1="' + prefix + "../assets/")
          .replace(/url\((['"]?)(img\/|\.\.\/assets\/)/g, "url($1" + prefix + "$2");
      }
      var cut = corteAplica(it, i);
      return '  <section class="mq-block" id="' + sectionAnchors()[i] + '" data-module="' + it.id + '" data-width="' + it.width + '"' + (cut ? ' data-corte="' + it.corte + '"' : "") + '>\n    <div class="mq-frame">' + html + (cut ? corteMarkup(it.corte) : "") + "</div>" +
        (preview === true ? herramientas(it, i) : "") + "\n  </section>";
    }

    function buildDocument(opts) {
      var prefix = opts.prefix || "";
      var assets = opts.base || prefix;
      var bootstrapCss = opts.base ? assets + "vendor/bootstrap/bootstrap.min.css" : BOOTSTRAP_CSS;
      var iconsCss = opts.base ? assets + "vendor/bootstrap-icons/bootstrap-icons.min.css" : ICONS_CSS;
      var bootstrapJs = opts.base ? assets + "vendor/bootstrap/bootstrap.bundle.min.js" : BOOTSTRAP_JS;
      var head = [
        "<!DOCTYPE html>",
        '<html lang="es">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>" + escapeHtml(estado().name || "Landing") + "</title>",
        opts.base ? '  <base href="' + opts.base + '">' : "",
        '  <link href="' + assets + FONTS + '" rel="stylesheet">',
        '  <link href="' + bootstrapCss + '" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous" rel="stylesheet">',
        '  <link href="' + iconsCss + '" integrity="sha384-XGjxtQfXaH2tnPFa9x+ruJTuLE3Aa6LhHSWRr1XeTyhezb4abCG4ccI5AkVDxqC+" crossorigin="anonymous" rel="stylesheet">',
        '  <link href="' + assets + 'css/lanzate.css" rel="stylesheet">',
        clientStyle(entorno.cliente()) ? "  <style>" + clientStyle(entorno.cliente()) + "</style>" : "",
        estado().estilo ? "  <style>\n" + estado().estilo + "\n  </style>" : "",
        /* La paleta va al final: el CSS propio de la plantilla no puede pisarla (así se ve igual que en la vista previa). */
        estado().colores ? "  <style>" + colorStyle(estado().colores) + "</style>" : "",
        "</head>",
        '<body class="landing-page' + (opts.tools ? " has-tools" : "") + (opts.staticPreview ? " lz-static-preview" : "") + '"' + (estado().animacion ? ' data-anim="' + estado().animacion + '"' : "") + ">"
      ].filter(Boolean);
      var menus = estado().items.filter(isMenu).flatMap(function (it) {
        return Array.from(moduleTemplate(it, false, true).tpl.content.querySelectorAll("nav.nx-nav a.nav-link[href]"));
      });
      var menuLinks = estado().items.some(isMenu) ? menus : null;
      var body = estado().items.map(function (it, i) { return moduleMarkup(it, prefix, i, opts.tools ? true : (opts.marks ? "marks" : false), menuLinks); });
      var tail = opts.staticPreview ? [] : [
        '  <script src="' + bootstrapJs + '" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></' + "script>",
        '  <script src="' + assets + 'js/lanzate.js"></' + "script>"
      ];
      if (opts.preview) {
        tail.push("  <script>document.addEventListener('click',function(e){var t=e.target.closest('.lp-tools [data-act]');if(t){parent.postMessage({lbAct:{index:+t.getAttribute('data-index'),act:t.getAttribute('data-act')}},'*');return;}var a=e.target.closest('a[href^=\"#\"]');if(a)e.preventDefault();});</" + "script>");
      }
      if (opts.staticPreview) {
        body = body.map(function (markup) {
          var template = document.createElement("template");
          template.innerHTML = markup;
          var root = template.content;
          root.querySelectorAll("a[href]").forEach(function (link) { link.removeAttribute("href"); });
          var toggle = root.querySelector(".navbar-toggler");
          if (toggle) {
            var menu = document.createElement("details");
            menu.className = "lz-preview-menu";
            var summary = document.createElement("summary");
            summary.textContent = "Menú";
            var links = root.querySelector(".navbar-collapse").cloneNode(true);
            links.removeAttribute("id");
            links.classList.remove("collapse", "navbar-collapse");
            menu.append(summary, links);
            toggle.replaceWith(menu);
          }
          root.querySelectorAll("[data-scroller]").forEach(function (gallery) {
            gallery.querySelectorAll("[data-dir]").forEach(function (button) { button.remove(); });
            var track = gallery.querySelector("[data-track]");
            if (track) {
              track.tabIndex = 0;
              track.setAttribute("aria-label", "Galería de imágenes");
              track.setAttribute("role", "region");
            }
          });
          root.querySelectorAll("form").forEach(function (form) {
            form.setAttribute("inert", "");
            var note = document.createElement("p");
            note.className = "nx-note";
            note.textContent = "Formulario de ejemplo";
            form.after(note);
          });
          return template.innerHTML;
        });
      }
      return head.concat(body, tail, ["</body>", "</html>", ""]).join("\n");
    }

    return { moduleTemplate: moduleTemplate, sectionAnchors: sectionAnchors, corteAplica: corteAplica, isMenu: isMenu,
      moduleMarkup: moduleMarkup, buildDocument: buildDocument };
  }

  var api = {
    crear: crear, socialUrl: socialUrl, leerBiblioteca: leerBiblioteca, armarLanding: armarLanding, imageTokens: imageTokens,
    MARCAS: MARCAS, nombresDe: nombresDe, aNombres: aNombres, aPosiciones: aPosiciones, renombrarRepetidos: renombrarRepetidos,
    brandFont: brandFont, COLOR_MARK: COLOR_MARK, readLandingColors: readLandingColors, stripLandingColors: stripLandingColors,

    FONTS: FONTS, BOOTSTRAP_CSS: BOOTSTRAP_CSS, ICONS_CSS: ICONS_CSS, BOOTSTRAP_JS: BOOTSTRAP_JS, SAMPLE: SAMPLE, SAMPLE_HOURS: SAMPLE_HOURS, SAMPLE_HOURS_TEXT: SAMPLE_HOURS_TEXT, SOCIAL: SOCIAL, DEFAULT_COLORS: DEFAULT_COLORS, CORTES: CORTES, LANDING_FONTS: LANDING_FONTS, AMBIENTES: AMBIENTES, COMMON_MODULE_COLORS: COMMON_MODULE_COLORS, MODULE_COLOR_FIELDS: MODULE_COLOR_FIELDS, EDIT_SEL: EDIT_SEL, IMG_SEL: IMG_SEL, slugify: slugify, escapeHtml: escapeHtml, normalizeHex: normalizeHex, shade: shade, mix: mix, waNumber: waNumber, logoSrc: logoSrc, logoMode: logoMode, clientStyle: clientStyle, corteMarkup: corteMarkup, moduleColorFields: moduleColorFields, paintModuleColors: paintModuleColors, paintFondoNodes: paintFondoNodes, ambientStyle: ambientStyle, colorStyle: colorStyle, ownText: ownText, editableNodes: editableNodes, imageNodes: imageNodes, linkNodes: linkNodes, imageData: imageData, setImage: setImage, setHref: setHref, applyClient: applyClient, syncFooterMenu: syncFooterMenu
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  else global.LanzateArmador = api;
})(typeof window !== "undefined" ? window : globalThis);
