(function () {
  "use strict";

  var OFFLINE = "El panel no responde. Abrí la Terminal en Lanzate_modulos y corré: python3 server.py";

  var currentNav = document.querySelector(".lib-header nav .is-current");
  if (currentNav && currentNav.parentElement.scrollWidth > currentNav.parentElement.clientWidth) {
    var nav = currentNav.parentElement;
    var left = currentNav.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollLeft = left - (nav.clientWidth - currentNav.offsetWidth) / 2;
  }

  var panelPage = /\/(?:constructor|landings|clientes|cliente|reglas)\.html$/.test(location.pathname);
  var SESSION = { ok: true, requiere: false, online: false };

  /* Clave del equipo: si no hay sesión, al login */
  function toLogin() {
    if (/login\.html$/.test(location.pathname)) return;
    location.href = "/maquetas/login.html?volver=" + encodeURIComponent(location.pathname + location.search);
  }
  if (panelPage) {
    fetch("/api/sesion", { cache: "no-store", credentials: "same-origin" }).then(function (r) { return r.json(); })
      .then(function (s) { SESSION = s; if (!s.ok) toLogin(); else addLogout(); })
      .catch(function () { /* sin servidor: el aviso lo da cada pedido */ });
  }

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function api(method, url, body) {
    var opts = { method: method, cache: "no-store", credentials: "same-origin" };
    if (body !== undefined) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    return fetch(url, opts).then(function (r) {
      if (r.status === 401 && !/\/api\/login$/.test(url)) toLogin();
      if (r.status === 413) throw new Error("La landing pesa demasiado para guardarla. Usá menos fotos o más livianas.");
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

  var SOCIAL_HOSTS = { instagram: "instagram.com", facebook: "facebook.com", linkedin: "linkedin.com/company" };

  function socialUrl(network, value) {
    var v = String(value || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(v)) return "https://" + v;
    return "https://" + SOCIAL_HOSTS[network] + "/" + v.replace(/^@/, "");
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
    var inner = c.logo_url ? '<img src="' + esc(c.logo_url) + '" alt="Logo de ' + esc(c.nombre) + '">' : "<span>" + esc(initials(c.nombre)) + "</span>";
    return '<span class="pf-avatar' + (c.logo_url ? " has-logo" : "") + (size ? " is-" + size : "") + '" style="' + style + '">' + inner + "</span>";
  }

  /* Aviso del plan: vencido, por vencer o sin pedidos de cambios disponibles */
  function planAlert(c) {
    var p = c.plan_estado || {};
    if (!c.plan) return "";
    if (p.vencido) return "El plan " + p.plan + " venció el " + String(c.plan_vence).split("-").reverse().join("/") + ".";
    if (p.dias != null && p.dias <= 15) return "El plan " + p.plan + " vence " + (p.dias === 0 ? "hoy" : p.dias === 1 ? "mañana" : "en " + p.dias + " días") + ".";
    if (p.cambios_mes && p.cambios_restantes === 0) return "Ya usó los " + plural(p.cambios_mes, "pedido", "pedidos") + " de cambios de este mes.";
    return "";
  }

  function status(c) {
    return '<span class="pf-status is-' + esc(c.estado) + '">' + (c.estado === "pausado" ? "Pausado" : "Activo") + "</span>";
  }

  /* Formulario de cliente (alta y edición) */
  var form = null;
  var TEXT_FIELDS = ["nombre", "rubro", "contacto", "email", "telefono", "sitio", "privacidad_url", "terminos_url", "direccion", "horario", "instagram", "facebook", "linkedin", "notas", "ga4", "gtm", "meta_pixel"];

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
      '<label class="pf-field"><span>Tipo de cliente</span><select class="lb-input" name="tipo_cliente"><option value="real">Real</option><option value="demo">Demo</option></select></label>' +
      '<label class="pf-field"><span>Rubro</span><input class="lb-input" name="rubro" placeholder="Ej: Arquitectura"></label>' +
      '<label class="pf-field"><span>Contacto</span><input class="lb-input" name="contacto" autocomplete="name" placeholder="Nombre y apellido"></label>' +
      '<label class="pf-field"><span>Email</span><input class="lb-input" name="email" type="email" autocomplete="email" placeholder="hola@example.com"></label>' +
      '<label class="pf-field"><span>Teléfono</span><input class="lb-input" name="telefono" type="tel" autocomplete="tel" placeholder="+54 11 5555-0000"></label>' +
      '<label class="pf-field is-wide"><span>Sitio web</span><input class="lb-input" name="sitio" type="url" placeholder="https://example.com"></label>' +
      '<label class="pf-field"><span>Política de privacidad</span><input class="lb-input" name="privacidad_url" type="url" placeholder="https://"></label>' +
      '<label class="pf-field"><span>Términos y condiciones</span><input class="lb-input" name="terminos_url" type="url" placeholder="https://"></label>' +
      '<label class="pf-field is-wide"><span>Dirección</span><input class="lb-input" name="direccion" autocomplete="street-address" placeholder="Ej: Av. Corrientes 1234, CABA"></label>' +
      '<label class="pf-field is-wide"><span>Horario de atención</span><input class="lb-input" name="horario" placeholder="Ej: Lun a Vie, 9 a 18 h"></label>' +
      '<label class="pf-field"><span>Instagram</span><input class="lb-input" name="instagram" placeholder="@usuario o link"></label>' +
      '<label class="pf-field"><span>Facebook</span><input class="lb-input" name="facebook" placeholder="Link de la página"></label>' +
      '<label class="pf-field is-wide"><span>LinkedIn</span><input class="lb-input" name="linkedin" placeholder="Link de la empresa o perfil"></label>' +
      '<div class="pf-field is-wide"><span>Marca</span>' +
      '<div class="pf-brand">' +
      '<div class="pf-logo" data-pf-logo-preview></div>' +
      '<div class="pf-brand-ctrls">' +
      '<div class="pf-logo-btns"><label class="lb-act"><i class="bi bi-upload"></i> <span data-pf-logo-label>Subir logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-pf-logo-input hidden></label>' +
      '<button class="lb-act" type="button" data-pf-logo-remove hidden><i class="bi bi-x-lg"></i> Quitar</button></div>' +
      '<div class="lb-seg pf-logo-mode" role="group" aria-label="Cómo se muestra el logo" data-pf-logo-modo>' +
      '<button type="button" data-value="imagen" aria-pressed="true"><i class="bi bi-image"></i> Imagen</button>' +
      '<button type="button" data-value="imagen-texto" aria-pressed="false"><i class="bi bi-layout-sidebar"></i> Imagen y&nbsp;texto</button>' +
      '<button type="button" data-value="texto" aria-pressed="false"><i class="bi bi-fonts"></i> Texto</button></div>' +
      '<div class="pf-colors"><label><input type="color" name="color_primario" value="#1b5e42"> Color principal</label>' +
      '<label><input type="color" name="color_secundario" value="#e7f3ee"> Color secundario</label></div>' +
      "</div></div><small class=\"pf-help\">PNG, JPG, WEBP o SVG de hasta 2 MB.</small></div>" +
      '<div class="pf-field is-wide"><span>Estado</span><div class="lb-seg" role="group" aria-label="Estado del cliente" data-pf-estado>' +
      '<button type="button" data-value="activo" aria-pressed="true"><i class="bi bi-check-circle"></i> Activo</button>' +
      '<button type="button" data-value="pausado" aria-pressed="false"><i class="bi bi-pause-circle"></i> Pausado</button></div></div>' +
      '<div class="pf-field is-wide pf-tracking"><span>Medición de campañas <em class="lb-optional">(opcional)</em></span>' +
      '<small class="pf-help">Se cargan solos en todas las landings de este cliente, y miden cada consulta y cada clic en&nbsp;WhatsApp.</small></div>' +
      '<label class="pf-field"><span>Google Analytics</span><input class="lb-input" name="ga4" placeholder="G-AB12CD34EF" autocomplete="off" spellcheck="false"></label>' +
      '<label class="pf-field"><span>Google Tag Manager</span><input class="lb-input" name="gtm" placeholder="GTM-AB12CD3" autocomplete="off" spellcheck="false"></label>' +
      '<label class="pf-field is-wide"><span>Píxel de Meta</span><input class="lb-input" name="meta_pixel" inputmode="numeric" placeholder="Número del píxel, ej: 123456789012345" autocomplete="off" spellcheck="false"></label>' +
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
    var logoModo = dialog.querySelector("[data-pf-logo-modo]");

    function setLogoModo(value) {
      logoModo.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-value") === value)); });
    }
    logoModo.addEventListener("click", function (e) {
      var b = e.target.closest("[data-value]");
      if (b) setLogoModo(b.getAttribute("data-value"));
    });

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
        if (logoModo.querySelector('[data-value="texto"][aria-pressed="true"]')) setLogoModo("imagen");
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
      TEXT_FIELDS.concat(["color_primario", "color_secundario"]).forEach(function (k) {
        data[k] = f.elements[k].value.trim();
      });
      data.tipo_cliente = f.elements.tipo_cliente.value;
      data.estado = currentEstado();
      var mode = logoModo.querySelector('[aria-pressed="true"]');
      data.logo_modo = mode ? mode.getAttribute("data-value") : "";
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
        TEXT_FIELDS.forEach(function (k) { f.elements[k].value = c[k] || ""; });
        f.elements.color_primario.value = c.color_primario || "#1b5e42";
        f.elements.color_secundario.value = c.color_secundario || "#e7f3ee";
        f.elements.tipo_cliente.value = c.tipo_cliente || "real";
        setEstado(c.estado || "activo");
        setLogoModo(c.logo_modo || (c.logo_url ? "imagen" : "texto"));
        showLogo(c.logo_url || "");
        dialog.querySelector("#pfFormTitle").textContent = client ? "Editar cliente" : "Nuevo cliente";
        dialog.querySelector("[data-pf-form-sub]").textContent = client
          ? "Sus landings se publican en " + client.carpeta + "<landing>/."
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
    var count = lp.cantidad_modulos == null ? (lp.items || []).length : lp.cantidad_modulos;
    var when = new Date(lp.actualizado).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }).replace(/ de /g, " ");
    var meta = [plural(count, "módulo", "módulos"), '<span title="' + esc(formatDate(lp.actualizado)) + '">' + esc(when) + "</span>"];
    var planWarn = lp.aviso_plan ? '<small><b class="pf-missing">No entra en el plan: ' + esc(lp.aviso_plan) + "</b></small>" : "";
    if (lp.ejemplo) meta.push('<span class="lb-badge" title="Se muestra en Proyectos del sitio de venta">Ejemplo en el sitio</span>');
    var icon = function (tag, attrs, ico, label, extra) {
      return "<" + tag + ' class="lb-act lb-act-icon' + (extra || "") + '" ' + attrs + ' title="' + label + '" aria-label="' + label + " " + esc(lp.nombre) + '">' +
        '<i class="bi ' + ico + '" aria-hidden="true"></i></' + tag + ">";
    };
    li.title = lp.path;
    li.innerHTML =
      '<a class="lb-saved-thumb" href="' + esc(lp.url) + '" target="_blank" rel="noopener" aria-label="Abrir ' + esc(lp.nombre) + '">' +
      (lp.preview ? '<img src="' + esc(lp.preview) + '" alt="Vista previa de ' + esc(lp.nombre) + '" loading="lazy">' : "") +
      '<i class="bi bi-window" aria-hidden="true"></i></a>' +
      '<span class="lb-saved-text"><strong>' + esc(lp.nombre) + "</strong>" +
      (opts.showClient ? '<small class="lb-saved-client"><a href="cliente.html?id=' + lp.cliente_id + '">' + esc(lp.cliente) + "</a></small>" : "") +
      "<small>" + meta.join(" · ") + "</small>" +
      (lp.disponible ? "" : '<small><b class="pf-missing">Sin publicar</b></small>') + planWarn + "</span>" +
      '<span class="lb-saved-actions">' +
      icon("a", 'href="' + esc(lp.url) + '" target="_blank" rel="noopener"', "bi-box-arrow-up-right", "Abrir") +
      (opts.onEdit
        ? icon("button", 'type="button" data-act="edit"', "bi-pencil", "Editar")
        : icon("a", 'href="constructor.html?landing=' + lp.id + '"', "bi-pencil", "Editar")) +
      icon("button", 'type="button" data-act="example" aria-pressed="' + (lp.ejemplo ? "true" : "false") + '"', lp.ejemplo ? "bi-star-fill" : "bi-star", lp.ejemplo ? "Sacar de los ejemplos del sitio" : "Mostrar como ejemplo en el sitio") +
      icon("button", 'type="button" data-act="editor"', "bi-chat-square-text", "Copiar link de pedido de cambios (portal del cliente)") +
      icon("button", 'type="button" data-act="duplicate"', "bi-copy", "Duplicar") +
      icon("button", 'type="button" data-act="delete"', "bi-trash3", "Eliminar", " is-danger") +
      "</span>";
    var thumb = li.querySelector(".lb-saved-thumb img");
    if (thumb) {
      thumb.addEventListener("error", function () {
        if (lp.portada && thumb.getAttribute("src") !== lp.portada) thumb.src = lp.portada;
        else thumb.remove();
      });
    }
    li.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      var report = opts.onMessage || function () {};
      if (act === "edit") opts.onEdit(lp);
      if (act === "example") {
        btn.disabled = true;
        api("PUT", "/api/landings/" + lp.id, { ejemplo: !lp.ejemplo }).then(function (saved) {
          report(saved.ejemplo ? "«" + lp.nombre + "» se muestra como ejemplo en el sitio. Publicá para que se vea online." : "«" + lp.nombre + "» ya no se muestra en el sitio.", "ok");
          if (opts.onChange) opts.onChange();
        }).catch(function (err) { btn.disabled = false; report(err.message, "warn"); });
      }
      if (act === "editor") {
        navigator.clipboard.writeText(lp.editor).then(function () {
          report("Link copiado. El cliente lo abre con su usuario y contraseña del portal.", "ok");
        }, function () { window.prompt("Copiá el link del editor:", lp.editor); });
      }
      if (act === "duplicate") {
        btn.disabled = true;
        api("POST", "/api/landings/" + lp.id + "/duplicate")
          .then(function (copy) {
            report("Se creó «" + copy.nombre + "».", "ok");
            if (opts.onChange) opts.onChange();
          })
          .catch(function (err) { btn.disabled = false; report(err.message, "warn"); });
      }
      var question = "¿Eliminar «" + lp.nombre + "»? Deja de estar online cuando publiques.";
      if (act === "delete" && confirm(question)) {
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
    var typeFilter = document.querySelector("[data-pf-type]");
    var count = document.querySelector("[data-pf-count]");
    var clients = [];
    var estado = "";

    function render() {
      var q = normalize(search.value.trim());
      var list = clients.filter(function (c) {
        return (!estado || c.estado === estado) &&
          (!typeFilter.value || c.tipo_cliente === typeFilter.value) &&
          (!q || normalize([c.nombre, c.rubro, c.contacto, c.email].join(" ")).indexOf(q) !== -1);
      });
      grid.innerHTML = "";
      list.forEach(function (c) {
        var art = document.createElement("article");
        art.className = "pf-client" + (c.estado === "pausado" ? " is-paused" : "");
        art.innerHTML =
          '<div class="pf-client-top">' + avatar(c) +
          '<div class="pf-client-name"><h2><a href="cliente.html?id=' + c.id + '">' + esc(c.nombre) + "</a></h2>" +
          "<p>" + esc(c.rubro || "Sin rubro") + "</p>" +
          "</div>" + status(c) + "</div>" +
          (c.pidio_clave ? '<a class="pf-pending" href="cliente.html?id=' + c.id + '#pf-acceso"><i class="bi bi-key-fill" aria-hidden="true"></i> Pidió su contraseña</a>' : "") +
          (planAlert(c) ? '<a class="pf-pending" href="cliente.html?id=' + c.id + '#pf-plan"><i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i> ' + esc(planAlert(c)) + "</a>" : "") +
          '<ul class="pf-client-data">' +
          (c.contacto ? '<li><i class="bi bi-person"></i>' + esc(c.contacto) + "</li>" : "") +
          (c.email ? '<li><i class="bi bi-envelope"></i>' + esc(c.email) + "</li>" : "") +
          (c.telefono ? '<li><i class="bi bi-telephone"></i>' + esc(c.telefono) + "</li>" : "") +
          (!c.contacto && !c.email && !c.telefono ? '<li class="is-muted"><i class="bi bi-info-circle"></i>Sin datos de contacto</li>' : "") +
          "</ul>" +
          '<div class="pf-client-foot"><span class="lb-badge">' + plural(c.landings, "landing", "landings") + " · " + (c.tipo_cliente === "demo" ? "Demo" : "Real") + (c.plan ? " · " + esc(planName(c.plan)) : "") + "</span>" +
          '<span class="pf-client-actions">' +
          '<a class="lb-act" href="cliente.html?id=' + c.id + '">Ver ficha <i class="bi bi-arrow-right"></i></a></span></div>';
        grid.appendChild(art);
      });
      empty.hidden = list.length > 0;
      empty.textContent = clients.length ? "No hay clientes que coincidan con la búsqueda." : "Todavía no diste de alta ningún cliente. Empezá con «Nuevo cliente».";
      count.textContent = plural(clients.length, "cliente", "clientes");
    }

    function load() {
      return loadPlans().then(function () { return api("GET", "/api/clientes"); }).then(function (list) {
        clients = list;
        render();
      })
        .catch(function (err) { say(msg, err.message, "warn"); });
    }

    document.querySelector("[data-pf-new-client]").addEventListener("click", function () {
      clientForm(null).then(function (saved) {
        if (!saved) return;
        say(msg, "Se dio de alta «" + saved.nombre + "». Ya podés crearle landings.", "ok");
        load();
      });
    });
    search.addEventListener("input", render);
    typeFilter.addEventListener("change", render);
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

    function row(icon, label, value) {
      return value ? '<div class="cf-row"><dt><i class="bi bi-' + icon + '" aria-hidden="true"></i>' + label + "</dt><dd>" + value + "</dd></div>" : "";
    }

    function money(n) { return n ? "$" + Number(n).toLocaleString("es-AR") : ""; }

    function render(c) {
      document.title = c.nombre + " · Lanzate";
      newLanding.href = "constructor.html?cliente=" + c.id;
      var site = c.sitio ? '<a href="' + esc(/^https?:\/\//.test(c.sitio) ? c.sitio : "https://" + c.sitio) + '" target="_blank" rel="noopener">' + esc(c.sitio.replace(/^https?:\/\//, "")) + "</a>" : "";
      var ps = c.plan_estado || {};
      var plan = PLANS.filter(function (p) { return p.id === c.plan; })[0];
      var month = new Date().toISOString().slice(0, 7);
      var requests = (c.pedidos || []).slice().reverse();
      var portalUrl = c.editor;
      var portalShort = portalUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
      var used = ps.cambios_usados || 0;
      var limit = ps.cambios_mes || 0;
      var pct = limit ? Math.min(100, Math.round(used / limit * 100)) : 0;
      var since = c.creado ? new Date(c.creado).toLocaleDateString("es-AR", { month: "long", year: "numeric" }) : "";
      var vence = c.plan_vence ? c.plan_vence.split("-").reverse().join("/") : "";
      var venceText = ps.vencido ? "Venció el " + vence : ps.dias != null ? (ps.dias === 0 ? "Vence hoy" : ps.dias === 1 ? "Vence mañana" : "Vence en " + ps.dias + " días") + " · " + vence : "Sin fecha de vencimiento";
      var socials = ["instagram", "facebook", "linkedin"].filter(function (k) { return c[k]; }).map(function (k) {
        var handle = socialUrl(k, c[k]).replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop();
        return '<a class="cf-chip" href="' + esc(socialUrl(k, c[k])) + '" target="_blank" rel="noopener"><i class="bi bi-' + k + '" aria-hidden="true"></i> @' + esc(handle) + "</a>";
      }).join("");
      var tracking = [c.ga4 ? "Analytics" : "", c.gtm ? "Tag Manager" : "", c.meta_pixel ? "Píxel de Meta" : ""].filter(Boolean);
      var trackingOff = tracking.length && ps.plan && !ps.medicion;

      profile.innerHTML =
        (c.pidio_clave ? '<div class="cf-alert is-key" role="status"><i class="bi bi-key-fill" aria-hidden="true"></i><p><strong>' + esc(c.nombre) +
          " pidió su contraseña</strong> el " + esc(new Date(c.pidio_clave).toLocaleDateString("es-AR", { day: "numeric", month: "long" })) + ". Copiá el acceso y mandáselo.</p>" +
          '<button class="btn-nx btn-sm" type="button" data-pf-copiar-acceso><i class="bi bi-copy" aria-hidden="true"></i> Copiar acceso</button>' +
          '<button class="btn-nx-outline btn-sm" type="button" data-pf-clave-enviada>Ya se la mandé</button></div>' : "") +
        (planAlert(c) ? '<div class="cf-alert" role="status"><i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i><p><strong>' + esc(planAlert(c)) + "</strong> " +
          (ps.vencido || (ps.dias != null && ps.dias <= 15) ? "Avisale para renovarlo y actualizá la fecha." : "Un pedido más se cobra aparte o pasa al mes que viene.") + "</p></div>" : "") +

        '<header class="cf-hero" style="--c1:' + esc(c.color_primario) + ";--c2:" + esc(c.color_secundario) + '">' +
          '<div class="cf-hero-main">' + avatar(c, "xl") +
            '<div class="cf-hero-text">' +
              '<p class="cf-kicker">' + esc(c.rubro || "Cliente") + "</p>" +
              "<h1>" + esc(c.nombre) + "</h1>" +
              '<p class="cf-hero-meta">' + status(c) +
                '<span class="cf-pill' + (plan ? " is-plan" : "") + '"><i class="bi bi-stars" aria-hidden="true"></i> ' + esc(plan ? "Plan " + plan.nombre : "Sin plan") + "</span>" +
                '<span class="cf-pill"><i class="bi bi-' + (c.tipo_cliente === "demo" ? "easel" : "patch-check") + '" aria-hidden="true"></i> ' + (c.tipo_cliente === "demo" ? "Demo" : "Cliente real") + "</span>" +
                (since ? '<span class="cf-since">Cliente desde ' + esc(since) + "</span>" : "") +
              "</p>" +
            "</div>" +
          "</div>" +
          '<div class="cf-hero-actions">' +
            '<a class="btn-nx" href="' + esc(portalUrl) + '" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> Abrir portal</a>' +
            '<button class="btn-nx-outline" type="button" data-pf-edit><i class="bi bi-pencil" aria-hidden="true"></i> Editar datos</button>' +
          "</div>" +
        "</header>" +

        '<div class="cf-grid">' +
        '<div class="cf-col">' +

          '<section class="cf-card cf-portal" aria-labelledby="pf-acceso">' +
            '<div class="cf-card-head"><span class="cf-icon"><i class="bi bi-door-open" aria-hidden="true"></i></span><div><h2 id="pf-acceso">Portal del cliente</h2>' +
            "<p>Ahí ve su web, su plan y te manda los pedidos de cambios.</p></div></div>" +
            '<div class="cf-link"><i class="bi bi-link-45deg" aria-hidden="true"></i><a href="' + esc(portalUrl) + '" target="_blank" rel="noopener">' + esc(portalShort) + "</a>" +
              '<button class="cf-icon-btn" type="button" data-pf-copiar-link aria-label="Copiar link del portal" title="Copiar link"><i class="bi bi-copy" aria-hidden="true"></i></button></div>' +
            (c.portal_usuario
              ? '<dl class="cf-access">' +
                  '<div><dt>Usuario</dt><dd><code>' + esc(c.portal_usuario) + "</code></dd></div>" +
                  "<div><dt>Contraseña</dt><dd>" + (c.portal_clave
                    ? '<code data-pf-clave hidden>' + esc(c.portal_clave) + '</code><code data-pf-clave-oculta aria-hidden="true">••••••••••</code>' +
                      '<button class="cf-icon-btn" type="button" data-pf-ver-clave aria-pressed="false" aria-label="Mostrar contraseña" title="Mostrar"><i class="bi bi-eye" aria-hidden="true"></i></button>'
                    : '<span class="cf-muted">No se puede mostrar: guardá una nueva.</span>') + "</dd></div>" +
                "</dl>" +
                '<button class="btn-nx btn-sm cf-wide" type="button" data-pf-copiar-acceso><i class="bi bi-whatsapp" aria-hidden="true"></i> Copiar acceso para mandárselo</button>'
              : '<p class="cf-empty"><i class="bi bi-lock" aria-hidden="true"></i> Todavía no tiene usuario. Creale uno abajo.</p>') +
            "<details" + (c.portal_usuario ? "" : " open") + ' class="cf-details"><summary>' + (c.portal_usuario ? "Cambiar usuario o contraseña" : "Crear acceso") + "</summary>" +
              '<form class="cf-form" data-pf-acceso>' +
                '<label>Usuario <input name="usuario" required minlength="3" maxlength="60" autocomplete="off" value="' + esc(c.portal_usuario || c.slug) + '"></label>' +
                '<label>Contraseña <input name="clave" type="text" minlength="8" maxlength="128" autocomplete="off" placeholder="Vacía: se crea una sola"></label>' +
                '<button class="btn-nx btn-sm" type="submit">' + (c.portal_usuario ? "Guardar" : "Crear acceso") + "</button>" +
              "</form></details>" +
            '<p class="cf-status" data-pf-editor-estado role="status"></p>' +
          "</section>" +

          '<section class="cf-card" aria-labelledby="pf-cambios">' +
            '<div class="cf-card-head"><span class="cf-icon"><i class="bi bi-chat-square-text" aria-hidden="true"></i></span><div><h2 id="pf-cambios">Pedidos de cambios</h2>' +
            "<p>" + (limit ? "Este mes usó " + used + " de " + limit + "." : used ? "Este mes: " + plural(used, "pedido", "pedidos") + "." : "Registrá cada pedido que aplicás.") + "</p></div></div>" +
            (limit ? '<div class="cf-meter' + (used >= limit ? " is-full" : "") + '" role="img" aria-label="' + used + " de " + limit + ' pedidos usados"><span style="width:' + pct + '%"></span></div>' +
              '<p class="cf-meter-note">' + (ps.cambios_restantes ? "Le " + (ps.cambios_restantes === 1 ? "queda 1 pedido" : "quedan " + ps.cambios_restantes + " pedidos") + " este mes." : "No le quedan pedidos este mes.") + "</p>" : "") +
            '<form class="cf-form cf-inline" data-pf-pedido><label class="cf-grow">Qué pidió <input name="nota" maxlength="300" placeholder="Por ejemplo: precio nuevo del corte"></label>' +
              '<button class="btn-nx btn-sm" type="submit"><i class="bi bi-plus-lg" aria-hidden="true"></i> Registrar</button></form>' +
            (requests.length ? '<ol class="cf-timeline">' + requests.slice(0, 8).map(function (r) {
              var d = new Date(r.fecha);
              return '<li class="' + (d.toISOString().slice(0, 7) === month ? "is-month" : "") + '"><time>' + esc(d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })) + "</time>" +
                "<span>" + esc(r.nota || "Pedido sin detalle") + "</span>" +
                '<button class="cf-icon-btn" type="button" data-pf-quitar-pedido="' + r.fecha + '" aria-label="Quitar pedido del ' + esc(d.toLocaleDateString("es-AR")) + '" title="Quitar"><i class="bi bi-x-lg" aria-hidden="true"></i></button></li>';
            }).join("") + "</ol>" : "") +
          "</section>" +

        "</div>" +
        '<div class="cf-col">' +

          '<section class="cf-card cf-plan" aria-labelledby="pf-plan">' +
            '<div class="cf-card-head"><span class="cf-icon"><i class="bi bi-stars" aria-hidden="true"></i></span><div><h2 id="pf-plan">Plan</h2>' +
            "<p>" + esc(venceText) + "</p></div></div>" +
            (plan
              ? '<div class="cf-plan-name"><strong>' + esc(plan.nombre) + "</strong>" + (plan.mensual ? "<span>" + esc(money(plan.mensual)) + " / mes</span>" : "") + "</div>" +
                '<ul class="cf-features">' +
                  "<li><i class=\"bi bi-layout-text-window\" aria-hidden=\"true\"></i> Hasta " + (plan.secciones || "—") + " secciones</li>" +
                  "<li><i class=\"bi bi-chat-square-text\" aria-hidden=\"true\"></i> " + plural(plan.cambiosPorMes || 0, "pedido", "pedidos") + " de cambios por mes</li>" +
                  '<li class="' + (plan.turnos ? "" : "is-off") + '"><i class="bi bi-' + (plan.turnos ? "check-circle-fill" : "x-circle") + '" aria-hidden="true"></i> Reserva de turnos</li>' +
                  '<li class="' + (plan.medicion ? "" : "is-off") + '"><i class="bi bi-' + (plan.medicion ? "check-circle-fill" : "x-circle") + '" aria-hidden="true"></i> Analytics y Píxel de Meta</li>' +
                "</ul>"
              : '<p class="cf-empty">Sin plan: no tiene límites. Sirve para demos y pruebas.</p>') +
            '<details class="cf-details"><summary>Cambiar plan o vencimiento</summary>' +
              '<form class="cf-form" data-pf-plan>' +
                '<label>Plan <select name="plan"><option value="">Sin plan</option>' + PLANS.map(function (p) {
                  return '<option value="' + esc(p.id) + '">' + esc(p.nombre) + "</option>";
                }).join("") + "</select></label>" +
                '<label>Vencimiento <input name="plan_vence" type="date" value="' + esc(c.plan_vence || "") + '"></label>' +
                '<button class="btn-nx btn-sm" type="submit">Guardar plan</button>' +
              "</form></details>" +
          "</section>" +

          '<section class="cf-card" aria-labelledby="cf-contacto">' +
            '<div class="cf-card-head"><span class="cf-icon"><i class="bi bi-person-lines-fill" aria-hidden="true"></i></span><div><h2 id="cf-contacto">Contacto</h2></div></div>' +
            '<dl class="cf-rows">' +
              row("person", "Contacto", esc(c.contacto)) +
              row("envelope", "Email", c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a>" : "") +
              row("telephone", "Teléfono", c.telefono ? '<a href="https://wa.me/' + esc(c.telefono.replace(/\D/g, "")) + '" target="_blank" rel="noopener">' + esc(c.telefono) + "</a>" : "") +
              row("globe2", "Sitio web", site) +
              row("geo-alt", "Dirección", esc(c.direccion)) +
              row("clock", "Horario", esc(c.horario)) +
            "</dl>" +
            (socials ? '<div class="cf-chips">' + socials + "</div>" : "") +
            (!c.contacto && !c.email && !c.telefono ? '<p class="cf-empty">Sin datos de contacto. Cargalos con «Editar datos».</p>' : "") +
          "</section>" +

          '<section class="cf-card" aria-labelledby="cf-marca">' +
            '<div class="cf-card-head"><span class="cf-icon"><i class="bi bi-palette" aria-hidden="true"></i></span><div><h2 id="cf-marca">Marca y medición</h2></div></div>' +
            '<div class="cf-swatches">' +
              '<span class="cf-swatch"><i style="background:' + esc(c.color_primario) + '"></i><small>Principal</small><code>' + esc(c.color_primario) + "</code></span>" +
              '<span class="cf-swatch"><i style="background:' + esc(c.color_secundario) + '"></i><small>Secundario</small><code>' + esc(c.color_secundario) + "</code></span>" +
            "</div>" +
            '<dl class="cf-rows">' +
              row("graph-up", "Medición", tracking.length ? esc(tracking.join(" · ")) + (trackingOff ? ' <b class="pf-missing">No se carga: el plan no la incluye</b>' : "") : '<span class="cf-muted">Sin códigos</span>') +
              row("folder2", "Carpeta", "<code>" + esc(c.carpeta) + "</code>") +
            "</dl>" +
          "</section>" +

          (c.notas ? '<section class="cf-card cf-notes" aria-labelledby="cf-notas"><h2 id="cf-notas"><i class="bi bi-sticky" aria-hidden="true"></i> Notas internas</h2><p>' + esc(c.notas) + "</p></section>" : "") +

        "</div>" +
        "</div>";

      var reveal = profile.querySelector("[data-pf-ver-clave]");
      if (reveal) reveal.addEventListener("click", function () {
        var on = reveal.getAttribute("aria-pressed") !== "true";
        reveal.setAttribute("aria-pressed", String(on));
        reveal.setAttribute("aria-label", on ? "Ocultar contraseña" : "Mostrar contraseña");
        reveal.innerHTML = '<i class="bi bi-' + (on ? "eye-slash" : "eye") + '" aria-hidden="true"></i>';
        profile.querySelector("[data-pf-clave]").hidden = !on;
        profile.querySelector("[data-pf-clave-oculta]").hidden = on;
      });
      profile.querySelector("[data-pf-copiar-link]").addEventListener("click", function () {
        navigator.clipboard.writeText(portalUrl).then(function () { say(profile.querySelector("[data-pf-editor-estado]"), "Link del portal copiado.", "ok"); },
          function () { window.prompt("Copiá el link del portal:", portalUrl); });
      });
      var planForm = profile.querySelector("[data-pf-plan]");
      planForm.elements.plan.value = c.plan || "";
      planForm.addEventListener("submit", function (e) {
        e.preventDefault();
        api("PUT", "/api/clientes/" + c.id + "/plan", {
          plan: planForm.elements.plan.value,
          plan_vence: planForm.elements.plan_vence.value
        }).then(function () { say(msg, "Se guardó el plan.", "ok"); load(); })
          .catch(function (err) { say(msg, err.message, "warn"); });
      });
      profile.querySelector("[data-pf-pedido]").addEventListener("submit", function (e) {
        e.preventDefault();
        var f = e.target;
        var over = ps.cambios_mes && !ps.cambios_restantes;
        if (over && !window.confirm("Ya usó los pedidos de este mes. ¿Lo registrás igual (por ejemplo, como pedido cobrado aparte)?")) return;
        api("POST", "/api/clientes/" + c.id + "/pedidos", { nota: f.elements.nota.value })
          .then(function () { say(msg, "Pedido registrado.", "ok"); load(); })
          .catch(function (err) { say(msg, err.message, "warn"); });
      });
      profile.querySelectorAll("[data-pf-quitar-pedido]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          api("DELETE", "/api/clientes/" + c.id + "/pedidos?fecha=" + btn.getAttribute("data-pf-quitar-pedido"))
            .then(function () { say(msg, "Pedido quitado.", "ok"); load(); })
            .catch(function (err) { say(msg, err.message, "warn"); });
        });
      });
      var accessOut = profile.querySelector("[data-pf-editor-estado]");
      var accessText = "Tu portal de Lanzate: " + c.editor + "\nUsuario: " + c.portal_usuario + "\nContraseña: " + c.portal_clave;
      profile.querySelectorAll("[data-pf-copiar-acceso]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          navigator.clipboard.writeText(accessText).then(function () { say(accessOut, "Copiado: link, usuario y contraseña. Pegalo en WhatsApp o en un mail.", "ok"); },
            function () { window.prompt("Copiá el acceso:", accessText); });
        });
      });
      var sentBtn = profile.querySelector("[data-pf-clave-enviada]");
      if (sentBtn) sentBtn.addEventListener("click", function () {
        api("POST", "/api/clientes/" + c.id + "/clave-enviada", {}).then(function () { say(msg, "Listo, se sacó el aviso.", "ok"); load(); })
          .catch(function (err) { say(msg, err.message, "warn"); });
      });
      profile.querySelector("[data-pf-acceso]").addEventListener("submit", function (e) {
        e.preventDefault();
        var f = e.target;
        var btn = f.querySelector("button");
        btn.disabled = true;
        api("POST", "/api/clientes/" + c.id + "/acceso", { usuario: f.elements.usuario.value, clave: f.elements.clave.value })
          .then(function () { say(msg, "Acceso guardado. Tocá «Copiar acceso» para mandárselo.", "ok"); return load(); })
          .catch(function (err) { say(accessOut, err.message, "warn"); })
          .then(function () { btn.disabled = false; });
      });
      if (location.hash === "#pf-acceso") {
        history.replaceState(null, "", location.pathname + location.search);
        var target = profile.querySelector("#pf-acceso");
        if (target) target.scrollIntoView({ block: "start" });
      }
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
      return loadPlans().then(function () { return api("GET", "/api/clientes/" + id); }).then(render).catch(function (err) {
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
    var params = new URLSearchParams(location.search);
    var preset = params.get("cliente") || "";

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

  /* Planes: los mismos del sitio de venta (data/planes.js) */
  var PLANS = [];
  function loadPlans() {
    if (PLANS.length) return Promise.resolve(PLANS);
    return api("GET", "/api/planes").then(function (list) { PLANS = list || []; return PLANS; }, function () { return PLANS; });
  }
  function planName(id) {
    var p = PLANS.filter(function (x) { return x.id === id; })[0];
    return p ? p.nombre : id;
  }
  function planInfo(id) {
    var p = PLANS.filter(function (x) { return x.id === id; })[0];
    if (!p) return "";
    var parts = [];
    if (p.secciones) parts.push("hasta " + p.secciones + " secciones");
    if (p.cambiosPorMes) parts.push(plural(p.cambiosPorMes, "pedido", "pedidos") + " de cambios por mes");
    parts.push(p.turnos ? "con reserva de turnos" : "sin reserva de turnos");
    parts.push(p.medicion ? "con Analytics y Píxel de Meta" : "sin Analytics ni Píxel");
    return "Plan " + p.nombre + ": " + parts.join(", ") + ".";
  }

  /* Rearmar: cada landing se vuelve a armar en el constructor con sus módulos guardados y las plantillas actuales */
  function rebuildOne(id) {
    return new Promise(function (resolve) {
      var frame = document.createElement("iframe");
      frame.hidden = true;
      frame.setAttribute("aria-hidden", "true");
      var done = false;
      function finish(data) {
        if (done) return;
        done = true;
        window.removeEventListener("message", onMessage);
        frame.remove();
        resolve(data);
      }
      function onMessage(e) {
        if (e.origin !== location.origin || !e.data || !e.data.lzRearmar || e.data.lzRearmar.id !== id) return;
        finish(e.data.lzRearmar);
      }
      window.addEventListener("message", onMessage);
      setTimeout(function () { finish({ id: id, ok: false, error: "El constructor tardó demasiado." }); }, 45000);
      frame.src = "/maquetas/constructor.html?landing=" + id + "&rearmar=1";
      document.body.appendChild(frame);
    });
  }

  function rebuildAll(progress) {
    return api("GET", "/api/landings").then(function (list) {
      var results = [];
      return list.reduce(function (chain, lp, i) {
        return chain.then(function () {
          if (progress) progress(i + 1, list.length);
          return rebuildOne(lp.id).then(function (r) { r.nombre = r.nombre || lp.nombre; results.push(r); });
        });
      }, Promise.resolve()).then(function () { return results; });
    });
  }

  /* Publicar: rearma las landings, guarda en git y sube a GitHub (las landings y el sitio de venta) */
  function addPublish() {
    var nav = document.querySelector(".lib-header nav");
    if (!nav || nav.querySelector("[data-pf-publish]") || !panelPage) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-nx btn-sm lib-publish";
    btn.setAttribute("data-pf-publish", "");
    btn.innerHTML = '<i class="bi bi-cloud-upload" aria-hidden="true"></i> Publicar';
    btn.title = "Rearma las landings con los módulos actuales y las sube a GitHub. En un par de minutos se ven online.";
    btn.addEventListener("click", function () {
      var note = window.prompt("¿Qué cambiaste? (queda anotado en el historial)", "Actualiza landings");
      if (note === null) return;
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i> Publicando…';
      var rebuilt = [];
      rebuildAll(function (n, total) {
        btn.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i> Armando ' + n + " de " + total + "…";
      }).then(function (results) {
        rebuilt = results;
        btn.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i> Subiendo…';
        return api("POST", "/api/publicar", { mensaje: note });
      }).then(function (out) {
        var failed = rebuilt.filter(function (r) { return !r.ok; });
        var lines = out.resultados.map(function (r) { return (r.ok ? "✓ " : "✗ ") + r.carpeta + ": " + r.detalle; });
        if (failed.length) {
          lines.push("", "Estas landings no se pudieron rearmar y quedan como estaban:");
          failed.forEach(function (r) { lines.push("• " + r.nombre + ": " + r.error); });
        }
        var ok = out.resultados.every(function (r) { return r.ok; });
        window.alert((ok ? "Listo. Se armaron " + (rebuilt.length - failed.length) + " landings con los módulos actuales. En un par de minutos se ve online en " + out.url + "\n\n" : "Hubo un problema al publicar:\n\n") + lines.join("\n"));
      }).catch(function (err) { window.alert(err.message); })
        .then(function () { btn.disabled = false; btn.innerHTML = '<i class="bi bi-cloud-upload" aria-hidden="true"></i> Publicar'; });
    });
    nav.appendChild(btn);
  }
  if (document.body.classList.contains("lib-page")) addPublish();

  function addLogout() {
    var nav = document.querySelector(".lib-header nav");
    if (!nav || !SESSION.requiere || nav.querySelector("[data-pf-logout]")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lib-logout";
    btn.setAttribute("data-pf-logout", "");
    btn.innerHTML = '<i class="bi bi-box-arrow-right" aria-hidden="true"></i> Salir';
    btn.addEventListener("click", function () {
      api("POST", "/api/logout", {}).then(function () { location.href = "/maquetas/login.html"; });
    });
    nav.appendChild(btn);
  }

  window.Lanzate = { rebuildAll: rebuildAll, api: api, esc: esc, socialUrl: socialUrl, say: say, clientForm: clientForm, landingRow: landingRow, plural: plural };

  var page = document.body.getAttribute("data-page");
  if (page === "clientes") pageClientes();
  if (page === "cliente") pageCliente();
  if (page === "landings") pageLandings();
})();
