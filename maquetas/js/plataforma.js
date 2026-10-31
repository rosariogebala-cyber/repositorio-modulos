(function () {
  "use strict";

  var OFFLINE = "No hay conexión con el servidor: iniciá la plataforma con «python3 server.py».";

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function api(method, url, body) {
    var opts = { method: method, cache: "no-store" };
    if (body !== undefined) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || "No se pudo completar la acción.");
        return data;
      });
    }, function () {
      var err = new Error(OFFLINE);
      err.offline = true;
      throw err;
    });
  }

  function formatDate(ms) {
    return new Date(ms).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function say(el, text, tone) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "lb-msg" + (tone ? " is-" + tone : "");
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join("").toUpperCase();
  }

  function avatar(c, size) {
    var style = "--c1:" + esc(c.color_primario) + ";--c2:" + esc(c.color_secundario);
    var inner = c.logo_url ? '<img src="' + esc(c.logo_url) + '" alt="">' : "<span>" + esc(initials(c.nombre)) + "</span>";
    return '<span class="pf-avatar' + (c.logo_url ? " has-logo" : "") + (size ? " is-" + size : "") + '" style="' + style + '">' + inner + "</span>";
  }

  function status(c) {
    return '<span class="pf-status is-' + esc(c.estado) + '">' + (c.estado === "pausado" ? "Pausado" : "Activo") + "</span>";
  }

  /* Formulario de cliente (alta y edición) */
  var form = null;

  function buildForm() {
    var dialog = document.createElement("dialog");
    dialog.className = "lb-dialog pf-form-dialog";
    dialog.setAttribute("aria-labelledby", "pfFormTitle");
    dialog.innerHTML =
      '<form method="dialog" novalidate>' +
      '<div class="lb-dialog-head"><div><h2 id="pfFormTitle">Nuevo cliente</h2><p data-pf-form-sub>Completá los datos del cliente. Solo el nombre es obligatorio.</p></div>' +
      '<button class="lb-dialog-close" type="button" data-pf-cancel aria-label="Cerrar"><i class="bi bi-x-lg"></i></button></div>' +
      '<div class="pf-form">' +
      '<label class="pf-field is-wide"><span>Nombre o razón social *</span><input class="lb-input" name="nombre" required autocomplete="organization" placeholder="Ej: Estudio Aurora"></label>' +
      '<label class="pf-field"><span>Rubro</span><input class="lb-input" name="rubro" placeholder="Ej: Arquitectura"></label>' +
      '<label class="pf-field"><span>Contacto</span><input class="lb-input" name="contacto" autocomplete="name" placeholder="Nombre y apellido"></label>' +
      '<label class="pf-field"><span>Email</span><input class="lb-input" name="email" type="email" autocomplete="email" placeholder="hola@example.com"></label>' +
      '<label class="pf-field"><span>Teléfono</span><input class="lb-input" name="telefono" type="tel" autocomplete="tel" placeholder="+54 11 5555-0000"></label>' +
      '<label class="pf-field is-wide"><span>Sitio web</span><input class="lb-input" name="sitio" type="url" placeholder="https://example.com"></label>' +
      '<div class="pf-field is-wide"><span>Marca</span>' +
      '<div class="pf-brand">' +
      '<div class="pf-logo" data-pf-logo-preview></div>' +
      '<div class="pf-brand-ctrls">' +
      '<div class="pf-logo-btns"><label class="lb-act"><i class="bi bi-upload"></i> <span data-pf-logo-label>Subir logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-pf-logo-input hidden></label>' +
      '<button class="lb-act" type="button" data-pf-logo-remove hidden><i class="bi bi-x-lg"></i> Quitar</button></div>' +
      '<div class="pf-colors"><label><input type="color" name="color_primario" value="#1b5e42"> Color principal</label>' +
      '<label><input type="color" name="color_secundario" value="#e7f3ee"> Color secundario</label></div>' +
      "</div></div><small class=\"pf-help\">PNG, JPG, WEBP o SVG de hasta 2 MB.</small></div>" +
      '<div class="pf-field is-wide"><span>Estado</span><div class="lb-seg" role="group" aria-label="Estado del cliente" data-pf-estado>' +
      '<button type="button" data-value="activo" aria-pressed="true"><i class="bi bi-check-circle"></i> Activo</button>' +
      '<button type="button" data-value="pausado" aria-pressed="false"><i class="bi bi-pause-circle"></i> Pausado</button></div></div>' +
      '<label class="pf-field is-wide"><span>Notas internas</span><textarea class="lb-input" name="notas" rows="3" placeholder="Acuerdos, fechas, preferencias…"></textarea></label>' +
      "</div>" +
      '<p class="lb-msg" data-pf-form-msg role="status" aria-live="polite"></p>' +
      '<div class="pf-form-foot">' +
      '<button class="lb-act is-danger" type="button" data-pf-delete hidden><i class="bi bi-trash3"></i> Eliminar cliente</button>' +
      '<span class="pf-form-actions"><button class="btn-nx-outline btn-sm" type="button" data-pf-cancel>Cancelar</button>' +
      '<button class="btn-nx btn-sm" type="submit" data-pf-save><i class="bi bi-check2-circle"></i> Guardar cliente</button></span>' +
      "</div></form>";
    document.body.appendChild(dialog);

    var f = dialog.querySelector("form");
    var state = { client: null, logoData: "", logoRemove: false, resolve: null };
    var preview = dialog.querySelector("[data-pf-logo-preview]");
    var removeBtn = dialog.querySelector("[data-pf-logo-remove]");
    var logoLabel = dialog.querySelector("[data-pf-logo-label]");
    var msg = dialog.querySelector("[data-pf-form-msg]");
    var estado = dialog.querySelector("[data-pf-estado]");

    function setEstado(value) {
      estado.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-value") === value)); });
    }
    function currentEstado() {
      var on = estado.querySelector('[aria-pressed="true"]');
      return on ? on.getAttribute("data-value") : "activo";
    }
    function showLogo(src) {
      preview.innerHTML = src ? '<img src="' + esc(src) + '" alt="Logo">' : '<i class="bi bi-image" aria-hidden="true"></i>';
      preview.classList.toggle("has-logo", !!src);
      removeBtn.hidden = !src;
      logoLabel.textContent = src ? "Cambiar logo" : "Subir logo";
    }

    estado.addEventListener("click", function (e) {
      var b = e.target.closest("[data-value]");
      if (b) setEstado(b.getAttribute("data-value"));
    });

    dialog.querySelector("[data-pf-logo-input]").addEventListener("change", function (e) {
      var file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { say(msg, "El logo pesa más de 2 MB. Probá con una versión más liviana.", "warn"); return; }
      var reader = new FileReader();
      reader.onload = function () {
        state.logoData = reader.result;
        state.logoRemove = false;
        showLogo(reader.result);
        say(msg, "");
      };
      reader.readAsDataURL(file);
    });
    removeBtn.addEventListener("click", function () {
      state.logoData = "";
      state.logoRemove = true;
      showLogo("");
    });

    dialog.querySelectorAll("[data-pf-cancel]").forEach(function (b) { b.addEventListener("click", function () { dialog.close(); }); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", function () {
      if (state.resolve) state.resolve(state.saved || null);
      state.resolve = null;
    });

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {};
      ["nombre", "rubro", "contacto", "email", "telefono", "sitio", "notas", "color_primario", "color_secundario"].forEach(function (k) {
        data[k] = f.elements[k].value.trim();
      });
      data.estado = currentEstado();
      if (!data.nombre) { say(msg, "Ponele un nombre al cliente.", "warn"); f.elements.nombre.focus(); return; }
      if (data.email && !f.elements.email.checkValidity()) { say(msg, "Revisá el email: no tiene un formato válido.", "warn"); f.elements.email.focus(); return; }
      if (state.logoData) data.logo_data = state.logoData;
      if (state.logoRemove) data.logo_quitar = true;
      var saveBtn = dialog.querySelector("[data-pf-save]");
      saveBtn.disabled = true;
      say(msg, "Guardando…");
      var req = state.client ? api("PUT", "/api/clientes/" + state.client.id, data) : api("POST", "/api/clientes", data);
      req.then(function (client) {
        state.saved = client;
        dialog.close();
      }).catch(function (err) {
        say(msg, err.message, "warn");
      }).then(function () { saveBtn.disabled = false; });
    });

    dialog.querySelector("[data-pf-delete]").addEventListener("click", function () {
      var c = state.client;
      if (!c || !confirm("¿Eliminar a «" + c.nombre + "»? Se borran sus datos y su logo.")) return;
      api("DELETE", "/api/clientes/" + c.id).then(function () {
        state.saved = { deleted: true, id: c.id, nombre: c.nombre };
        dialog.close();
      }).catch(function (err) { say(msg, err.message, "warn"); });
    });

    return {
      open: function (client) {
        state.client = client || null;
        state.logoData = "";
        state.logoRemove = false;
        state.saved = null;
        f.reset();
        var c = client || {};
        ["nombre", "rubro", "contacto", "email", "telefono", "sitio", "notas"].forEach(function (k) { f.elements[k].value = c[k] || ""; });
        f.elements.color_primario.value = c.color_primario || "#1b5e42";
        f.elements.color_secundario.value = c.color_secundario || "#e7f3ee";
        setEstado(c.estado || "activo");
        showLogo(c.logo_url || "");
        dialog.querySelector("#pfFormTitle").textContent = client ? "Editar cliente" : "Nuevo cliente";
        dialog.querySelector("[data-pf-form-sub]").textContent = client
          ? "Sus landings se guardan en " + client.carpeta + "."
          : "Completá los datos del cliente. Solo el nombre es obligatorio.";
        dialog.querySelector("[data-pf-delete]").hidden = !client;
        say(msg, "");
        dialog.showModal();
        f.elements.nombre.focus();
        return new Promise(function (resolve) { state.resolve = resolve; });
      }
    };
  }

  function clientForm(client) {
    if (!form) form = buildForm();
    return form.open(client);
  }

  /* Fila de landing con acciones */
  function landingRow(lp, opts) {
    opts = opts || {};
    var li = document.createElement("li");
    li.className = "lb-saved-item";
    var count = (lp.items || []).length;
    var meta = [];
    if (opts.showClient) meta.push('<a href="cliente.html?id=' + lp.cliente_id + '">' + esc(lp.cliente) + "</a>");
    meta.push(plural(count, "módulo", "módulos"), esc(formatDate(lp.actualizado)));
    li.innerHTML =
      '<span class="lb-saved-text"><strong>' + esc(lp.nombre) + "</strong>" +
      "<small>" + meta.join(" · ") + "</small>" +
      "<small>" + esc(lp.path) + (lp.disponible ? "" : ' · <b class="pf-missing">Falta la carpeta</b>') + "</small></span>" +
      '<span class="lb-saved-actions">' +
      '<a class="lb-act" href="' + esc(lp.url) + '" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Abrir</a>' +
      (opts.onEdit
        ? '<button class="lb-act" type="button" data-act="edit"><i class="bi bi-pencil"></i> Editar</button>'
        : '<a class="lb-act" href="constructor.html?landing=' + lp.id + '"><i class="bi bi-pencil"></i> Editar</a>') +
      '<button class="lb-act" type="button" data-act="duplicate"><i class="bi bi-copy"></i> Duplicar</button>' +
      '<button class="lb-act is-danger" type="button" data-act="delete"><i class="bi bi-trash3"></i> Eliminar</button>' +
      "</span>";
    li.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      var report = opts.onMessage || function () {};
      if (act === "edit") opts.onEdit(lp);
      if (act === "duplicate") {
        btn.disabled = true;
        api("POST", "/api/landings/" + lp.id + "/duplicate")
          .then(function (copy) { report("Se creó «" + copy.nombre + "» en " + copy.path + ".", "ok"); if (opts.onChange) opts.onChange(); })
          .catch(function (err) { btn.disabled = false; report(err.message, "warn"); });
      }
      if (act === "delete" && confirm("¿Eliminar «" + lp.nombre + "»? Se borra la carpeta " + lp.path.replace("index.html", "") + ".")) {
        btn.disabled = true;
        api("DELETE", "/api/landings/" + lp.id)
          .then(function () { report("Se eliminó «" + lp.nombre + "».", "ok"); if (opts.onChange) opts.onChange(); })
          .catch(function (err) { btn.disabled = false; report(err.message, "warn"); });
      }
    });
    return li;
  }

  function normalize(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /* Página: Clientes */
  function pageClientes() {
    var grid = document.querySelector("[data-pf-clients]");
    var empty = document.querySelector("[data-pf-empty]");
    var msg = document.querySelector("[data-pf-msg]");
    var search = document.querySelector("[data-pf-search]");
    var filter = document.querySelector("[data-pf-filter]");
    var count = document.querySelector("[data-pf-count]");
    var clients = [];
    var estado = "";

    function render() {
      var q = normalize(search.value.trim());
      var list = clients.filter(function (c) {
        return (!estado || c.estado === estado) &&
          (!q || normalize([c.nombre, c.rubro, c.contacto, c.email].join(" ")).indexOf(q) !== -1);
      });
      grid.innerHTML = "";
      list.forEach(function (c) {
        var art = document.createElement("article");
        art.className = "pf-client" + (c.estado === "pausado" ? " is-paused" : "");
        art.innerHTML =
          '<div class="pf-client-top">' + avatar(c) +
          '<div class="pf-client-name"><h2><a href="cliente.html?id=' + c.id + '">' + esc(c.nombre) + "</a></h2>" +
          "<p>" + esc(c.rubro || "Sin rubro") + "</p></div>" + status(c) + "</div>" +
          '<ul class="pf-client-data">' +
          (c.contacto ? '<li><i class="bi bi-person"></i>' + esc(c.contacto) + "</li>" : "") +
          (c.email ? '<li><i class="bi bi-envelope"></i>' + esc(c.email) + "</li>" : "") +
          (c.telefono ? '<li><i class="bi bi-telephone"></i>' + esc(c.telefono) + "</li>" : "") +
          (!c.contacto && !c.email && !c.telefono ? '<li class="is-muted"><i class="bi bi-info-circle"></i>Sin datos de contacto</li>' : "") +
          "</ul>" +
          '<div class="pf-client-foot"><span class="lb-badge">' + plural(c.landings, "landing", "landings") + "</span>" +
          '<span class="pf-client-actions"><button class="lb-act" type="button" data-act="edit"><i class="bi bi-pencil"></i> Editar</button>' +
          '<a class="lb-act" href="cliente.html?id=' + c.id + '">Ver ficha <i class="bi bi-arrow-right"></i></a></span></div>';
        art.querySelector('[data-act="edit"]').addEventListener("click", function () { edit(c); });
        grid.appendChild(art);
      });
      empty.hidden = list.length > 0;
      empty.textContent = clients.length ? "No hay clientes que coincidan con la búsqueda." : "Todavía no diste de alta ningún cliente. Empezá con «Nuevo cliente».";
      count.textContent = plural(clients.length, "cliente", "clientes");
    }

    function load() {
      return api("GET", "/api/clientes").then(function (list) { clients = list; render(); })
        .catch(function (err) { say(msg, err.message, "warn"); });
    }

    function edit(c) {
      clientForm(c).then(function (saved) {
        if (!saved) return;
        say(msg, saved.deleted ? "Se eliminó «" + saved.nombre + "»." : "Se guardaron los cambios de «" + saved.nombre + "».", "ok");
        load();
      });
    }

    document.querySelector("[data-pf-new-client]").addEventListener("click", function () {
      clientForm(null).then(function (saved) {
        if (!saved) return;
        say(msg, "Se dio de alta «" + saved.nombre + "». Ya podés crearle landings.", "ok");
        load();
      });
    });
    search.addEventListener("input", render);
    filter.addEventListener("click", function (e) {
      var b = e.target.closest("[data-value]");
      if (!b) return;
      estado = b.getAttribute("data-value");
      filter.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      render();
    });
    if (/[?&]nuevo=1/.test(location.search)) {
      history.replaceState(null, "", location.pathname);
      document.querySelector("[data-pf-new-client]").click();
    }
    load();
  }

  /* Página: ficha de cliente */
  function pageCliente() {
    var id = Number(new URLSearchParams(location.search).get("id"));
    var profile = document.querySelector("[data-pf-profile]");
    var list = document.querySelector("[data-pf-landings]");
    var empty = document.querySelector("[data-pf-landings-empty]");
    var msg = document.querySelector("[data-pf-msg]");
    var newLanding = document.querySelector("[data-pf-new-landing]");
    var countEl = document.querySelector("[data-pf-landings-count]");

    function field(icon, label, value) {
      return value ? '<div class="pf-fact"><dt><i class="bi bi-' + icon + '"></i> ' + label + "</dt><dd>" + value + "</dd></div>" : "";
    }

    function render(c) {
      document.title = c.nombre + " · Nexoia";
      newLanding.href = "constructor.html?cliente=" + c.id;
      var site = c.sitio ? '<a href="' + esc(/^https?:\/\//.test(c.sitio) ? c.sitio : "https://" + c.sitio) + '" target="_blank" rel="noopener">' + esc(c.sitio) + "</a>" : "";
      profile.innerHTML =
        '<div class="pf-profile-head">' + avatar(c, "lg") +
        '<div class="pf-profile-name"><p class="lb-kicker">' + esc(c.rubro || "Cliente") + "</p><h1>" + esc(c.nombre) + "</h1>" + status(c) + "</div>" +
        '<button class="btn-nx-outline btn-sm" type="button" data-pf-edit><i class="bi bi-pencil"></i> Editar datos</button></div>' +
        '<dl class="pf-facts">' +
        field("person", "Contacto", esc(c.contacto)) +
        field("envelope", "Email", c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a>" : "") +
        field("telephone", "Teléfono", esc(c.telefono)) +
        field("globe2", "Sitio web", site) +
        field("palette", "Colores", '<span class="pf-swatch" style="background:' + esc(c.color_primario) + '"></span><span class="pf-swatch" style="background:' + esc(c.color_secundario) + '"></span> ' + esc(c.color_primario) + " · " + esc(c.color_secundario)) +
        field("folder2", "Carpeta", esc(c.carpeta)) +
        "</dl>" +
        (c.notas ? '<div class="pf-notes"><strong>Notas internas</strong><p>' + esc(c.notas) + "</p></div>" : "");
      profile.querySelector("[data-pf-edit]").addEventListener("click", function () {
        clientForm(c).then(function (saved) {
          if (!saved) return;
          if (saved.deleted) { location.href = "clientes.html"; return; }
          say(msg, "Se guardaron los cambios.", "ok");
          load();
        });
      });
      list.innerHTML = "";
      c.lista.forEach(function (lp) {
        list.appendChild(landingRow(lp, { onChange: load, onMessage: function (t, tone) { say(msg, t, tone); } }));
      });
      countEl.textContent = c.lista.length;
      empty.hidden = c.lista.length > 0;
    }

    function load() {
      return api("GET", "/api/clientes/" + id).then(render).catch(function (err) {
        profile.innerHTML = '<p class="pf-empty">' + esc(err.message) + ' <a href="clientes.html">Volver a clientes</a></p>';
        newLanding.hidden = true;
      });
    }
    load();
  }

  /* Página: todas las landings */
  function pageLandings() {
    var list = document.querySelector("[data-pf-landings]");
    var empty = document.querySelector("[data-pf-landings-empty]");
    var msg = document.querySelector("[data-pf-msg]");
    var search = document.querySelector("[data-pf-search]");
    var select = document.querySelector("[data-pf-client-filter]");
    var count = document.querySelector("[data-pf-count]");
    var newLanding = document.querySelector("[data-pf-new-landing]");
    var landings = [];
    var preset = new URLSearchParams(location.search).get("cliente") || "";

    function render() {
      var q = normalize(search.value.trim());
      var cid = select.value;
      var shown = landings.filter(function (lp) {
        return (!cid || String(lp.cliente_id) === cid) && (!q || normalize(lp.nombre + " " + lp.cliente).indexOf(q) !== -1);
      });
      list.innerHTML = "";
      shown.forEach(function (lp) {
        list.appendChild(landingRow(lp, { showClient: true, onChange: load, onMessage: function (t, tone) { say(msg, t, tone); } }));
      });
      empty.hidden = shown.length > 0;
      empty.textContent = landings.length ? "No hay landings con ese filtro." : "Todavía no creaste landings. Empezá desde la ficha de un cliente o con «Nueva landing».";
      count.textContent = plural(shown.length, "landing", "landings");
      newLanding.href = "constructor.html" + (cid ? "?cliente=" + cid : "");
    }

    function load() {
      return Promise.all([api("GET", "/api/clientes"), api("GET", "/api/landings")]).then(function (res) {
        var current = select.value || preset;
        preset = "";
        select.innerHTML = '<option value="">Todos los clientes</option>' + res[0].map(function (c) {
          return '<option value="' + c.id + '">' + esc(c.nombre) + " (" + c.landings + ")</option>";
        }).join("");
        select.value = res[0].some(function (c) { return String(c.id) === current; }) ? current : "";
        landings = res[1];
        render();
      }).catch(function (err) { say(msg, err.message, "warn"); });
    }

    search.addEventListener("input", render);
    select.addEventListener("change", render);
    load();
  }

  window.Nexoia = { api: api, esc: esc, say: say, clientForm: clientForm, landingRow: landingRow, plural: plural };

  var page = document.body.getAttribute("data-page");
  if (page === "clientes") pageClientes();
  if (page === "cliente") pageCliente();
  if (page === "landings") pageLandings();
})();
