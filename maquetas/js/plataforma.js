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
      .then(function (s) { SESSION = s; if (!s.ok) toLogin(); else { addLogout(); showWarnings(s.avisos || []); } })
      .catch(function () { /* sin servidor: el aviso lo da cada pedido */ });
  }

  /* Avisos de configuración (token de GitHub por vencer, secreto faltante) arriba de cada página del panel */
  function showWarnings(list) {
    if (!list.length) return;
    var main = document.querySelector("main") || document.body;
    var box = document.createElement("div");
    box.className = "pf-warnings";
    box.setAttribute("role", "alert");
    box.innerHTML = list.map(function (t) {
      return '<p class="cf-alert"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> <span>' + esc(t) + "</span></p>";
    }).join("");
    main.insertBefore(box, main.firstChild);
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

  /* Contraste WCAG entre dos colores #rrggbb */
  function luminance(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return null;
    return [0, 2, 4].map(function (i) {
      var v = parseInt(m[1].substr(i, 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }).reduce(function (sum, v, i) { return sum + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    if (la == null || lb == null) return 0;
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  /* Color del texto sobre el color de marca: el secundario si se lee bien, si no blanco o casi negro */
  function readableOn(bg, preferred) {
    if (contrast(preferred, bg) >= 4.5) return preferred;
    return contrast("#ffffff", bg) >= contrast("#14142b", bg) ? "#ffffff" : "#14142b";
  }
  /* Con tonos medios ni el blanco ni el negro llegan a 4,5:1: se oscurece el fondo lo justo */
  function readableBackground(bg) {
    var m = /^#([0-9a-f]{6})$/i.exec(bg || "");
    if (!m) return "#1b5e42";
    var rgb = [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); });
    for (var pct = 100; pct >= 0; pct -= 4) {
      var hex = "#" + rgb.map(function (v) { return ("0" + Math.round(v * pct / 100).toString(16)).slice(-2); }).join("");
      if (Math.max(contrast("#ffffff", hex), contrast("#14142b", hex)) >= 4.6) return hex;
    }
    return "#14142b";
  }

  function avatar(c, size) {
    var bg = readableBackground(c.color_primario);
    var style = "--c1:" + esc(bg) + ";--c2:" + esc(readableOn(bg, c.color_secundario));
    var inner = c.logo_url ? '<img src="' + esc(c.logo_url) + '" alt="Logo de ' + esc(c.nombre) + '">' : "<span>" + esc(initials(c.nombre)) + "</span>";
    return '<span class="pf-avatar' + (c.logo_url ? " has-logo" : "") + (size ? " is-" + size : "") + '" style="' + style + '">' + inner + "</span>";
  }

  function pendingCount(c) {
    return (c.pedidos || []).filter(function (r) { return r.estado === "pendiente"; }).length;
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
          (pendingCount(c) ? '<a class="pf-pending" href="cliente.html?id=' + c.id + '#cf-revisar"><i class="bi bi-pencil-square" aria-hidden="true"></i> ' +
            (pendingCount(c) === 1 ? "Mandó un pedido de cambios" : "Mandó " + pendingCount(c) + " pedidos de cambios") + "</a>" : "") +
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
    var freshKeys = {}; // contraseñas recién generadas: solo viven mientras esta página está abierta

    function row(icon, label, value) {
      return value ? '<div class="cf-row"><dt><i class="bi bi-' + icon + '" aria-hidden="true"></i>' + label + "</dt><dd>" + value + "</dd></div>" : "";
    }

    function money(n) { return n ? "$" + Number(n).toLocaleString("es-AR") : ""; }

    function requestSummary(r) {
      if (r.nota) return r.nota;
      var n = (r.cambios || []).length;
      return n ? plural(n, "cambio", "cambios") + (r.landing ? " en " + r.landing : "") : "Pedido sin detalle";
    }

    function requestCard(r) {
      var id = esc(r.id || r.fecha);
      var changes = (r.cambios || []).map(function (ch) {
        if (ch.tipo === "texto") return "<li><b>" + esc(ch.seccion) + ':</b> <s>' + esc(ch.antes) + "</s> → " + esc(ch.despues) + "</li>";
        if (ch.tipo === "foto") return "<li><b>" + esc(ch.seccion) + ":</b> cambiar la foto «" + esc(ch.antes) + "»" + (ch.detalle ? " — " + esc(ch.detalle) : "") + "</li>";
        return "<li><b>" + esc(ch.seccion) + ":</b> el botón «" + esc(ch.antes) + "» que lleve a " + esc(ch.despues) + "</li>";
      }).join("");
      var photos = (r.fotos || []).map(function (f) {
        return '<a href="' + esc(f.ruta) + '" target="_blank" rel="noopener" download><img src="' + esc(f.ruta) + '" alt="' + esc(f.nota || "Foto del pedido") + '"></a>';
      }).join("");
      return '<li class="cf-request" data-pf-request="' + id + '"><div class="cf-request-head"><b class="cf-state is-pendiente">Para revisar</b><time>' +
        esc(new Date(r.fecha).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + "</time>" +
        (r.landing ? '<span class="cf-muted">' + esc(r.landing) + "</span>" : "") + "</div>" +
        (r.nota ? '<p class="cf-request-note">' + esc(r.nota) + "</p>" : "") +
        (changes ? '<ul class="cf-request-list">' + changes + "</ul>" : "") +
        (photos ? '<div class="cf-request-photos">' + photos + "</div>" : "") +
        '<label class="cf-request-reply">Respuesta para el cliente (opcional) <input name="comentario" maxlength="600" placeholder="Por ejemplo: ¡Listo! Ya está publicado."></label>' +
        '<div class="cf-request-actions"><button class="btn-nx btn-sm" type="button" data-pf-decidir="aceptado"><i class="bi bi-check2" aria-hidden="true"></i> Aceptar</button>' +
        '<button class="btn-nx-outline btn-sm" type="button" data-pf-decidir="rechazado"><i class="bi bi-x-lg" aria-hidden="true"></i> Rechazar</button></div></li>';
    }

    function changeLine(ch) {
      if (ch.tipo === "texto") return '<span class="cf-before">' + esc(ch.antes) + '</span><span class="cf-after">' + esc(ch.despues) + "</span>";
      if (ch.tipo === "foto") return "Foto nueva" + (ch.detalle ? ": " + esc(ch.detalle) : "") + (ch.foto ? '<img class="cf-change-photo" src="' + esc(ch.foto) + '" alt="Foto nueva que mandó el cliente">' : "");
      return 'Botón «' + esc(ch.antes) + '» → <span class="cf-after">' + esc(ch.despues) + "</span>";
    }

    var current = null;

    /* Cada pedido es de una web (landing). Los que no tienen web (por ejemplo «actualizar un dato») son generales. */
    function siteOf(r, c) {
      if (r.landing_slug) return r.landing_slug;
      if (r.landing) {
        var byName = c.lista.filter(function (lp) { return lp.nombre === r.landing; })[0];
        if (byName) return byName.slug;
      }
      return (r.cambios || []).length && c.lista.length === 1 ? c.lista[0].slug : "";
    }

    function historyList(items) {
      return '<ol class="cf-timeline">' + items.slice(0, 12).map(function (r) {
        var d = new Date(r.fecha);
        var estado = r.estado || "aceptado";
        var label = estado === "rechazado" ? "Rechazado" : estado === "parcial" ? "Aceptado en parte" : "Aceptado";
        var detail = (r.cambios || []).map(function (ch) {
          return '<li class="is-' + esc(ch.estado || "pendiente") + '">' + (ch.estado === "rechazado" ? '<i class="bi bi-x-lg" aria-label="Rechazado"></i>' : '<i class="bi bi-check-lg" aria-label="Aceptado"></i>') +
            " <b>" + esc(ch.seccion) + ":</b> " + (ch.tipo === "texto" ? esc(ch.despues) : ch.tipo === "foto" ? "foto nueva" : "botón → " + esc(ch.despues)) + "</li>";
        }).join("");
        return '<li class="is-month"><time>' + esc(d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })) + "</time>" +
          '<span><b class="cf-state is-' + esc(estado === "parcial" ? "aceptado" : estado) + '">' + label + "</b> " + esc(requestSummary(r)) +
          (detail ? '<details class="cf-hist"><summary>Ver cambios</summary><ul>' + detail + "</ul>" + (r.comentario ? '<p class="cf-muted">Respuesta: ' + esc(r.comentario) + "</p>" : "") + "</details>" : "") + "</span>" +
          (r.origen === "cliente" ? '<button class="cf-icon-btn" type="button" data-pf-reabrir="' + esc(r.id || r.fecha) + '" aria-label="Volver a revisar" title="Volver a revisar"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i></button>' : "<span></span>") + "</li>";
      }).join("") + "</ol>";
    }

    function sitesSection(c, requests) {
      var head = '<div class="cf-sites-head"><div><h2>Webs de ' + esc(c.nombre) + ' <span class="lb-badge">' + c.lista.length + "</span></h2>" +
        "<p>Cada web con sus pedidos de cambios, su historial y sus visitas.</p></div>" +
        '<a class="btn-nx btn-sm" href="constructor.html?cliente=' + c.id + '"><i class="bi bi-plus-lg" aria-hidden="true"></i> Nueva landing</a></div>';
      if (!c.lista.length) return '<section class="cf-sites">' + head + '<p class="cf-empty">Este cliente todavía no tiene webs. Creá la primera con «Nueva landing».</p></section>';
      return '<section class="cf-sites" aria-label="Webs del cliente">' + head + c.lista.map(function (lp) {
        var mine = requests.filter(function (r) { return siteOf(r, c) === lp.slug; });
        var pending = mine.filter(function (r) { return r.estado === "pendiente" && (r.cambios || []).length; });
        var done = mine.filter(function (r) { return r.estado !== "pendiente"; });
        return '<article class="cf-site" id="web-' + esc(lp.slug) + '" data-site="' + esc(lp.slug) + '" data-site-id="' + lp.id + '">' +
          '<div class="cf-site-top"><ul class="lb-saved cf-site-card" data-site-row></ul>' +
          '<div class="cf-site-info">' +
            '<div class="cf-site-stats"><div><strong data-site-visitas>—</strong><span>visitas en 30 días</span></div>' +
            "<div><strong>" + pending.length + "</strong><span>" + (pending.length === 1 ? "pedido para revisar" : "pedidos para revisar") + "</span></div>" +
            '<div><strong data-site-consultas>—</strong><span data-site-consultas-label>consultas en 30 días</span></div></div>' +
            '<div class="cf-spark" data-site-spark aria-hidden="true"></div>' +
            '<ul class="cf-leads" data-site-leads></ul>' +
            '<p class="cf-site-links"><a href="' + esc(lp.editor) + '" target="_blank" rel="noopener"><i class="bi bi-pencil-square" aria-hidden="true"></i> Pedir cambios como el cliente</a></p>' +
          "</div></div>" +
          (pending.length ? '<div class="cf-review-wrap"><div class="cf-review-title"><span class="cf-icon"><i class="bi bi-eye" aria-hidden="true"></i></span><div><h3>Cambios para revisar en ' + esc(lp.nombre) + "</h3>" +
            "<p>Los cambios que pidió, marcados en amarillo sobre esta web. Aceptá o rechazá cada uno: lo aceptado se aplica y se publica.</p></div></div>" +
            pending.map(reviewBlock).join("") + "</div>" : "") +
          (done.length ? '<details class="cf-site-history"' + (pending.length ? "" : " open") + "><summary>Historial de pedidos de esta web (" + done.length + ")</summary>" + historyList(done) + "</details>"
            : (pending.length ? "" : '<p class="cf-muted cf-site-none">Sin pedidos de cambios para esta web.</p>')) +
          "</article>";
      }).join("") + "</section>";
    }


    function reviewBlock(r) {
      var id = esc(r.id || r.fecha);
      var icons = { texto: "fonts", foto: "image", link: "link-45deg" };
      return '<article class="cf-review" data-pf-review="' + id + '">' +
        '<header class="cf-review-head"><b class="cf-state is-pendiente">Para revisar</b><strong>' + esc(r.landing || "Pedido") + "</strong>" +
        '<time class="cf-muted">' + esc(new Date(r.fecha).toLocaleString("es-AR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })) + "</time>" +
        '<span class="cf-review-views" role="group" aria-label="Vista"><button type="button" data-pf-vista="compu" aria-pressed="true"><i class="bi bi-laptop" aria-hidden="true"></i> Compu</button>' +
        '<button type="button" data-pf-vista="celu" aria-pressed="false"><i class="bi bi-phone" aria-hidden="true"></i> Celular</button></span></header>' +
        (r.nota ? '<p class="cf-review-note"><i class="bi bi-chat-quote" aria-hidden="true"></i> ' + esc(r.nota) + "</p>" : "") +
        '<div class="cf-review-body"><div class="cf-review-stage" data-vista="compu"><iframe title="Web con los cambios pedidos" loading="lazy" src="/api/clientes/' + current.id + "/pedidos/" + encodeURIComponent(r.id || r.fecha) + '/vista"></iframe></div>' +
        '<div class="cf-review-side"><ol class="cf-changes">' + r.cambios.map(function (ch, i) {
          if (ch.estado && ch.estado !== "pendiente") return "";
          return '<li class="cf-change" data-pf-cambio="' + i + '" data-decision=""><button class="cf-change-go" type="button" data-pf-ir="' + i + '" aria-label="Ver el cambio ' + (i + 1) + ' en la web">' +
            '<span class="cf-change-num">' + (i + 1) + '</span><span class="cf-change-text"><small><i class="bi bi-' + (icons[ch.tipo] || "pencil") + '" aria-hidden="true"></i> ' + esc(ch.seccion) + "</small>" + changeLine(ch) + "</span></button>" +
            '<span class="cf-change-actions" role="group" aria-label="Decisión del cambio ' + (i + 1) + '">' +
            '<button type="button" class="cf-yes" data-pf-si aria-pressed="false" title="Aceptar"><i class="bi bi-check-lg" aria-hidden="true"></i><span>Aceptar</span></button>' +
            '<button type="button" class="cf-no" data-pf-no aria-pressed="false" title="Rechazar"><i class="bi bi-x-lg" aria-hidden="true"></i><span>Rechazar</span></button></span></li>';
        }).join("") + "</ol>" +
        '<label class="cf-request-reply">Respuesta para el cliente (opcional) <input name="comentario" maxlength="600" placeholder="Por ejemplo: ¡Listo! Ya está publicado."></label>' +
        '<div class="cf-review-actions"><button class="btn-nx btn-sm" type="button" data-pf-guardar-revision><i class="bi bi-check2-all" aria-hidden="true"></i> Guardar y publicar</button>' +
        '<button class="btn-nx-outline btn-sm" type="button" data-pf-todo="aceptado">Aceptar todo</button>' +
        '<button class="btn-nx-outline btn-sm" type="button" data-pf-todo="rechazado">Rechazar todo</button></div>' +
        '<p class="cf-status" role="status" data-pf-review-msg></p></div></div></article>';
    }

    function bindReview(block) {
      var frame = block.querySelector("iframe");
      var stage = block.querySelector(".cf-review-stage");
      function setDecision(li, value) {
        li.setAttribute("data-decision", value);
        li.querySelector("[data-pf-si]").setAttribute("aria-pressed", String(value === "aceptado"));
        li.querySelector("[data-pf-no]").setAttribute("aria-pressed", String(value === "rechazado"));
      }
      block.querySelectorAll("[data-pf-vista]").forEach(function (b) {
        b.addEventListener("click", function () {
          stage.setAttribute("data-vista", b.getAttribute("data-pf-vista"));
          block.querySelectorAll("[data-pf-vista]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        });
      });
      block.querySelectorAll("[data-pf-ir]").forEach(function (b) {
        b.addEventListener("click", function () {
          block.querySelectorAll(".cf-change.is-focus").forEach(function (x) { x.classList.remove("is-focus"); });
          b.closest(".cf-change").classList.add("is-focus");
          frame.contentWindow.postMessage({ lzCambio: Number(b.getAttribute("data-pf-ir")) }, location.origin);
        });
      });
      block.querySelectorAll(".cf-change").forEach(function (li) {
        li.querySelector("[data-pf-si]").addEventListener("click", function () { setDecision(li, "aceptado"); });
        li.querySelector("[data-pf-no]").addEventListener("click", function () { setDecision(li, "rechazado"); });
      });
      block.querySelectorAll("[data-pf-todo]").forEach(function (b) {
        b.addEventListener("click", function () {
          block.querySelectorAll(".cf-change").forEach(function (li) { setDecision(li, b.getAttribute("data-pf-todo")); });
        });
      });
      block.querySelector("[data-pf-guardar-revision]").addEventListener("click", function () {
        var out = block.querySelector("[data-pf-review-msg]");
        var decisions = {};
        var rejected = 0;
        var undecided = block.querySelector('.cf-change[data-decision=""]');
        if (undecided) {
          say(out, "Marcá Aceptar o Rechazar en cada cambio antes de guardar.", "warn");
          undecided.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }
        block.querySelectorAll(".cf-change").forEach(function (li) {
          decisions[li.getAttribute("data-pf-cambio")] = li.getAttribute("data-decision");
          if (li.getAttribute("data-decision") === "rechazado") rejected += 1;
        });
        var comment = block.querySelector("[name=comentario]").value;
        if (rejected && !comment.trim() && !window.confirm("Rechazás " + plural(rejected, "cambio", "cambios") + " sin explicarle el motivo al cliente. ¿Seguís?")) return;
        block.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
        say(out, "Aplicando y publicando…", "");
        api("PUT", "/api/clientes/" + current.id + "/pedidos/" + encodeURIComponent(block.getAttribute("data-pf-review")), { decisiones: decisions, comentario: comment })
          .then(function (res) {
            var manual = res.sin_aplicar || [];
            say(msg, manual.length
              ? "Listo. " + plural(manual.length, "cambio no se pudo aplicar solo", "cambios no se pudieron aplicar solos") + " (" + manual.map(function (m) { return m.seccion + ": " + (m.antes || m.tipo); }).join("; ") + "). Hacelos en el constructor."
              : "Listo. Lo aceptado ya está aplicado y se publica en un par de minutos.", manual.length ? "warn" : "ok");
            load();
          })
          .catch(function (err) { block.querySelectorAll("button").forEach(function (x) { x.disabled = false; }); say(out, err.message, "warn"); });
      });
    }

    /* Visitas y consultas de cada web (últimos 30 días) */
    function loadStats(c) {
      var sites = profile.querySelectorAll("[data-site]");
      if (!sites.length) return;
      api("GET", "/api/clientes/" + c.id + "/estadisticas").then(function (d) {
        if (!d.registro) {
          sites.forEach(function (site) {
            site.querySelector("[data-site-leads]").outerHTML = '<p class="cf-muted">Falta conectar el registro de visitas y consultas (Upstash Redis en Vercel).</p>';
          });
          return;
        }
        var st = d.estadisticas;
        var since = Date.now() - (st.dias || 30) * 86400000;
        sites.forEach(function (site) {
          var slug = site.getAttribute("data-site");
          var id = Number(site.getAttribute("data-site-id"));
          var pg = (st.paginas || []).filter(function (x) { return x.slug === slug; })[0] || { visitas: 0, serie: [] };
          site.querySelector("[data-site-visitas]").textContent = pg.visitas;
          var m = Math.max(1, Math.max.apply(null, (pg.serie || []).concat([0])));
          site.querySelector("[data-site-spark]").innerHTML = (pg.serie || []).map(function (v, i) {
            return '<span style="height:' + Math.max(6, Math.round(v / m * 100)) + '%" title="' + esc((st.serie[i] || {}).dia + ": " + v) + '"></span>';
          }).join("");
          var leads = d.consultas.filter(function (l) { return l.landing_id === id; });
          var recent = leads.filter(function (l) { return l.fecha >= since; });
          var fresh = leads.filter(function (l) { return l.estado === "nueva"; }).length;
          site.querySelector("[data-site-consultas]").textContent = recent.length;
          if (fresh) site.querySelector("[data-site-consultas-label]").textContent = "consultas en 30 días · " + fresh + " sin atender";
          site.querySelector("[data-site-leads]").innerHTML = leads.slice(0, 3).map(function (l) {
            return '<li><b class="cf-state is-' + (l.estado === "nueva" ? "pendiente" : "aceptado") + '">' + (l.estado === "nueva" ? "Nueva" : "Atendida") + "</b> " +
              esc((l.datos && l.datos.nombre) || "Consulta") + ' <span class="cf-muted">· ' + (l.tipo === "turno" ? "turno · " : "") +
              esc(new Date(l.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short" })) + "</span></li>";
          }).join("");
        });
      }).catch(function (err) { say(msg, err.message, "warn"); });
    }

    function render(c) {
      current = c;
      var freshKey = freshKeys[c.id] || c.portal_clave || "";
      document.title = c.nombre + " · Lanzate";
      newLanding.href = "constructor.html?cliente=" + c.id;
      var site = c.sitio ? '<a href="' + esc(/^https?:\/\//.test(c.sitio) ? c.sitio : "https://" + c.sitio) + '" target="_blank" rel="noopener">' + esc(c.sitio.replace(/^https?:\/\//, "")) + "</a>" : "";
      var ps = c.plan_estado || {};
      var plan = PLANS.filter(function (p) { return p.id === c.plan; })[0];
      var month = new Date().toISOString().slice(0, 7);
      var requests = (c.pedidos || []).slice().sort(function (a, b) { return b.fecha - a.fecha; });
      var pendingRequests = requests.filter(function (r) { return r.estado === "pendiente"; });
      var reviewRequests = pendingRequests.filter(function (r) { return (r.cambios || []).length; });
      var noteRequests = pendingRequests.filter(function (r) { return !(r.cambios || []).length; });
      var doneRequests = requests.filter(function (r) { return r.estado !== "pendiente" && !siteOf(r, c); });
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
          " pidió su contraseña</strong> el " + esc(new Date(c.pidio_clave).toLocaleDateString("es-AR", { day: "numeric", month: "long" })) + ". Copiá el acceso y mandáselo, o poné una contraseña nueva en «Cambiar usuario o contraseña».</p>" +
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

        sitesSection(c, requests) +
        '<h2 class="cf-section-title">Datos del cliente</h2>' +
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
                  "<div><dt>Contraseña</dt><dd>" + (freshKey
                    ? '<code data-pf-clave hidden>' + esc(freshKey) + '</code><code data-pf-clave-oculta aria-hidden="true">••••••••••</code>' +
                      '<button class="cf-icon-btn" type="button" data-pf-ver-clave aria-pressed="false" aria-label="Mostrar contraseña" title="Mostrar"><i class="bi bi-eye" aria-hidden="true"></i></button>'
                    : '<span class="cf-muted">No se puede mostrar: poné una nueva en «Cambiar usuario o contraseña».</span>') + "</dd></div>" +
                "</dl>" +
                '<button class="btn-nx btn-sm cf-wide" type="button" data-pf-copiar-acceso><i class="bi bi-whatsapp" aria-hidden="true"></i> ' +
                  (freshKey ? "Copiar acceso para mandárselo" : "Clave nueva y copiar acceso") + "</button>"
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
            "<p>" + (pendingRequests.length ? "<b>" + plural(pendingRequests.length, "pedido para revisar", "pedidos para revisar") + ".</b> " : "") +
              (limit ? "Este mes usó " + used + " de " + limit + "." : used ? "Este mes: " + plural(used, "pedido", "pedidos") + "." : "Los pedidos del portal llegan acá.") + "</p></div></div>" +
            (limit ? '<div class="cf-meter' + (used >= limit ? " is-full" : "") + '" role="img" aria-label="' + used + " de " + limit + ' pedidos usados"><span style="width:' + pct + '%"></span></div>' +
              '<p class="cf-meter-note">' + (ps.cambios_restantes ? "Le " + (ps.cambios_restantes === 1 ? "queda 1 pedido" : "quedan " + ps.cambios_restantes + " pedidos") + " este mes." : "No le quedan pedidos este mes.") + "</p>" : "") +
            c.lista.filter(function (lp) { return reviewRequests.some(function (r) { return siteOf(r, c) === lp.slug; }); }).map(function (lp) {
              var n = reviewRequests.filter(function (r) { return siteOf(r, c) === lp.slug; }).length;
              return '<a class="cf-review-link" href="#web-' + esc(lp.slug) + '"><i class="bi bi-eye" aria-hidden="true"></i> Revisar ' + plural(n, "pedido", "pedidos") + " de " + esc(lp.nombre) + "</a>";
            }).join("") +
            (noteRequests.length ? '<ul class="cf-requests">' + noteRequests.map(requestCard).join("") + "</ul>" : "") +
            '<details class="cf-details"><summary>Anotar un pedido que llegó por otro lado</summary>' +
            '<form class="cf-form cf-inline" data-pf-pedido><label class="cf-grow">Qué pidió <input name="nota" maxlength="300" placeholder="Por ejemplo: precio nuevo del corte"></label>' +
              '<button class="btn-nx btn-sm" type="submit"><i class="bi bi-plus-lg" aria-hidden="true"></i> Registrar</button></form></details>' +
            (doneRequests.length ? '<h3 class="cf-sub">Pedidos generales</h3><ol class="cf-timeline">' + doneRequests.slice(0, 10).map(function (r) {
              var d = new Date(r.fecha);
              var estado = r.estado || "aceptado";
              return '<li class="' + (d.toISOString().slice(0, 7) === month ? "is-month" : "") + '"><time>' + esc(d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })) + "</time>" +
                '<span><b class="cf-state is-' + esc(estado === "parcial" ? "aceptado" : estado) + '">' + (estado === "rechazado" ? "Rechazado" : estado === "parcial" ? "Aceptado en parte" : "Aceptado") + "</b> " + esc(requestSummary(r)) + "</span>" +
                (r.origen === "cliente" ? '<button class="cf-icon-btn" type="button" data-pf-reabrir="' + esc(r.id || r.fecha) + '" aria-label="Volver a pendiente" title="Volver a pendiente"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i></button>'
                  : '<button class="cf-icon-btn" type="button" data-pf-quitar-pedido="' + r.fecha + '" aria-label="Quitar pedido del ' + esc(d.toLocaleDateString("es-AR")) + '" title="Quitar"><i class="bi bi-x-lg" aria-hidden="true"></i></button>') + "</li>";
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

      profile.querySelectorAll("[data-pf-decidir]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var card = btn.closest("[data-pf-request]");
          var estado = btn.getAttribute("data-pf-decidir");
          var comentario = card.querySelector("[name=comentario]").value;
          if (estado === "rechazado" && !comentario.trim() && !window.confirm("¿Rechazar sin explicarle el motivo al cliente?")) return;
          card.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
          api("PUT", "/api/clientes/" + c.id + "/pedidos/" + encodeURIComponent(card.getAttribute("data-pf-request")), { estado: estado, comentario: comentario })
            .then(function () { say(msg, estado === "aceptado" ? "Pedido aceptado. El cliente lo ve en su portal." : "Pedido rechazado. El cliente ve tu respuesta en su portal.", "ok"); load(); })
            .catch(function (err) { card.querySelectorAll("button").forEach(function (b) { b.disabled = false; }); say(msg, err.message, "warn"); });
        });
      });
      profile.querySelectorAll("[data-pf-reabrir]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          api("PUT", "/api/clientes/" + c.id + "/pedidos/" + encodeURIComponent(btn.getAttribute("data-pf-reabrir")), { estado: "pendiente" })
            .then(function () { say(msg, "El pedido volvió a «para revisar».", "ok"); load(); })
            .catch(function (err) { say(msg, err.message, "warn"); });
        });
      });
      profile.querySelectorAll("[data-pf-review]").forEach(bindReview);
      loadStats(c);
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
      function accessText(key) {
        return "Tu portal de Lanzate: " + c.editor + "\nUsuario: " + c.portal_usuario + "\nContraseña: " + key;
      }
      function copyAccess(key) {
        var text = accessText(key);
        return navigator.clipboard.writeText(text).then(function () { say(msg, "Copiado: link, usuario y contraseña. Pegalo en WhatsApp o en un mail.", "ok"); },
          function () { window.prompt("Copiá el acceso:", text); });
      }
      profile.querySelectorAll("[data-pf-copiar-acceso]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (freshKey) { copyAccess(freshKey); return; }
          // No hay copia guardada de la contraseña: se genera una nueva, se copia y se muestra esta vez.
          if (!window.confirm("Se va a generar una contraseña nueva y la anterior deja de funcionar. ¿Seguimos?")) return;
          btn.disabled = true;
          api("POST", "/api/clientes/" + c.id + "/acceso", { usuario: c.portal_usuario, clave: "" })
            .then(function (out) { freshKeys[c.id] = out.clave_nueva; return copyAccess(out.clave_nueva); })
            .then(load)
            .catch(function (err) { btn.disabled = false; say(accessOut, err.message, "warn"); });
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
          .then(function (out) { freshKeys[c.id] = out.clave_nueva; say(msg, "Acceso guardado. Tocá «Copiar acceso» para mandárselo.", "ok"); return load(); })
          .catch(function (err) { say(accessOut, err.message, "warn"); })
          .then(function () { btn.disabled = false; });
      });
      if (/^#(pf-acceso|pf-cambios|cf-revisar|web-[a-z0-9-]+)$/.test(location.hash)) {
        var target = profile.querySelector(location.hash);
        history.replaceState(null, "", location.pathname + location.search);
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
      c.lista.forEach(function (lp) {
        var slot = profile.querySelector('[data-site="' + lp.slug + '"] [data-site-row]');
        if (slot) slot.appendChild(landingRow(lp, { onChange: load, onMessage: function (t, tone) { say(msg, t, tone); } }));
      });
      if (list) list.closest("section").hidden = true;
    }

    function load() {
      return loadPlans().then(function () { return api("GET", "/api/clientes/" + id); }).then(render).catch(function (err) {
        profile.innerHTML = '<h1 class="visually-hidden">Ficha del cliente</h1><p class="pf-empty">' + esc(err.message) + ' <a href="clientes.html">Volver a clientes</a></p>';
        newLanding.hidden = true;
        if (list && list.closest("section")) list.closest("section").hidden = true;
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
      /* Las landings se rearman en esta pestaña: si se cierra a la mitad, la publicación queda incompleta */
      function stay(e) { e.preventDefault(); e.returnValue = ""; }
      window.addEventListener("beforeunload", stay);
      var rebuilt = [];
      rebuildAll(function (n, total) {
        btn.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i> Armando ' + n + " de " + total + "… no cierres";
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
        .then(function () {
          window.removeEventListener("beforeunload", stay);
          btn.disabled = false; btn.innerHTML = '<i class="bi bi-cloud-upload" aria-hidden="true"></i> Publicar';
        });
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
