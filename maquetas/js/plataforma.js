(function () {
  "use strict";

  var OFFLINE = "No hay conexión con el servidor. Revisá internet y probá de nuevo.";
  var SHOW_LEADS = false;

  var currentNav = document.querySelector(".lib-header nav .is-current");
  if (currentNav && currentNav.parentElement.scrollWidth > currentNav.parentElement.clientWidth) {
    var nav = currentNav.parentElement;
    var left = currentNav.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollLeft = left - (nav.clientWidth - currentNav.offsetWidth) / 2;
  }

  function toLogin() {
    if (/login\.html$/.test(location.pathname)) return;
    location.href = "login.html?volver=" + encodeURIComponent(location.pathname + location.search);
  }

  var panelPage = /\/(?:constructor|landings|clientes|cliente|consultas|reglas)\.html$/.test(location.pathname);
  if (panelPage) {
    document.documentElement.hidden = true;
    fetch("/api/sesion", { cache: "no-store", credentials: "same-origin" }).then(function (r) {
      return r.json();
    }).then(function (s) {
      if (s.ok) { document.documentElement.hidden = false; return null; }
      if (!/\/constructor\.html$/.test(location.pathname)) { toLogin(); return null; }
      return fetch("/api/portal/sesion", { cache: "no-store", credentials: "same-origin" }).then(function (r) {
        return r.json();
      }).then(function (p) {
        if (p.ok) { window.LanzatePortal = true; document.dispatchEvent(new Event("lz-portal")); document.documentElement.hidden = false; }
        else location.href = p.sitio || "/maquetas/portal.html";
      });
    }).catch(function () { toLogin(); });
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
      if (r.status === 401 && !/\/api\/login$/.test(url) && !/\/constructor\.html$/.test(location.pathname)) toLogin();
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
  function reviewLanding(lp, opts) {
    var dialog = document.createElement("dialog");
    dialog.className = "lb-dialog pf-review";
    dialog.setAttribute("aria-label", "Revisar cambios de " + lp.nombre);
    dialog.innerHTML = '<h2>Revisar cambios</h2><p></p><div data-review-content></div>' +
      '<p role="status">Cargando propuesta…</p><form method="dialog"><button class="lb-act">Cerrar</button></form>';
    dialog.querySelector("p").textContent = lp.nombre;
    dialog.addEventListener("close", function () { dialog.remove(); });
    document.body.appendChild(dialog);
    dialog.showModal();
    var status = dialog.querySelector("[role=status]");
    var path = "/api/landings/" + lp.id + "/revision";
    api("GET", path).then(function (review) {
      if (!dialog.open) return;
      status.textContent = "";
      var target = dialog.querySelector("[data-review-content]");
      var labels = { texto: "Texto", imagen: "Imagen", enlace: "Enlace", bloque: "Bloque" };
      var decisions = {};
      var shown = -1;
      var fingerprint = null;
      target.innerHTML = '<div class="pf-review-bar"><p data-review-progress aria-live="polite"></p>' +
        '<button type="button" class="lb-act" data-review-preview>Ver resultado</button>' +
        '<button type="button" class="btn-nx btn-sm" data-review-publish>Confirmar revisión</button></div>' +
        '<div class="pf-review-result" hidden><iframe sandbox title="Resultado de la revisión"></iframe></div>' +
        review.cambios.map(function (change) {
          return '<article class="pf-review-change"><header><div><span class="lb-kicker">' +
            esc(change.seccion.replace(/-/g, " ")) + '</span><h3>' + labels[change.tipo] + ' ' + esc(change.id) +
            '</h3></div><span data-choice-label>Pendiente</span></header><div class="pf-review-grid">' +
            '<div><strong>Publicado</strong><div data-before></div></div><div><strong>Propuesto</strong><div data-after></div></div></div>' +
            '<div class="lb-actions" role="group" aria-label="Decisión del cambio ' + esc(change.id) + '">' +
            '<button type="button" class="lb-act" data-choice="aprobar" aria-pressed="false">Aprobar</button>' +
            '<button type="button" class="lb-act" data-choice="rechazar" aria-pressed="false">Rechazar</button></div></article>';
        }).join("");
      var cards = target.querySelectorAll("article");
      var preview = target.querySelector("[data-review-preview]");
      var publish = target.querySelector("[data-review-publish]");
      var result = target.querySelector(".pf-review-result");
      var progress = target.querySelector("[data-review-progress]");
      function documentPreview(html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelectorAll("script, base, meta[http-equiv], iframe, object, embed").forEach(function (el) { el.remove(); });
        doc.querySelectorAll("a[href]").forEach(function (el) { el.removeAttribute("href"); });
        return "<!DOCTYPE html>" + doc.documentElement.outerHTML;
      }
      function renderValue(box, type, value) {
        if (type === "texto") {
          box.textContent = value || "Sin texto";
          return;
        }
        var doc = new DOMParser().parseFromString(value || "", "text/html");
        var element = doc.body.firstElementChild;
        if (type === "enlace" && element) {
          box.textContent = element.getAttribute("href") || "Sin destino";
        } else if (type === "imagen" && element && /^(\/[^/]|https:\/\/|data:image\/(?:jpeg|png|webp|gif);)/i.test(element.getAttribute("src") || "")) {
          var img = document.createElement("img");
          img.loading = "lazy";
          img.src = element.getAttribute("src");
          img.alt = element.getAttribute("alt") || "Imagen del cambio";
          box.appendChild(img);
          var alt = document.createElement("p");
          alt.textContent = img.alt;
          box.appendChild(alt);
        } else {
          box.textContent = doc.body.textContent.trim().slice(0, 300) || "Cambio visual. Mirá el resultado para compararlo.";
        }
      }
      function update() {
        var count = Object.keys(decisions).length;
        var approved = Object.values(decisions).filter(function (choice) { return choice === "aprobar"; }).length;
        progress.textContent = count + " de " + review.cambios.length + " revisados · " + approved + " aprobados";
        preview.disabled = count !== review.cambios.length;
        publish.disabled = preview.disabled || (approved > 0 && !fingerprint);
        publish.textContent = approved ? "Publicar cambios aprobados" : "Cerrar sin publicar";
      }
      cards.forEach(function (card, index) {
        var change = review.cambios[index];
        renderValue(card.querySelector("[data-before]"), change.tipo, change.antes);
        renderValue(card.querySelector("[data-after]"), change.tipo, change.despues);
        var buttons = card.querySelectorAll("[data-choice]");
        buttons.forEach(function (button) {
          button.onclick = function () {
            decisions[change.id] = button.dataset.choice;
            shown++;
            fingerprint = null;
            result.hidden = true;
            buttons.forEach(function (item) { item.setAttribute("aria-pressed", String(item === button)); });
            card.querySelector("[data-choice-label]").textContent = button.dataset.choice === "aprobar" ? "Aprobado" : "Rechazado";
            update();
          };
        });
      });
      function submit(action) {
        return api("POST", path, { token: review.token, accion: action, decisiones: decisions, huella: fingerprint });
      }
      preview.onclick = function () {
        var version = ++shown;
        status.textContent = "Preparando vista previa…";
        submit("preview").then(function (data) {
          if (version !== shown || !dialog.open) return;
          fingerprint = data.huella;
          update();
          result.querySelector("iframe").srcdoc = documentPreview(data.html);
          result.hidden = false;
          status.textContent = "";
          result.scrollIntoView({ block: "nearest" });
        }).catch(function (err) { if (version === shown) status.textContent = err.message; });
      };
      publish.onclick = function () {
        if (!window.confirm("¿Confirmar las decisiones de esta revisión?")) return;
        var controls = Array.from(target.querySelectorAll("button"));
        controls.forEach(function (button) { button.disabled = true; });
        submit("publicar").then(function (data) {
          dialog.close();
          if (opts.onMessage) opts.onMessage(data.publicada === false ? "Revisión cerrada." : "Cambios aprobados y publicados.", "ok");
          if (opts.onChange) opts.onChange();
        }).catch(function (err) {
          status.textContent = err.message;
          controls.forEach(function (button) { button.disabled = false; });
          update();
        });
      };
      update();
    }).catch(function (err) { status.textContent = err.message; });
  }

  function landingRow(lp, opts) {
    opts = opts || {};
    var li = document.createElement("li");
    li.className = "lb-saved-item";
    var count = lp.cantidad_modulos == null ? (lp.items || []).length : lp.cantidad_modulos;
    var when = new Date(lp.actualizado).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }).replace(/ de /g, " ");
    var meta = [plural(count, "módulo", "módulos"), '<span title="' + esc(formatDate(lp.actualizado)) + '">' + esc(when) + "</span>"];
    if (SHOW_LEADS && lp.consultas) {
      meta.push('<a class="pf-leads-link' + (lp.consultas_nuevas ? " is-new" : "") + '" href="consultas.html?landing=' + lp.id + '">' +
        plural(lp.consultas, "consulta", "consultas") + (lp.consultas_nuevas ? " (" + lp.consultas_nuevas + (lp.consultas_nuevas === 1 ? " nueva" : " nuevas") + ")" : "") + "</a>");
    }
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
      (lp.disponible ? "" : '<small><b class="pf-missing">Sin publicar</b></small>') + "</span>" +
      '<span class="lb-saved-actions">' +
      (lp.revision_estado === "pendiente" ? '<button class="lb-act" type="button" data-act="review">Revisar cambios</button>' : "") +
      icon("a", 'href="' + esc(lp.url) + '" target="_blank" rel="noopener"', "bi-box-arrow-up-right", "Abrir") +
      (opts.onEdit
        ? icon("button", 'type="button" data-act="edit"', "bi-pencil", "Editar")
        : icon("a", 'href="constructor.html?landing=' + lp.id + '"', "bi-pencil", "Editar")) +
      (lp.restaurable && lp.revision_estado !== "pendiente" ? '<button class="lb-act" type="button" data-act="restore">Restaurar versión</button>' : "") +
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
      if (act === "review") reviewLanding(lp, opts);
      if (act === "restore" && window.confirm("¿Volver a la versión anterior de esta landing?")) {
        btn.disabled = true;
        api("POST", "/api/landings/" + lp.id + "/restaurar", {}).then(function () {
          report("Versión anterior restaurada.", "ok");
          if (opts.onChange) opts.onChange();
        }).catch(function (err) {
          btn.disabled = false;
          report(err.message, "warn");
        });
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
      var question = "¿Eliminar «" + lp.nombre + "»? Deja de estar publicada en " + lp.url + ".";
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
          '<ul class="pf-client-data">' +
          (c.contacto ? '<li><i class="bi bi-person"></i>' + esc(c.contacto) + "</li>" : "") +
          (c.email ? '<li><i class="bi bi-envelope"></i>' + esc(c.email) + "</li>" : "") +
          (c.telefono ? '<li><i class="bi bi-telephone"></i>' + esc(c.telefono) + "</li>" : "") +
          (!c.contacto && !c.email && !c.telefono ? '<li class="is-muted"><i class="bi bi-info-circle"></i>Sin datos de contacto</li>' : "") +
          "</ul>" +
          '<div class="pf-client-foot"><span class="lb-badge">' + plural(c.landings, "landing", "landings") + " · " + (c.tipo_cliente === "demo" ? "Demo" : "Real") + "</span>" +
          '<span class="pf-client-actions"><a class="btn-nx btn-sm" href="/sitio/' + encodeURIComponent(c.slug) + '/" target="_blank" rel="noopener">Abrir portal</a>' +
          '<a class="lb-act" href="cliente.html?id=' + c.id + '">Ver ficha <i class="bi bi-arrow-right"></i></a></span></div>';
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

    function field(icon, label, value) {
      return value ? '<div class="pf-fact"><dt><i class="bi bi-' + icon + '"></i> ' + label + "</dt><dd>" + value + "</dd></div>" : "";
    }

    function render(c) {
      document.title = c.nombre + " · Lanzate";
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
        field("geo-alt", "Dirección", esc(c.direccion)) +
        field("clock", "Horario", esc(c.horario)) +
        field("share", "Redes", ["instagram", "facebook", "linkedin"].filter(function (k) { return c[k]; }).map(function (k) {
          var handle = socialUrl(k, c[k]).replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop();
          return '<a href="' + esc(socialUrl(k, c[k])) + '" target="_blank" rel="noopener"><i class="bi bi-' + k + '"></i> @' + esc(handle) + "</a>";
        }).join(" ")) +
        field("palette", "Colores", '<span class="pf-swatch" style="background:' + esc(c.color_primario) + '"></span><span class="pf-swatch" style="background:' + esc(c.color_secundario) + '"></span> ' + esc(c.color_primario) + " · " + esc(c.color_secundario)) +
        field("folder2", "Carpeta", esc(c.carpeta)) +
        field("graph-up", "Medición", [c.ga4 ? "Analytics " + esc(c.ga4) : "", c.gtm ? "Tag Manager " + esc(c.gtm) : "", c.meta_pixel ? "Píxel de Meta" : ""].filter(Boolean).join(" · ")) +
        "</dl>" +
        (c.notas ? '<div class="pf-notes"><strong>Notas internas</strong><p>' + esc(c.notas) + "</p></div>" : "") +
        '<section class="pf-admin"><h2>Administración</h2>' +
        '<p class="pf-admin-line">Alta: ' + (c.creado ? new Date(c.creado).toLocaleDateString("es-AR") : "—") + "</p>" +
        '<form class="pf-admin-form" data-pf-plan>' +
        '<label>Plan <select name="plan"><option value="">Sin plan</option><option>Base</option><option>Pro</option></select></label>' +
        '<label>Vencimiento <input name="plan_vence" type="date" value="' + esc(c.plan_vence || "") + '"></label>' +
        '<button class="btn-nx btn-sm" type="submit">Guardar plan</button></form>' +
        '<h2>Acceso al portal</h2>' +
        '<p><a class="btn-nx-outline btn-sm" href="/sitio/' + encodeURIComponent(c.slug) + '/" target="_blank" rel="noopener">Entrar al portal</a></p>' +
        '<p class="pf-admin-line">Sitio: ' + esc("/sitio/" + c.slug + "/") + "</p>" +
        '<p class="pf-admin-line" id="pf-acceso-ayuda">Elegí el usuario y una contraseña nueva de al menos 12 caracteres. Al guardar, se cierran las sesiones abiertas de este cliente.</p>' +
        '<form class="pf-admin-form" data-pf-acceso aria-describedby="pf-acceso-ayuda">' +
        '<label>Usuario <input name="usuario" required minlength="3" maxlength="40" value="' + esc(c.portal_usuario || "") + '" autocomplete="off"></label>' +
        '<label>Contraseña nueva <input name="clave" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>' +
        '<label><input type="checkbox" data-pf-ver-clave> Mostrar contraseña</label>' +
        '<button class="btn-nx btn-sm" type="submit">Guardar acceso</button></form>' +
        '<p data-pf-acceso-estado role="status"></p></section>';
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
      var accessForm = profile.querySelector("[data-pf-acceso]");
      var accessStatus = profile.querySelector("[data-pf-acceso-estado]");
      var password = accessForm.elements.clave;
      var revealPassword = accessForm.querySelector("[data-pf-ver-clave]");
      revealPassword.addEventListener("change", function () {
        password.type = revealPassword.checked ? "text" : "password";
      });
      accessForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var button = accessForm.querySelector("button");
        button.disabled = true;
        say(accessStatus, "Guardando acceso…");
        api("POST", "/api/clientes/" + c.id + "/acceso", {
          usuario: accessForm.elements.usuario.value.trim(),
          clave: password.value
        }).then(function (out) {
          accessForm.elements.usuario.value = out.usuario;
          password.value = "";
          password.type = "password";
          revealPassword.checked = false;
          say(accessStatus, "Acceso guardado.", "ok");
        }).catch(function (err) { say(accessStatus, err.message, "warn"); })
          .finally(function () { button.disabled = false; });
      });
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
    var params = new URLSearchParams(location.search);
    var preset = params.get("cliente") || "";
    var reviewId = params.get("revision");

    function render() {
      var q = normalize(search.value.trim());
      var cid = select.value;
      var shown = landings.filter(function (lp) {
        return (!reviewId || String(lp.id) === reviewId) && (!cid || String(lp.cliente_id) === cid) && (!q || normalize(lp.nombre + " " + lp.cliente).indexOf(q) !== -1);
      });
      list.innerHTML = "";
      shown.forEach(function (lp) {
        list.appendChild(landingRow(lp, { showClient: true, onChange: load, onMessage: function (t, tone) { say(msg, t, tone); } }));
      });
      empty.hidden = shown.length > 0;
      empty.textContent = landings.length ? "No hay landings con ese filtro." : "Todavía no creaste landings. Empezá desde la ficha de un cliente o con «Nueva landing».";
      count.textContent = plural(shown.length, "landing", "landings");
      if (reviewId) {
        var selected = shown[0];
        say(msg, selected && selected.revision_estado === "pendiente" ?
          "Esta landing tiene cambios pendientes. Abrí «Revisar cambios» para decidir." :
          "La propuesta ya no está pendiente.", "");
        var back = document.createElement("a");
        back.href = "landings.html";
        back.textContent = "Ver todas las landings";
        msg.append(" ", back);
      }
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

  /* Página: consultas que llegan desde las landings */
  var LEAD_LABELS = { nombre: "Nombre", email: "Email", telefono: "Teléfono", servicio: "Servicio", profesional: "Profesional",
    dia: "Día", horario: "Horario", notas: "Mensaje", mensaje: "Mensaje", recordatorio: "Recordatorio por WhatsApp", duracion: "Duración" };

  var LEAD_ORDER = ["nombre", "email", "telefono", "servicio", "profesional", "dia", "horario", "duracion", "recordatorio", "notas", "mensaje"];

  function waLink(tel) {
    var d = String(tel || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.indexOf("54") !== 0) d = "549" + d.replace(/^0/, "");
    return "https://wa.me/" + d;
  }

  function pageConsultas() {
    var list = document.querySelector("[data-pf-leads]");
    var empty = document.querySelector("[data-pf-leads-empty]");
    var msg = document.querySelector("[data-pf-msg]");
    var search = document.querySelector("[data-pf-search]");
    var clientSel = document.querySelector("[data-pf-client-filter]");
    var landingSel = document.querySelector("[data-pf-landing-filter]");
    var count = document.querySelector("[data-pf-count]");
    var leads = [];
    var params = new URLSearchParams(location.search);
    var presetLanding = params.get("landing") || "";

    function fillLandings() {
      var cid = clientSel.value;
      var seen = {};
      var opts = leads.filter(function (l) { return !cid || String(l.cliente_id) === cid; }).filter(function (l) {
        if (seen[l.landing_id]) return false;
        seen[l.landing_id] = true;
        return true;
      });
      var current = landingSel.value || presetLanding;
      landingSel.innerHTML = '<option value="">Todas las landings</option>' + opts.map(function (l) {
        return '<option value="' + l.landing_id + '">' + esc(l.landing) + (cid ? "" : " · " + esc(l.cliente)) + "</option>";
      }).join("");
      landingSel.value = opts.some(function (l) { return String(l.landing_id) === current; }) ? current : "";
      presetLanding = "";
    }

    function card(l) {
      var d = l.datos || {};
      var who = d.nombre || d.email || d.telefono || "Consulta sin nombre";
      var fields = Object.keys(d).sort(function (a, b) {
        var ia = LEAD_ORDER.indexOf(a), ib = LEAD_ORDER.indexOf(b);
        return (ia === -1 ? 50 : ia) - (ib === -1 ? 50 : ib);
      }).map(function (k) {
        var label = LEAD_LABELS[k] || k.charAt(0).toUpperCase() + k.slice(1);
        return '<div class="pf-fact"><dt>' + esc(label) + "</dt><dd>" + esc(d[k]) + "</dd></div>";
      }).join("");
      var acts = [];
      if (d.email) acts.push('<a class="lb-act" href="mailto:' + esc(d.email) + "?subject=" + encodeURIComponent("Tu consulta en " + l.cliente) + '"><i class="bi bi-envelope"></i> Responder por email</a>');
      if (d.telefono && waLink(d.telefono)) acts.push('<a class="lb-act" href="' + esc(waLink(d.telefono)) + '" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> WhatsApp</a>');
      acts.push('<button class="lb-act" type="button" data-act="read">' + (l.leida ? '<i class="bi bi-envelope"></i> Marcar como nueva' : '<i class="bi bi-check2"></i> Marcar como leída') + "</button>");
      acts.push('<button class="lb-act lb-act-icon is-danger" type="button" data-act="delete" title="Borrar consulta" aria-label="Borrar consulta de ' + esc(who) + '"><i class="bi bi-trash3"></i></button>');
      var li = document.createElement("li");
      li.className = "pf-lead" + (l.leida ? "" : " is-new");
      li.innerHTML =
        '<div class="pf-lead-head"><div><strong>' + esc(who) + "</strong>" +
        '<small><span class="pf-lead-type">' + (l.tipo === "turno" ? "Turno" : "Contacto") + "</span>" +
        (l.leida ? "" : '<span class="pf-lead-new">Nueva</span>') +
        '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.landing) + '</a> · <a href="cliente.html?id=' + l.cliente_id + '">' + esc(l.cliente) + "</a></small></div>" +
        '<time datetime="' + new Date(l.creado).toISOString() + '">' + esc(formatDate(l.creado)) + "</time></div>" +
        '<dl class="pf-facts">' + fields + "</dl>" +
        (l.origen ? '<p class="pf-lead-origin">Origen: ' + esc(l.origen) + "</p>" : "") +
        '<div class="pf-lead-acts">' + acts.join("") + "</div>";
      li.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-act]");
        if (!btn) return;
        btn.disabled = true;
        if (btn.getAttribute("data-act") === "read") {
          api("PUT", "/api/consultas/" + l.id, { leida: !l.leida }).then(function () { l.leida = !l.leida; render(); })
            .catch(function (err) { btn.disabled = false; say(msg, err.message, "warn"); });
        } else if (confirm("¿Borrar la consulta de «" + who + "»? No se puede recuperar.")) {
          api("DELETE", "/api/consultas/" + l.id).then(function () {
            leads = leads.filter(function (x) { return x !== l; });
            say(msg, "Se borró la consulta.", "ok");
            render();
          }).catch(function (err) { btn.disabled = false; say(msg, err.message, "warn"); });
        } else btn.disabled = false;
      });
      return li;
    }

    function render() {
      var q = normalize(search.value.trim());
      var cid = clientSel.value;
      var lid = landingSel.value;
      var shown = leads.filter(function (l) {
        return (!cid || String(l.cliente_id) === cid) && (!lid || String(l.landing_id) === lid) &&
          (!q || normalize(Object.keys(l.datos || {}).map(function (k) { return l.datos[k]; }).join(" ") + " " + l.landing + " " + l.cliente).indexOf(q) !== -1);
      });
      list.innerHTML = "";
      shown.forEach(function (l) { list.appendChild(card(l)); });
      var nuevas = shown.filter(function (l) { return !l.leida; }).length;
      count.textContent = plural(shown.length, "consulta", "consultas") + (nuevas ? " · " + plural(nuevas, "nueva", "nuevas") : "");
      empty.hidden = shown.length > 0;
      empty.textContent = leads.length ? "No hay consultas con ese filtro."
        : "Todavía no llegó ninguna consulta. Aparecen acá cuando alguien completa un formulario o reserva un turno en una landing&nbsp;publicada.".replace("&nbsp;", "\u00a0");
    }

    function load() {
      return Promise.all([api("GET", "/api/clientes"), api("GET", "/api/consultas")]).then(function (res) {
        leads = res[1];
        var withLeads = {};
        leads.forEach(function (l) { withLeads[l.cliente_id] = (withLeads[l.cliente_id] || 0) + 1; });
        var current = clientSel.value || params.get("cliente") || "";
        if (presetLanding) {
          var match = leads.filter(function (l) { return String(l.landing_id) === presetLanding; })[0];
          if (match) current = String(match.cliente_id);
        }
        clientSel.innerHTML = '<option value="">Todos los clientes</option>' + res[0].filter(function (c) { return withLeads[c.id]; }).map(function (c) {
          return '<option value="' + c.id + '">' + esc(c.nombre) + " (" + withLeads[c.id] + ")</option>";
        }).join("");
        clientSel.value = withLeads[current] ? current : "";
        fillLandings();
        render();
      }).catch(function (err) { say(msg, err.message, "warn"); });
    }

    search.addEventListener("input", render);
    clientSel.addEventListener("change", function () { fillLandings(); render(); });
    landingSel.addEventListener("change", render);
    load();
  }

  function addLogout() {
    var nav = document.querySelector(".lib-header nav");
    if (!nav || nav.querySelector("[data-pf-logout]")) return;
    api("GET", "/api/sesion").then(function (s) {
      if (!s.requiere || !s.ok) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lib-logout";
      btn.setAttribute("data-pf-logout", "");
      btn.innerHTML = '<i class="bi bi-box-arrow-right" aria-hidden="true"></i> Salir';
      btn.addEventListener("click", function () {
        api("POST", "/api/logout", {}).then(function () { location.href = "login.html"; });
      });
      nav.appendChild(btn);
    }).catch(function () { /* sin sesión: el botón no hace falta */ });
  }
  if (document.body.classList.contains("lib-page")) addLogout();

  window.Lanzate = { api: api, esc: esc, socialUrl: socialUrl, say: say, clientForm: clientForm, landingRow: landingRow, plural: plural };

  var page = document.body.getAttribute("data-page");
  if (page === "clientes") pageClientes();
  if (page === "cliente") pageCliente();
  if (page === "landings") pageLandings();
  if (page === "consultas") pageConsultas();
})();
