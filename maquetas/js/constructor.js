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
  var animSeg = $("[data-lb-anim]");
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
  var state = { name: "", clienteId: null, landingId: null, items: [], estilo: "", ignorados: [], descripcion: "", animacion: "suave" };
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
    return JSON.stringify([state.name.trim(), state.clienteId, state.items, state.estilo, state.colores || null, state.ignorados || [], (state.descripcion || "").trim(), state.animacion || ""]);
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
    if (on && idx === -1) state.items.push(menuDefault({ id: id, width: "full" }));
    if (!on && idx !== -1) state.items.splice(idx, 1);
    update();
  }

  function menuLimit() {
    var rule = rules && rules.estructura.reglas.find(function (r) { return r.id === "max-menu" && r.activo; });
    return rule ? rule.valor : 0;
  }

  /* Ítems del menú en orden, sin repetir (el menú de escritorio y el móvil comparten textos) */
  function menuEntries(it) {
    var tpl = document.createElement("template");
    tpl.innerHTML = it.html || byId[it.id].html;
    var seen = {}, entries = [], textOf = {};
    linkNodes(tpl.content).forEach(function (el, k) {
      var text = el.textContent.replace(/\s+/g, " ").trim();
      textOf[k] = text.toLowerCase();
      if (!el.classList.contains("nav-link") || !text || seen[textOf[k]]) return;
      seen[textOf[k]] = true;
      entries.push({ key: String(k), text: text });
    });
    return { entries: entries, textOf: textOf };
  }

  function menuHidden(it, info) {
    var hidden = {};
    Object.keys(it.ocultos || {}).forEach(function (k) { if (info.textOf[k]) hidden[info.textOf[k]] = true; });
    return hidden;
  }

  function menuDefault(it) {
    var limit = menuLimit();
    if (!limit || !isMenu(it)) return it;
    it.menuAjustado = true;
    var extra = menuEntries(it).entries.slice(limit);
    if (!extra.length) return it;
    it.ocultos = {};
    extra.forEach(function (e) { it.ocultos[e.key] = true; });
    return it;
  }

  function isMenu(it) { return !!(byId[it.id] && byId[it.id].groupId === "navegacion"); }

  /* Menús guardados antes del límite: arrancan con los recomendados y el resto queda para sumar */
  function menuDefaults(items) {
    items.forEach(function (it) { if (isMenu(it) && !it.menuAjustado && !it.ocultos) menuDefault(it); });
  }

  function showMenuItem(index) {
    var it = state.items[index];
    if (!it || !it.ocultos) return;
    it.menuAjustado = true;
    var info = menuEntries(it);
    var hidden = menuHidden(it, info);
    var next = info.entries.find(function (e) { return hidden[e.text.toLowerCase()]; });
    if (!next) { delete it.ocultos; update(); return; }
    Object.keys(it.ocultos).forEach(function (k) { if (info.textOf[k] === next.text.toLowerCase()) delete it.ocultos[k]; });
    if (!Object.keys(it.ocultos).length) delete it.ocultos;
    update();
    var shown = info.entries.length - Object.keys(menuHidden(it, info)).length;
    var limit = menuLimit();
    if (limit && shown > limit) say("Sumaste «" + next.text + "». El menú tiene " + shown + " ítems y lo recomendado es " + limit + ".", "warn");
    else say("Sumaste «" + next.text + "» al menú. Tocalo para cambiar el texto o el link.", "ok");
  }

  function ruleOn(id) {
    return !!(rules && rules.estructura.reglas.some(function (r) { return r.id === id && r.activo; }));
  }

  function pinOf(it) {
    var group = it && byId[it.id] && byId[it.id].groupId;
    if (group === "navegacion" && ruleOn("inicio-navegacion")) return -1;
    if (group === "footer" && ruleOn("fin-footer")) return 1;
    return 0;
  }

  function pinOrder() {
    state.items = state.items.map(function (it, i) { return { it: it, i: i }; })
      .sort(function (a, b) { return pinOf(a.it) - pinOf(b.it) || a.i - b.i; })
      .map(function (x) { return x.it; });
  }

  function canMove(i, dir) {
    var it = state.items[i];
    var other = state.items[i + dir];
    return !!it && !!other && pinOf(it) === 0 && pinOf(other) === 0;
  }

  var focusModule = -1;
  var lastRemoved = null;

  function moduleAction(i, act) {
    var it = state.items[i];
    if (!it) return;
    var name = byId[it.id].group;
    if (act === "restore") { showMenuItem(i); return; }
    if (act === "up" || act === "down") {
      var dir = act === "up" ? -1 : 1;
      if (!canMove(i, dir)) return;
      state.items.splice(i + dir, 0, state.items.splice(i, 1)[0]);
      focusModule = i + dir;
    } else if (act === "dup") {
      if (pinOf(it)) return;
      state.items.splice(i + 1, 0, JSON.parse(JSON.stringify(it)));
      focusModule = i + 1;
      say("Duplicaste «" + name + "». La copia quedó justo debajo.", "ok");
    } else if (act === "remove") {
      lastRemoved = { item: it, index: i };
      state.items.splice(i, 1);
      say("Quitaste «" + name + "».", "ok", { act: "undo-remove", text: "Deshacer" });
    } else return;
    update();
  }

  function moveModule(from, to) {
    if (from === to || !state.items[from] || pinOf(state.items[from])) return;
    var it = state.items.splice(from, 1)[0];
    var min = state.items.filter(function (x) { return pinOf(x) === -1; }).length;
    var max = state.items.length - state.items.filter(function (x) { return pinOf(x) === 1; }).length;
    to = Math.max(min, Math.min(max, to));
    state.items.splice(to, 0, it);
    focusModule = to;
    update();
  }

  function undoRemove() {
    if (!lastRemoved) return;
    var at = Math.min(lastRemoved.index, state.items.length);
    state.items.splice(at, 0, lastRemoved.item);
    focusModule = at;
    say("Volvió «" + byId[lastRemoved.item.id].group + "».", "ok");
    lastRemoved = null;
    update();
  }

  var dragFrom = -1;

  function clearDrop() {
    orderList.querySelectorAll(".is-drop-before, .is-drop-after").forEach(function (el) { el.classList.remove("is-drop-before", "is-drop-after"); });
  }

  orderList.addEventListener("dragover", function (e) {
    if (dragFrom < 0) return;
    var li = e.target.closest(".lb-item");
    if (!li) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    var r = li.getBoundingClientRect();
    clearDrop();
    li.classList.add(e.clientY < r.top + r.height / 2 ? "is-drop-before" : "is-drop-after");
  });
  orderList.addEventListener("dragleave", function (e) { if (!orderList.contains(e.relatedTarget)) clearDrop(); });
  orderList.addEventListener("drop", function (e) {
    var li = e.target.closest(".lb-item");
    if (dragFrom < 0 || !li) return;
    e.preventDefault();
    var to = Number(li.getAttribute("data-index")) + (li.classList.contains("is-drop-after") ? 1 : 0);
    if (to > dragFrom) to--;
    var from = dragFrom;
    dragFrom = -1;
    clearDrop();
    moveModule(from, to);
  });

  function renderOrder() {
    orderList.innerHTML = "";
    state.items.forEach(function (it, i) {
      var m = byId[it.id];
      var pin = pinOf(it);
      var noUp = !canMove(i, -1);
      var noDown = !canMove(i, 1);
      var li = document.createElement("li");
      li.className = "lb-item" + (pin ? " is-pinned" : "");
      li.setAttribute("data-index", i);
      if (!pin) {
        li.draggable = true;
        li.addEventListener("dragstart", function (e) {
          if (e.target.closest("button")) { e.preventDefault(); return; }
          dragFrom = i;
          li.classList.add("is-dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(i));
        });
        li.addEventListener("dragend", function () { dragFrom = -1; li.classList.remove("is-dragging"); clearDrop(); });
      }
      li.innerHTML =
        '<span class="lb-item-num">' + (pin ? '<i class="bi bi-pin-angle" title="' + (pin === -1 ? "Fija arriba" : "Fijo al final") + '"></i>' : '<i class="bi bi-grip-vertical lb-item-grip" title="Arrastrá para mover"></i>') + "<b>" + String(i + 1).padStart(2, "0") + "</b></span>" +
        '<strong class="lb-item-text">' + escapeHtml(m.group) + "</strong>" +
        '<span class="lb-item-tools">' +
        '<button type="button" data-act="up" aria-label="Subir ' + escapeHtml(m.group) + '"' + (noUp ? " disabled" : "") + '><i class="bi bi-arrow-up"></i></button>' +
        '<button type="button" data-act="down" aria-label="Bajar ' + escapeHtml(m.group) + '"' + (noDown ? " disabled" : "") + '><i class="bi bi-arrow-down"></i></button>' +
        '<button type="button" data-act="dup" title="Duplicar" aria-label="Duplicar ' + escapeHtml(m.group) + '"' + (pin ? " disabled" : "") + '><i class="bi bi-copy"></i></button>' +
        '<button type="button" data-act="remove" title="Quitar" aria-label="Quitar ' + escapeHtml(m.group) + '"><i class="bi bi-trash3"></i></button>' +
        "</span>";
      li.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-act]");
        if (!btn) return;
        var act = btn.getAttribute("data-act");
        if (act === "width") { setWidth(i, btn.getAttribute("data-value")); return; }
        moduleAction(i, act);
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
    renderSectionColors();
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
    pressSeg(animSeg, state.animacion || "");
  }

  function fondoNote(it) {
    if (!it.fondo) return { bad: false, text: "Todavía usa el fondo del módulo." };
    var colors = effectiveColors();
    var checks = [["Títulos", colors.titulos], ["Párrafos", colors.parrafos], ["Etiquetas", colors.etiquetas]];
    if (/^navegacion/.test(it.id) && colors.nav) checks = [["Textos del menú", colors.nav]];
    if (/^hero/.test(it.id) && colors.hero) checks = [["Textos de la portada", colors.hero]];
    var worst = checks.map(function (pair) {
      return { name: pair[0], ratio: contrastRatio(pair[1], it.fondo) };
    }).sort(function (a, b) { return a.ratio - b.ratio; })[0];
    var value = (Math.round(worst.ratio * 10) / 10).toFixed(1);
    var bad = worst.ratio < 4.5;
    return { bad: bad, text: worst.name + " sobre este fondo: " + value + ":1. " + (bad ? "Hace falta 4.5:1." : "Llega a 4.5:1.") };
  }

  function paintFondoNodes(root, color) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll(".nx").forEach(function (el) {
      if (el.parentElement && el.parentElement.closest(".nx")) return;
      el.style.backgroundColor = color || "";
    });
  }

  function paintFondo(color, index) {
    var doc = frameDoc();
    var section = doc && doc.querySelectorAll("body > section.mq-block")[index];
    if (section) paintFondoNodes(section, color);
  }

  function normalizeHex(value) {
    var hex = String(value || "").trim();
    if (hex.charAt(0) !== "#") hex = "#" + hex;
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : "";
  }

  function paintLandingColors() {
    var doc = frameDoc();
    if (!doc || !doc.head) return;
    var style = doc.getElementById("lz-live-colors");
    if (!state.colores) {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = doc.createElement("style");
      style.id = "lz-live-colors";
      doc.head.appendChild(style);
    }
    style.textContent = colorStyle(state.colores);
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
    var pin = pinOf(it);
    var btn = function (act, icon, label, off, text) {
      return '<button type="button" data-index="' + i + '" data-act="' + act + '" title="' + label + '" aria-label="' + label + " " + escapeHtml(m.group) + '"' + (off ? " disabled" : "") + '><i class="bi ' + icon + '"></i>' + (text ? " " + text : "") + "</button>";
    };
    return '\n    <div class="lp-tools" role="group" aria-label="Módulo ' + escapeHtml(m.group) + '">' +
      "<span>" + (pin ? '<i class="bi bi-pin-angle"></i> ' : "") + String(i + 1).padStart(2, "0") + " · " + escapeHtml(m.group) + "</span>" +
      (it.ocultos ? btn("restore", "bi-plus-lg", "Agregar ítem al menú", false, "Ítem al menú") : "") +
      btn("up", "bi-arrow-up", "Subir", !canMove(i, -1)) +
      btn("down", "bi-arrow-down", "Bajar", !canMove(i, 1)) +
      btn("dup", "bi-copy", "Duplicar", !!pin) +
      btn("remove", "bi-trash3", "Quitar", false) +
      "</div>";
  }

  /* Datos del cliente: reemplazan los de ejemplo de las maquetas */
  var SAMPLE = {
    nombre: "Marca Ejemplo", email: "hola@example.com", telefono: "+54 11 2345 6789", wa: "5491123456789",
    direccion: "Calle Ejemplo 123, Buenos Aires", mapa: "query=Calle+Ejemplo+123,+Buenos+Aires"
  };
  var SAMPLE_HOURS = /Lun a Vie,? 9 a 18 h/g;
  var SAMPLE_HOURS_TEXT = /de lunes a viernes, de 9 a 18 h/g;
  var SOCIAL = ["instagram", "facebook", "linkedin"];
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
      if (c.direccion) href = href.replace(SAMPLE.mapa, "query=" + encodeURIComponent(c.direccion));
      el.setAttribute("href", href);
    });
    SOCIAL.forEach(function (k) {
      root.querySelectorAll('a[href="https://' + k + '.com"]').forEach(function (a) {
        if (a.closest(".person-card")) return;
        if (c[k]) a.setAttribute("href", window.Lanzate.socialUrl(k, c[k]));
        else a.remove();
      });
    });
    var logo = logoSrc(c, preview);
    var mode = logoMode(c);
    if (logo && mode !== "texto") {
      root.querySelectorAll(".nx-brand").forEach(function (el) {
        var name = el.textContent.replace(/\s+/g, " ").trim() || c.nombre;
        el.classList.toggle("has-name", mode === "imagen-texto");
        el.innerHTML = mode === "imagen-texto"
          ? '<img class="nx-brand-logo" src="' + escapeHtml(logo) + '" alt=""><span class="nx-brand-name">' + escapeHtml(name) + "</span>"
          : '<img class="nx-brand-logo" src="' + escapeHtml(logo) + '" alt="' + escapeHtml(c.nombre) + '">';
      });
    }
  }

  function logoMode(c) {
    if (!c || !c.logo_url) return "texto";
    return c.logo_modo || "imagen";
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

  var COLOR_MARK = /\/\*lz-colores (\{[\s\S]*?\})\*\//;

  function channelLinear(channel) {
    var value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function luminance(hex) {
    var n = parseInt(String(hex).slice(1), 16);
    return [16, 8, 0].reduce(function (sum, shift, i) {
      return sum + [0.2126, 0.7152, 0.0722][i] * channelLinear((n >> shift) & 255);
    }, 0);
  }

  function contrastRatio(a, b) {
    var hi = Math.max(luminance(a), luminance(b));
    var lo = Math.min(luminance(a), luminance(b));
    return (hi + 0.05) / (lo + 0.05);
  }

  function readLandingColors(estilo) {
    var match = COLOR_MARK.exec(estilo || "");
    if (!match) return null;
    try {
      var data = JSON.parse(match[1]);
      if (data.texto && !data.titulos) data.titulos = data.texto;
      return ["titulos", "acento", "iconos"].every(function (key) { return /^#[0-9a-f]{6}$/i.test(data[key] || ""); }) ? data : null;
    } catch (e) {
      return null;
    }
  }

  function stripLandingColors(estilo) {
    return (estilo || "").replace(COLOR_MARK, "").replace(/^\n+/, "");
  }

  function effectiveColors() {
    var client = currentClient();
    var accent = client && /^#[0-9a-f]{6}$/i.test(client.color_primario || "") ? client.color_primario : DEFAULT_COLORS.c1;
    var base = { titulos: "#17352c", parrafos: "#5f6f68", etiquetas: accent, acento: accent, iconos: accent };
    if (state.colores && state.colores.texto && !state.colores.titulos) base.titulos = state.colores.texto;
    return Object.assign(base, state.colores || {});
  }

  function colorStyle(colors) {
    if (!colors) return "";
    return ":root { --ink: " + colors.titulos + "; --muted: " + colors.parrafos + "; --lz-label: " + colors.etiquetas +
      "; --green: " + colors.acento + "; --green-deep: " + shade(colors.acento, -0.28) + "; --lz-icon: " + colors.iconos + "; }" +
      ".landing-page { color: var(--ink); }" +
      ".landing-page :is(p, li, blockquote, figcaption, dd) { color: var(--muted); }" +
      ".landing-page :is(.nx-kicker, .plan-kicker, .badge, .k) { color: var(--lz-label); }" +
      ".landing-page .bi { color: var(--lz-icon); }" +
      (colors.nav ? '.landing-page [data-module^="navegacion"] :is(a, span, strong, p, li, button, .bi):not(:is(.btn-nx, .btn-nx-outline, .btn-nx-light, .btn-nx *, .btn-nx-outline *, .btn-nx-light *)) { color: ' + colors.nav + "; }" : "") +
      (colors.hero ? '.landing-page [data-module^="hero"] :is(h1, h2, h3, p, li, span, .nx-kicker):not(:is(.btn-nx, .btn-nx-outline, .btn-nx-light, .btn-nx *, .btn-nx-outline *, .btn-nx-light *)) { color: ' + colors.hero + "; }" : "") +
      ".landing-page :is(.btn-nx, .btn-nx-outline, .btn-nx-light) .bi { color: inherit; }";
  }

  function contrastNotes(colors) {
    var pairs = [
      ["Texto blanco del botón", "#ffffff", colors.acento, 4.5],
      ["Íconos sobre fondo claro", colors.iconos, "#f7f4ef", 3]
    ];
    return pairs.map(function (pair) {
      var ratio = contrastRatio(pair[1], pair[2]);
      var ok = ratio >= pair[3];
      var value = (Math.round(ratio * 10) / 10).toFixed(1);
      return '<li class="' + (ok ? "" : "is-bad") + '">' + pair[0] + ": " + value + ":1. " +
        (ok ? "Llega al mínimo de " + pair[3] + ":1." : "Hace falta " + pair[3] + ":1. Oscurecé o aclará uno de los dos.") + "</li>";
    }).join("");
  }

  function renderSectionColors() {
    var list = document.querySelector("[data-lb-fondos]");
    if (!list) return;
    list.innerHTML = "";
    if (!state.items.length) {
      list.innerHTML = '<li class="lb-hint">Sumá módulos y acá vas a poder pintar el fondo de cada uno.</li>';
      return;
    }
    state.items.forEach(function (it, i) {
      var m = byId[it.id];
      if (!m) return;
      var status = fondoNote(it);
      var li = document.createElement("li");
      li.className = "lb-fondo-row";
      li.innerHTML =
        '<span class="lb-swatch-name"><b>' + String(i + 1).padStart(2, "0") + "</b> " + escapeHtml(m.group) + "</span>" +
        '<span class="lb-color-controls">' +
        '<input type="color" data-fondo value="' + (it.fondo || "#f7f4ef") + '" aria-label="Fondo de ' + escapeHtml(m.group) + '">' +
        '<input class="lb-hex" type="text" data-fondo-hex value="' + (it.fondo || "#f7f4ef") + '" maxlength="7" spellcheck="false" autocapitalize="off" aria-label="Hexadecimal del fondo de ' + escapeHtml(m.group) + '">' +
        "</span>" +
        '<span class="lb-fondo-note' + (status.bad ? " is-bad" : "") + '" data-fondo-note' + (it.fondo ? "" : " hidden") + ">" + status.text + "</span>" +
        '<button type="button" class="lb-link" data-fondo-reset' + (it.fondo ? "" : " hidden") + ">Color original</button>";
      var input = li.querySelector("[data-fondo]");
      var hexInput = li.querySelector("[data-fondo-hex]");
      function applyFondo(raw, fromHex) {
        var hex = normalizeHex(raw);
        if (!hex) return;
        it.fondo = hex;
        if (!fromHex) hexInput.value = hex;
        input.value = hex;
        paintFondo(hex, i);
        var note = li.querySelector("[data-fondo-note]");
        var next = fondoNote(it);
        note.hidden = false;
        note.textContent = next.text;
        note.classList.toggle("is-bad", next.bad);
        li.querySelector("[data-fondo-reset]").hidden = false;
        renderMode();
        saveDraft();
      }
      input.addEventListener("input", function () { applyFondo(input.value, false); });
      hexInput.addEventListener("input", function () { applyFondo(hexInput.value, true); });
      li.querySelector("[data-fondo-reset]").addEventListener("click", function () {
        delete it.fondo;
        input.value = "#f7f4ef";
        hexInput.value = "#f7f4ef";
        paintFondo("", i);
        li.querySelector("[data-fondo-note]").hidden = true;
        this.hidden = true;
        renderMode();
        saveDraft();
      });
      list.appendChild(li);
    });
  }

  function renderColors() {
    var box = document.querySelector("[data-lb-contrast]");
    if (!box) return;
    var colors = effectiveColors();
    document.querySelectorAll("[data-color], [data-hex]").forEach(function (input) {
      if (document.activeElement === input) return;
      var key = input.getAttribute("data-color") || input.getAttribute("data-hex");
      input.value = colors[key] || { nav: "#17352c", hero: "#ffffff" }[key] || input.value;
    });
    box.innerHTML = contrastNotes(colors);
    document.querySelectorAll("[data-lb-fondos] [data-fondo-row], [data-lb-fondos] .lb-fondo-row").forEach(function (row) {
      var note = row.querySelector("[data-fondo-note]");
      var input = row.querySelector("[data-fondo]");
      if (!note || !input || note.hidden) return;
      var fake = { fondo: input.value };
      var status = fondoNote(fake);
      note.textContent = status.text;
      note.classList.toggle("is-bad", status.bad);
    });
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
    var nodes = all.filter(function (el) {
      for (var p = el.parentElement; p; p = p.parentElement) { if (set.has(p) && ownText(p)) return false; }
      return ownText(el) || !all.some(function (o) { return o !== el && el.contains(o); });
    });
    /* Van al final para no correr las posiciones de los textos ya guardados */
    Array.prototype.forEach.call(root.querySelectorAll(EDIT_EXTRA), function (el) {
      if (/\S/.test(el.textContent) && !nodes.some(function (n) { return n.contains(el) || el.contains(n); })) nodes.push(el);
    });
    return nodes;
  }
  var EDIT_EXTRA = ".nx-phone strong, .nx-phone span";

  /* Imágenes editables: cada módulo guarda en it.imagenes { src, alt } por posición */
  var IMG_SEL = "img, [style*='background-image']";

  function imageNodes(root) {
    return Array.prototype.filter.call(root.querySelectorAll(IMG_SEL), function (el) {
      return !el.closest(".nx-brand, .lp-tools, script, style, svg");
    });
  }

  /* Links editables: cada módulo guarda en it.links { href } por posición */
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
      } else {
        el.style.backgroundImage = 'url("' + data.src + '")';
      }
    }
    if (data.alt != null) {
      if (el.tagName === "IMG") el.setAttribute("alt", data.alt);
      else if (el.closest(".nx-hero, .nx-hero-slide")) el.setAttribute("data-lz-background-alt", data.alt);
    }
  }

  function moduleTemplate(it, preview, withTexts) {
    var tpl = document.createElement("template");
    tpl.innerHTML = it.html || byId[it.id].html;
    var nodes = editableNodes(tpl.content);
    var images = imageNodes(tpl.content);
    var links = linkNodes(tpl.content);
    var linkText = links.map(function (el) { return el.textContent.replace(/\s+/g, " ").trim().toLowerCase(); });
    links.forEach(function (el, k) { el.setAttribute("data-lb-l", k); });
    applyClient(tpl.content, currentClient(), preview);
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
    return state.items.map(function (it) {
      var base = slugify(byId[it.id].group);
      var id = base;
      for (var n = 2; used[id]; n++) id = base + "-" + n;
      used[id] = true;
      return id;
    });
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
    return '  <section class="mq-block" id="' + sectionAnchors()[i] + '" data-module="' + it.id + '" data-width="' + it.width + '">\n    <div class="mq-frame">' + html + "</div>" +
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
      '  <link href="' + BOOTSTRAP_CSS + '" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous" rel="stylesheet">',
      '  <link href="' + ICONS_CSS + '" integrity="sha384-XGjxtQfXaH2tnPFa9x+ruJTuLE3Aa6LhHSWRr1XeTyhezb4abCG4ccI5AkVDxqC+" crossorigin="anonymous" rel="stylesheet">',
      '  <link href="' + prefix + 'css/lanzate.css" rel="stylesheet">',
      clientStyle(currentClient()) ? "  <style>" + clientStyle(currentClient()) + "</style>" : "",
      state.colores ? "  <style>" + colorStyle(state.colores) + "</style>" : "",
      state.estilo ? "  <style>\n" + state.estilo + "\n  </style>" : "",
      "</head>",
      '<body class="landing-page' + (opts.tools ? " has-tools" : "") + '"' + (state.animacion ? ' data-anim="' + state.animacion + '"' : "") + ">"
    ].filter(Boolean);
    var body = state.items.map(function (it, i) { return moduleMarkup(it, prefix, i, opts.tools); });
    var tail = [
      '  <script src="' + BOOTSTRAP_JS + '" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></' + "script>",
      '  <script src="' + prefix + 'js/lanzate.js"></' + "script>"
    ];
    if (opts.preview) {
      tail.push("  <script>document.addEventListener('click',function(e){var t=e.target.closest('.lp-tools [data-act]');if(t){parent.postMessage({lbAct:{index:+t.getAttribute('data-index'),act:t.getAttribute('data-act')}},'*');return;}var a=e.target.closest('a[href^=\"#\"]');if(a)e.preventDefault();});</" + "script>");
    }
    return head.concat(body, tail, ["</body>", "</html>", ""]).join("\n");
  }

  function baseUrl() { return new URL("./", location.href).href; }

  function fitPreview() {
    var avail = viewport.clientWidth - 32;
    var scale = Math.min(1, avail / device);
    deviceFrame.style.width = device + "px";
    deviceFrame.style.transform = "scale(" + scale + ")";
    var doc = frameDoc();
    if (doc) doc.documentElement.style.setProperty("--lb-ui-scale", (1 / scale).toFixed(3));
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
    var pend = pendingSelect;
    pendingSelect = null;
    var pendEl = pend && frameDoc() && frameDoc().querySelectorAll("body > section.mq-block")[pend.module];
    pendEl = pendEl && pendEl.querySelector('[data-lb-i="' + pend.key + '"]');
    if (pendEl) setTimeout(function () { scrollToEl(pendEl); selectImage(pendEl); }, 200);
    var section = focusModule >= 0 && frameDoc() && frameDoc().querySelectorAll("body > section.mq-block")[focusModule];
    focusModule = -1;
    if (section) {
      setTimeout(function () {
        scrollToEl(section);
        section.classList.add("lp-flash");
        setTimeout(function () { section.classList.remove("lp-flash"); }, 1400);
      }, 150);
    }
  });

  /* Edición de textos sobre la vista previa */
  var editHint = $("[data-lb-edit]");
  var editMode = true;
  var editing = null;
  var hoverEl = null;
  var EDIT_CSS =
    ".lb-editing [data-lb-t]{cursor:text}.lb-editing [data-lb-i],.lb-editing a[data-lb-l]{cursor:pointer}" +
    ".lb-hover{outline:2px solid #5a3df2!important;outline-offset:3px;border-radius:2px}[data-lb-i].lb-hover{outline-offset:-3px}" +
    "#lbHover{position:absolute;z-index:2147482999;pointer-events:none;display:flex;align-items:center;gap:.35em;padding:.35em .6em;border-radius:6px;background:#5a3df2;color:#fff;font:700 12px/1 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 4px 12px rgba(14,17,48,.25)}#lbHover[hidden]{display:none}" +
    "[data-lb-t][contenteditable]{outline:2px solid #5a3df2!important;background:rgba(255,255,255,.85);color:#0e1130;caret-color:#5a3df2}" +
    "#lbEditTip{position:absolute;z-index:2147483000;display:flex;align-items:center;gap:.6em;padding:.45em .8em;border-radius:999px;background:#0e1130;color:#fff;font:600 13px/1.2 Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);white-space:nowrap}" +
    "#lbEditTip[hidden]{display:none}#lbEditTip .is-over{color:#ff8a80}#lbEditTip .is-under{color:#ffd27a}" +
    "#lbEditTip button{border:0;background:none;color:#d5f660;font:inherit;text-decoration:underline;cursor:pointer;padding:0}" +
    "[data-lb-i].lb-img-on{outline:3px solid #5a3df2!important;outline-offset:-3px}" +
    ":is(#lbImgTip,#lbLinkTip){position:absolute;z-index:2147483000;display:flex;flex-direction:column;gap:.55em;width:min(22em,calc(100vw - 16px));padding:.8em .9em;border-radius:14px;background:#0e1130;color:#fff;font:500 13px/1.35 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3)}" +
    ":is(#lbImgTip,#lbLinkTip)[hidden]{display:none}:is(#lbImgTip,#lbLinkTip) b{font-weight:700}#lbImgTip small,#lbLinkTip small{color:#c9cbe0;font-size:.9em;text-wrap:pretty}#lbImgTip .is-bad,#lbLinkTip .is-bad{color:#ff8a80}" +
    ":is(#lbImgTip,#lbLinkTip) .lb-img-row{display:flex;flex-wrap:wrap;gap:.5em;align-items:center}" +
    ":is(#lbImgTip,#lbLinkTip) button{border:0;border-radius:999px;padding:.5em .95em;font:700 1em/1 Inter,system-ui,sans-serif;cursor:pointer;background:#d5f660;color:#0e1130}" +
    ":is(#lbImgTip,#lbLinkTip) button.is-ghost{background:none;color:#d5f660;text-decoration:underline;padding:.5em .2em}" +
    "#lbImgTip button.lb-img-ai{align-self:flex-start;margin-top:-.2em;display:inline-flex;gap:.35em;align-items:center}" +
    ":is(#lbImgTip,#lbLinkTip) button.is-save,#lbLinkTip button.is-save{background:#5a3df2;color:#fff}#lbImgTip button.is-save:disabled,#lbLinkTip button.is-save:disabled{background:#2b2f52;color:#c9cbe0;cursor:default}#lbImgTip button[hidden],#lbLinkTip button[hidden]{display:none}" +
    ":is(#lbImgTip,#lbLinkTip) button.lb-img-x{position:absolute;top:.35em;right:.4em;background:none;color:#fff;font-size:1.4em;padding:.1em .35em}" +
    ":is(#lbImgTip,#lbLinkTip)>div:first-of-type{padding-right:1.8em}" +
    ":is(#lbImgTip,#lbLinkTip) label{display:flex;flex-direction:column;gap:.3em;font-size:.92em;color:#c9cbe0}" +
    ":is(#lbImgTip,#lbLinkTip) input{width:100%;border:1px solid #2b2f52;border-radius:8px;padding:.5em .6em;font:500 1em/1.2 Inter,system-ui,sans-serif;color:#0e1130;background:#fff}" +
    ".lb-editing a[data-lb-l].lb-link-on{outline:2px solid #5a3df2!important;outline-offset:3px}" +
    "#lbLinkTip select{width:100%;border:1px solid #2b2f52;border-radius:8px;padding:.5em .6em;font:500 1em/1.2 Inter,system-ui,sans-serif;color:#0e1130;background:#fff}" +
    "#lbLinkTip .lb-link-modes{display:flex;gap:.25em;padding:.2em;border-radius:999px;background:#1d2150}" +
    "#lbLinkTip .lb-link-modes button{flex:1;background:none;color:#c9cbe0;padding:.5em .6em;font-weight:600}" +
    "#lbLinkTip .lb-link-modes button[aria-pressed=true]{background:#fff;color:#0e1130}" +
    "#lbImgTip .lb-prod{display:flex;flex-direction:column;gap:.45em;margin-top:.2em;padding-top:.65em;border-top:1px solid #2b2f52}" +
    "#lbImgTip .lb-prod-cats{display:flex;flex-wrap:wrap;gap:.35em}" +
    "#lbImgTip .lb-prod-cats button{background:#1d2150;color:#c9cbe0;font-weight:600;padding:.45em .8em}" +
    "#lbImgTip .lb-prod-cats button[aria-pressed=true]{background:#fff;color:#0e1130}" +
    "#lbImgTip .lb-prod-cats button[aria-pressed=true]::before{content:'✓ '}" +
    "#lbImgTip .lb-prod-cats .lb-prod-new{background:none;color:#d5f660;border:1px dashed #d5f660}" +
    "#lbImgTip .lb-prod-newrow[hidden]{display:none}#lbImgTip .lb-prod-newrow{flex-wrap:nowrap}#lbImgTip .lb-prod-newrow input{flex:1;min-width:0}";

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
        if (!editing) return;
        if (e.target.closest("[data-lb-link]")) { selectLink(editing.el.closest("a[data-lb-l]")); return; }
        if (e.target.closest("[data-lb-hide]")) { hideMenuItem(editing.el.closest(".nav-link[data-lb-l]")); return; }
        if (e.target.closest("[data-lb-cat-remove]")) { removeCategory(editing.el.closest("[data-filter]")); return; }
        if (e.target.closest("[data-lb-prod]")) {
          var img = productOf(editing.el).querySelector("[data-lb-i]");
          endEdit();
          selectImage(img);
          return;
        }
        if (!e.target.closest("[data-lb-revert]")) return;
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
      (editing.el.closest("a[data-lb-l]") ? '<button type="button" data-lb-link>Cambiar link</button>' : "") +
      (editing.el.closest(".nav-link[data-lb-l]") ? '<button type="button" data-lb-hide>Quitar del menú</button>' : "") +
      (productOf(editing.el) && productOf(editing.el).querySelector("[data-lb-i]") ? '<button type="button" data-lb-prod>Producto</button>' : "") +
      (isCategoryTab(editing.el) ? '<button type="button" data-lb-cat-remove>Quitar categoría</button>' : "") +
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

  function storeText(el) {
    var it = state.items[moduleIndex(el)];
    if (!it) return;
    var key = el.getAttribute("data-lb-t");
    var html = cleanEdited(el);
    it.textos = it.textos || {};
    if (html === originalText(it, key)) delete it.textos[key];
    else it.textos[key] = html;
    if (!Object.keys(it.textos).length) delete it.textos;
    el.closest("section.mq-block").querySelectorAll('[data-lb-t="' + key + '"]').forEach(function (o) { if (o !== el) o.innerHTML = html; });
    renderMode();
    renderOrder();
    saveDraft();
    scheduleQa(900);
  }

  function commitEdit() {
    if (!editing) return;
    storeText(editing.el);
    renderTip();
  }

  function beginEdit(el, focus) {
    if (editing && editing.el === el) return;
    endEdit();
    var it = state.items[moduleIndex(el)];
    editing = { el: el, module: moduleIndex(el), key: el.getAttribute("data-lb-t"), start: el.innerHTML,
      startText: plainText(el), hadEdit: !!(it && it.textos && it.textos[el.getAttribute("data-lb-t")] != null) };
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
    var done = editing;
    commitEdit();
    el.removeAttribute("contenteditable");
    el.removeAttribute("spellcheck");
    editing = null;
    syncClientField(done, plainText(el));
    var doc = frameDoc();
    var tip = doc && doc.getElementById("lbEditTip");
    if (tip) tip.hidden = true;
    scheduleQa(200);
  }

  function plainText(el) { return el.textContent.replace(/\s+/g, " ").trim(); }

  /* Si el texto editado reemplaza un dato de ejemplo o que le falta al cliente, el dato nuevo se guarda en el cliente */
  var CLIENT_SYNC = ["telefono", "email", "direccion", "sitio"];
  var saveAfterQa = null;

  function isSampleValue(val) {
    var low = val.toLowerCase();
    var list = (rules && rules.textos.listaEjemplos) || [];
    return list.concat(Object.keys(EXAMPLE_FIELDS)).some(function (s) {
      s = String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
      return s && low.indexOf(s) !== -1;
    });
  }

  function syncClientField(done, after) {
    var client = currentClient();
    if (!client || !after || after === done.startText) return;
    CLIENT_SYNC.some(function (k) {
      var val = String(client[k] || "").replace(/\s+/g, " ").trim();
      if (!val && SAMPLE[k]) val = SAMPLE[k];
      if (!val || !isSampleValue(val)) return false;
      var at = done.startText.indexOf(val);
      if (at === -1 || after.indexOf(val) !== -1) return false;
      var head = done.startText.slice(0, at);
      var tail = done.startText.slice(at + val.length);
      if (after.length < head.length + tail.length || after.indexOf(head) !== 0 || after.slice(after.length - tail.length) !== tail) return false;
      var value = after.slice(head.length, after.length - tail.length).trim();
      if (!value) return false;
      saveClientField(client, k, value, done);
      return true;
    });
  }

  function saveClientField(client, field, value, done) {
    var data = Object.assign({}, client);
    data[field] = value;
    ["logo", "logo_url", "lista", "landings"].forEach(function (k) { delete data[k]; });
    say("Guardando " + (FIELD_NAMES[field] || "el dato") + " de «" + client.nombre + "»…");
    window.Lanzate.api("PUT", "/api/clientes/" + client.id, data).then(function () {
      return loadClients();
    }).then(function () {
      var it = state.items[done.module];
      if (it && it.textos && !done.hadEdit) {
        delete it.textos[done.key];
        if (!Object.keys(it.textos).length) delete it.textos;
      }
      saveAfterQa = { field: field, nombre: client.nombre };
      renderPreview();
      renderOrder();
      renderMode();
      saveDraft();
      say("Guardamos " + (FIELD_NAMES[field] || "el dato") + " nuevo en los datos de «" + client.nombre + "»: ya se usa en toda la\u00a0landing.", "ok");
    }).catch(function (err) { say(err.message, "warn"); });
  }

  function afterClientFix(report) {
    var pending = saveAfterQa;
    if (!pending) return;
    if (report.issues.some(function (i) { return i.campo === pending.field; })) return;
    saveAfterQa = null;
    if (state.landingId && !busy) createLanding();
  }

  function setEditMode(on) {
    if (!on) { endEdit(); closeImage(); closeLink(); }
  }

  function editTarget(t) {
    var img = t.closest("[data-lb-i]");
    var link = t.closest("a[data-lb-l]");
    if (link && !img && (link.classList.contains("nx-brand") || linkTextEl(link) || !link.querySelector("[data-lb-t]"))) return { kind: "link", el: link, direct: true };
    var el = t.closest("[data-lb-t]");
    if (el) return { kind: "text", el: el };
    if (img) return { kind: "img", el: img };
    if (link) return { kind: "link", el: link };
    return null;
  }

  function hoverLabel(target) {
    if (target.kind === "text") return '<i class="bi bi-pencil"></i> Editar texto';
    if (target.kind === "img") return '<i class="bi bi-image"></i> Cambiar foto';
    if (target.el.classList.contains("nx-brand")) return '<i class="bi bi-pencil"></i> Cambiar logo';
    return '<i class="bi bi-link-45deg"></i> ' + (linkTextEl(target.el) ? "Editar texto y link" : "Cambiar link");
  }

  function showHover(target) {
    var doc = frameDoc();
    if (!doc) return;
    var chip = doc.getElementById("lbHover");
    if (hoverEl && (!target || hoverEl !== target.el)) hoverEl.classList.remove("lb-hover");
    hoverEl = null;
    var busy = target && ((editing && editing.el === target.el) || (imgSel && imgSel.el === target.el) || (linkSel && linkSel.el === target.el));
    if (!target || busy) { if (chip) chip.hidden = true; return; }
    if (!chip) {
      chip = doc.createElement("div");
      chip.id = "lbHover";
      doc.body.appendChild(chip);
    }
    hoverEl = target.el;
    hoverEl.classList.add("lb-hover");
    chip.innerHTML = hoverLabel(target);
    var scale = frame.getBoundingClientRect().width / frame.offsetWidth || 1;
    chip.style.fontSize = Math.round(12 / scale) + "px";
    chip.hidden = false;
    var r = target.el.getBoundingClientRect();
    var win = doc.defaultView;
    var top = r.top + win.scrollY - chip.offsetHeight - 6;
    if (top < win.scrollY) top = r.top + win.scrollY + 6;
    chip.style.top = top + "px";
    chip.style.left = Math.max(4, Math.min(r.left + win.scrollX, doc.documentElement.clientWidth - chip.offsetWidth - 4)) + "px";
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
    hoverEl = null;
    doc.addEventListener("pointerover", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      var skip = e.target.closest("#lbEditTip, #lbImgTip, #lbLinkTip, .lp-tools, [data-bs-slide], [data-bs-slide-to]");
      showHover(skip ? null : editTarget(e.target));
    });
    doc.documentElement.addEventListener("pointerleave", function () { showHover(null); });
    doc.addEventListener("pointerdown", function (e) {
      if (!editMode || e.target.closest("#lbEditTip, #lbImgTip, #lbLinkTip, [data-bs-slide], [data-bs-slide-to]")) return;
      var target = editTarget(e.target);
      showHover(null);
      if (!target) { closeImage(); closeLink(); return; }
      if (target.kind === "link") {
        if (target.direct) e.preventDefault();
        closeImage();
        selectLink(target.el);
        return;
      }
      if (target.kind === "text") { closeImage(); closeLink(); beginEdit(target.el); return; }
      closeLink();
      selectImage(target.el);
    }, true);
    doc.addEventListener("click", function (e) {
      if (!editMode || e.target.closest(".lp-tools, #lbEditTip, #lbImgTip, #lbLinkTip, [data-bs-slide], [data-bs-slide-to]")) return;
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

  /* Productos: duplicar, quitar y elegir categorías. Cambian la estructura del módulo:
     el HTML queda en it.html y las ediciones por posición se reacomodan. */
  function productOf(el) {
    var item = el.closest("[data-item]");
    if (item) return item;
    var card = el.closest(".prod-card");
    return card && card.parentElement && /\bcol-/.test(card.parentElement.className) ? card.parentElement : null;
  }

  function productsIn(root) {
    var out = [];
    root.querySelectorAll("[data-item], .prod-card").forEach(function (el) {
      var p = productOf(el);
      if (p && out.indexOf(p) === -1) out.push(p);
    });
    return out;
  }

  function productCategories(product) {
    var group = product.closest("[data-filter-group]");
    if (!group || !product.hasAttribute("data-item")) return [];
    return Array.prototype.filter.call(group.querySelectorAll("[data-filter]"), function (b) { return b.getAttribute("data-filter") !== "todos"; })
      .map(function (b) { return { id: b.getAttribute("data-filter"), label: b.textContent.replace(/\s+/g, " ").trim() }; });
  }

  var pendingSelect = null;

  function restructure(index, change) {
    var it = state.items[index];
    if (!it) return false;
    var tpl = document.createElement("template");
    tpl.innerHTML = it.html || byId[it.id].html;
    var marks = [["data-lz-t", editableNodes], ["data-lz-i", imageNodes], ["data-lz-l", linkNodes]];
    marks.forEach(function (m) { m[1](tpl.content).forEach(function (el, k) { el.setAttribute(m[0], k); }); });
    if (change(tpl.content) === false) return false;
    var remap = function (attr, nodes, store) {
      if (!store) return null;
      var out = {};
      nodes.forEach(function (el, k) {
        var old = el.getAttribute(attr);
        if (old != null && store[old] != null) out[k] = JSON.parse(JSON.stringify(store[old]));
      });
      return Object.keys(out).length ? out : null;
    };
    var images = imageNodes(tpl.content);
    var links = linkNodes(tpl.content);
    var next = {
      textos: remap("data-lz-t", editableNodes(tpl.content), it.textos),
      imagenes: remap("data-lz-i", images, it.imagenes),
      links: remap("data-lz-l", links, it.links),
      ocultos: remap("data-lz-l", links, it.ocultos)
    };
    var picked = tpl.content.querySelector("[data-lz-pick]");
    var pickImg = picked && images.filter(function (img) { return picked.contains(img); })[0];
    var pick = pickImg ? images.indexOf(pickImg) : -1;
    tpl.content.querySelectorAll("[data-lz-t], [data-lz-i], [data-lz-l], [data-lz-pick]").forEach(function (el) {
      ["data-lz-t", "data-lz-i", "data-lz-l", "data-lz-pick"].forEach(function (a) { el.removeAttribute(a); });
    });
    it.html = tpl.innerHTML;
    Object.keys(next).forEach(function (k) { if (next[k]) it[k] = next[k]; else delete it[k]; });
    if (pick >= 0) pendingSelect = { module: index, key: String(pick) };
    return true;
  }

  function productAction(el, act, value) {
    var section = el.closest("section.mq-block");
    var module = moduleIndex(el);
    var product = productOf(el);
    if (!section || !product) return;
    var n = productsIn(section).indexOf(product);
    var name = (product.querySelector("h3") || {}).textContent || "el producto";
    var done = restructure(module, function (root) {
      var list = productsIn(root);
      var target = list[n];
      if (!target) return false;
      if (act === "dup") {
        var copy = target.cloneNode(true);
        copy.setAttribute("data-lz-pick", "");
        target.after(copy);
      } else if (act === "remove") {
        if (list.length < 2) return false;
        target.remove();
      } else if (act === "cat") {
        var tags = (target.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean);
        tags = tags.indexOf(value) === -1 ? tags.concat(value) : tags.filter(function (t) { return t !== value; });
        if (!tags.length) return false;
        target.setAttribute("data-tags", tags.join(" "));
        target.setAttribute("data-lz-pick", "");
      } else if (act === "newcat") {
        var group = target.closest("[data-filter-group]");
        var tabs = group && group.querySelectorAll("[data-filter]");
        if (!tabs || !tabs.length) return false;
        var base = slugify(value);
        var id = base;
        for (var k = 2; group.querySelector('[data-filter="' + id + '"]'); k++) id = base + "-" + k;
        var tab = tabs[tabs.length - 1].cloneNode(false);
        tab.classList.remove("is-on");
        tab.setAttribute("data-filter", id);
        tab.textContent = value;
        tabs[tabs.length - 1].after(tab);
        target.setAttribute("data-tags", ((target.getAttribute("data-tags") || "") + " " + id).trim());
        target.setAttribute("data-lz-pick", "");
      }
    });
    if (!done) {
      if (act === "remove") say("Es el único producto del módulo: si no lo querés, quitá el módulo entero.", "warn");
      if (act === "cat") say("Cada producto tiene que estar en al menos una categoría.", "warn");
      return;
    }
    closeImage();
    update();
    if (act === "dup") say("Duplicaste «" + name.trim() + "». Cambiale la foto, el nombre y el precio a la copia.", "ok");
    if (act === "remove") say("Quitaste «" + name.trim() + "».", "ok");
    if (act === "newcat") say("Creaste la categoría «" + value + "» y sumaste «" + name.trim() + "». Para sumar otros productos, tocá su foto y marcala.", "ok");
  }

  function isCategoryTab(el) {
    var tab = el.closest("[data-filter]");
    return !!tab && tab.getAttribute("data-filter") !== "todos" && !!tab.closest("[data-filter-group]");
  }

  function removeCategory(tabEl) {
    var section = tabEl.closest("section.mq-block");
    var id = tabEl.getAttribute("data-filter");
    if (!section || !id || id === "todos") return;
    var label = tabEl.textContent.replace(/\s+/g, " ").trim();
    var groups = Array.prototype.slice.call(section.querySelectorAll("[data-filter-group]"));
    var g = groups.indexOf(tabEl.closest("[data-filter-group]"));
    endEdit();
    var done = restructure(moduleIndex(tabEl), function (root) {
      var group = root.querySelectorAll("[data-filter-group]")[g];
      var tab = group && group.querySelector('[data-filter="' + id + '"]');
      if (!tab) return false;
      tab.remove();
      group.querySelectorAll("[data-item]").forEach(function (item) {
        var tags = (item.getAttribute("data-tags") || "").split(/\s+/).filter(function (t) { return t && t !== id; });
        item.setAttribute("data-tags", tags.join(" "));
      });
    });
    if (!done) return;
    update();
    say("Quitaste la categoría «" + label + "». Sus productos siguen en «Todos».", "ok");
  }

  function productTipHtml(el) {
    var product = productOf(el);
    if (!product) return "";
    var cats = productCategories(product);
    var tags = (product.getAttribute("data-tags") || "").split(/\s+/);
    return '<div class="lb-prod"><b>Producto</b>' +
      (cats.length ? "<small>Aparece en estas categorías:</small><div class=\"lb-prod-cats\">" + cats.map(function (c) {
        return '<button type="button" data-prod-cat="' + escapeHtml(c.id) + '" aria-pressed="' + (tags.indexOf(c.id) !== -1) + '">' + escapeHtml(c.label) + "</button>";
      }).join("") + '<button type="button" class="lb-prod-new" data-prod-newcat>+ Nueva</button></div>' +
        '<div class="lb-img-row lb-prod-newrow" hidden><input type="text" data-prod-newcat-name maxlength="24" placeholder="Nombre de la categoría"><button type="button" data-prod-newcat-ok>Crear</button></div>' : "") +
      '<div class="lb-img-row"><button type="button" class="is-ghost" data-prod-dup>Duplicar producto</button><button type="button" class="is-ghost" data-prod-remove>Quitar producto</button></div></div>';
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
        else if (e.target.closest("[data-img-ai]")) { var target = imgSel.el; withAi(function () { describeOne(target, false); }); }
        else if (e.target.closest("[data-img-link]")) selectLink(imgSel.el.closest("a[data-lb-l]"));
        else if (e.target.closest("[data-prod-dup]")) productAction(imgSel.el, "dup");
        else if (e.target.closest("[data-prod-remove]")) productAction(imgSel.el, "remove");
        else if (e.target.closest("[data-prod-cat]")) productAction(imgSel.el, "cat", e.target.closest("[data-prod-cat]").getAttribute("data-prod-cat"));
        else if (e.target.closest("[data-prod-newcat]")) {
          tip.querySelector(".lb-prod-newrow").hidden = false;
          tip.querySelector("[data-prod-newcat-name]").focus();
        } else if (e.target.closest("[data-prod-newcat-ok]")) newCategory();
      });
      var newCategory = function () {
        var input = tip.querySelector("[data-prod-newcat-name]");
        var value = input && input.value.replace(/\s+/g, " ").trim();
        if (!value) { if (input) input.focus(); return; }
        productAction(imgSel.el, "newcat", value);
      };
      tip.addEventListener("input", function (e) {
        if (imgSel && e.target.matches("[data-img-alt]")) commitImage({ alt: e.target.value });
      });
      tip.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.target.matches("[data-prod-newcat-name]")) { e.preventDefault(); newCategory(); return; }
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
    var canDescribe = isImg || !!el.closest(".nx-hero, .nx-hero-slide");
    var probe = new Image();
    var sizeId = "lbImgSize" + Date.now();
    tip.innerHTML =
      '<button type="button" class="lb-img-x" data-img-close aria-label="Cerrar">×</button>' +
      "<div><b>" + escapeHtml(role ? role.label : "Imagen") + "</b><br><small><span id=\"" + sizeId + "\" role=\"status\">Midiendo…</span>" + (need ? " · mínimo " + need : "") + "</small></div>" +
      (canDescribe ? '<label>Descripción de la foto<input type="text" data-img-alt maxlength="' + ((rules && rules.imagenes.altMax) || 125) + '" value="' + escapeHtml(data.alt || "") + '" placeholder="Describí lo importante o dejalo vacío si es decorativa"></label>' +
        (ai && isImg ? '<button type="button" class="is-ghost lb-img-ai" data-img-ai><i class="bi bi-stars"></i> Describir con IA</button>' : "") : "") +
      '<div class="lb-img-row"><button type="button" data-img-pick>Cambiar imagen</button>' +
      '<button type="button" class="is-save" data-img-save hidden></button>' +
      (el.closest("a[data-lb-l]") ? '<button type="button" class="is-ghost" data-img-link>Cambiar link</button>' : "") +
      (changed ? '<button type="button" class="is-ghost" data-img-revert>Volver a la original</button>' : "") + "</div>" +
      productTipHtml(el);
    renderImgSave();
    probe.onload = function () {
      var span = tip.querySelector("#" + sizeId);
      if (!span) return;
      var small = role && ((role.minAncho && probe.naturalWidth < role.minAncho) || (role.minAlto && probe.naturalHeight < role.minAlto));
      span.textContent = (small ? "Resolución baja · " : role ? "Resolución correcta · " : "") + probe.naturalWidth + "×" + probe.naturalHeight + "\u00a0px";
      span.className = small ? "is-warn" : role ? "is-good" : "";
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
    var doc = (imgSel || linkSel) && frameDoc();
    if (!doc) return;
    var dirty = isDirty();
    doc.querySelectorAll("#lbImgTip [data-img-save], #lbLinkTip [data-link-save]").forEach(function (btn) {
      btn.hidden = !state.landingId;
      btn.disabled = busy || !dirty;
      btn.textContent = busy ? "Guardando…" : !dirty ? "Guardada ✓" : "Guardar cambios";
    });
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
    var minW = (role && role.minAncho) || 0;
    var minH = (role && role.minAlto) || 0;
    var floor = Math.min(1, Math.max(minW / img.naturalWidth, minH / img.naturalHeight));
    var scale = Math.min(1, Math.max(floor, 1920 / Math.max(img.naturalWidth, img.naturalHeight)));
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    var webp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
    var type = webp ? "image/webp" : "image/jpeg";
    var maxBytes = ((role && role.maxKB) || 300) * 1024;
    var out;
    var bytes;

    while (true) {
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      if (!webp) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (var quality of [0.86, 0.78, 0.70, 0.62, 0.54, 0.50]) {
        out = canvas.toDataURL(type, quality);
        if (!out.startsWith("data:" + type + ";base64,")) throw new Error("No se pudo comprimir la imagen.");
        var encoded = out.slice(out.indexOf(",") + 1);
        bytes = encoded.length * 3 / 4 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
        if (bytes <= maxBytes) break;
      }
      if (bytes <= maxBytes || scale <= floor || Math.max(canvas.width, canvas.height) <= 320) break;
      scale = Math.max(floor, scale * 0.8);
    }

    return { src: out, w: canvas.width, h: canvas.height, kb: Math.round(bytes / 1024), overweight: bytes > maxBytes };
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
        try { return compressImage(res.img, role); }
        finally { URL.revokeObjectURL(res.url); }
      });
    job.then(function (out) {
      if (imgSel !== sel) selectImage(sel.el);
      commitImage({ src: out.src });
      renderImgTip();
      if (out.svg) { say("Imagen cambiada.", "ok"); return; }
      var small = role && ((role.minAncho && out.w < role.minAncho) || (role.minAlto && out.h < role.minAlto));
      if (!small && !out.overweight && ai && ai.configurada && sel.el.tagName === "IMG") { describeOne(sel.el, true); return; }
      say(small
        ? "Imagen cambiada, pero mide " + out.w + "×" + out.h + " px y el mínimo es " + minLabel(role) + ". Buscá una versión más grande."
        : out.overweight
          ? "Imagen cambiada, pero pesa " + out.kb + " KB. El máximo recomendado es " + ((role && role.maxKB) || 300) + " KB."
          : "Imagen cambiada: " + out.w + "×" + out.h + " px, " + out.kb + " KB.", small || out.overweight ? "warn" : "ok");
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

  /* Edición de links sobre la vista previa */
  var linkSel = null;
  var CLIENT_HINT = "Sale de los datos del cliente. Cambialo acá para esta landing o en sus datos para todas.";

  function linkKind(el, href) {
    var own = !el.closest(".person-card");
    if (el.classList.contains("nx-brand")) return { label: "Logo", field: "nombre", hint: "El logo y el nombre salen de los datos del cliente." };
    if (/wa\.me\//.test(href)) return { label: "WhatsApp", field: "telefono", hint: CLIENT_HINT };
    if (/^mailto:/.test(href)) return { label: "Email", field: own ? "email" : "", hint: own ? CLIENT_HINT : "" };
    if (/^tel:/.test(href)) return { label: "Teléfono", field: "telefono", hint: CLIENT_HINT };
    if (/google\.[a-z.]+\/maps/.test(href)) return { label: "Google Maps", field: "direccion", hint: CLIENT_HINT };
    var net = /(instagram|facebook|linkedin)\.com/.exec(href);
    if (net) return { label: net[1].charAt(0).toUpperCase() + net[1].slice(1).replace("edin", "edIn"), field: own ? net[1] : "", hint: own ? CLIENT_HINT : "" };
    if (/^#/.test(href)) return { label: "Link a una sección", hint: "Lleva a otra parte de esta landing." };
    return { label: "Link", hint: "" };
  }

  function normalizeHref(value) {
    var v = String(value || "").trim();
    if (!v || /^(#|\/|[a-z][a-z0-9+.-]*:)/i.test(v)) return v;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "mailto:" + v;
    if (/^\+?[\d\s().-]{8,}$/.test(v)) return "tel:" + v.replace(/[^\d+]/g, "");
    if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(v)) return "https://" + v;
    return v;
  }

  function setHref(el, href) {
    el.setAttribute("href", href);
    if (/^https?:/.test(href)) { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
    else if (/^#/.test(href)) el.removeAttribute("target");
  }

  function originalLink(it, key) {
    var el = moduleTemplate(it, true, false).links[key];
    return el ? el.getAttribute("href") : null;
  }

  function setLogoMode(mode) {
    var client = currentClient();
    closeLink();
    if (!client) { goTo("client"); return; }
    if (mode !== "texto" && !client.logo_url) {
      openClientForm("logo");
      say("Subí el logo de «" + client.nombre + "» para mostrarlo como imagen.", "warn");
      return;
    }
    if (logoMode(client) === mode) return;
    say("Guardando cómo se ve el logo…");
    var data = Object.assign({}, client, { logo_modo: mode });
    ["logo", "logo_url", "lista", "landings"].forEach(function (k) { delete data[k]; });
    window.Lanzate.api("PUT", "/api/clientes/" + client.id, data).then(function () {
      return loadClients();
    }).then(function () {
      renderPreview();
      saveDraft();
      say("Listo: el logo de «" + client.nombre + "» se ve como " + LOGO_MODES[mode].toLowerCase() + " en todas sus landings.", "ok");
    }).catch(function (err) { say(err.message, "warn"); });
  }

  var LOGO_MODES = { imagen: "Imagen", "imagen-texto": "Imagen y texto", texto: "Texto" };

  function linkTip() {
    var doc = frameDoc();
    var tip = doc.getElementById("lbLinkTip");
    if (!tip) {
      tip = doc.createElement("div");
      tip.id = "lbLinkTip";
      tip.hidden = true;
      tip.addEventListener("click", function (e) {
        if (!linkSel) return;
        var client = e.target.closest("[data-link-client]");
        if (e.target.closest("[data-link-save]")) createLanding();
        else if (e.target.closest("[data-link-revert]")) revertLink();
        else if (e.target.closest("[data-link-close]")) closeLink();
        else if (e.target.closest("[data-link-hide]")) hideMenuItem(linkSel.el);
        else if (e.target.closest("[data-logo-mode]")) setLogoMode(e.target.closest("[data-logo-mode]").getAttribute("data-logo-mode"));
        else if (e.target.closest("[data-link-mode]")) {
          linkSel.mode = e.target.closest("[data-link-mode]").getAttribute("data-link-mode");
          renderLinkTip();
          var field = tip.querySelector("[data-link-href], [data-link-section]");
          if (field) field.focus();
        }
        else if (client) { var field = client.getAttribute("data-link-client"); closeLink(); openClientForm(field); }
      });
      tip.addEventListener("change", function (e) {
        if (linkSel && e.target.matches("[data-link-section]") && e.target.value) commitLink(e.target.value);
      });
      tip.addEventListener("input", function (e) {
        if (!linkSel) return;
        if (e.target.matches("[data-link-text]")) {
          var textEl = linkTextEl(linkSel.el);
          if (!textEl) return;
          setPlainText(textEl, e.target.value);
          storeText(textEl);
          var count = tip.querySelector("[data-link-count]");
          if (count) count.innerHTML = textCount(textEl).html;
          return;
        }
        if (!e.target.matches("[data-link-href]")) return;
        var v = e.target.value.trim();
        var orig = originalLink(state.items[linkSel.module], linkSel.key) || "";
        var net = /(instagram|facebook|linkedin)\.com/.exec(orig);
        if (net && /^@/.test(v)) commitLink(window.Lanzate.socialUrl(net[1], v));
        else if (/wa\.me\//.test(orig) && /^\+?[\d\s().-]{8,}$/.test(v)) commitLink("https://wa.me/" + waNumber(v));
        else commitLink(normalizeHref(v));
      });
      tip.addEventListener("keydown", function (e) {
        if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); closeLink(); }
      });
      doc.body.appendChild(tip);
    }
    return tip;
  }

  function linkTextEl(a) {
    if (a.hasAttribute("data-lb-t")) return a;
    var texts = a.querySelectorAll("[data-lb-t]");
    return texts.length === 1 ? texts[0] : null;
  }

  function setPlainText(el, text) {
    var walker = el.ownerDocument.createTreeWalker(el, 4);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) if (/\S/.test(node.nodeValue)) nodes.push(node);
    if (!nodes.length) { el.appendChild(el.ownerDocument.createTextNode(text)); return; }
    var first = nodes[0].nodeValue;
    nodes[0].nodeValue = (/^\s/.test(first) ? " " : "") + text + (/\s$/.test(first) ? " " : "");
    nodes.slice(1).forEach(function (n) { n.nodeValue = ""; });
  }

  function textCount(el) {
    var role = rules && window.LanzateReglas ? window.LanzateReglas.textRole(el, rules) : null;
    var len = el.textContent.replace(/\s+/g, " ").trim().length;
    var tone = role && role.max && len > role.max ? "is-bad" : "";
    return { label: role ? role.label : "Texto", html: '<span class="' + tone + '">' + len + (role && role.max ? "/" + role.max : "") + "</span>" };
  }

  function sectionOptions(href) {
    var anchors = sectionAnchors();
    var opts = [["#top", "Arriba de todo"]].concat(state.items.map(function (it, i) {
      return ["#" + anchors[i], String(i + 1).padStart(2, "0") + " · " + byId[it.id].group];
    }));
    var found = opts.some(function (o) { return o[0] === href; });
    return (found ? "" : '<option value="" selected disabled>Elegí una sección</option>') + opts.map(function (o) {
      return '<option value="' + escapeHtml(o[0]) + '"' + (o[0] === href ? " selected" : "") + ">" + escapeHtml(o[1]) + "</option>";
    }).join("");
  }

  function renderLinkTip() {
    if (!linkSel) return;
    var el = linkSel.el;
    var tip = linkTip();
    var it = state.items[linkSel.module];
    var href = el.getAttribute("href") || "";
    var kind = linkKind(el, href || originalLink(it, linkSel.key) || "");
    var brand = el.classList.contains("nx-brand");
    var textEl = brand ? null : linkTextEl(el);
    if (!linkSel.mode) linkSel.mode = /^#/.test(href) ? "section" : "external";
    var section = linkSel.mode === "section";
    var count = textEl && textCount(textEl);
    tip.innerHTML =
      '<button type="button" class="lb-img-x" data-link-close aria-label="Cerrar">×</button>' +
      "<div><b>" + escapeHtml(kind.label) + "</b>" + (kind.hint ? "<br><small>" + escapeHtml(kind.hint) + "</small>" : "") + "</div>" +
      (brand ? '<div class="lb-link-modes" role="group" aria-label="Cómo se ve el logo">' + Object.keys(LOGO_MODES).map(function (m) {
        return '<button type="button" data-logo-mode="' + m + '" aria-pressed="' + (logoMode(currentClient()) === m) + '">' + LOGO_MODES[m].replace(" y ", " y\u00a0") + "</button>";
      }).join("") + "</div>" : "") +
      (textEl ? '<label><span>' + escapeHtml(count.label) + ' · <span data-link-count>' + count.html + "</span></span>" +
        '<input type="text" data-link-text value="' + escapeHtml(textEl.textContent.replace(/\s+/g, " ").trim()) + '"></label>' : "") +
      '<div class="lb-link-modes" role="group" aria-label="A dónde lleva">' +
      '<button type="button" data-link-mode="section" aria-pressed="' + section + '">Sección</button>' +
      '<button type="button" data-link-mode="external" aria-pressed="' + !section + '">Link externo</button></div>' +
      (section
        ? '<label>Lleva a<select data-link-section>' + sectionOptions(href) + "</select></label>"
        : '<label>Lleva a<input type="text" data-link-href value="' + escapeHtml(/^#/.test(href) ? "" : href) + '" placeholder="Web, email, teléfono o @usuario" spellcheck="false"></label>') +
      '<div class="lb-img-row"><button type="button" class="is-save" data-link-save hidden></button>' +
      (el.classList.contains("nav-link") ? '<button type="button" data-link-hide>Quitar del menú</button>' : "") +
      (kind.field ? '<button type="button" class="is-ghost" data-link-client="' + kind.field + '">' + (brand ? "Cambiar logo o nombre" : "Datos del cliente") + "</button>" : "") +
      '<button type="button" class="is-ghost" data-link-revert' + (it && it.links && it.links[linkSel.key] != null ? "" : " hidden") + ">Volver al original</button></div>";
    renderImgSave();
    var scale = frame.getBoundingClientRect().width / frame.offsetWidth || 1;
    tip.style.fontSize = Math.round(13 / scale) + "px";
    tip.hidden = false;
    var doc = frameDoc();
    var win = doc.defaultView;
    var r = el.getBoundingClientRect();
    var top = r.bottom + win.scrollY + 10;
    if (r.bottom + tip.offsetHeight + 10 > win.innerHeight && r.top > tip.offsetHeight + 10) top = r.top + win.scrollY - tip.offsetHeight - 10;
    tip.style.top = top + "px";
    tip.style.left = Math.max(8, Math.min(r.left + win.scrollX, doc.documentElement.clientWidth - tip.offsetWidth - 8)) + "px";
  }

  function selectLink(el) {
    if (linkSel && linkSel.el === el) return;
    closeLink();
    closeImage();
    endEdit();
    linkSel = { el: el, module: moduleIndex(el), key: el.getAttribute("data-lb-l") };
    el.classList.add("lb-link-on");
    renderLinkTip();
  }

  function closeLink() {
    if (!linkSel) return;
    linkSel.el.classList.remove("lb-link-on");
    linkSel = null;
    var doc = frameDoc();
    var tip = doc && doc.getElementById("lbLinkTip");
    if (tip) tip.hidden = true;
  }

  function commitLink(href) {
    var it = state.items[linkSel.module];
    if (!it) return;
    var orig = originalLink(it, linkSel.key);
    it.links = it.links || {};
    if (!href || href === orig) delete it.links[linkSel.key];
    else it.links[linkSel.key] = href;
    if (!Object.keys(it.links).length) delete it.links;
    linkSel.el.closest("section.mq-block").querySelectorAll('[data-lb-l="' + linkSel.key + '"]').forEach(function (o) { setHref(o, href || orig || ""); });
    var head = frameDoc().querySelector("#lbLinkTip > div:first-of-type");
    if (head && !linkSel.el.classList.contains("nx-brand")) {
      var kind = linkKind(linkSel.el, linkSel.el.getAttribute("href") || "");
      head.innerHTML = "<b>" + escapeHtml(kind.label) + "</b>" + (kind.hint ? "<br><small>" + escapeHtml(kind.hint) + "</small>" : "");
    }
    var revert = frameDoc().querySelector("#lbLinkTip [data-link-revert]");
    if (revert) revert.hidden = !(it.links && it.links[linkSel.key] != null);
    renderMode();
    renderOrder();
    saveDraft();
    renderImgSave();
  }

  function hideMenuItem(el) {
    var module = moduleIndex(el);
    var it = state.items[module];
    if (!it) return;
    var label = el.textContent.replace(/\s+/g, " ").trim();
    closeLink();
    endEdit();
    it.ocultos = it.ocultos || {};
    it.ocultos[el.getAttribute("data-lb-l")] = true;
    it.menuAjustado = true;
    update();
    say("Quitaste «" + label + "» del menú. Para sumarlo de nuevo: «Ítem al menú» en la barra del módulo.", "ok");
  }

  function revertLink() {
    commitLink("");
    renderLinkTip();
    say("El link volvió al original.", "ok");
  }

  /* IA: sugerir módulos y escribir textos. Solo con el servidor local: la clave nunca llega al navegador. */
  var aiBar = $("[data-lb-ai]");
  var aiModulesBtn = $("[data-lb-ai-modules]");
  var aiTextsBtn = $("[data-lb-ai-texts]");
  var qaAiBtn = $("[data-lb-qa-ai]");
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
    renderQaAi();
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
    aiModulesBtn.disabled = aiTextsBtn.disabled = qaAiBtn.disabled = true;
    if (btn) btn.classList.add("is-busy");
    say(waitText);
    return api("POST", "/api/ia", body).catch(function (err) {
      var config = /clave|Configurá/i.test(err.message);
      say(err.message, "warn", config ? { act: "ia-config", text: "Configurar IA" } : []);
      throw err;
    }).finally(function () {
      aiBusy = false;
      aiModulesBtn.disabled = aiTextsBtn.disabled = qaAiBtn.disabled = false;
      if (btn) btn.classList.remove("is-busy");
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
    if (!state.name.trim()) {
      say("Contale a la IA qué landing querés: escribí el nombre, por ejemplo «Promo de verano 20% off».", "warn");
      nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
      nameInput.focus({ preventScroll: true });
      return;
    }
    if (state.items.length && !window.confirm("La IA arma la landing de cero y reemplaza los " + state.items.length + " módulos que elegiste. ¿Seguimos?")) return;
    var names = {};
    library.forEach(function (g) { names[g.id] = g.name; });
    var catalogo = [];
    library.forEach(function (g) {
      g.modules.forEach(function (m) { catalogo.push({ id: m.id, grupo: g.name, variante: m.variant, nota: m.note }); });
    });
    var reglas = rules && window.LanzateReglas ? window.LanzateReglas.toPrompt(rules, names).split("\nTEXTOS")[0] : "";
    aiRequest(aiModulesBtn, { tarea: "modulos", cliente: aiClient(), objetivo: state.name.trim(), catalogo: catalogo, reglas: reglas },
      "Paso 1 de 2: la IA está eligiendo los módulos para " + currentClient().nombre + "…").then(function (data) {
      var before = JSON.stringify(state.items);
      state.items = data.modulos.map(function (id) { return menuDefault({ id: id, width: "full" }); });
      frame.addEventListener("load", function () {
        setTimeout(function () { writeTexts(before, data); }, 400);
      }, { once: true });
      update();
      showTab("order");
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

  function writeTexts(undoTo, built) {
    if (typeof undoTo !== "string") undoTo = null;
    var textos = aiTextList();
    if (!textos.length) { say("Todavía no hay textos en la vista previa. Sumá módulos y esperá a que cargue.", "warn"); return; }
    if (!currentClient()) {
      say("Elegí el cliente primero: la IA escribe los textos para su negocio.", "warn");
      clientSelect.focus();
      return;
    }
    setEditMode(false);
    aiRequest(aiTextsBtn, { tarea: "textos", cliente: aiClient(), objetivo: state.name.trim(), textos: textos },
      (built ? "Paso 2 de 2: la IA" : "La IA") + " está escribiendo " + textos.length + " textos para " + currentClient().nombre + ". Puede tardar un minuto…").then(function (data) {
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
      aiUndo = undoTo || prev;
      renderMode();
      renderOrder();
      renderPreview();
      saveDraft();
      if (built) {
        say("La IA armó la landing: " + plural(state.items.length, "módulo", "módulos") + " y " + count + " textos. " + (built.motivo ? built.motivo + " " : "") +
          "Revisala, cambiá las fotos por las del cliente y guardala.", "ok", { act: "ia-undo", text: "Deshacer" });
      } else {
        say("La IA escribió " + count + " textos. Revisalos en la vista previa: tocá cualquiera para ajustarlo.", "ok", { act: "ia-undo", text: "Deshacer" });
      }
    }, function () {
      if (built) {
        aiUndo = undoTo;
        say("La IA eligió los módulos pero no pudo escribir los textos. Probá «Escribir con IA» en la vista previa.", "warn", { act: "ia-undo", text: "Deshacer" });
      }
    });
  }

  /* IA: arreglar los errores de calidad que se pueden resolver solos */
  function aiFixList() {
    var out = { texts: [], widows: [], photos: [], total: 0 };
    var seen = new Set();
    qaView.issues.forEach(function (issue) {
      if (!issue.el || !issue.el.isConnected) return;
      var el = null;
      if (issue.largo || issue.viuda) {
        el = editableFor(issue.el);
        if (!el || seen.has(el)) return;
        if (issue.largo) out.texts.push({ el: el, largo: issue.largo });
        else out.widows.push(el);
      } else if (issue.area === "imagenes" && /texto alternativo/i.test(issue.text)) {
        el = issue.el.closest("[data-lb-i]");
        if (!el || el.tagName !== "IMG" || seen.has(el)) return;
        out.photos.push(el);
      } else return;
      seen.add(el);
      out.total++;
    });
    return out;
  }

  function renderQaAi() {
    var n = ai && qaReport ? aiFixList().total : 0;
    qaAiBtn.hidden = !n;
    $("[data-lb-qa-ai-count]").textContent = n;
    qaAiBtn.title = "La IA arregla " + plural(n, "problema", "problemas") + ": largo de textos, palabras sueltas y descripciones de fotos";
  }

  function applyAiTexts(list) {
    var sections = frameDoc() ? frameDoc().querySelectorAll("body > section.mq-block") : [];
    var count = 0;
    list.forEach(function (t) {
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
    return count;
  }

  function aiThumb(el) {
    return new Promise(function (resolve) {
      var src = imageData(el).src;
      if (!src) { resolve(null); return; }
      var img = new Image();
      img.onload = function () {
        try {
          var ratio = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      try { img.src = new URL(src, frameDoc().baseURI).href; } catch (e) { resolve(null); }
    });
  }

  function setAlt(module, key, alt) {
    var it = state.items[module];
    if (!it) return;
    var orig = originalImage(it, key) || {};
    var cur = Object.assign({}, it.imagenes && it.imagenes[key], { alt: alt });
    if (cur.alt === (orig.alt || "")) delete cur.alt;
    it.imagenes = it.imagenes || {};
    if (Object.keys(cur).length) it.imagenes[key] = cur;
    else delete it.imagenes[key];
    if (!Object.keys(it.imagenes).length) delete it.imagenes;
    var section = frameDoc() && frameDoc().querySelectorAll("body > section.mq-block")[module];
    if (section) section.querySelectorAll('[data-lb-i="' + key + '"]').forEach(function (o) { if (o.tagName === "IMG") o.setAttribute("alt", alt); });
  }

  function describePhotos(els, btn) {
    return Promise.all(els.map(function (el) {
      return aiThumb(el).then(function (src) {
        if (!src) return null;
        var m = moduleIndex(el);
        var section = el.closest("section.mq-block");
        var heading = section && section.querySelector("h1, h2, h3");
        var card = el.closest(".card, article, li, figure");
        var near = card && card !== section ? card.textContent : heading ? heading.textContent : "";
        return { el: el, module: m, key: el.getAttribute("data-lb-i"), foto: {
          id: m + "." + el.getAttribute("data-lb-i"), seccion: state.items[m] ? byId[state.items[m].id].group : "",
          contexto: window.LanzateReglas.norm(near || "").slice(0, 160), imagen: src } };
      });
    })).then(function (rows) {
      rows = rows.filter(Boolean);
      var byFoto = {};
      rows.forEach(function (r) { byFoto[r.foto.id] = r; });
      var count = 0;
      var chain = Promise.resolve();
      for (var i = 0; i < rows.length; i += 6) {
        (function (chunk) {
          chain = chain.then(function () {
            var body = { tarea: "fotos", cliente: aiClient(), max: (rules && rules.imagenes.altMax) || 125, fotos: chunk.map(function (r) { return r.foto; }) };
            var wait = "La IA está mirando " + (rows.length === 1 ? "la foto" : rows.length + " fotos") + " para describirlas…";
            return (btn ? aiRequest(btn, body, wait) : api("POST", "/api/ia", body)).then(function (data) {
              data.fotos.forEach(function (f) {
                var r = byFoto[f.id];
                if (!r) return;
                setAlt(r.module, r.key, f.alt);
                r.alt = f.alt;
                count++;
              });
            });
          });
        })(rows.slice(i, i + 6));
      }
      return chain.then(function () { return { count: count, rows: rows }; });
    });
  }

  function fixAllAi() {
    var list = aiFixList();
    if (!list.total) return;
    var prev = JSON.stringify(state.items);
    var done = { textos: 0, viudas: 0, fotos: 0 };
    var payload = list.texts.map(function (t) {
      var role = window.LanzateReglas.textRole(t.el, rules);
      var m = moduleIndex(t.el);
      return { id: m + "." + t.el.getAttribute("data-lb-t"), seccion: state.items[m] ? byId[state.items[m].id].group : "",
        tipo: role ? role.label : "Texto", min: t.largo.min || 0, max: t.largo.max || 0, actual: window.LanzateReglas.norm(t.el.textContent) };
    });
    setEditMode(false);
    list.widows.forEach(function (el) {
      beginEdit(el);
      if (joinLastWords(el)) done.viudas++;
      endEdit();
    });
    var chain = Promise.resolve();
    if (payload.length) {
      chain = chain.then(function () {
        return aiRequest(qaAiBtn, { tarea: "ajustar", cliente: aiClient(), textos: payload },
          "La IA está ajustando el largo de " + plural(payload.length, "texto", "textos") + "…").then(function (data) {
          done.textos = applyAiTexts(data.textos);
        });
      });
    }
    if (list.photos.length) {
      chain = chain.then(function () {
        return describePhotos(list.photos, qaAiBtn).then(function (res) { done.fotos = res.count; });
      });
    }
    var finish = function (ok) {
      var parts = [];
      if (done.textos) parts.push(plural(done.textos, "texto ajustado", "textos ajustados"));
      if (done.viudas) parts.push(plural(done.viudas, "palabra suelta unida", "palabras sueltas unidas"));
      if (done.fotos) parts.push(plural(done.fotos, "foto descrita", "fotos descritas"));
      if (parts.length) aiUndo = prev;
      renderMode();
      renderOrder();
      renderPreview();
      saveDraft();
      if (!parts.length) return;
      var text = "La IA arregló: " + parts.join(", ") + "." + (ok ? " Revisá cómo quedó en la vista previa." : " El resto no se pudo: probá de nuevo.");
      say(text, ok ? "ok" : "warn", { act: "ia-undo", text: "Deshacer" });
    };
    chain.then(function () { finish(true); }, function () { finish(false); });
  }

  function describeOne(el, auto) {
    var m = moduleIndex(el);
    var key = el.getAttribute("data-lb-i");
    var prev = JSON.stringify(state.items);
    describePhotos([el], auto ? null : qaAiBtn).then(function (res) {
      if (!res.count) { if (!auto) say("La IA no pudo ver esta foto. Escribí la descripción a mano.", "warn"); return; }
      aiUndo = prev;
      renderMode();
      renderOrder();
      saveDraft();
      scheduleQa(300);
      if (imgSel && imgSel.module === m && imgSel.key === key) {
        var input = frameDoc().querySelector("#lbImgTip [data-img-alt]");
        if (input) input.value = res.rows[0].alt;
      }
      say((auto ? "Imagen cambiada. " : "") + "La IA la describió como «" + res.rows[0].alt + "». Podés ajustarlo en «Descripción de la foto».", "ok", { act: "ia-undo", text: "Deshacer" });
    }, function (err) { if (!auto && err && err.message) say(err.message, "warn"); });
  }

  function undoAi() {
    if (!aiUndo) return;
    state.items = JSON.parse(aiUndo);
    aiUndo = null;
    update();
    say("Listo, volvió todo a como estaba antes de la IA.", "ok");
  }

  aiModulesBtn.addEventListener("click", function () { withAi(suggestModules); });
  aiTextsBtn.addEventListener("click", function () { withAi(function () { writeTexts(); }); });
  qaAiBtn.addEventListener("click", function () { withAi(fixAllAi); });
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
    if (!state.items.length) { qaReport = null; buildQaView(); qaBusy = false; renderQa(); renderMode(); return; }
    var doc = frameDoc();
    qaBusy = true;
    renderQa();
    var fonts = doc && doc.fonts ? doc.fonts.ready.catch(function () {}) : Promise.resolve();
    fonts.then(function () {
      return window.LanzateReglas.check({ doc: frameDoc(), win: frame.contentWindow, items: qaItems(), rules: rules, name: state.name, cliente: currentClient(),
        groupNames: library.reduce(function (acc, g) { acc[g.id] = g.name; return acc; }, {}) });
    }).then(function (report) {
      if (run !== qaRun) return;
      qaReport = report;
      buildQaView();
      qaBusy = false;
      renderQa();
      renderMode();
      afterClientFix(report);
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
    var v = qaView;
    var tone = !r ? "" : v.errors ? "is-error" : v.warnings ? "is-aviso" : "is-ok";
    qaBox.className = "lb-qa " + tone + (qaBusy ? " is-running" : "");
    qaBox.querySelector(".lb-qa-sum i").className = "bi " + (tone === "is-ok" ? "bi-patch-check-fill" : tone === "is-error" ? "bi-exclamation-octagon-fill" : tone === "is-aviso" ? "bi-exclamation-triangle-fill" : "bi-shield-check");
    if (!r) qaLabel.textContent = "Revisando calidad…";
    else if (!v.issues.length) qaLabel.textContent = "La landing cumple todas las reglas";
    else qaLabel.textContent = [v.errors ? plural(v.errors, "error", "errores") : "", v.warnings ? plural(v.warnings, "aviso", "avisos") : ""].filter(Boolean).join(" · ") +
      " en " + (DEVICE_NAMES[device] || "la vista previa").toLowerCase() + (rules.general.bloquear && v.errors ? ". Se guarda cuando no quedan errores." : "");
    if (!r) return;
    qaShown = v.issues.concat(v.ignored);
    var html = "";
    var last;
    v.issues.forEach(function (issue) {
      if (issue.module !== last) {
        last = issue.module;
        var it = issue.module == null ? null : state.items[issue.module];
        html += '<li class="lb-qa-group">' + (it
          ? '<button type="button" data-qa-module="' + issue.module + '">' + String(issue.module + 1).padStart(2, "0") + " · " + escapeHtml(byId[it.id].group) + "</button>"
          : "<span>Toda la landing</span>") + "</li>";
      }
      html += qaItemHtml(issue, false);
    });
    if (v.ignored.length) {
      html += '<li class="lb-qa-ignored"><details><summary>' + plural(v.ignored.length, "ignorado", "ignorados") + "</summary><ul>" +
        v.ignored.map(function (issue) { return qaItemHtml(issue, true); }).join("") + "</ul></details></li>";
    }
    qaList.hidden = !html;
    qaList.innerHTML = html;
    if (qaAiBtn) renderQaAi();
  }

  function qaItemHtml(issue, ignored) {
    var n = qaShown.indexOf(issue);
    var fix = !ignored && fixAction(issue);
    var canShow = issue.el || issue.module != null;
    return '<li class="lb-qa-item is-' + issue.level + (ignored ? " is-ignored" : "") + '">' +
      '<span class="rg-tag is-' + issue.level + '">' + (issue.level === "error" ? "Error" : "Aviso") + "</span>" +
      '<span class="lb-qa-text"><b>' + escapeHtml(issue.text) + "</b>" + (issue.detail ? "<small>" + escapeHtml(issue.detail) + "</small>" : "") + "</span>" +
      '<span class="lb-qa-acts">' +
      (ignored
        ? '<button type="button" class="lb-link" data-qa-unignore="' + n + '">Volver a mostrar</button>'
        : (fix ? '<button type="button" class="lb-qa-fix" data-qa-fix="' + n + '">Arreglar</button>'
          : canShow ? '<button type="button" class="lb-qa-fix is-ghost" data-qa-show="' + n + '">Ver</button>' : "") +
          '<button type="button" class="lb-link lb-qa-ignore" data-qa-ignore="' + n + '">Ignorar</button>') +
      "</span></li>";
  }

  /* Vista del panel: las fotos del modelo van juntas y lo ignorado queda aparte */
  var qaView = { issues: [], ignored: [], errors: 0, warnings: 0 };
  var qaShown = [];

  function isSamplePhoto(issue) {
    if (issue.area !== "imagenes" || !issue.el || !issue.el.isConnected || /texto alternativo/i.test(issue.text) || issue.el.closest(".nx-brand")) return false;
    var img = issue.el.closest("[data-lb-i]");
    var it = state.items[issue.module];
    return !!img && !!it && !(it.imagenes && it.imagenes[img.getAttribute("data-lb-i")]);
  }

  function issueKey(issue) {
    if (issue.key) return issue.key;
    var it = issue.module == null ? null : state.items[issue.module];
    return (it ? it.id : "landing") + "|" + issue.text;
  }

  function buildQaView() {
    var ignoredKeys = state.ignorados || [];
    var view = { issues: [], ignored: [], errors: 0, warnings: 0 };
    if (!qaReport) { qaView = view; return; }
    var samples = [];
    var all = [];
    qaReport.issues.forEach(function (issue) {
      if (isSamplePhoto(issue)) samples.push(issue);
      else all.push(issue);
    });
    if (samples.length) {
      all.push({
        key: "landing|fotos-ejemplo", level: "aviso", area: "imagenes", module: null, fotos: samples,
        text: samples.length === 1 ? "Queda 1 foto de ejemplo" : "Quedan " + samples.length + " fotos de ejemplo",
        detail: "Son las del modelo. Cambialas por fotos del cliente antes de publicar."
      });
    }
    all.forEach(function (issue) {
      if (ignoredKeys.indexOf(issueKey(issue)) !== -1) { view.ignored.push(issue); return; }
      view.issues.push(issue);
      if (issue.level === "error") view.errors++;
      else view.warnings++;
    });
    view.issues.sort(function (x, y) {
      return ((x.module == null ? -1 : x.module) - (y.module == null ? -1 : y.module)) || (x.level === y.level ? 0 : x.level === "error" ? -1 : 1);
    });
    qaView = view;
  }

  function setIgnored(issue, on) {
    var key = issueKey(issue);
    var list = (state.ignorados || []).filter(function (k) { return k !== key; });
    if (on) list.push(key);
    state.ignorados = list;
    buildQaView();
    renderQa();
    renderMode();
    saveDraft();
    var text = issue.text.replace(/\.$/, "");
    say(on ? "Ignoraste «" + text + "». Está abajo de todo en el panel, por si querés volver a mostrarlo." : "«" + text + "» volvió a la lista.", "ok");
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

  /* «Arreglar»: lleva al lugar donde se arregla cada problema */
  var EXAMPLE_FIELDS = { "example.com": "email", "5491123456789": "telefono", "2345 6789": "telefono", "Marca Ejemplo": "nombre", "Calle Ejemplo": "direccion" };
  var FIELD_NAMES = { email: "el email", telefono: "el teléfono", nombre: "el nombre", direccion: "la dirección" };

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
        if (field) saveAfterQa = { field: field, nombre: saved.nombre };
        renderPreview();
        renderMode();
        saveDraft();
        say("Datos de «" + saved.nombre + "» actualizados: la landing ya los\u00a0usa.", "ok");
      });
    });
    var input = document.querySelector(field === "logo" ? "dialog[open] [data-pf-logo-input]" : 'dialog[open] [name="' + field + '"]');
    if (input && field === "logo") input = input.closest("label") || input;
    if (input) setTimeout(function () { input.focus(); if (input.select) input.select(); }, 60);
  }

  function fixAction(issue) {
    if (issue.fotos) {
      var first = issue.fotos.map(function (f) { return f.el.isConnected && f.el.closest("[data-lb-i]"); }).filter(Boolean)[0];
      if (!first) return null;
      return function () {
        editImage(first);
        say(issue.fotos.length === 1 ? "Esta es la foto de ejemplo que queda: «Cambiar imagen» para subir la del cliente."
          : "Empezá por esta: «Cambiar imagen» para subir la del cliente. Después «Arreglar» te lleva a la siguiente.", "ok");
      };
    }
    if (issue.campo) {
      return function () {
        openClientForm(issue.campo);
        say("Completá " + (FIELD_NAMES[issue.campo] || "el dato") + " del cliente: se aplica solo en toda la landing.", "ok");
      };
    }
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
    if (issue.regla === "menu") {
      return function () {
        setEditMode(true);
        var section = frameDoc() && frameDoc().querySelectorAll("body > section.mq-block")[issue.module];
        var first = section && Array.prototype.find.call(section.querySelectorAll(".nav-link[data-lb-l]"), function (a) { return a.offsetParent; });
        if (first) { scrollToEl(first); selectLink(first); }
        say("Lo recomendado es " + menuLimit() + " ítems. Si querés achicarlo, tocá un ítem y elegí «Quitar del menú».", "ok");
      };
    }
    return null;
  }

  qaList.addEventListener("click", function (e) {
    if (!qaReport) return;
    var pick = function (attr) {
      var btn = e.target.closest("[" + attr + "]");
      return btn ? qaShown[Number(btn.getAttribute(attr))] : null;
    };
    var module = e.target.closest("[data-qa-module]");
    if (module) { showIssue({ module: Number(module.getAttribute("data-qa-module")) }); return; }
    var issue = pick("data-qa-show");
    if (issue) { showIssue(issue); return; }
    issue = pick("data-qa-ignore");
    if (issue) { setIgnored(issue, true); return; }
    issue = pick("data-qa-unignore");
    if (issue) { setIgnored(issue, false); return; }
    issue = pick("data-qa-fix");
    var act = issue && fixAction(issue);
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
    pinOrder();
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
    if (rules && rules.general.bloquear && state.items.length && qaReport && qaView.errors) {
      out.push({ key: "qa", text: "Corregí " + (qaView.errors === 1 ? "1 error" : qaView.errors + " errores") + " de calidad" });
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
    editHint.hidden = !state.items.length;
    if (jumpBtn) renderJump();
    renderAi();
    renderImgSave();
    renderColors();
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
        if (it.links) item.links = it.links;
        if (it.ocultos) item.ocultos = it.ocultos;
        if (it.menuAjustado) item.menuAjustado = true;
        if (/^#[0-9a-f]{6}$/i.test(it.fondo || "")) item.fondo = it.fondo;
        return item;
      }),
      estilo: lp.estilo || "",
      ignorados: lp.ignorados || [],
      descripcion: lp.descripcion || "",
      animacion: lp.animacion || ""
    };
    state.colores = readLandingColors(state.estilo);
    state.estilo = stripLandingColors(state.estilo);
    savedSnapshot = snapshot();
    menuDefaults(state.items);
    nameInput.value = state.name;
    renderDesc(true);
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
    var estilo = stripLandingColors(state.estilo);
    if (state.colores) estilo = "/*lz-colores " + JSON.stringify(state.colores) + "*/\n" + estilo;
    var body = { cliente_id: state.clienteId, nombre: state.name.trim(), html: imageTokens(html), items: state.items, estilo: estilo, ignorados: state.ignorados || [], descripcion: (state.descripcion || "").trim(), animacion: state.animacion || "" };
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
    state = { name: "", clienteId: clienteId || null, landingId: null, items: [], estilo: "", ignorados: [], descripcion: "", animacion: "suave" };
    savedSnapshot = null;
    nameInput.value = "";
    renderDesc(true);
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
    if (btn && btn.getAttribute("data-msg-act") === "undo-remove") undoRemove();
    if (btn && btn.getAttribute("data-msg-act") === "ia-config" && ai) openAiConfig();
  });

  newBtn.addEventListener("click", newLanding);

  /* En celular la vista previa queda debajo de los módulos: un botón salta de uno a otro */
  var jumpBtn = $("[data-lb-jump]");
  var stage = $(".lb-stage");
  var side = $(".lb-side");
  function onStage() {
    var r = stage.getBoundingClientRect();
    return r.top < window.innerHeight * 0.5;
  }
  function renderJump() {
    jumpBtn.hidden = !state.items.length;
    var there = onStage();
    $("[data-lb-jump-label]").textContent = there ? "Módulos" : "Ver landing";
    $("[data-lb-jump-icon]").className = "bi " + (there ? "bi-grid" : "bi-eye");
  }
  jumpBtn.addEventListener("click", function () {
    var target = onStage() ? side.querySelector('[data-lb-step="2"]') : stage;
    var header = $(".lib-header");
    var offset = (header ? header.getBoundingClientRect().height : 0) + 12;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  });
  window.addEventListener("scroll", renderJump, { passive: true });

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

  animSeg.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-value]");
    if (!btn) return;
    state.animacion = btn.getAttribute("data-value");
    renderSettings();
    renderMode();
    saveDraft();
  });
  $("[data-lb-anim-see]").addEventListener("click", function () { $("[data-lb-open]").click(); });

  allSeg.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-value]");
    if (!btn) return;
    state.items.forEach(function (it) { it.width = btn.getAttribute("data-value"); });
    refreshLight();
  });

  window.addEventListener("message", function (e) {
    if (e.source !== frame.contentWindow || !e.data) return;
    if (e.data.lbAct) moduleAction(e.data.lbAct.index, e.data.lbAct.act);
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

  var descInput = $("[data-lb-desc]");
  var descHint = $("[data-lb-desc-hint]");
  function renderDesc(fromState) {
    if (fromState) descInput.value = state.descripcion || "";
    var n = descInput.value.trim().length;
    descHint.textContent = !n ? "Es el texto que aparece en Google y al compartir el link. Si la dejás vacía, se usa el texto que acompaña al título principal."
      : n + " caracteres" + (n < 70 ? ": sumá un poco más, lo ideal es entre 70 y 160." : n > 160 ? ": Google corta a partir de 160, conviene acortarla." : ", buen largo.");
    descHint.className = "lb-hint" + (n && (n < 70 || n > 160) ? " is-warn" : "");
  }
  descInput.addEventListener("input", function () {
    state.descripcion = descInput.value;
    renderDesc(false);
    renderMode();
    saveDraft();
  });

  function setLandingColor(key, value) {
    var hex = normalizeHex(value);
    if (!hex) return;
    var next = effectiveColors();
    next[key] = hex;
    state.colores = next;
    paintLandingColors();
    renderColors();
    renderMode();
    saveDraft();
  }
  document.querySelectorAll("[data-color], [data-hex]").forEach(function (input) {
    input.addEventListener("input", function () {
      setLandingColor(input.getAttribute("data-color") || input.getAttribute("data-hex"), input.value);
    });
  });
  var resetColors = document.querySelector("[data-lb-colors-reset]");
  if (resetColors) resetColors.addEventListener("click", function () {
    state.colores = null;
    paintLandingColors();
    renderColors();
    renderMode();
    saveDraft();
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
      estilo: draft.estilo || "",
      ignorados: draft.ignorados || [],
      descripcion: draft.descripcion || "",
      animacion: draft.animacion == null ? "suave" : draft.animacion
    };
    state.colores = readLandingColors(state.estilo) || draft.colores || null;
    state.estilo = stripLandingColors(state.estilo);
    savedSnapshot = draft.saved || null;
    if (!state.landingId) menuDefaults(state.items);
    if (!state.landingId) return state.items.length || state.name.trim() ? { kind: "draft" } : null;
    if (savedSnapshot && isDirty()) return { kind: "unsaved", name: state.name };
    var last = { kind: "last", id: state.landingId, name: state.name };
    state = { name: "", clienteId: state.clienteId, landingId: null, items: [], estilo: "", ignorados: [], descripcion: "", animacion: "suave" };
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
    renderDesc(true);
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
    renderDesc(true);
    renderClients();
    update();
    if (!restored) return;
    if (restored.kind === "draft") {
      say("Recuperamos la landing que estabas\u00a0armando.", "", { act: "new", text: "Empezar de cero" });
    } else if (restored.kind === "unsaved") {
      say("Recuperamos los cambios sin guardar de «" + restored.name + "».", "", { act: "new", text: "Crear una nueva" });
    } else {
      say("La última vez trabajaste en «" + restored.name + "».", "", { href: "constructor.html?landing=" + restored.id, text: "Seguir editándola" });
    }
  }

  if (window.LanzateReglas) {
    window.LanzateReglas.load().then(function (loaded) {
      rules = loaded;
      if (library.length) {
        var before = state.items.map(function (it) { return it.id; }).join();
        pinOrder();
        if (state.items.map(function (it) { return it.id; }).join() !== before) update();
        else renderOrder();
      }
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
