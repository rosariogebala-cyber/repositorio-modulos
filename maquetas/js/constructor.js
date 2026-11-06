(function () {
  "use strict";

  var DRAFT = "lanzate-landing-draft";
  var FONTS = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,620;1,9..144,520&family=Manrope:wght@400;500;600;700&display=swap";
  var BOOTSTRAP_CSS = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";
  var ICONS_CSS = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
  var BOOTSTRAP_JS = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js";

  var $ = function (sel) { return document.querySelector(sel); };
  var nameInput = $("#lbName");
  var picker = $("[data-lb-picker]");
  var orderList = $("[data-lb-order]");
  var orderEmpty = $("[data-lb-order-empty]");
  var countBadge = $("[data-lb-count]");
  var savedList = $("[data-lb-saved]");
  var savedEmpty = $("[data-lb-saved-empty]");
  var savedCount = $("[data-lb-saved-count]");
  var libraryDialog = $("[data-lb-library]");
  var libraryMsg = $("[data-lb-library-msg]");
  var title = $("[data-lb-title]");
  var msg = $("[data-lb-msg]");
  var frame = $("[data-lb-frame]");
  var deviceFrame = $("[data-lb-device-frame]");
  var viewport = $("[data-lb-viewport]");
  var placeholder = $("[data-lb-placeholder]");
  var search = $("[data-lb-search]");
  var settings = $("[data-lb-settings]");
  var allSeg = $("[data-lb-all]");
  var clientSelect = $("[data-lb-client]");
  var modeHint = $("[data-lb-mode]");
  var kicker = $("[data-lb-kicker]");
  var createLabel = $("[data-lb-create-label]");
  var createIcon = $("[data-lb-create-icon]");
  var createBtn = $("[data-lb-create]");
  var newBtn = $("[data-lb-new]");
  var chip = $("[data-lb-chip]");
  var statusEl = $("[data-lb-status]");
  var tabCount = $("[data-lb-tab-count]");
  var orderFoot = $("[data-lb-order-foot]");
  var qaBox = $("[data-lb-qa]");
  var qaLabel = $("[data-lb-qa-label]");
  var qaList = $("[data-lb-qa-list]");
  var api = window.Lanzate.api;
  var DEVICE_NAMES = { 1280: "Escritorio", 820: "Tablet", 390: "Celular" };
  var rules = null;
  var qaReport = null;
  var qaRun = 0;
  var qaBusy = false;
  var qaTimer = null;

  var library = [];
  var byId = {};
  var clients = [];
  var state = { name: "", clienteId: null, landingId: null, items: [], estilo: "" };
  var savedSnapshot = null;
  var busy = false;
  var device = 1280;
  var renderTimer = null;

  function slugify(text) {
    return (text || "landing").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "landing";
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function snapshot() {
    return JSON.stringify([state.name.trim(), state.clienteId, state.items, state.estilo]);
  }
  function isDirty() {
    return state.landingId ? snapshot() !== savedSnapshot : !!(state.items.length || state.name.trim());
  }
  function saveDraft() {
    var draft = Object.assign({}, state, { saved: savedSnapshot });
    try { localStorage.setItem(DRAFT, JSON.stringify(draft)); } catch (e) { /* cuota llena: el borrador queda en memoria */ }
  }
  function say(text, tone, links) {
    msg.textContent = text;
    msg.className = "lb-msg" + (tone ? " is-" + tone : "");
    [].concat(links || []).forEach(function (link) {
      var el;
      if (link.act) {
        el = document.createElement("button");
        el.type = "button";
        el.className = "lb-msg-btn";
        el.setAttribute("data-msg-act", link.act);
      } else {
        el = document.createElement("a");
        el.href = link.href;
        if (link.blank) { el.target = "_blank"; el.rel = "noopener"; }
      }
      el.textContent = link.text;
      msg.append(" ", el);
    });
  }

  function loadLibrary() {
    return fetch("index.html", { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
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
            thumb: "../assets/modulos/" + section.id + "/" + variant + ".png",
            width: nx && nx.getAttribute("data-width") === "full" ? "full" : "contained",
            html: frameEl.innerHTML
          };
          group.modules.push(mod);
          byId[mod.id] = mod;
        });
        if (group.modules.length) library.push(group);
      });
    });
  }

  function renderPicker() {
    var q = (search.value || "").trim().toLowerCase();
    var selected = {};
    state.items.forEach(function (it) { selected[it.id] = true; });
    picker.innerHTML = "";
    library.forEach(function (group) {
      var mods = group.modules.filter(function (m) {
        return !q || (group.name + " " + m.variant + " " + m.note).toLowerCase().indexOf(q) !== -1;
      });
      if (!mods.length) return;
      var on = mods.filter(function (m) { return selected[m.id]; }).length;
      var details = document.createElement("details");
      details.className = "lb-group";
      details.open = !!q || on > 0 || library.indexOf(group) < 2;
      details.innerHTML = '<summary><span>' + escapeHtml(group.name) + '</span><span class="lb-group-count">' + on + " / " + group.modules.length + "</span></summary>";
      var list = document.createElement("div");
      list.className = "lb-mods";
      mods.forEach(function (m) {
        var label = document.createElement("label");
        label.className = "lb-mod" + (selected[m.id] ? " is-on" : "");
        label.innerHTML =
          '<input type="checkbox" value="' + m.id + '"' + (selected[m.id] ? " checked" : "") + ">" +
          '<span class="lb-thumb"><img src="' + m.thumb + '" alt="" loading="lazy"><i class="bi bi-layout-wtf" aria-hidden="true"></i></span>' +
          '<span class="lb-mod-text"><strong>' + escapeHtml(m.variant) + "</strong>" + (m.note ? "<small>" + escapeHtml(m.note) + "</small>" : "") + "</span>" +
          '<i class="bi bi-check-circle-fill lb-check" aria-hidden="true"></i>';
        var img = label.querySelector("img");
        img.addEventListener("error", function () { img.remove(); });
        label.querySelector("input").addEventListener("change", function (e) { toggle(m.id, e.target.checked); });
        list.appendChild(label);
      });
      details.appendChild(list);
      picker.appendChild(details);
    });
    if (!picker.children.length) picker.innerHTML = '<p class="lb-empty">No hay módulos con ese nombre.</p>';
  }

  function toggle(id, on) {
    var idx = state.items.findIndex(function (it) { return it.id === id; });
    if (on && idx === -1) state.items.push({ id: id, width: "full" });
    if (!on && idx !== -1) state.items.splice(idx, 1);
    update();
  }

  function renderOrder() {
    orderList.innerHTML = "";
    state.items.forEach(function (it, i) {
      var m = byId[it.id];
      var li = document.createElement("li");
      li.className = "lb-item";
      li.innerHTML =
        '<span class="lb-item-num">' + String(i + 1).padStart(2, "0") + "</span>" +
        '<span class="lb-item-text"><strong>' + escapeHtml(m.group) + "</strong><small>" + escapeHtml(m.variant) + (it.html ? " · personalizado" : "") + (it.textos ? " · textos editados" : "") + (it.imagenes ? " · imágenes cambiadas" : "") + "</small></span>" +
        '<span class="lb-seg lb-item-seg" role="group" aria-label="Ancho de ' + escapeHtml(m.group) + '">' +
        '<button type="button" data-act="width" data-value="contained" aria-pressed="' + (it.width !== "full") + '"><i class="bi bi-layout-three-columns"></i> Márgenes</button>' +
        '<button type="button" data-act="width" data-value="full" aria-pressed="' + (it.width === "full") + '"><i class="bi bi-arrows-angle-expand"></i> Ancho completo</button>' +
        "</span>" +
        '<span class="lb-item-tools">' +
        '<button type="button" data-act="up" aria-label="Subir ' + escapeHtml(m.group) + '"' + (i === 0 ? " disabled" : "") + '><i class="bi bi-arrow-up"></i></button>' +
        '<button type="button" data-act="down" aria-label="Bajar ' + escapeHtml(m.group) + '"' + (i === state.items.length - 1 ? " disabled" : "") + '><i class="bi bi-arrow-down"></i></button>' +
        '<button type="button" data-act="remove" aria-label="Quitar ' + escapeHtml(m.group) + '"><i class="bi bi-x-lg"></i></button>' +
        "</span>";
      li.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-act]");
        if (!btn) return;
        var act = btn.getAttribute("data-act");
        if (act === "width") { setWidth(i, btn.getAttribute("data-value")); return; }
        if (act === "up" && i > 0) state.items.splice(i - 1, 0, state.items.splice(i, 1)[0]);
        if (act === "down" && i < state.items.length - 1) state.items.splice(i + 1, 0, state.items.splice(i, 1)[0]);
        if (act === "remove") state.items.splice(i, 1);
        update();
      });
      orderList.appendChild(li);
    });
    var n = state.items.length;
    countBadge.textContent = n + (n === 1 ? " módulo" : " módulos");
    tabCount.textContent = n;
    orderEmpty.hidden = n > 0;
    orderFoot.hidden = n === 0;
    settings.hidden = n === 0;
    renderSettings();
  }

  function pressSeg(seg, value) {
    seg.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-value") === value));
    });
  }

  function renderSettings() {
    var widths = state.items.map(function (it) { return it.width; });
    var same = widths.length && widths.every(function (w) { return w === widths[0]; }) ? widths[0] : "";
    pressSeg(allSeg, same);
  }

  function frameDoc() {
    try { return frame.contentDocument && frame.contentDocument.body ? frame.contentDocument : null; } catch (e) { return null; }
  }

  function patchFrame() {
    var doc = frameDoc();
    if (!doc) return;
    doc.querySelectorAll("body > section.mq-block").forEach(function (section, i) {
      var it = state.items[i];
      if (!it) return;
      section.setAttribute("data-width", it.width);
      section.querySelectorAll(".mq-frame .nx").forEach(function (el) {
        if (!el.parentElement.closest(".nx")) el.setAttribute("data-width", it.width);
      });
      section.querySelectorAll(".lp-tools [data-value]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-value") === it.width));
      });
    });
  }

  function refreshLight() {
    renderMode();
    renderOrder();
    patchFrame();
    saveDraft();
    scheduleQa(500);
  }

  function setWidth(index, width) {
    if (!state.items[index] || state.items[index].width === width) return;
    state.items[index].width = width;
    refreshLight();
  }

  function previewTools(it, i) {
    var m = byId[it.id];
    return '\n    <div class="lp-tools" role="group" aria-label="Ancho de ' + escapeHtml(m.group) + '">' +
      "<span>" + String(i + 1).padStart(2, "0") + " · " + escapeHtml(m.group) + "</span>" +
      '<button type="button" data-index="' + i + '" data-value="contained" aria-pressed="' + (it.width !== "full") + '"><i class="bi bi-layout-three-columns"></i> Márgenes</button>' +
      '<button type="button" data-index="' + i + '" data-value="full" aria-pressed="' + (it.width === "full") + '"><i class="bi bi-arrows-angle-expand"></i> Ancho completo</button>' +
      "</div>";
  }

  /* Datos del cliente: reemplazan los de ejemplo de las maquetas */
  var SAMPLE = { nombre: "Marca Ejemplo", email: "hola@example.com", telefono: "+54 11 2345 6789", wa: "5491123456789" };
  var DEFAULT_COLORS = { c1: "#1b5e42", c2: "#e7f3ee" };

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

  function applyClient(root, c, preview) {
    if (!c) return;
    function literal(s) { return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"); }
    var pairs = [[literal(" · Datos de ejemplo"), ""]];
    if (c.nombre) pairs.push([new RegExp(SAMPLE.nombre, "gi"), c.nombre]);
    if (c.email) pairs.push([literal(SAMPLE.email), c.email]);
    if (c.telefono) pairs.push([literal(SAMPLE.telefono), c.telefono]);
    function swap(text) {
      pairs.forEach(function (p) { text = text.replace(p[0], function () { return p[1]; }); });
      return text;
    }
    var walker = document.createTreeWalker(root, 4);
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
      el.setAttribute("href", href);
    });
    var logo = logoSrc(c, preview);
    if (logo) {
      root.querySelectorAll(".nx-brand").forEach(function (el) {
        el.innerHTML = '<img class="nx-brand-logo" src="' + escapeHtml(logo) + '" alt="' + escapeHtml(c.nombre) + '">';
      });
    }
  }

  function shade(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    return "#" + [16, 8, 0].map(function (s) {
      var v = Math.round(((n >> s) & 255) * (1 + amount));
      return ("0" + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    }).join("");
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

  /* Textos editables: cada módulo guarda sus cambios en it.textos, por posición */
  var EDIT_SEL = "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, dt, dd, a, button, label, .nx-kicker, .plan-kicker, .badge";

  function ownText(el) {
    return Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && /\S/.test(n.nodeValue); });
  }

  function editableNodes(root) {
    var all = Array.prototype.filter.call(root.querySelectorAll(EDIT_SEL), function (el) {
      return /\S/.test(el.textContent) && !el.closest(".nx-brand, .lp-tools, script, style, svg, select, .visually-hidden");
    });
    var set = new Set(all);
    return all.filter(function (el) {
      for (var p = el.parentElement; p; p = p.parentElement) { if (set.has(p) && ownText(p)) return false; }
      return ownText(el) || !all.some(function (o) { return o !== el && el.contains(o); });
    });
  }

  /* Imágenes editables: cada módulo guarda en it.imagenes { src, alt } por posición */
  var IMG_SEL = "img, [style*='background-image']";

  function imageNodes(root) {
    return Array.prototype.filter.call(root.querySelectorAll(IMG_SEL), function (el) {
      return !el.closest(".nx-brand, .lp-tools, script, style, svg");
    });
  }

  function imageData(el) {
    if (el.tagName === "IMG") return { src: el.getAttribute("src") || "", alt: el.getAttribute("alt") || "" };
    var m = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(el.style.backgroundImage || "");
    return { src: m ? m[1] : "" };
  }

  function setImage(el, data) {
    if (data.src) {
      if (el.tagName === "IMG") {
        el.setAttribute("src", data.src);
        el.removeAttribute("srcset");
        el.removeAttribute("sizes");
      } else {
        el.style.backgroundImage = 'url("' + data.src + '")';
      }
    }
    if (el.tagName === "IMG" && data.alt != null) el.setAttribute("alt", data.alt);
  }

  function moduleTemplate(it, preview, withTexts) {
    var tpl = document.createElement("template");
    tpl.innerHTML = it.html || byId[it.id].html;
    var nodes = editableNodes(tpl.content);
    var images = imageNodes(tpl.content);
    applyClient(tpl.content, currentClient(), preview);
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
    return { tpl: tpl, nodes: nodes, images: images };
  }

  function moduleMarkup(it, prefix, i, preview) {
    var tpl = moduleTemplate(it, preview, true).tpl;
    tpl.content.querySelectorAll(".nx").forEach(function (el) {
      if (!el.parentElement || !el.parentElement.closest(".nx")) el.setAttribute("data-width", it.width);
    });
    var html = tpl.innerHTML;
    if (prefix) {
      html = html
        .replace(/(src|href|data-src)="(img|css|js)\//g, '$1="' + prefix + "$2/")
        .replace(/(src|href)="\.\.\/assets\//g, '$1="' + prefix + "../assets/")
        .replace(/url\((['"]?)(img\/|\.\.\/assets\/)/g, "url($1" + prefix + "$2");
    }
    return '  <section class="mq-block" data-module="' + it.id + '" data-width="' + it.width + '">\n    <div class="mq-frame">' + html + "</div>" +
      (preview ? previewTools(it, i) : "") + "\n  </section>";
  }

  function buildDocument(opts) {
    var prefix = opts.prefix || "";
    var head = [
      "<!DOCTYPE html>",
      '<html lang="es">',
      "<head>",
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      "  <title>" + escapeHtml(state.name || "Landing") + "</title>",
      opts.base ? '  <base href="' + opts.base + '">' : "",
      '  <link rel="preconnect" href="https://fonts.googleapis.com">',
      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '  <link href="' + FONTS + '" rel="stylesheet">',
      '  <link href="' + BOOTSTRAP_CSS + '" rel="stylesheet">',
      '  <link href="' + ICONS_CSS + '" rel="stylesheet">',
      '  <link href="' + prefix + 'css/lanzate.css" rel="stylesheet">',
      clientStyle(currentClient()) ? "  <style>" + clientStyle(currentClient()) + "</style>" : "",
      state.estilo ? "  <style>\n" + state.estilo + "\n  </style>" : "",
      "</head>",
      '<body class="landing-page' + (opts.tools ? " has-tools" : "") + '">'
    ].filter(Boolean);
    var body = state.items.map(function (it, i) { return moduleMarkup(it, prefix, i, opts.tools); });
    var tail = [
      '  <script src="' + BOOTSTRAP_JS + '"></' + "script>",
      '  <script src="' + prefix + 'js/lanzate.js"></' + "script>"
    ];
    if (opts.preview) {
      tail.push("  <script>document.addEventListener('click',function(e){var t=e.target.closest('.lp-tools [data-value]');if(t){parent.postMessage({lbWidth:{index:+t.getAttribute('data-index'),width:t.getAttribute('data-value')}},'*');return;}var a=e.target.closest('a[href^=\"#\"]');if(a)e.preventDefault();});</" + "script>");
    }
    return head.concat(body, tail, ["</body>", "</html>", ""]).join("\n");
  }

  function baseUrl() { return new URL("./", location.href).href; }

  function fitPreview() {
    var avail = viewport.clientWidth - 32;
    var scale = Math.min(1, avail / device);
    deviceFrame.style.width = device + "px";
    deviceFrame.style.transform = "scale(" + scale + ")";
    deviceFrame.style.marginLeft = Math.max(0, (avail - device * scale) / 2) + "px";
    var h = frame.offsetHeight;
    viewport.style.height = state.items.length ? (h * scale + 32) + "px" : "";
  }

  function syncFrameHeight() {
    try {
      var doc = frame.contentDocument;
      if (!doc || !doc.body) return;
      frame.style.height = Math.max(400, doc.documentElement.scrollHeight) + "px";
      fitPreview();
    } catch (e) { /* noop */ }
  }

  frame.addEventListener("load", function () {
    syncFrameHeight();
    try {
      var win = frame.contentWindow;
      if (win.ResizeObserver) new win.ResizeObserver(syncFrameHeight).observe(frame.contentDocument.body);
    } catch (e) { /* noop */ }
    setupEditing();
    scheduleQa(300);
  });

  /* Edición de textos sobre la vista previa */
  var editBtn = $("[data-lb-edit]");
  var editMode = false;
  var editing = null;
  var EDIT_CSS =
    ".lb-editing [data-lb-t]{cursor:text;outline:1px dashed rgba(90,61,242,.55);outline-offset:3px;border-radius:2px}" +
    ".lb-editing [data-lb-t]:hover{outline:2px solid #5a3df2}" +
    "[data-lb-t][contenteditable]{outline:2px solid #5a3df2!important;background:rgba(255,255,255,.85);color:#0e1130;caret-color:#5a3df2}" +
    "#lbEditTip{position:absolute;z-index:2147483000;display:flex;align-items:center;gap:.6em;padding:.45em .8em;border-radius:999px;background:#0e1130;color:#fff;font:600 13px/1.2 Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);white-space:nowrap}" +
    "#lbEditTip[hidden]{display:none}#lbEditTip .is-over{color:#ff8a80}#lbEditTip .is-under{color:#ffd27a}" +
    "#lbEditTip button{border:0;background:none;color:#d5f660;font:inherit;text-decoration:underline;cursor:pointer;padding:0}" +
    ".lb-editing [data-lb-i]{cursor:pointer;outline:2px dashed rgba(213,246,96,.95);outline-offset:-2px;box-shadow:inset 0 0 0 4px rgba(90,61,242,.45)}" +
    ".lb-editing [data-lb-i]:hover,[data-lb-i].lb-img-on{outline:3px solid #5a3df2!important;outline-offset:-3px}" +
    "#lbImgTip{position:absolute;z-index:2147483000;display:flex;flex-direction:column;gap:.55em;width:min(22em,calc(100vw - 16px));padding:.8em .9em;border-radius:14px;background:#0e1130;color:#fff;font:500 13px/1.35 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3)}" +
    "#lbImgTip[hidden]{display:none}#lbImgTip b{font-weight:700}#lbImgTip small{color:#c9cbe0;font-size:.9em;text-wrap:pretty}#lbImgTip .is-bad{color:#ff8a80}" +
    "#lbImgTip .lb-img-row{display:flex;flex-wrap:wrap;gap:.5em;align-items:center}" +
    "#lbImgTip button{border:0;border-radius:999px;padding:.5em .95em;font:700 1em/1 Inter,system-ui,sans-serif;cursor:pointer;background:#d5f660;color:#0e1130}" +
    "#lbImgTip button.is-ghost{background:none;color:#d5f660;text-decoration:underline;padding:.5em .2em}" +
    "#lbImgTip button.is-save{background:#5a3df2;color:#fff}#lbImgTip button.is-save:disabled{background:#2b2f52;color:#c9cbe0;cursor:default}#lbImgTip button[hidden]{display:none}" +
    "#lbImgTip button.lb-img-x{position:absolute;top:.35em;right:.4em;background:none;color:#fff;font-size:1.4em;padding:.1em .35em}" +
    "#lbImgTip>div:first-of-type{padding-right:1.8em}" +
    "#lbImgTip label{display:flex;flex-direction:column;gap:.3em;font-size:.92em;color:#c9cbe0}" +
    "#lbImgTip input{width:100%;border:1px solid #2b2f52;border-radius:8px;padding:.5em .6em;font:500 1em/1.2 Inter,system-ui,sans-serif;color:#0e1130;background:#fff}";

  function moduleIndex(el) {
    var doc = frameDoc();
    var section = el.closest("section.mq-block");
    return doc && section ? Array.prototype.indexOf.call(doc.querySelectorAll("body > section.mq-block"), section) : -1;
  }

  function cleanEdited(el) {
    var copy = el.cloneNode(true);
    copy.querySelectorAll("script, style").forEach(function (n) { n.remove(); });
    [copy].concat(Array.prototype.slice.call(copy.querySelectorAll("*"))).forEach(function (n) {
      ["contenteditable", "spellcheck", "data-lb-t"].forEach(function (a) { n.removeAttribute(a); });
    });
    return copy.innerHTML.replace(/(<br>)+$/, "");
  }

  function originalText(it, key) {
    var el = moduleTemplate(it, true, false).nodes[key];
    return el ? el.innerHTML : null;
  }

  function editTip() {
    var doc = frameDoc();
    var tip = doc.getElementById("lbEditTip");
    if (!tip) {
      tip = doc.createElement("div");
      tip.id = "lbEditTip";
      tip.hidden = true;
      tip.addEventListener("pointerdown", function (e) { e.preventDefault(); });
      tip.addEventListener("click", function (e) {
        if (!e.target.closest("[data-lb-revert]") || !editing) return;
        var orig = originalText(state.items[editing.module], editing.key);
        if (orig != null) editing.el.innerHTML = orig;
        commitEdit();
      });
      doc.body.appendChild(tip);
    }
    return tip;
  }

  function renderTip() {
    if (!editing) return;
    var doc = frameDoc();
    var tip = editTip();
    var role = rules && window.LanzateReglas ? window.LanzateReglas.textRole(editing.el, rules) : null;
    var len = editing.el.textContent.replace(/\s+/g, " ").trim().length;
    var tone = role && role.max && len > role.max ? "is-over" : role && role.min && len < role.min ? "is-under" : "";
    var it = state.items[editing.module];
    var changed = it && it.textos && it.textos[editing.key] != null;
    tip.innerHTML = (role ? "<span>" + escapeHtml(role.label) + "</span>" : "") +
      '<span class="' + tone + '">' + len + (role && role.max ? " / " + role.max : "") + " caracteres</span>" +
      (changed ? '<button type="button" data-lb-revert>Volver al original</button>' : "");
    var scale = frame.getBoundingClientRect().width / frame.offsetWidth || 1;
    tip.style.fontSize = Math.round(13 / scale) + "px";
    tip.hidden = false;
    var r = editing.el.getBoundingClientRect();
    var win = doc.defaultView;
    var top = r.top + win.scrollY - tip.offsetHeight - 10;
    if (top < win.scrollY) top = r.bottom + win.scrollY + 10;
    tip.style.top = top + "px";
    tip.style.left = Math.max(8, Math.min(r.left + win.scrollX, doc.documentElement.clientWidth - tip.offsetWidth - 8)) + "px";
  }

  function commitEdit() {
    if (!editing) return;
    var it = state.items[editing.module];
    if (!it) return;
    var html = cleanEdited(editing.el);
    it.textos = it.textos || {};
    if (html === originalText(it, editing.key)) delete it.textos[editing.key];
    else it.textos[editing.key] = html;
    if (!Object.keys(it.textos).length) delete it.textos;
    var section = editing.el.closest("section.mq-block");
    section.querySelectorAll('[data-lb-t="' + editing.key + '"]').forEach(function (o) { if (o !== editing.el) o.innerHTML = html; });
    renderMode();
    renderOrder();
    saveDraft();
    renderTip();
    scheduleQa(900);
  }

  function beginEdit(el, focus) {
    if (editing && editing.el === el) return;
    endEdit();
    editing = { el: el, module: moduleIndex(el), key: el.getAttribute("data-lb-t"), start: el.innerHTML };
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "true");
    if (focus) {
      el.focus();
      var sel = el.ownerDocument.getSelection();
      sel.selectAllChildren(el);
      sel.collapseToEnd();
    }
    renderTip();
  }

  function endEdit() {
    if (!editing) return;
    var el = editing.el;
    commitEdit();
    el.removeAttribute("contenteditable");
    el.removeAttribute("spellcheck");
    editing = null;
    var doc = frameDoc();
    var tip = doc && doc.getElementById("lbEditTip");
    if (tip) tip.hidden = true;
    scheduleQa(200);
  }

  function setEditMode(on) {
    editMode = on;
    editBtn.setAttribute("aria-pressed", String(on));
    var doc = frameDoc();
    if (doc) doc.body.classList.toggle("lb-editing", on);
    if (!on) { endEdit(); closeImage(); }
  }

  function setupEditing() {
    var doc = frameDoc();
    if (!doc) return;
    editing = null;
    imgSel = null;
    doc.addEventListener("slid.bs.carousel", function (e) {
      if (imgSel && e.target.contains(imgSel.el) && !imgSel.el.closest(".carousel-item.active")) closeImage();
    });
    var style = doc.createElement("style");
    style.textContent = EDIT_CSS;
    doc.head.appendChild(style);
    doc.body.classList.toggle("lb-editing", editMode);
    doc.addEventListener("pointerdown", function (e) {
      if (!editMode || e.target.closest("#lbEditTip, #lbImgTip, [data-bs-slide], [data-bs-slide-to]")) return;
      var el = e.target.closest("[data-lb-t]");
      if (el) { closeImage(); beginEdit(el); return; }
      var img = e.target.closest("[data-lb-i]");
      if (img) selectImage(img);
      else closeImage();
    }, true);
    doc.addEventListener("click", function (e) {
      if (!editMode || e.target.closest(".lp-tools, #lbEditTip, #lbImgTip, [data-bs-slide], [data-bs-slide-to]")) return;
      if (e.target.closest("[data-lb-t], [data-lb-i], a, button")) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    doc.addEventListener("keydown", function (e) {
      if (!editing || !editing.el.contains(e.target)) return;
      if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); doc.execCommand("insertLineBreak"); }
      else if (e.key === "Enter") { e.preventDefault(); editing.el.blur(); }
      else if (e.key === "Escape") { e.preventDefault(); editing.el.innerHTML = editing.start; editing.el.blur(); }
      else if (e.key === " " && editing.el.closest("button")) { e.preventDefault(); doc.execCommand("insertText", false, " "); }
    }, true);
    doc.addEventListener("input", function (e) {
      if (editing && editing.el.contains(e.target)) commitEdit();
    }, true);
    doc.addEventListener("paste", function (e) {
      if (!editing || !editing.el.contains(e.target)) return;
      e.preventDefault();
      doc.execCommand("insertText", false, (e.clipboardData.getData("text/plain") || "").replace(/\s+/g, " "));
    }, true);
    doc.addEventListener("focusout", function (e) {
      if (editing && e.target === editing.el) endEdit();
    }, true);
  }

  editBtn.addEventListener("click", function () {
    setEditMode(!editMode);
    if (editMode) say("Tocá un texto para cambiarlo o una foto para reemplazarla. Enter para terminar, Esc para deshacer.", "ok");
  });

  function editElement(el) {
    setEditMode(true);
    scrollToEl(el);
    beginEdit(el, true);
  }

  /* Edición de imágenes sobre la vista previa */
  var imgSel = null;
  var imgInput = document.createElement("input");
  imgInput.type = "file";
  imgInput.accept = "image/jpeg,image/png,image/webp,image/avif,image/svg+xml";
  imgInput.hidden = true;
  document.body.appendChild(imgInput);

  function imageRoleOf(el) {
    return rules && window.LanzateReglas && window.LanzateReglas.imageRole ? window.LanzateReglas.imageRole(el, rules) : null;
  }

  function originalImage(it, key) {
    var el = moduleTemplate(it, true, false).images[key];
    return el ? imageData(el) : null;
  }

  function minLabel(role) {
    if (!role || (!role.minAncho && !role.minAlto)) return "";
    return role.minAncho && role.minAlto ? role.minAncho + "×" + role.minAlto + "\u00a0px"
      : role.minAncho ? role.minAncho + "\u00a0px de\u00a0ancho" : role.minAlto + "\u00a0px de\u00a0alto";
  }

  function imgTip() {
    var doc = frameDoc();
    var tip = doc.getElementById("lbImgTip");
    if (!tip) {
      tip = doc.createElement("div");
      tip.id = "lbImgTip";
      tip.hidden = true;
      tip.addEventListener("click", function (e) {
        if (!imgSel) return;
        if (e.target.closest("[data-img-pick]")) pickImage();
        else if (e.target.closest("[data-img-save]")) createLanding();
        else if (e.target.closest("[data-img-revert]")) revertImage();
        else if (e.target.closest("[data-img-close]")) closeImage();
      });
      tip.addEventListener("input", function (e) {
        if (imgSel && e.target.matches("[data-img-alt]")) commitImage({ alt: e.target.value });
      });
      tip.addEventListener("keydown", function (e) {
        if (e.key === "Escape" || (e.key === "Enter" && e.target.matches("[data-img-alt]"))) { e.preventDefault(); closeImage(); }
      });
      doc.body.appendChild(tip);
    }
    return tip;
  }

  function renderImgTip() {
    if (!imgSel) return;
    var el = imgSel.el;
    var tip = imgTip();
    var role = imageRoleOf(el);
    var it = state.items[imgSel.module];
    var changed = !!(it && it.imagenes && it.imagenes[imgSel.key]);
    var data = imageData(el);
    var need = minLabel(role);
    var isImg = el.tagName === "IMG";
    var probe = new Image();
    var sizeId = "lbImgSize" + Date.now();
    tip.innerHTML =
      '<button type="button" class="lb-img-x" data-img-close aria-label="Cerrar">×</button>' +
      "<div><b>" + escapeHtml(role ? role.label : "Imagen") + "</b><br><small><span id=\"" + sizeId + "\">Midiendo…</span>" + (need ? " · mínimo " + need : "") + "</small></div>" +
      (isImg ? '<label>Descripción (alt)<input type="text" data-img-alt maxlength="' + ((rules && rules.imagenes.altMax) || 125) + '" value="' + escapeHtml(data.alt || "") + '" placeholder="Qué se ve en la foto"></label>' : "") +
      '<div class="lb-img-row"><button type="button" data-img-pick>Cambiar imagen</button>' +
      '<button type="button" class="is-save" data-img-save hidden></button>' +
      (changed ? '<button type="button" class="is-ghost" data-img-revert>Volver a la original</button>' : "") + "</div>";
    renderImgSave();
    probe.onload = function () {
      var span = tip.querySelector("#" + sizeId);
      if (!span) return;
      var small = role && ((role.minAncho && probe.naturalWidth < role.minAncho) || (role.minAlto && probe.naturalHeight < role.minAlto));
      span.textContent = "Mide " + probe.naturalWidth + "×" + probe.naturalHeight + "\u00a0px";
      span.className = small ? "is-bad" : "";
    };
    probe.onerror = function () {
      var span = tip.querySelector("#" + sizeId);
      if (span) { span.textContent = "No carga"; span.className = "is-bad"; }
    };
    try { probe.src = new URL(data.src, frameDoc().baseURI).href; } catch (e) { probe.onerror(); }
    var scale = frame.getBoundingClientRect().width / frame.offsetWidth || 1;
    tip.style.fontSize = Math.round(13 / scale) + "px";
    tip.hidden = false;
    var doc = frameDoc();
    var win = doc.defaultView;
    var r = el.getBoundingClientRect();
    var top = Math.max(r.top, 0) + win.scrollY + 12;
    tip.style.top = top + "px";
    tip.style.left = Math.max(8, Math.min(r.left + win.scrollX + 12, doc.documentElement.clientWidth - tip.offsetWidth - 8)) + "px";
  }

  function renderImgSave() {
    var doc = imgSel && frameDoc();
    var btn = doc && doc.querySelector("#lbImgTip [data-img-save]");
    if (!btn) return;
    var dirty = isDirty();
    btn.hidden = !dirty && !state.landingId;
    btn.disabled = busy || !dirty;
    btn.textContent = busy ? "Guardando…" : !dirty ? "Guardada ✓" : state.landingId ? "Guardar" : "Crear landing";
  }

  function showSlide(el) {
    var item = el.closest(".carousel-item");
    var win = frameDoc().defaultView;
    if (!item || !win.bootstrap) return false;
    var carousel = win.bootstrap.Carousel.getOrCreateInstance(item.closest(".carousel"));
    carousel.pause();
    if (item.classList.contains("active")) return false;
    carousel.to(Array.prototype.indexOf.call(item.parentElement.children, item));
    return true;
  }

  function selectImage(el) {
    if (imgSel && imgSel.el === el) return;
    closeImage();
    endEdit();
    imgSel = { el: el, module: moduleIndex(el), key: el.getAttribute("data-lb-i") };
    el.classList.add("lb-img-on");
    if (showSlide(el)) setTimeout(renderImgTip, 700);
    renderImgTip();
  }

  function closeImage() {
    if (!imgSel) return;
    imgSel.el.classList.remove("lb-img-on");
    imgSel = null;
    var doc = frameDoc();
    var tip = doc && doc.getElementById("lbImgTip");
    if (tip) tip.hidden = true;
    scheduleQa(200);
  }

  function commitImage(change) {
    var it = state.items[imgSel.module];
    if (!it) return;
    var orig = originalImage(it, imgSel.key) || {};
    var cur = Object.assign({}, it.imagenes && it.imagenes[imgSel.key], change);
    if (cur.src === orig.src) delete cur.src;
    if (cur.alt != null && cur.alt === (orig.alt || "")) delete cur.alt;
    it.imagenes = it.imagenes || {};
    if (Object.keys(cur).length) it.imagenes[imgSel.key] = cur;
    else delete it.imagenes[imgSel.key];
    if (!Object.keys(it.imagenes).length) delete it.imagenes;
    var data = { src: change.src, alt: change.alt };
    imgSel.el.closest("section.mq-block").querySelectorAll('[data-lb-i="' + imgSel.key + '"]').forEach(function (o) { setImage(o, data); });
    renderMode();
    renderOrder();
    saveDraft();
    scheduleQa(900);
  }

  function revertImage() {
    var orig = originalImage(state.items[imgSel.module], imgSel.key);
    if (!orig) return;
    commitImage(orig);
    renderImgTip();
    say("La imagen volvió a la original.", "ok");
  }

  function pickImage() {
    imgInput.value = "";
    imgInput.click();
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen. Probá con JPG, PNG o WEBP.")); };
      img.src = url;
    });
  }

  function readDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("No se pudo leer el archivo.")); };
      reader.readAsDataURL(file);
    });
  }

  function compressImage(img, role) {
    var maxW = Math.max((role && role.minAncho) || 0, 1920);
    var maxH = Math.max((role && role.minAlto) || 0, 1920);
    var ratio = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * ratio);
    canvas.height = Math.round(img.naturalHeight * ratio);
    var ctx = canvas.getContext("2d");
    var webp = canvas.toDataURL("image/webp", 0.8).indexOf("data:image/webp") === 0;
    if (!webp) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    var type = webp ? "image/webp" : "image/jpeg";
    var maxBytes = ((role && role.maxKB) || 300) * 1024;
    var out = "";
    for (var q = 0.86; q >= 0.5; q -= 0.08) {
      out = canvas.toDataURL(type, q);
      if (out.length * 0.75 <= maxBytes) break;
    }
    return { src: out, w: canvas.width, h: canvas.height, kb: Math.round(out.length * 0.75 / 1024) };
  }

  imgInput.addEventListener("change", function () {
    var file = imgInput.files && imgInput.files[0];
    if (!file || !imgSel) return;
    var sel = imgSel;
    var role = imageRoleOf(sel.el);
    var svg = /svg/.test(file.type);
    say("Preparando la imagen…");
    var job = svg ? readDataUrl(file).then(function (src) { return { src: src, svg: true }; })
      : loadImage(file).then(function (res) {
        var out = compressImage(res.img, role);
        URL.revokeObjectURL(res.url);
        return out;
      });
    job.then(function (out) {
      if (imgSel !== sel) selectImage(sel.el);
      commitImage({ src: out.src });
      renderImgTip();
      if (out.svg) { say("Imagen cambiada.", "ok"); return; }
      var small = role && ((role.minAncho && out.w < role.minAncho) || (role.minAlto && out.h < role.minAlto));
      say(small
        ? "Imagen cambiada, pero mide " + out.w + "×" + out.h + " px y el mínimo es " + minLabel(role) + ". Buscá una versión más grande."
        : "Imagen cambiada: " + out.w + "×" + out.h + " px, " + out.kb + " KB.", small ? "warn" : "ok");
    }).catch(function (err) { say(err.message, "warn"); });
  });

  function editImage(el, focusAlt) {
    setEditMode(true);
    scrollToEl(el);
    selectImage(el);
    var input = focusAlt && frameDoc().querySelector("#lbImgTip [data-img-alt]");
    if (input) { input.focus(); input.select(); }
    else if (!focusAlt) pickImage();
  }

  /* IA: sugerir módulos y escribir textos. Solo con el servidor local: la clave nunca llega al navegador. */
  var aiBar = $("[data-lb-ai]");
  var aiModulesBtn = $("[data-lb-ai-modules]");
  var aiTextsBtn = $("[data-lb-ai-texts]");
  var aiDialog = $("[data-lb-ia-dialog]");
  var aiProvider = $("[data-lb-ia-provider]");
  var aiKey = $("[data-lb-ia-key]");
  var aiModel = $("[data-lb-ia-model]");
  var aiHint = $("[data-lb-ia-hint]");
  var aiMsg = $("[data-lb-ia-msg]");
  var AI_MODELS = { anthropic: "claude-haiku-5-5", openai: "gpt-6-luna" };
  var AI_KEYS = { anthropic: "https://console.anthropic.com/settings/keys", openai: "https://platform.openai.com/api-keys" };
  var ai = null;
  var aiBusy = false;
  var aiAfter = null;
  var aiUndo = null;

  function loadAi() {
    api("GET", "/api/ia").then(function (data) { ai = data; renderAi(); }, function () { ai = null; renderAi(); });
  }

  function renderAi() {
    aiBar.hidden = !ai;
    aiTextsBtn.hidden = !ai || !state.items.length;
  }

  function aiSay(text, tone) {
    aiMsg.textContent = text || "";
    aiMsg.className = "lb-msg" + (tone ? " is-" + tone : "");
  }

  function renderAiHint() {
    var p = aiProvider.value;
    aiModel.placeholder = AI_MODELS[p];
    aiKey.placeholder = p === "openai" ? "sk-…" : "sk-ant-…";
    var saved = ai && ai.configurada && ai.proveedor === p;
    aiHint.innerHTML = (saved ? "Ya hay una clave guardada: dejá el campo vacío para mantenerla. " : "") +
      '<a href="' + AI_KEYS[p] + '" target="_blank" rel="noopener">Conseguí tu clave&nbsp;acá</a>.';
  }

  function openAiConfig(then) {
    aiProvider.value = ai.proveedor;
    aiKey.value = "";
    aiModel.value = ai.modelo !== AI_MODELS[ai.proveedor] ? ai.modelo : "";
    aiAfter = then || null;
    renderAiHint();
    aiSay("");
    aiDialog.showModal();
    aiKey.focus();
  }

  function withAi(fn) {
    if (!ai || aiBusy) return;
    if (ai.configurada) fn();
    else openAiConfig(fn);
  }

  function aiRequest(btn, body, waitText) {
    aiBusy = true;
    aiModulesBtn.disabled = aiTextsBtn.disabled = true;
    btn.classList.add("is-busy");
    say(waitText);
    return api("POST", "/api/ia", body).catch(function (err) {
      var config = /clave|Configurá/i.test(err.message);
      say(err.message, "warn", config ? { act: "ia-config", text: "Configurar IA" } : []);
      throw err;
    }).finally(function () {
      aiBusy = false;
      aiModulesBtn.disabled = aiTextsBtn.disabled = false;
      btn.classList.remove("is-busy");
    });
  }

  function aiClient() {
    var c = currentClient() || {};
    return { nombre: c.nombre || "", rubro: c.rubro || "", notas: c.notas || "", sitio: c.sitio || "" };
  }

  function suggestModules() {
    if (!currentClient()) {
      say("Elegí el cliente primero: la IA arma la propuesta según su rubro.", "warn");
      clientSelect.focus();
      return;
    }
    if (state.items.length && !window.confirm("La sugerencia reemplaza los " + state.items.length + " módulos que elegiste. ¿Seguimos?")) return;
    var names = {};
    library.forEach(function (g) { names[g.id] = g.name; });
    var catalogo = [];
    library.forEach(function (g) {
      g.modules.forEach(function (m) { catalogo.push({ id: m.id, grupo: g.name, variante: m.variant, nota: m.note }); });
    });
    var reglas = rules && window.LanzateReglas ? window.LanzateReglas.toPrompt(rules, names).split("\nTEXTOS")[0] : "";
    aiRequest(aiModulesBtn, { tarea: "modulos", cliente: aiClient(), objetivo: state.name.trim(), catalogo: catalogo, reglas: reglas },
      "La IA está eligiendo los módulos para " + currentClient().nombre + "…").then(function (data) {
      aiUndo = JSON.stringify(state.items);
      state.items = data.modulos.map(function (id) { return { id: id, width: "full" }; });
      update();
      showTab("order");
      say("La IA sugirió " + data.modulos.length + " módulos. " + data.motivo, "ok", { act: "ia-undo", text: "Deshacer" });
    }, function () { /* el error ya se mostró */ });
  }

  function aiTextList() {
    var doc = frameDoc();
    var out = [];
    if (!doc) return out;
    doc.querySelectorAll("body > section.mq-block").forEach(function (section, m) {
      var it = state.items[m];
      if (!it) return;
      var seen = {};
      section.querySelectorAll("[data-lb-t]").forEach(function (el) {
        var k = el.getAttribute("data-lb-t");
        if (seen[k] || el.closest(".lp-tools, .nav-link, a[href^='mailto:'], a[href^='tel:'], a[href*='wa.me']")) return;
        seen[k] = true;
        var text = window.LanzateReglas.norm(el.textContent);
        if (text.length < 2 || /@|^\+?[\d\s().-]{6,}$/.test(text)) return;
        var role = rules ? window.LanzateReglas.textRole(el, rules) : null;
        out.push({
          id: m + "." + k,
          seccion: byId[it.id].group,
          tipo: role ? role.label : "Texto",
          min: role && role.min || 0,
          max: role && role.max || 0,
          actual: text
        });
      });
    });
    return out;
  }

  function aiHtml(el, text) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    var keep = function (n) { return n && (n.nodeType === 1 ? n.matches("i, svg, img, .bi") : !/\S/.test(n.nodeValue)); };
    var piece = function (n) { return n.nodeType === 1 ? n.outerHTML : n.nodeValue; };
    var lead = "";
    var trail = "";
    while (keep(nodes[0])) lead += piece(nodes.shift());
    while (keep(nodes[nodes.length - 1])) trail = piece(nodes.pop()) + trail;
    if (lead && !/\s$/.test(lead) && nodes[0] && /^\s/.test(nodes[0].textContent)) lead += " ";
    if (trail && !/^\s/.test(trail) && nodes.length && /\s$/.test(nodes[nodes.length - 1].textContent)) trail = " " + trail;
    var body = escapeHtml(text.replace(/^["«“]+|["»”]+$/g, ""));
    body = el.querySelector("em") ? body.replace(/\*([^*]+)\*/g, "<em>$1</em>") : body.replace(/\*/g, "");
    return lead + body + trail;
  }

  function writeTexts() {
    var textos = aiTextList();
    if (!textos.length) { say("Todavía no hay textos en la vista previa. Sumá módulos y esperá a que cargue.", "warn"); return; }
    if (!currentClient()) {
      say("Elegí el cliente primero: la IA escribe los textos para su negocio.", "warn");
      clientSelect.focus();
      return;
    }
    setEditMode(false);
    aiRequest(aiTextsBtn, { tarea: "textos", cliente: aiClient(), objetivo: state.name.trim(), textos: textos },
      "La IA está escribiendo " + textos.length + " textos para " + currentClient().nombre + ". Puede tardar un minuto…").then(function (data) {
      var doc = frameDoc();
      var sections = doc ? doc.querySelectorAll("body > section.mq-block") : [];
      var prev = JSON.stringify(state.items);
      var count = 0;
      data.textos.forEach(function (t) {
        var parts = t.id.split(".");
        var it = state.items[Number(parts[0])];
        var el = sections[Number(parts[0])] && sections[Number(parts[0])].querySelector('[data-lb-t="' + parts[1] + '"]');
        if (!it || !el) return;
        var html = aiHtml(el, t.texto);
        it.textos = it.textos || {};
        if (html === originalText(it, parts[1])) delete it.textos[parts[1]];
        else it.textos[parts[1]] = html;
        if (!Object.keys(it.textos).length) delete it.textos;
        count++;
      });
      aiUndo = prev;
      renderMode();
      renderOrder();
      renderPreview();
      saveDraft();
      say("La IA escribió " + count + " textos. Revisalos en la vista previa: con «Editar textos y fotos» podés ajustar cualquiera.", "ok", { act: "ia-undo", text: "Deshacer" });
    }, function () { /* el error ya se mostró */ });
  }

  function undoAi() {
    if (!aiUndo) return;
    state.items = JSON.parse(aiUndo);
    aiUndo = null;
    update();
    say("Listo, volvió todo a como estaba antes de la IA.", "ok");
  }

  aiModulesBtn.addEventListener("click", function () { withAi(suggestModules); });
  aiTextsBtn.addEventListener("click", function () { withAi(writeTexts); });
  $("[data-lb-ai-config]").addEventListener("click", function () { if (ai) openAiConfig(); });
  $("[data-lb-ia-close]").addEventListener("click", function () { aiDialog.close(); });
  aiDialog.addEventListener("click", function (e) { if (e.target === aiDialog) aiDialog.close(); });
  aiProvider.addEventListener("change", renderAiHint);
  $("[data-lb-ia-form]").addEventListener("submit", function (e) {
    e.preventDefault();
    var saveBtn = $("[data-lb-ia-save]");
    saveBtn.disabled = true;
    aiSay("Guardando…");
    api("PUT", "/api/ia", { proveedor: aiProvider.value, clave: aiKey.value.trim(), modelo: aiModel.value.trim() })
      .then(function (data) {
        ai = data;
        aiKey.value = "";
        aiDialog.close();
        say("IA lista: " + data.nombre + " con el modelo " + data.modelo + ".", "ok");
        var next = aiAfter;
        aiAfter = null;
        if (next) next();
      }, function (err) { aiSay(err.message, "warn"); })
      .then(function () { saveBtn.disabled = false; });
  });

  /* Control de calidad: revisa la vista previa con las reglas de reglas.html */
  function qaItems() {
    return state.items.map(function (it) { return { groupId: byId[it.id].groupId, group: byId[it.id].group }; });
  }

  function scheduleQa(delay) {
    clearTimeout(qaTimer);
    qaTimer = setTimeout(runQa, delay || 0);
  }

  function runQa() {
    if (!rules) return;
    var run = ++qaRun;
    if (!state.items.length) { qaReport = null; qaBusy = false; renderQa(); renderMode(); return; }
    var doc = frameDoc();
    qaBusy = true;
    renderQa();
    var fonts = doc && doc.fonts ? doc.fonts.ready.catch(function () {}) : Promise.resolve();
    fonts.then(function () {
      return window.LanzateReglas.check({ doc: frameDoc(), win: frame.contentWindow, items: qaItems(), rules: rules, name: state.name,
        groupNames: library.reduce(function (acc, g) { acc[g.id] = g.name; return acc; }, {}) });
    }).then(function (report) {
      if (run !== qaRun) return;
      qaReport = report;
      qaBusy = false;
      renderQa();
      renderMode();
    }).catch(function () {
      if (run !== qaRun) return;
      qaBusy = false;
      renderQa();
    });
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function renderQa() {
    qaBox.hidden = !rules || !state.items.length;
    if (qaBox.hidden) return;
    var r = qaReport;
    var tone = !r ? "" : r.errors ? "is-error" : r.warnings ? "is-aviso" : "is-ok";
    qaBox.className = "lb-qa " + tone + (qaBusy ? " is-running" : "");
    qaBox.querySelector(".lb-qa-sum i").className = "bi " + (tone === "is-ok" ? "bi-patch-check-fill" : tone === "is-error" ? "bi-exclamation-octagon-fill" : tone === "is-aviso" ? "bi-exclamation-triangle-fill" : "bi-shield-check");
    if (!r) qaLabel.textContent = "Revisando calidad…";
    else if (!r.issues.length) qaLabel.textContent = "La landing cumple todas las reglas";
    else qaLabel.textContent = [r.errors ? plural(r.errors, "error", "errores") : "", r.warnings ? plural(r.warnings, "aviso", "avisos") : ""].filter(Boolean).join(" · ") +
      " en " + (DEVICE_NAMES[device] || "la vista previa").toLowerCase() + (rules.general.bloquear && r.errors ? ". Se guarda cuando no quedan errores." : "");
    if (!r) return;
    var list = r.issues.slice().sort(function (x, y) {
      return (x.level === y.level ? 0 : x.level === "error" ? -1 : 1) || ((x.module == null ? -1 : x.module) - (y.module == null ? -1 : y.module));
    });
    qaList.hidden = !list.length;
    qaList.innerHTML = list.map(function (issue) {
      var it = issue.module == null ? null : state.items[issue.module];
      var where = it ? String(issue.module + 1).padStart(2, "0") + " · " + byId[it.id].group : "Toda la landing";
      return '<li class="lb-qa-item is-' + issue.level + '">' +
        '<span class="rg-tag is-' + issue.level + '">' + (issue.level === "error" ? "Error" : "Aviso") + "</span>" +
        '<span class="lb-qa-text"><b>' + escapeHtml(issue.text) + "</b><small>" + escapeHtml(where) + (issue.detail ? " · " + escapeHtml(issue.detail) : "") + "</small></span>" +
        '<span class="lb-qa-acts">' +
        (fixAction(issue) ? '<button type="button" class="lb-qa-fix" data-qa-fix="' + r.issues.indexOf(issue) + '">Corregir</button>' : "") +
        (issue.el || issue.module != null ? '<button type="button" class="lb-link" data-qa-show="' + r.issues.indexOf(issue) + '">Ver</button>' : "") +
        "</span></li>";
    }).join("");
  }

  function scrollToEl(el) {
    var frameRect = frame.getBoundingClientRect();
    var scale = frameRect.width / frame.offsetWidth || 1;
    var top = window.scrollY + frameRect.top + el.getBoundingClientRect().top * scale - 140;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function showIssue(issue) {
    var doc = frameDoc();
    if (!doc) return;
    var el = issue.el && issue.el.isConnected ? issue.el : doc.querySelectorAll("body > section.mq-block")[issue.module];
    while (el && el.parentElement && !(el.getClientRects().length && el.getBoundingClientRect().height > 0)) el = el.parentElement;
    if (!el) return;
    if (!doc.getElementById("lbQaStyle")) {
      var style = doc.createElement("style");
      style.id = "lbQaStyle";
      style.textContent = ".lb-qa-flag{outline:4px solid #e5484d!important;outline-offset:-4px!important;animation:lbQaPulse 1.2s ease-in-out 3}@keyframes lbQaPulse{50%{outline-color:rgba(229,72,77,.3)}}";
      doc.head.appendChild(style);
    }
    scrollToEl(el);
    el.classList.add("lb-qa-flag");
    setTimeout(function () { el.classList.remove("lb-qa-flag"); }, 3200);
  }

  /* «Corregir»: lleva al lugar donde se arregla cada problema */
  var EXAMPLE_FIELDS = { "example.com": "email", "5491123456789": "telefono", "Marca Ejemplo": "nombre" };
  var FIELD_NAMES = { email: "el email", telefono: "el teléfono", nombre: "el nombre" };

  function editableFor(el) {
    if (!el || !el.isConnected) return null;
    return el.closest("[data-lb-t]") || el.querySelector("[data-lb-t]");
  }

  function findText(module, text) {
    var doc = frameDoc();
    var section = doc && doc.querySelectorAll("body > section.mq-block")[module];
    if (!section) return null;
    var low = text.toLowerCase();
    return Array.prototype.find.call(section.querySelectorAll("[data-lb-t]"), function (el) {
      return el.textContent.toLowerCase().indexOf(low) !== -1;
    }) || null;
  }

  function joinLastWords(el) {
    var walker = el.ownerDocument.createTreeWalker(el, 4);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);
    for (var i = nodes.length - 1; i >= 0; i--) {
      var next = nodes[i].nodeValue.replace(/(\S)[ \t\n]+(\S+\s*)$/, "$1\u00a0$2");
      if (next !== nodes[i].nodeValue) { nodes[i].nodeValue = next; return true; }
      if (/\s\S/.test(nodes[i].nodeValue)) return false;
    }
    return false;
  }

  function openClientForm(field) {
    var client = currentClient();
    if (!client) { goTo("client"); return; }
    window.Lanzate.clientForm(client).then(function (saved) {
      if (!saved || saved.deleted) return;
      loadClients().then(function () {
        renderPreview();
        renderMode();
        saveDraft();
        say("Datos de «" + saved.nombre + "» actualizados: la landing ya los usa.", "ok");
      });
    });
    var input = document.querySelector(field === "logo" ? "dialog[open] [data-pf-logo-input]" : 'dialog[open] [name="' + field + '"]');
    if (input && field === "logo") input = input.closest("label") || input;
    if (input) setTimeout(function () { input.focus(); }, 60);
  }

  function fixAction(issue) {
    if (issue.ejemplo) {
      var field = EXAMPLE_FIELDS[issue.ejemplo];
      var client = currentClient();
      if (!client) return function () { goTo("client"); say("Elegí el cliente: sus datos reemplazan a los de ejemplo.", "warn"); };
      if (field && !client[field]) return function () { openClientForm(field); say("Completá " + FIELD_NAMES[field] + " de «" + client.nombre + "»: se aplica solo en toda la landing.", "ok"); };
      var target = findText(issue.module, issue.ejemplo);
      return target ? function () { editElement(target); } : null;
    }
    if (issue.area === "textos") {
      var el = editableFor(issue.el);
      if (!el) return null;
      if (issue.viuda) {
        return function () {
          beginEdit(el);
          var ok = joinLastWords(el);
          endEdit();
          say(ok ? "Listo: las dos últimas palabras quedaron unidas." : "Ese texto no tiene dos palabras para unir.", ok ? "ok" : "warn");
        };
      }
      return function () { editElement(el); };
    }
    if (issue.area === "imagenes" && issue.el && issue.el.isConnected) {
      if (issue.el.closest(".nx-brand")) {
        return function () {
          if (!currentClient()) { goTo("client"); return; }
          openClientForm("logo");
          say("Subí el logo de «" + currentClient().nombre + "»: se aplica solo en toda la landing.", "ok");
        };
      }
      var img = issue.el.closest("[data-lb-i]");
      if (!img) return null;
      var alt = /texto alternativo/i.test(issue.text);
      return function () { editImage(img, alt); };
    }
    if (issue.regla === "obligatorio" || issue.regla === "sumar") {
      return function () {
        var group = library.filter(function (g) { return g.id === issue.grupo; })[0];
        showTab("add");
        search.value = group ? group.name : "";
        renderPicker();
        search.scrollIntoView({ behavior: "smooth", block: "center" });
        search.focus({ preventScroll: true });
      };
    }
    if (issue.regla === "orden") {
      return function () { showTab("order"); orderList.scrollIntoView({ behavior: "smooth", block: "center" }); };
    }
    if (issue.regla === "nombre") return function () { nameInput.focus(); nameInput.select(); };
    return null;
  }

  qaList.addEventListener("click", function (e) {
    if (!qaReport) return;
    var show = e.target.closest("[data-qa-show]");
    if (show) showIssue(qaReport.issues[Number(show.getAttribute("data-qa-show"))]);
    var fix = e.target.closest("[data-qa-fix]");
    var act = fix && fixAction(qaReport.issues[Number(fix.getAttribute("data-qa-fix"))]);
    if (act) act();
  });

  function renderPreview() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      var has = state.items.length > 0;
      placeholder.hidden = has;
      deviceFrame.hidden = !has;
      if (!has) { viewport.style.height = ""; scheduleQa(0); return; }
      frame.srcdoc = buildDocument({ base: baseUrl(), preview: true, tools: true });
      fitPreview();
    }, 220);
  }

  function update() {
    renderMode();
    renderOrder();
    renderPicker();
    renderPreview();
    saveDraft();
  }

  function currentClient() {
    return clients.find(function (c) { return c.id === state.clienteId; }) || null;
  }

  function missing() {
    var out = [];
    if (!state.clienteId) out.push({ key: "client", text: "Elegí el cliente" });
    if (!state.name.trim()) out.push({ key: "name", text: "Ponele un nombre" });
    if (!state.items.length) out.push({ key: "items", text: "Sumá módulos" });
    if (rules && rules.general.bloquear && state.items.length && qaReport && qaReport.errors) {
      out.push({ key: "qa", text: "Corregí " + (qaReport.errors === 1 ? "1 error" : qaReport.errors + " errores") + " de calidad" });
    }
    return out;
  }

  function stepDone(n, done) {
    var step = document.querySelector('[data-lb-step="' + n + '"]');
    if (step) step.classList.toggle("is-done", done);
  }

  function renderMode() {
    var client = currentClient();
    var editing = !!state.landingId;
    var dirty = isDirty();
    var todo = missing();
    title.textContent = state.name.trim() || "Landing sin nombre";
    chip.innerHTML = editing ? '<i class="bi bi-pencil-square"></i> Editando' : '<i class="bi bi-stars"></i> Nueva landing';
    chip.classList.toggle("is-editing", editing);
    kicker.textContent = client ? client.nombre : "";
    createLabel.textContent = editing ? (dirty ? "Guardar cambios" : "Guardada") : "Crear landing";
    createIcon.className = "bi " + (editing ? (dirty ? "bi-floppy" : "bi-check2") : "bi-plus-circle");
    createBtn.disabled = busy || (editing && !dirty && !todo.length);
    createBtn.classList.toggle("is-pending", todo.length > 0);
    createBtn.title = todo.length ? "Falta: " + todo.map(function (t) { return t.text.toLowerCase(); }).join(", ") : "";
    newBtn.hidden = !editing;
    editBtn.hidden = !state.items.length;
    renderAi();
    renderImgSave();
    stepDone(1, !!state.clienteId && !!state.name.trim());
    stepDone(2, state.items.length > 0);

    if (todo.length) {
      statusEl.className = "lb-status";
      statusEl.innerHTML = '<span class="lb-status-lead">Para ' + (editing ? "guardar" : "crear la landing") + " falta:</span>" +
        todo.map(function (t) { return '<button type="button" class="lb-todo" data-todo="' + t.key + '"><i class="bi bi-arrow-right-short"></i>' + t.text + "</button>"; }).join("");
    } else if (editing) {
      statusEl.className = "lb-status" + (dirty ? " is-dirty" : " is-ok");
      statusEl.innerHTML = dirty
        ? '<span class="lb-dot" aria-hidden="true"></span> Tenés cambios sin guardar.'
        : '<i class="bi bi-check-circle-fill"></i> Todos los cambios están guardados.';
    } else {
      statusEl.className = "lb-status is-ok";
      statusEl.innerHTML = '<i class="bi bi-check-circle-fill"></i> Todo listo: tocá «Crear landing».';
    }

    modeHint.className = "lb-hint lb-mode";
    modeHint.textContent = client
      ? "Se publica en /l/" + client.slug + "/" + (state.name.trim() ? slugify(state.name) + "/" : "")
      : "Cada landing se publica con el nombre de su cliente.";
  }

  function showTab(name) {
    document.querySelectorAll("[data-lb-tab]").forEach(function (tab) {
      tab.setAttribute("aria-selected", String(tab.getAttribute("data-lb-tab") === name));
    });
    document.querySelectorAll("[data-lb-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-lb-panel") !== name;
    });
  }

  function renderClients() {
    clientSelect.innerHTML = '<option value="">Elegí un cliente</option>' + clients.map(function (c) {
      return '<option value="' + c.id + '">' + escapeHtml(c.nombre) + (c.estado === "pausado" ? " (pausado)" : "") + "</option>";
    }).join("");
    if (state.clienteId && !currentClient()) state.clienteId = null;
    clientSelect.value = state.clienteId ? String(state.clienteId) : "";
  }

  function loadClients() {
    return api("GET", "/api/clientes").then(function (list) {
      clients = list;
      renderClients();
    }).catch(function (err) {
      clientSelect.innerHTML = '<option value="">Sin conexión con el servidor</option>';
      say(err.message, "warn");
    });
  }

  function libSay(text, tone) {
    libraryMsg.textContent = text || "";
    libraryMsg.className = "lb-msg" + (tone ? " is-" + tone : "");
  }

  function loadLanding(lp) {
    state = {
      name: lp.nombre,
      clienteId: lp.cliente_id,
      landingId: lp.id,
      items: (lp.items || []).filter(function (it) { return byId[it.id]; }).map(function (it) {
        var item = { id: it.id, width: it.width };
        if (it.html) item.html = it.html;
        if (it.textos) item.textos = it.textos;
        if (it.imagenes) item.imagenes = it.imagenes;
        return item;
      }),
      estilo: lp.estilo || ""
    };
    savedSnapshot = snapshot();
    nameInput.value = state.name;
    clientSelect.value = String(state.clienteId);
    update();
  }

  function confirmDiscard() {
    return !state.landingId || !isDirty() ||
      window.confirm("Tenés cambios sin guardar en «" + (state.name.trim() || "esta landing") + "». ¿Querés descartarlos?");
  }

  function editLanding(lp) {
    if (lp.id !== state.landingId && !confirmDiscard()) return;
    loadLanding(lp);
    libraryDialog.close();
    say("Editando «" + lp.nombre + "» de " + lp.cliente + ".", "ok");
  }

  function renderSaved() {
    return api("GET", "/api/landings").then(function (list) {
      savedList.innerHTML = "";
      list.forEach(function (lp) {
        savedList.appendChild(window.Lanzate.landingRow(lp, { showClient: true, onEdit: editLanding, onChange: renderSaved, onMessage: libSay }));
      });
      savedCount.textContent = list.length;
      savedEmpty.hidden = list.length > 0;
      if (state.landingId && !list.some(function (lp) { return lp.id === state.landingId; })) {
        state.landingId = null;
        savedSnapshot = null;
        renderMode();
        saveDraft();
      }
    }).catch(function (err) {
      savedList.innerHTML = "";
      savedCount.textContent = "–";
      savedEmpty.hidden = true;
      libSay(err.message, "warn");
    });
  }

  function download(html, fileName) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function goTo(key) {
    if (key === "client" || key === "name") { openAssign(); return; }
    if (key === "qa") { qaBox.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    showTab("add");
    search.scrollIntoView({ behavior: "smooth", block: "center" });
    search.focus({ preventScroll: true });
  }

  var assignDialog = $("[data-lb-assign-dialog]");
  var assignClient = $("[data-lb-assign-client]");
  var assignName = $("[data-lb-assign-name]");
  var assignMsg = $("[data-lb-assign-msg]");

  function fillAssignClients() {
    assignClient.innerHTML = '<option value="">Elegí un cliente</option>' + clients.map(function (c) {
      return '<option value="' + c.id + '">' + escapeHtml(c.nombre) + (c.estado === "pausado" ? " (pausado)" : "") + "</option>";
    }).join("");
    assignClient.value = state.clienteId ? String(state.clienteId) : "";
  }

  var assignCreates = false;

  function openAssign(create) {
    assignCreates = !!create;
    fillAssignClients();
    assignName.value = state.name;
    assignMsg.textContent = "";
    assignMsg.className = "lb-msg";
    $("[data-lb-assign-label]").textContent = !create ? "Listo" : state.landingId ? "Guardar" : "Crear landing";
    assignDialog.showModal();
    (assignClient.value ? assignName : assignClient).focus();
  }

  $("[data-lb-assign-close]").addEventListener("click", function () { assignDialog.close(); });

  $("[data-lb-assign-new]").addEventListener("click", function () {
    window.Lanzate.clientForm(null).then(function (client) {
      if (!client || client.deleted) return;
      loadClients().then(function () {
        fillAssignClients();
        assignClient.value = String(client.id);
        assignName.focus();
      });
    });
  });

  $("[data-lb-assign-form]").addEventListener("submit", function (e) {
    e.preventDefault();
    var id = Number(assignClient.value) || null;
    var name = assignName.value.trim();
    if (!id || !name) {
      assignMsg.textContent = !id ? "Elegí el cliente o dalo de alta con «Nuevo cliente»." : "Ponele un nombre a la landing.";
      assignMsg.className = "lb-msg is-warn";
      (!id ? assignClient : assignName).focus();
      return;
    }
    state.clienteId = id;
    state.name = name;
    clientSelect.value = String(id);
    nameInput.value = name;
    assignDialog.close();
    renderMode();
    renderPreview();
    saveDraft();
    if (assignCreates) createLanding();
  });

  /* Vercel acepta hasta 4,5 MB por pedido: las fotos viajan una sola vez, dentro de items */
  var MAX_SAVE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 38 * 1048576 : 4.3 * 1048576;

  function imageTokens(html) {
    state.items.forEach(function (it, i) {
      Object.keys(it.imagenes || {}).forEach(function (k) {
        var src = it.imagenes[k].src;
        if (src && src.indexOf("data:") === 0) html = html.split(src).join("lzimg:" + i + ":" + k);
      });
    });
    return html;
  }

  function createLanding() {
    var todo = missing();
    if (todo.some(function (t) { return t.key === "client" || t.key === "name"; })) { openAssign(true); return; }
    if (todo.length) { goTo(todo[0].key); return; }
    var html = buildDocument({ prefix: "" });
    var editing = !!state.landingId;
    var body = { cliente_id: state.clienteId, nombre: state.name.trim(), html: imageTokens(html), items: state.items, estilo: state.estilo };
    var payload = JSON.stringify(body);
    if (payload.length > MAX_SAVE) {
      say("La landing pesa " + (payload.length / 1048576).toFixed(1).replace(".", ",") + " MB y el máximo para guardar es " +
        (MAX_SAVE / 1048576).toFixed(1).replace(".", ",") + " MB. Usá menos fotos o más livianas.", "warn");
      return;
    }
    busy = true;
    renderMode();
    say((editing ? "Guardando «" : "Creando «") + body.nombre + "»…");
    (editing ? api("PUT", "/api/landings/" + state.landingId, payload) : api("POST", "/api/landings", payload))
      .then(function (data) {
        state.landingId = data.id;
        if (data.cliente_id && data.cliente_id !== state.clienteId) {
          state.clienteId = data.cliente_id;
          loadClients().then(function () {
            clientSelect.value = String(state.clienteId);
            savedSnapshot = snapshot();
            saveDraft();
            renderMode();
          });
        }
        savedSnapshot = snapshot();
        saveDraft();
        renderSaved();
        if (editing) {
          say("Cambios guardados y publicados.", "ok", { href: data.url, text: "Abrir landing", blank: true });
        } else {
          say("¡Listo! Creaste «" + body.nombre + "» para " + data.cliente + ".", "ok", [
            { href: data.url, text: "Abrir landing", blank: true },
            { href: "landings.html", text: "Ver en Landings" },
            { act: "new", text: "Crear otra" }
          ]);
        }
      })
      .catch(function (err) {
        if (!err.offline) { say(err.message, "warn"); return; }
        download(html, slugify(state.name) + ".html");
        say("No se pudo guardar: revisá la conexión y volvé a intentarlo. Mientras tanto se descargó el HTML.", "warn");
      })
      .then(function () { busy = false; renderMode(); });
  }

  function startNew(clienteId) {
    state = { name: "", clienteId: clienteId || null, landingId: null, items: [], estilo: "" };
    savedSnapshot = null;
    nameInput.value = "";
    clientSelect.value = state.clienteId ? String(state.clienteId) : "";
    search.value = "";
    showTab("add");
    update();
  }

  function newLanding() {
    if (!confirmDiscard()) return;
    startNew(state.clienteId);
    say("Landing nueva: completá los datos y elegí los módulos.", "ok");
    nameInput.focus();
  }

  clientSelect.addEventListener("change", function () {
    state.clienteId = clientSelect.value ? Number(clientSelect.value) : null;
    renderMode();
    renderPreview();
    saveDraft();
  });

  statusEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-todo]");
    if (btn) goTo(btn.getAttribute("data-todo"));
  });

  msg.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-msg-act]");
    if (btn && btn.getAttribute("data-msg-act") === "new") newLanding();
    if (btn && btn.getAttribute("data-msg-act") === "ia-undo") undoAi();
    if (btn && btn.getAttribute("data-msg-act") === "ia-config" && ai) openAiConfig();
  });

  newBtn.addEventListener("click", newLanding);

  document.querySelectorAll("[data-lb-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () { showTab(tab.getAttribute("data-lb-tab")); });
  });

  $("[data-lb-new-client]").addEventListener("click", function () {
    window.Lanzate.clientForm(null).then(function (client) {
      if (!client || client.deleted) return;
      state.clienteId = client.id;
      loadClients().then(function () {
        renderMode();
        renderPreview();
        saveDraft();
        say("Se dio de alta «" + client.nombre + "» y quedó elegido para esta landing.", "ok");
      });
    });
  });

  $("[data-lb-create]").addEventListener("click", function () {
    createLanding();
  });

  $("[data-lb-library-open]").addEventListener("click", function () {
    libSay("");
    renderSaved();
    libraryDialog.showModal();
  });
  $("[data-lb-library-close]").addEventListener("click", function () { libraryDialog.close(); });
  libraryDialog.addEventListener("click", function (e) {
    if (e.target === libraryDialog) libraryDialog.close();
  });

  $("[data-lb-open]").addEventListener("click", function () {
    if (!state.items.length) { say("Tildá al menos un módulo para ver la vista previa.", "warn"); return; }
    var url = URL.createObjectURL(new Blob([buildDocument({ base: baseUrl(), preview: true })], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
  });

  allSeg.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-value]");
    if (!btn) return;
    state.items.forEach(function (it) { it.width = btn.getAttribute("data-value"); });
    refreshLight();
  });

  window.addEventListener("message", function (e) {
    if (e.source !== frame.contentWindow || !e.data || !e.data.lbWidth) return;
    setWidth(e.data.lbWidth.index, e.data.lbWidth.width);
  });

  $("[data-lb-clear]").addEventListener("click", function () {
    state.items = [];
    update();
  });

  document.querySelectorAll("[data-lb-device]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      device = Number(btn.getAttribute("data-lb-device"));
      document.querySelectorAll("[data-lb-device]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      fitPreview();
      setTimeout(syncFrameHeight, 350);
      scheduleQa(450);
    });
  });

  nameInput.addEventListener("input", function () {
    state.name = nameInput.value;
    renderMode();
    saveDraft();
    scheduleQa(600);
  });
  search.addEventListener("input", renderPicker);
  window.addEventListener("resize", fitPreview);
  if (window.ResizeObserver) {
    var lastViewportW = 0;
    new ResizeObserver(function () {
      if (viewport.clientWidth === lastViewportW) return;
      lastViewportW = viewport.clientWidth;
      fitPreview();
    }).observe(viewport);
  }

  // Al entrar sin parámetros se arranca una landing nueva; una guardada solo se retoma si quedaron cambios sin guardar.
  function restoreDraft() {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT)); } catch (e) { /* noop */ }
    if (!draft || !Array.isArray(draft.items)) return null;
    state = {
      name: draft.name || "",
      clienteId: draft.clienteId || null,
      landingId: draft.landingId || null,
      items: draft.items.filter(function (it) { return byId[it.id]; }),
      estilo: draft.estilo || ""
    };
    savedSnapshot = draft.saved || null;
    if (!state.landingId) return state.items.length || state.name.trim() ? { kind: "draft" } : null;
    if (savedSnapshot && isDirty()) return { kind: "unsaved", name: state.name };
    var last = { kind: "last", id: state.landingId, name: state.name };
    state = { name: "", clienteId: state.clienteId, landingId: null, items: [], estilo: "" };
    savedSnapshot = null;
    return last;
  }

  function start() {
    var params = new URLSearchParams(location.search);
    var landingId = Number(params.get("landing"));
    var clienteId = Number(params.get("cliente"));
    if (params.toString()) history.replaceState(null, "", location.pathname);
    if (landingId) {
      return api("GET", "/api/landings/" + landingId).then(function (lp) {
        loadLanding(lp);
        say("Editando «" + lp.nombre + "» de " + lp.cliente + ".", "ok");
      }).catch(function (err) {
        restoreDraft();
        nameInput.value = state.name;
        update();
        say(err.message, "warn");
      });
    }
    if (clienteId) {
      startNew(clienteId);
      var client = currentClient();
      if (client) say("Landing nueva para " + client.nombre + ".", "ok");
      return;
    }
    var restored = restoreDraft();
    nameInput.value = state.name;
    renderClients();
    update();
    if (!restored) return;
    if (restored.kind === "draft") {
      say("Recuperamos la landing que estabas armando.", "", { act: "new", text: "Empezar de cero" });
    } else if (restored.kind === "unsaved") {
      say("Recuperamos los cambios sin guardar de «" + restored.name + "».", "", { act: "new", text: "Crear una nueva" });
    } else {
      say("La última vez trabajaste en «" + restored.name + "».", "", { href: "constructor.html?landing=" + restored.id, text: "Seguir editándola" });
    }
  }

  if (window.LanzateReglas) {
    window.LanzateReglas.load().then(function (loaded) {
      rules = loaded;
      scheduleQa(0);
    });
  }

  Promise.all([loadLibrary(), loadClients()]).then(function () {
    renderClients();
    start();
    renderSaved();
    loadAi();
  }).catch(function () {
    picker.innerHTML = '<p class="lb-empty">No se pudieron cargar los módulos. Abrí esta página desde el servidor local (http://), no como archivo.</p>';
  });
})();
