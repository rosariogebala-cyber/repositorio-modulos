(function () {
  "use strict";

  var R = window.NexoiaReglas;
  var esc = window.Nexoia.esc;
  var $ = function (sel) { return document.querySelector(sel); };
  var msg = $("[data-rg-msg]");
  var saveBtn = $("[data-rg-save]");
  var saveLabel = $("[data-rg-save-label]");
  var saveBar = $("[data-rg-savebar]");
  var saveBarBtn = $("[data-rg-save-bar]");
  var FORMATS = ["webp", "avif", "jpg", "jpeg", "png", "svg", "gif"];
  var LEVELS = [["error", "Error"], ["aviso", "Aviso"]];

  var rules = R.defaults();
  var saved = "";
  var groups = [];
  var groupNames = {};
  var busy = false;

  function say(text, tone) {
    msg.textContent = text || "";
    msg.className = "lb-msg" + (tone ? " is-" + tone : "");
  }
  function snapshot() { return JSON.stringify(rules, function (k, v) { return k === "local" || k === "actualizado" ? undefined : v; }); }
  function dirty() { return snapshot() !== saved; }
  function levelOptions(value) {
    return LEVELS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === value ? " selected" : "") + ">" + l[1] + "</option>"; }).join("");
  }

  function refresh() {
    var changed = dirty();
    saveBtn.disabled = busy || !changed;
    saveLabel.textContent = busy ? "Guardando…" : changed ? "Guardar reglas" : "Guardado";
    saveBar.hidden = !changed;
    saveBarBtn.disabled = busy;
    $("[data-rg-summary]").textContent = R.toPrompt(rules, groupNames);
  }

  /* Estructura */
  function renderStructure() {
    var oblig = $("[data-rg-oblig]");
    oblig.innerHTML = groups.length ? groups.map(function (g) {
      var on = rules.estructura.obligatorios.indexOf(g.id) !== -1;
      return '<label class="rg-chip"><input type="checkbox" value="' + g.id + '"' + (on ? " checked" : "") + "><span>" + esc(g.name) + "</span></label>";
    }).join("") : '<p class="lb-empty">No se pudieron leer las secciones de la biblioteca.</p>';
    $("[data-rg-oblig-level]").innerHTML = levelOptions(rules.estructura.nivelObligatorios);

    $("[data-rg-structure]").innerHTML = rules.estructura.reglas.map(function (r, i) {
      return '<li class="rg-row" data-i="' + i + '">' +
        '<label class="rg-switch"><input type="checkbox" data-k="activo"' + (r.activo ? " checked" : "") + ' aria-label="Activar: ' + esc(r.label) + '"><span aria-hidden="true"></span></label>' +
        '<div class="rg-row-text"><b>' + esc(r.label) + "</b></div>" +
        (r.valor !== undefined
          ? '<label class="rg-num"><input class="lb-input" type="number" min="0" max="999" data-k="valor" value="' + r.valor + '" aria-label="' + esc(r.label) + '"><span>' + esc(r.unidad || "") + "</span></label>"
          : "") +
        '<select class="lb-input rg-level-select" data-k="nivel" aria-label="Nivel">' + levelOptions(r.nivel) + "</select>" +
        "</li>";
    }).join("");

    document.querySelectorAll("[data-rg-block]").forEach(function (input) {
      input.checked = input.value === (rules.general.bloquear ? "bloquear" : "avisar");
    });
  }

  /* Roles de textos e imágenes */
  function num(label, key, value, attrs) {
    return '<label class="rg-num"><span>' + label + '</span><input class="lb-input" type="number" min="0" step="1" data-k="' + key + '" value="' + (value || 0) + '"' + (attrs || "") + "></label>";
  }

  function renderRoles(kind) {
    var list = rules[kind].roles;
    $('[data-rg-roles="' + kind + '"]').innerHTML = list.map(function (r, i) {
      var fields = kind === "textos"
        ? num("Mín.", "min", r.min, ' max="2000"') + num("Máx.", "max", r.max, ' max="2000"')
        : num("Ancho mín.", "minAncho", r.minAncho, ' max="8000" step="10"') +
          num("Alto mín.", "minAlto", r.minAlto, ' max="8000" step="10"') +
          '<label class="rg-num"><span>Proporción</span><select class="lb-input" data-k="proporcion">' +
          R.proporciones.map(function (p) { return '<option value="' + p + '"' + (p === (r.proporcion || "") ? " selected" : "") + ">" + (p || "Libre") + "</option>"; }).join("") +
          "</select></label>" +
          num("Peso máx. (KB)", "maxKB", r.maxKB, ' max="20000" step="10"');
      return '<li class="rg-row rg-role' + (r.activo ? "" : " is-off") + '" data-i="' + i + '">' +
        '<label class="rg-switch"><input type="checkbox" data-k="activo"' + (r.activo ? " checked" : "") + ' aria-label="Activar: ' + esc(r.label) + '"><span aria-hidden="true"></span></label>' +
        '<div class="rg-role-main">' +
        '<input class="rg-name" type="text" data-k="label" value="' + esc(r.label) + '" aria-label="Nombre de la regla">' +
        '<details class="rg-where"><summary>Dónde aplica</summary>' +
        '<input class="lb-input rg-selector" type="text" spellcheck="false" data-k="selector" value="' + esc(r.selector) + '" aria-label="Selector CSS de ' + esc(r.label) + '">' +
        '<small>Selector CSS dentro de cada sección. Separá varios con coma.</small></details>' +
        "</div>" +
        '<div class="rg-fields">' + fields + "</div>" +
        '<span class="rg-tools">' +
        '<button type="button" data-act="up" aria-label="Subir prioridad"' + (i === 0 ? " disabled" : "") + '><i class="bi bi-arrow-up"></i></button>' +
        '<button type="button" data-act="down" aria-label="Bajar prioridad"' + (i === list.length - 1 ? " disabled" : "") + '><i class="bi bi-arrow-down"></i></button>' +
        (r.custom ? '<button type="button" data-act="remove" aria-label="Eliminar regla"><i class="bi bi-trash3"></i></button>' : "") +
        "</span></li>";
    }).join("");
  }

  function renderFlags() {
    document.querySelectorAll("[data-rg-flag]").forEach(function (input) {
      var p = input.getAttribute("data-rg-flag").split(".");
      input.checked = !!rules[p[0]][p[1]];
    });
    document.querySelectorAll("[data-rg-num]").forEach(function (input) {
      var p = input.getAttribute("data-rg-num").split(".");
      input.value = rules[p[0]][p[1]];
    });
    $("[data-rg-examples]").value = rules.textos.listaEjemplos.join("\n");
    $("[data-rg-sharp]").value = String(Number(rules.imagenes.nitidez) || 0);
    $("[data-rg-formats]").innerHTML = FORMATS.map(function (f) {
      var on = rules.imagenes.formatos.indexOf(f) !== -1;
      return '<label class="rg-chip"><input type="checkbox" value="' + f + '"' + (on ? " checked" : "") + "><span>" + f.toUpperCase() + "</span></label>";
    }).join("");
  }

  function noWidows(root) {
    root.querySelectorAll(".rg-main p, .rg-main b, .rg-main small, .rg-main h2, .rg-savebar span").forEach(function (el) {
      var walker = document.createTreeWalker(el, 4);
      var nodes = [];
      var node;
      while ((node = walker.nextNode())) nodes.push(node);
      for (var i = nodes.length - 1; i >= 0; i--) {
        if (!/\S/.test(nodes[i].nodeValue)) continue;
        nodes[i].nodeValue = nodes[i].nodeValue.replace(/(\S)[ \t\n]+(\S+\s*)$/, "$1\u00a0$2");
        break;
      }
    });
  }

  function renderAll() {
    renderStructure();
    renderRoles("textos");
    renderRoles("imagenes");
    renderFlags();
    refresh();
    noWidows(document);
  }

  function value(input) {
    if (input.type === "checkbox") return input.checked;
    if (input.type === "number") return Math.max(0, Number(input.value) || 0);
    return input.value;
  }

  /* Eventos */
  $("[data-rg-oblig]").addEventListener("change", function () {
    rules.estructura.obligatorios = Array.prototype.map.call(document.querySelectorAll("[data-rg-oblig] input:checked"), function (i) { return i.value; });
    refresh();
  });
  $("[data-rg-oblig-level]").addEventListener("change", function (e) { rules.estructura.nivelObligatorios = e.target.value; refresh(); });

  $("[data-rg-structure]").addEventListener("input", function (e) {
    var row = e.target.closest("[data-i]");
    var key = e.target.getAttribute("data-k");
    if (!row || !key) return;
    rules.estructura.reglas[Number(row.getAttribute("data-i"))][key] = value(e.target);
    refresh();
  });

  document.querySelectorAll("[data-rg-block]").forEach(function (input) {
    input.addEventListener("change", function () { rules.general.bloquear = input.value === "bloquear"; refresh(); });
  });

  ["textos", "imagenes"].forEach(function (kind) {
    var list = $('[data-rg-roles="' + kind + '"]');
    list.addEventListener("input", function (e) {
      var row = e.target.closest("[data-i]");
      var key = e.target.getAttribute("data-k");
      if (!row || !key) return;
      var role = rules[kind].roles[Number(row.getAttribute("data-i"))];
      role[key] = value(e.target);
      if (key === "activo") row.classList.toggle("is-off", !role.activo);
      refresh();
    });
    list.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var roles = rules[kind].roles;
      var i = Number(btn.closest("[data-i]").getAttribute("data-i"));
      var act = btn.getAttribute("data-act");
      if (act === "up" && i > 0) roles.splice(i - 1, 0, roles.splice(i, 1)[0]);
      if (act === "down" && i < roles.length - 1) roles.splice(i + 1, 0, roles.splice(i, 1)[0]);
      if (act === "remove") roles.splice(i, 1);
      renderRoles(kind);
      refresh();
      noWidows(list);
    });
  });

  document.querySelectorAll("[data-rg-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var kind = btn.getAttribute("data-rg-add");
      var role = kind === "textos"
        ? { id: "custom-" + Date.now(), custom: true, label: "Nueva regla de texto", selector: ".mi-clase", min: 0, max: 80, activo: true }
        : { id: "custom-" + Date.now(), custom: true, label: "Nueva regla de imagen", selector: ".mi-clase img", minAncho: 1200, minAlto: 0, proporcion: "", maxKB: 300, activo: true };
      rules[kind].roles.unshift(role);
      renderRoles(kind);
      refresh();
      var first = $('[data-rg-roles="' + kind + '"] .rg-role');
      first.querySelector("details").open = true;
      first.querySelector(".rg-name").select();
    });
  });

  document.querySelectorAll("[data-rg-flag]").forEach(function (input) {
    input.addEventListener("change", function () {
      var p = input.getAttribute("data-rg-flag").split(".");
      rules[p[0]][p[1]] = input.checked;
      refresh();
    });
  });
  document.querySelectorAll("[data-rg-num]").forEach(function (input) {
    input.addEventListener("input", function () {
      var p = input.getAttribute("data-rg-num").split(".");
      rules[p[0]][p[1]] = value(input);
      refresh();
    });
  });
  $("[data-rg-examples]").addEventListener("input", function (e) {
    rules.textos.listaEjemplos = e.target.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    refresh();
  });
  $("[data-rg-sharp]").addEventListener("change", function (e) { rules.imagenes.nitidez = Number(e.target.value); refresh(); });
  $("[data-rg-formats]").addEventListener("change", function () {
    rules.imagenes.formatos = Array.prototype.map.call(document.querySelectorAll("[data-rg-formats] input:checked"), function (i) { return i.value; });
    refresh();
  });

  document.querySelectorAll("[data-rg-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var name = tab.getAttribute("data-rg-tab");
      document.querySelectorAll("[data-rg-tab]").forEach(function (t) { t.setAttribute("aria-selected", String(t === tab)); });
      document.querySelectorAll("[data-rg-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-rg-panel") !== name; });
      try { history.replaceState(null, "", "#" + name); } catch (err) { /* noop */ }
    });
  });

  $("[data-rg-reset]").addEventListener("click", function () {
    if (!window.confirm("¿Volver a los valores recomendados? Se reemplazan todas las reglas, incluidas las que sumaste.")) return;
    rules = R.defaults();
    renderAll();
    say("Volviste a los valores recomendados. Tocá «Guardar reglas» para aplicarlos.", "ok");
  });

  function save() {
    busy = true;
    refresh();
    say("Guardando las reglas…");
    R.save(rules).then(function (data) {
      rules = data;
      saved = snapshot();
      renderAll();
      say("Reglas guardadas. Ya se aplican en el constructor para todo el equipo.", "ok");
    }).catch(function (err) {
      say(err.message, "warn");
    }).then(function () { busy = false; refresh(); });
  }
  saveBtn.addEventListener("click", save);
  saveBarBtn.addEventListener("click", save);

  $("[data-rg-copy]").addEventListener("click", function (e) {
    var btn = e.currentTarget;
    var text = R.toPrompt(rules, groupNames);
    var done = function () { btn.innerHTML = '<i class="bi bi-check2"></i> Copiado'; setTimeout(function () { btn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar'; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copiá las reglas:", text); });
    else window.prompt("Copiá las reglas:", text);
  });

  $("[data-rg-download]").addEventListener("click", function () {
    var data = JSON.parse(snapshot());
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" }));
    a.download = "reglas.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  window.addEventListener("beforeunload", function (e) {
    if (dirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  function loadGroups() {
    return fetch("index.html", { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll(".lib-section").forEach(function (s) {
        var h = s.querySelector(".lib-title h2");
        if (!h) return;
        groups.push({ id: s.id, name: h.textContent.trim() });
        groupNames[s.id] = h.textContent.trim();
      });
    }).catch(function () { /* sin biblioteca: se muestran los ids */ });
  }

  var hash = location.hash.replace("#", "");
  var startTab = document.querySelector('[data-rg-tab="' + hash + '"]');
  if (startTab) startTab.click();

  Promise.all([R.load(), loadGroups()]).then(function (res) {
    rules = res[0];
    saved = snapshot();
    renderAll();
  });
})();
