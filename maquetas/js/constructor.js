(function () {
  "use strict";

  var DRAFT = "nexoia-landing-draft";
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
  var api = window.Nexoia.api;
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
        '<span class="lb-item-text"><strong>' + escapeHtml(m.group) + "</strong><small>" + escapeHtml(m.variant) + (it.html ? " · personalizado" : "") + (it.textos ? " · textos editados" : "") + "</small></span>" +
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
  var SAMPLE = { nombre: "Nexoia", email: "hola@example.com", telefono: "+54 11 2345 6789", wa: "5491123456789" };
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
    if (!c) return "";
    if (/^data:/.test(c.logo_url || "")) return c.logo_url;
    if (!c.logo) return "";
    return (preview ? "../" : "../../../") + c.logo + (preview && c.actualizado ? "?v=" + c.actualizado : "");
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
      if (c.nombre) href = href.replace("q=" + SAMPLE.nombre, "q=" + encodeURIComponent(c.nombre).replace(/%20/g, "+"));
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

  function moduleTemplate(it, preview, withTexts) {
    var tpl = document.createElement("template");
    tpl.innerHTML = it.html || byId[it.id].html;
    var nodes = editableNodes(tpl.content);
    applyClient(tpl.content, currentClient(), preview);
    var textos = withTexts && it.textos || {};
    nodes.forEach(function (el, k) {
      if (textos[k] != null) el.innerHTML = textos[k];
      if (preview) el.setAttribute("data-lb-t", k);
    });
    return { tpl: tpl, nodes: nodes };
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
      '  <link href="' + prefix + 'css/nexoia.css" rel="stylesheet">',
      clientStyle(currentClient()) ? "  <style>" + clientStyle(currentClient()) + "</style>" : "",
      state.estilo ? "  <style>\n" + state.estilo + "\n  </style>" : "",
      "</head>",
      '<body class="landing-page' + (opts.tools ? " has-tools" : "") + '">'
    ].filter(Boolean);
    var body = state.items.map(function (it, i) { return moduleMarkup(it, prefix, i, opts.tools); });
    var tail = [
      '  <script src="' + BOOTSTRAP_JS + '"></' + "script>",
      '  <script src="' + prefix + 'js/nexoia.js"></' + "script>"
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
    ".lb-editing [data-lb-t]{cursor:text;outline:1px dashed rgba(27,94,66,.5);outline-offset:3px;border-radius:2px}" +
    ".lb-editing [data-lb-t]:hover{outline:2px solid #1b5e42}" +
    "[data-lb-t][contenteditable]{outline:2px solid #1b5e42!important;background:rgba(255,255,255,.85);color:#17352c;caret-color:#1b5e42}" +
    "#lbEditTip{position:absolute;z-index:2147483000;display:flex;align-items:center;gap:.6em;padding:.45em .8em;border-radius:999px;background:#0b1736;color:#fff;font:600 13px/1.2 Manrope,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);white-space:nowrap}" +
    "#lbEditTip[hidden]{display:none}#lbEditTip .is-over{color:#ff8a80}#lbEditTip .is-under{color:#ffd27a}" +
    "#lbEditTip button{border:0;background:none;color:#9fd8bd;font:inherit;text-decoration:underline;cursor:pointer;padding:0}";

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
    var role = rules && window.NexoiaReglas ? window.NexoiaReglas.textRole(editing.el, rules) : null;
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
    if (!on) endEdit();
  }

  function setupEditing() {
    var doc = frameDoc();
    if (!doc) return;
    editing = null;
    var style = doc.createElement("style");
    style.textContent = EDIT_CSS;
    doc.head.appendChild(style);
    doc.body.classList.toggle("lb-editing", editMode);
    doc.addEventListener("pointerdown", function (e) {
      if (!editMode || e.target.closest("#lbEditTip")) return;
      var el = e.target.closest("[data-lb-t]");
      if (el) beginEdit(el);
    }, true);
    doc.addEventListener("click", function (e) {
      if (!editMode || e.target.closest(".lp-tools, #lbEditTip")) return;
      if (e.target.closest("[data-lb-t], a, button")) { e.preventDefault(); e.stopPropagation(); }
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
    if (editMode) say("Tocá cualquier texto de la vista previa para cambiarlo. Enter para terminar, Esc para deshacer.", "ok");
  });

  function editElement(el) {
    setEditMode(true);
    scrollToEl(el);
    beginEdit(el, true);
  }

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
      return window.NexoiaReglas.check({ doc: frameDoc(), win: frame.contentWindow, items: qaItems(), rules: rules, name: state.name });
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
  var EXAMPLE_FIELDS = { "example.com": "email", "5491123456789": "telefono", "Nexoia": "nombre" };
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
    window.Nexoia.clientForm(client).then(function (saved) {
      if (!saved || saved.deleted) return;
      loadClients().then(function () {
        renderPreview();
        renderMode();
        saveDraft();
        say("Datos de «" + saved.nombre + "» actualizados: la landing ya los usa.", "ok");
      });
    });
    var input = document.querySelector('dialog[open] [name="' + field + '"]');
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
    var browserOnly = window.NexoiaGitHub && !window.NexoiaGitHub.connected();
    modeHint.textContent = browserOnly
      ? "Se guarda en este navegador. Después la podés publicar en el link."
      : client
      ? "Se guarda en Templates/" + client.slug + "/" + (state.name.trim() ? slugify(state.name) + "/" : "")
      : "Cada landing se guarda en la carpeta de su cliente.";
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
        savedList.appendChild(window.Nexoia.landingRow(lp, { showClient: true, onEdit: editLanding, onChange: renderSaved, onMessage: libSay }));
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
    if (key === "client") { clientSelect.focus(); return; }
    if (key === "name") { nameInput.focus(); return; }
    if (key === "qa") { qaBox.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    showTab("add");
    search.scrollIntoView({ behavior: "smooth", block: "center" });
    search.focus({ preventScroll: true });
  }

  function createLanding() {
    var todo = missing();
    if (todo.length) { goTo(todo[0].key); return; }
    var html = buildDocument({ prefix: "" });
    var editing = !!state.landingId;
    var body = { cliente_id: state.clienteId, nombre: state.name.trim(), html: html, items: state.items, estilo: state.estilo };
    busy = true;
    renderMode();
    say((editing ? "Guardando «" : "Creando «") + body.nombre + "»…");
    (editing ? api("PUT", "/api/landings/" + state.landingId, body) : api("POST", "/api/landings", body))
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
        var later = data.publicando ? " Queda online en 1 o 2 minutos." : "";
        if (data.local) {
          say((editing ? "Cambios guardados en este navegador." : "¡Listo! Creaste «" + body.nombre + "» para " + data.cliente + ". Quedó guardada en este navegador."), "ok", [
            { href: data.url, text: "Abrir landing", blank: true },
            { act: "publish", text: "Publicar en el link" }
          ].concat(editing ? [] : [{ act: "new", text: "Crear otra" }]));
        } else if (editing) {
          say("Cambios guardados en " + data.path + "." + later, "ok", { href: data.url, text: "Abrir landing", blank: true });
        } else {
          say("¡Listo! Creaste «" + body.nombre + "» para " + data.cliente + "." + later, "ok", [
            { href: data.url, text: "Abrir landing", blank: true },
            { href: "landings.html", text: "Ver en Landings" },
            { act: "new", text: "Crear otra" }
          ]);
        }
      })
      .catch(function (err) {
        if (!err.offline) { say(err.message, "warn"); return; }
        download(html, slugify(state.name) + ".html");
        say("No se pudo guardar: iniciá el servidor con «python3 server.py» y volvé a intentarlo. Mientras tanto se descargó el HTML.", "warn");
      })
      .then(function () { busy = false; renderMode(); });
  }

  function publishLanding(btn) {
    if (!state.landingId) return;
    btn.disabled = true;
    api("POST", "/api/landings/" + state.landingId + "/publish")
      .then(function (data) {
        state.landingId = data.id;
        state.clienteId = data.cliente_id;
        loadClients().then(function () {
          clientSelect.value = String(state.clienteId);
          savedSnapshot = snapshot();
          saveDraft();
          renderMode();
        });
        renderSaved();
        say("Se publicó «" + data.nombre + "». Queda online en 1 o 2 minutos.", "ok", { href: data.url, text: "Abrir landing", blank: true });
      })
      .catch(function (err) { btn.disabled = false; say(err.message, "warn"); });
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
    if (btn && btn.getAttribute("data-msg-act") === "publish") publishLanding(btn);
  });

  newBtn.addEventListener("click", newLanding);

  document.querySelectorAll("[data-lb-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () { showTab(tab.getAttribute("data-lb-tab")); });
  });

  $("[data-lb-new-client]").addEventListener("click", function () {
    window.Nexoia.clientForm(null).then(function (client) {
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

  if (window.NexoiaReglas) {
    window.NexoiaReglas.load().then(function (loaded) {
      rules = loaded;
      scheduleQa(0);
    });
  }

  Promise.all([loadLibrary(), loadClients()]).then(function () {
    renderClients();
    start();
    renderSaved();
  }).catch(function () {
    picker.innerHTML = '<p class="lb-empty">No se pudieron cargar los módulos. Abrí esta página desde el servidor local (http://), no como archivo.</p>';
  });
})();
