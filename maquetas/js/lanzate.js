(function () {
  "use strict";

  /* En una landing publicada los formularios envían la consulta; en las maquetas y la vista previa son de muestra */
  var leadMeta = document.querySelector('meta[name="lz-landing"]');
  var apiMeta = document.querySelector('meta[name="lz-api"]');
  /* Visitas y consultas se registran en el panel (Vercel) para el portal del cliente */
  function beacon(path, payload) {
    if (!apiMeta || !apiMeta.content) return;
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(apiMeta.content + path, new Blob([body], { type: "text/plain" }))) return;
    } catch (e) {}
    try { fetch(apiMeta.content + path, { method: "POST", body: body, keepalive: true, mode: "no-cors" }); } catch (e) {}
  }
  if (leadMeta && window.top === window && !/[?&]lzvista=/.test(location.search)) {
    beacon("/api/visita", { l: Number(leadMeta.content), r: document.referrer || "" });
  }
  if (leadMeta) {
    document.querySelectorAll(".nx-footer h2.h6").forEach(function (heading) {
      var label = document.createElement("p");
      Array.prototype.forEach.call(heading.attributes, function (attr) {
        label.setAttribute(attr.name, attr.value);
      });
      label.classList.add("nx-footer-label");
      while (heading.firstChild) label.appendChild(heading.firstChild);
      heading.replaceWith(label);
    });
    document.querySelectorAll('form input[name="web"]').forEach(function (trap) {
      trap.hidden = true;
      trap.tabIndex = -1;
      trap.setAttribute("aria-hidden", "true");
    });
  }
  var LEAD_FAIL = "No se pudo abrir WhatsApp. Escribinos por los datos de contacto de la página.";

  function leadData(form, extra) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === "web" || el.disabled || el.type === "submit" || el.type === "button") return;
      if (el.type === "checkbox") { data[el.name] = el.checked; return; }
      if (el.type === "radio" && !el.checked) return;
      var value = el.tagName === "SELECT" && el.selectedIndex > -1 ? el.options[el.selectedIndex].text : el.value;
      if (String(value).trim()) data[el.name] = value;
    });
    Object.keys(extra || {}).forEach(function (k) {
      if (!/_iso$/.test(k) && extra[k] && data[k] == null) data[k] = extra[k];
    });
    return data;
  }

  /* Las landings son páginas estáticas: la consulta se arma como mensaje y se abre WhatsApp (o el mail) del negocio. */
  var LEAD_LABELS = { nombre: "Nombre", email: "Email", telefono: "Teléfono", servicio: "Servicio", profesional: "Con quién",
    dia: "Día", horario: "Horario", notas: "Mensaje", mensaje: "Mensaje", duracion: "Duración" };
  function sendLead(form, tipo, extra) {
    if (!leadMeta) return Promise.resolve(true);
    var trap = form.querySelector('[name="web"]');
    if (trap && trap.value) return Promise.resolve(true);
    var data = leadData(form, extra);
    beacon("/api/consultas/nueva", { l: Number(leadMeta.content), tipo: tipo, datos: data, web: trap ? trap.value : "" });
    var lines = [tipo === "turno" ? "Hola, quiero reservar un turno:" : "Hola, quiero hacer una consulta:"];
    Object.keys(data).forEach(function (k) {
      var value = data[k];
      if (value === true) value = "Sí";
      if (value === false || value === "" || value == null) return;
      lines.push((LEAD_LABELS[k] || k.charAt(0).toUpperCase() + k.slice(1)) + ": " + value);
    });
    var text = lines.join("\n");
    var wa = document.querySelector('meta[name="lz-whatsapp"]');
    var mail = document.querySelector('meta[name="lz-email"]');
    var url = "";
    if (wa && wa.content) url = "https://wa.me/" + wa.content + "?text=" + encodeURIComponent(text);
    else if (mail && mail.content) url = "mailto:" + mail.content + "?subject=" + encodeURIComponent(tipo === "turno" ? "Reserva de turno" : "Consulta desde la web") + "&body=" + encodeURIComponent(text);
    if (!url) return Promise.resolve(false);
    track("consulta", tipo);
    var win = /^https:/.test(url) ? window.open(url, "_blank", "noopener") : null;
    if (!win) location.href = url;
    return Promise.resolve(true);
  }

  /* Conversiones para Analytics, Tag Manager y Meta (si el cliente los cargó) */
  function track(kind, detail) {
    try {
      if (window.dataLayer) window.dataLayer.push({ event: "lz_" + kind, lz_detalle: detail || "" });
      if (window.gtag) window.gtag("event", kind === "consulta" ? "generate_lead" : "contact", { method: detail || kind });
      if (window.fbq) window.fbq("track", kind === "consulta" ? "Lead" : "Contact");
    } catch (e) { /* la medición nunca frena a la landing */ }
  }

  if (leadMeta) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href*="wa.me/"], a[href^="tel:"], a[href^="mailto:"]');
      if (a) track("contacto", /wa\.me/.test(a.href) ? "whatsapp" : /^tel:/.test(a.href) ? "telefono" : "email");
    }, true);
    document.querySelectorAll(".nx-note").forEach(function (el) { el.remove(); });
    /* La reserva se pide por WhatsApp: el negocio la confirma al responder. */
    document.querySelectorAll("[data-book-done]").forEach(function (box) {
      var title = box.querySelector("h3");
      if (title) title.textContent = "¡Ya casi!";
      var text = box.querySelector("p");
      if (text) text.textContent = "Se abrió WhatsApp con tu pedido de turno. Mandá el mensaje y te confirmamos el horario.";
    });
    document.querySelectorAll("[data-form-msg]").forEach(function (el) { el.textContent = ""; });
    document.querySelectorAll("[data-demo-form], [data-book-form]").forEach(function (form) {
      var trap = document.createElement("input");
      trap.type = "text";
      trap.name = "web";
      trap.tabIndex = -1;
      trap.autocomplete = "off";
      trap.setAttribute("aria-hidden", "true");
      trap.hidden = true;
      form.appendChild(trap);
    });
  }

  document.querySelectorAll("[data-search-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var form = btn.closest("[data-nav-search]");
      form.classList.toggle("is-open");
      var input = form.querySelector("input");
      if (form.classList.contains("is-open")) input.focus();
    });
  });

  document.querySelectorAll("[data-nav-search]").forEach(function (form) {
    form.addEventListener("submit", function (e) { e.preventDefault(); });
  });

  document.querySelectorAll("[data-tabs]").forEach(function (root) {
    var buttons = root.querySelectorAll("[data-tab]");
    var panels = root.querySelectorAll("[data-panel]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-tab");
        buttons.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-on", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach(function (p) {
          p.classList.toggle("is-on", p.getAttribute("data-panel") === id);
        });
      });
    });
  });

  document.querySelectorAll("[data-filter-group]").forEach(function (root) {
    var buttons = root.querySelectorAll("[data-filter]");
    var items = root.querySelectorAll("[data-item]");
    var empty = root.querySelector("[data-empty]");
    var paged = root.hasAttribute("data-pager");
    var homes = Array.prototype.map.call(items, function (item) { return item.parentNode; });
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tag = btn.getAttribute("data-filter");
        buttons.forEach(function (b) { b.classList.toggle("is-on", b === btn); });
        var shown = 0;
        items.forEach(function (item) {
          var tags = (item.getAttribute("data-tags") || "").split(/\s+/);
          var ok = tag === "todos" || tags.indexOf(tag) !== -1;
          item.hidden = !ok;
          if (ok) shown += 1;
        });
        if (empty) empty.style.display = shown ? "none" : "block";
        if (paged) {
          var filtered = tag !== "todos";
          var first = homes[0];
          items.forEach(function (item, idx) { (filtered ? first : homes[idx]).appendChild(item); });
          root.classList.toggle("is-filtered", filtered);
        }
      });
    });
  });

  document.querySelectorAll("[data-heart]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var on = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      btn.innerHTML = on ? '<i class="bi bi-heart"></i>' : '<i class="bi bi-heart-fill"></i>';
    });
  });

  document.querySelectorAll("[data-swatches]").forEach(function (group) {
    group.querySelectorAll(".swatch").forEach(function (dot) {
      dot.addEventListener("click", function () {
        group.querySelectorAll(".swatch").forEach(function (d) { d.classList.remove("is-on"); });
        dot.classList.add("is-on");
      });
    });
  });

  var videoModal = document.getElementById("videoModal");
  if (videoModal) {
    var modal = new bootstrap.Modal(videoModal);
    var titleEl = videoModal.querySelector("[data-video-title]");
    document.querySelectorAll("[data-video]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        titleEl.textContent = btn.getAttribute("data-video") || "Video";
        modal.show();
      });
    });
  }

  document.querySelectorAll("[data-scroller]").forEach(function (root) {
    var track = root.querySelector("[data-track]");
    var count = root.querySelector("[data-count]");
    var bar = root.querySelector("[data-bar]");
    if (!track) return;
    function update() {
      var items = Array.prototype.filter.call(track.children, function (el) { return !el.hidden; });
      if (!items.length) return;
      var gap = 16;
      var w = items[0].getBoundingClientRect().width + gap;
      var index = Math.min(items.length, Math.round(track.scrollLeft / w) + 1);
      if (count) {
        count.textContent = String(index).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
      }
      if (bar) bar.style.width = Math.max(12, (index / items.length) * 100) + "%";
    }
    root.querySelectorAll("[data-dir]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = track.querySelector(":scope > :not([hidden])");
        var delta = item ? item.getBoundingClientRect().width + 16 : 280;
        track.scrollBy({ left: btn.getAttribute("data-dir") === "next" ? delta : -delta, behavior: "smooth" });
      });
    });
    track.addEventListener("scroll", update, { passive: true });
    update();
  });

  document.querySelectorAll("[data-bento]").forEach(function (root) {
    var dialog = root.querySelector("[data-lightbox-dialog]");
    if (!dialog || typeof dialog.showModal !== "function") return;
    var tiles = root.querySelectorAll("[data-lightbox]");
    var img = dialog.querySelector("[data-lb-img]");
    var copy = dialog.querySelector("[data-lb-copy]");
    var title = dialog.querySelector("[data-lb-title]");
    var count = dialog.querySelector("[data-lb-count]");
    var list = [];
    var index = 0;
    function render() {
      var tile = list[index];
      var src = tile.querySelector("img");
      img.src = src.getAttribute("src");
      img.alt = src.alt;
      copy.textContent = tile.getAttribute("data-copy") || "";
      title.textContent = tile.getAttribute("data-title") || "";
      count.textContent = String(index + 1).padStart(2, "0") + " / " + String(list.length).padStart(2, "0");
    }
    function step(dir) {
      index = (index + dir + list.length) % list.length;
      render();
    }
    tiles.forEach(function (tile) {
      tile.addEventListener("click", function () {
        list = Array.prototype.filter.call(tiles, function (t) { return !t.hidden; });
        index = Math.max(0, list.indexOf(tile));
        render();
        dialog.showModal();
      });
    });
    dialog.querySelectorAll("[data-lb-dir]").forEach(function (btn) {
      btn.addEventListener("click", function () { step(Number(btn.getAttribute("data-lb-dir"))); });
    });
    dialog.querySelector("[data-lb-close]").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    });
  });

  document.querySelectorAll("[data-faq]").forEach(function (root) {
    var input = root.querySelector("[data-faq-search]");
    var topics = root.querySelectorAll("[data-topic]");
    var items = root.querySelectorAll("[data-faq-item]");
    var empty = root.querySelector("[data-faq-empty]");
    var topic = "primeros";
    function apply() {
      var q = (input && input.value || "").trim().toLowerCase();
      var shown = 0;
      items.forEach(function (item) {
        var okTopic = !q && item.getAttribute("data-faq-item") === topic;
        var text = item.textContent.toLowerCase();
        var okSearch = q && text.indexOf(q) !== -1;
        var ok = q ? okSearch : okTopic;
        item.hidden = !ok;
        if (ok) shown += 1;
      });
      if (empty) empty.hidden = shown !== 0;
    }
    topics.forEach(function (btn) {
      btn.addEventListener("click", function () {
        topic = btn.getAttribute("data-topic");
        topics.forEach(function (b) { b.classList.toggle("is-on", b === btn); });
        if (input) input.value = "";
        apply();
      });
    });
    if (input) input.addEventListener("input", apply);
    apply();
  });

  document.querySelectorAll("[data-map]").forEach(function (root) {
    var stage = root.querySelector("[data-map-stage]");
    var scale = 1;
    function paint() {
      stage.style.transform = "scale(" + scale + ")";
      stage.style.transformOrigin = "center center";
    }
    root.querySelectorAll("[data-zoom]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        scale = btn.getAttribute("data-zoom") === "in" ? Math.min(1.8, scale + 0.2) : Math.max(1, scale - 0.2);
        paint();
      });
    });
  });

  document.querySelectorAll("[data-pager]").forEach(function (root) {
    var pages = root.querySelectorAll("[data-page]");
    var count = root.querySelector("[data-count]");
    var i = 0;
    function show(n) {
      i = (n + pages.length) % pages.length;
      pages.forEach(function (p, idx) { p.hidden = idx !== i; });
      if (count) count.textContent = String(i + 1).padStart(2, "0") + " / " + String(pages.length).padStart(2, "0");
    }
    root.querySelectorAll("[data-dir]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        show(i + (btn.getAttribute("data-dir") === "next" ? 1 : -1));
      });
    });
    show(0);
  });

  function withTransition(apply) {
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }

  document.querySelectorAll("[data-split-toggle]").forEach(function (group) {
    var scope = group.closest(".mq-block") || document;
    var buttons = group.querySelectorAll("[data-split-side]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var side = btn.getAttribute("data-split-side");
        withTransition(function () {
          scope.querySelectorAll("[data-media]").forEach(function (el) { el.setAttribute("data-media", side); });
          buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        });
      });
    });
  });

  function setWidth(block, modules, mode) {
    block.setAttribute("data-width", mode);
    modules.forEach(function (el) { el.setAttribute("data-width", mode); });
  }

  document.querySelectorAll(".mq-block").forEach(function (block) {
    var caption = block.querySelector(".mq-caption");
    var modules = Array.prototype.filter.call(block.querySelectorAll(".mq-frame .nx"), function (el) {
      return !el.parentElement.closest(".nx");
    });
    if (!caption || !modules.length) return;

    var initial = modules[0].getAttribute("data-width") === "full" ? "full" : "contained";
    var tools = document.createElement("div");
    tools.className = "mq-tools";
    caption.querySelectorAll(".split-toggle").forEach(function (t) { tools.appendChild(t); });

    var group = document.createElement("div");
    group.className = "split-toggle";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Ancho del módulo");
    [["contained", "bi-layout-three-columns", "Con márgenes"], ["full", "bi-arrows-angle-expand", "Ancho completo"]].forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-width-set", opt[0]);
      btn.setAttribute("aria-pressed", String(opt[0] === initial));
      btn.innerHTML = '<i class="bi ' + opt[1] + '"></i> ' + opt[2];
      group.appendChild(btn);
    });
    tools.appendChild(group);
    caption.appendChild(tools);

    setWidth(block, modules, initial);
    var buttons = group.querySelectorAll("button");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        withTransition(function () {
          setWidth(block, modules, btn.getAttribute("data-width-set"));
          buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        });
      });
    });
  });
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.documentElement.classList.add("mq-ready"); });
  });

  document.querySelectorAll("[data-cmp]").forEach(function (root) {
    var picks = root.querySelectorAll("[data-pick]");
    picks.forEach(function (btn) {
      btn.addEventListener("click", function () {
        root.setAttribute("data-show", btn.getAttribute("data-pick"));
        picks.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      });
    });
  });

  document.querySelectorAll("[data-demo-form]").forEach(function (form) {
    var msg = form.querySelector("[data-form-msg]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      sendLead(form, "contacto").then(function (ok) {
        if (btn) btn.disabled = false;
        if (msg) msg.textContent = ok ? "Se abrió WhatsApp con tu consulta. Tocá enviar para que nos llegue." : LEAD_FAIL;
        if (ok) form.reset();
      });
    });
  });

  /* Reserva de turnos: demo sin envío */
  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function longDate(d) {
    return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  }
  function tomorrow() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return d;
  }

  document.querySelectorAll("[data-booking]").forEach(function (root) {
    var form = root.matches("[data-book-form]") ? root : root.querySelector("[data-book-form]");
    var steps = Array.prototype.slice.call(root.querySelectorAll("[data-book-step]"));
    var stepItems = root.querySelectorAll("[data-book-steps] li");
    var nextBtn = root.querySelector("[data-book-next]");
    var prevBtn = root.querySelector("[data-book-prev]");
    var msg = root.querySelector("[data-book-msg]");
    var cal = root.querySelector("[data-book-cal]");
    var values = {};
    var current = 0;
    var calMonth = tomorrow();
    calMonth.setDate(1);

    function render() {
      root.querySelectorAll("[data-book-out]").forEach(function (el) {
        var v = values[el.getAttribute("data-book-out")];
        el.textContent = v || el.getAttribute("data-empty") || "";
        el.classList.toggle("is-empty", !v);
      });
      if (steps.length) {
        var need = (steps[current].getAttribute("data-book-requires") || "").split(",").filter(Boolean);
        nextBtn.disabled = need.some(function (k) { return !values[k]; });
      }
    }

    function say(text) { if (msg) msg.textContent = text || ""; }

    function busySlots() {
      var seed = values.dia_iso || "";
      root.querySelectorAll("[data-book-slots] [data-book-pick]").forEach(function (btn, i) {
        if (!seed) return;
        var hash = 0;
        (seed + btn.textContent).split("").forEach(function (c) { hash = (hash * 31 + c.charCodeAt(0)) % 997; });
        var busy = hash % 4 === 0 && i > 0;
        btn.disabled = busy;
        btn.title = busy ? "Ocupado" : "";
        if (busy && btn.getAttribute("aria-pressed") === "true") {
          btn.setAttribute("aria-pressed", "false");
          values.horario = "";
        }
      });
    }

    function pick(btn) {
      var name = btn.getAttribute("data-book-pick");
      root.querySelectorAll('[data-book-pick="' + name + '"]').forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      values[name] = btn.getAttribute("data-label") || btn.querySelector("strong") && btn.querySelector("strong").textContent || btn.textContent.trim();
      if (btn.hasAttribute("data-iso")) values[name + "_iso"] = btn.getAttribute("data-iso");
      (btn.getAttribute("data-book-set") || "").split("|").forEach(function (pair) {
        var i = pair.indexOf(":");
        if (i > 0) values[pair.slice(0, i)] = pair.slice(i + 1);
      });
      if (name === "dia") busySlots();
      say("");
      render();
    }

    function dayButton(d, cls, inner) {
      var iso = isoDate(d);
      var on = values.dia_iso === iso;
      return '<button class="' + cls + '" type="button" data-book-pick="dia" data-iso="' + iso + '" data-label="' + longDate(d) +
        '" aria-pressed="' + on + '" aria-label="' + longDate(d) + '">' + inner + "</button>";
    }

    root.querySelectorAll("[data-book-days]").forEach(function (box) {
      var count = Number(box.getAttribute("data-count")) || 6;
      var d = tomorrow();
      var html = "";
      while (count > 0) {
        if (d.getDay() !== 0) {
          html += dayButton(d, "bk-day",
            "<small>" + d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "") + "</small>" +
            "<strong>" + d.getDate() + "</strong>" +
            "<small>" + d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "") + "</small>");
          count -= 1;
        }
        d.setDate(d.getDate() + 1);
      }
      box.innerHTML = html;
    });

    function renderCal() {
      if (!cal) return;
      var first = tomorrow();
      var min = new Date(first.getFullYear(), first.getMonth(), 1);
      var max = new Date(min.getFullYear(), min.getMonth() + 2, 1);
      var y = calMonth.getFullYear();
      var m = calMonth.getMonth();
      var title = calMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
      var html = '<div class="bk-cal-head"><button type="button" data-cal="-1" aria-label="Mes anterior"' + (calMonth <= min ? " disabled" : "") + '><i class="bi bi-chevron-left"></i></button>' +
        "<strong>" + title + "</strong>" +
        '<button type="button" data-cal="1" aria-label="Mes siguiente"' + (calMonth >= max ? " disabled" : "") + '><i class="bi bi-chevron-right"></i></button></div>' +
        '<div class="bk-cal-grid">' + ["L", "M", "M", "J", "V", "S", "D"].map(function (w) { return '<span class="bk-cal-dow">' + w + "</span>"; }).join("");
      var offset = (new Date(y, m, 1).getDay() + 6) % 7;
      for (var i = 0; i < offset; i++) html += "<span></span>";
      var days = new Date(y, m + 1, 0).getDate();
      for (var day = 1; day <= days; day++) {
        var d = new Date(y, m, day);
        if (d < first || d.getDay() === 0) html += '<span class="bk-cal-off">' + day + "</span>";
        else html += dayButton(d, "bk-cal-day", String(day));
      }
      cal.innerHTML = html + "</div>";
    }

    function goTo(n) {
      if (!steps.length) return;
      current = Math.max(0, Math.min(steps.length - 1, n));
      steps.forEach(function (s, i) { s.hidden = i !== current; });
      stepItems.forEach(function (li, i) {
        li.classList.toggle("is-on", i === current);
        li.classList.toggle("is-done", i < current);
        var b = li.querySelector("button");
        b.disabled = i > current;
        if (i === current) b.setAttribute("aria-current", "step");
        else b.removeAttribute("aria-current");
      });
      prevBtn.hidden = current === 0;
      var last = current === steps.length - 1;
      nextBtn.innerHTML = last ? 'Confirmar reserva <i class="bi bi-check2"></i>' : 'Continuar <i class="bi bi-arrow-right"></i>';
      say("");
      render();
    }

    function toggleDone(done) {
      root.querySelectorAll("[data-book-hide-on-done]").forEach(function (el) { el.hidden = done; });
      root.querySelectorAll("[data-book-done]").forEach(function (el) { el.hidden = !done; });
      stepItems.forEach(function (li) { li.classList.toggle("is-done", done || li.classList.contains("is-done")); li.querySelector("button").disabled = done; });
    }

    root.addEventListener("click", function (e) {
      var target = e.target.closest("[data-book-pick], [data-cal], [data-book-goto], [data-book-next], [data-book-prev], [data-book-reset], [data-book-ics]");
      if (!target || target.disabled || !root.contains(target)) return;
      if (target.hasAttribute("data-book-pick")) pick(target);
      if (target.hasAttribute("data-cal")) {
        calMonth.setMonth(calMonth.getMonth() + Number(target.getAttribute("data-cal")));
        renderCal();
      }
      if (target.hasAttribute("data-book-goto")) goTo(Number(target.getAttribute("data-book-goto")) - 1);
      if (target.hasAttribute("data-book-prev")) goTo(current - 1);
      if (target.hasAttribute("data-book-next")) {
        if (current === steps.length - 1) form.requestSubmit();
        else goTo(current + 1);
      }
      if (target.hasAttribute("data-book-reset")) {
        form.reset();
        values = {};
        root.querySelectorAll("[data-book-pick]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        toggleDone(false);
        goTo(0);
        renderCal();
        render();
      }
      if (target.hasAttribute("data-book-ics")) downloadIcs();
    });

    root.querySelectorAll("[data-book-field]").forEach(function (field) {
      var name = field.getAttribute("data-book-field");
      field.addEventListener("input", function () {
        if (field.type === "date") {
          values[name] = field.value ? longDate(new Date(field.value + "T00:00")) : "";
        } else if (field.tagName === "SELECT") {
          values[name] = field.value ? field.selectedOptions[0].textContent : "";
        } else {
          values[name] = field.value.trim();
        }
        render();
      });
    });

    root.querySelectorAll("[data-book-date]").forEach(function (input) {
      input.min = isoDate(tomorrow());
      input.addEventListener("input", function () {
        var sunday = input.value && new Date(input.value + "T00:00").getDay() === 0;
        input.setCustomValidity(sunday ? "Los domingos no atendemos. Elegí otro día." : "");
      });
    });

    form.noValidate = true;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (steps.length && current < steps.length - 1) {
        if (!nextBtn.disabled) goTo(current + 1);
        return;
      }
      var labels = { servicio: "el servicio", profesional: "con quién", dia: "el día", horario: "el horario" };
      var missing = (form.getAttribute("data-book-requires") || "").split(",").filter(function (k) { return k && !values[k]; });
      if (missing.length) {
        say("Elegí " + missing.map(function (k) { return labels[k] || k; }).join(" y ") + " para seguir.");
        return;
      }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      sendLead(form, "turno", values).then(function (ok) {
        if (submit) submit.disabled = false;
        if (!ok) { say(LEAD_FAIL); return; }
        toggleDone(true);
        render();
      });
    });

    function downloadIcs() {
      if (!values.dia_iso || !values.horario) return;
      var parts = values.horario.split(":");
      var start = new Date(values.dia_iso + "T00:00");
      start.setHours(Number(parts[0]), Number(parts[1]));
      var end = new Date(start.getTime() + (parseInt(values.duracion, 10) || 30) * 60000);
      function stamp(d) { return isoDate(d).replace(/-/g, "") + "T" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + "00"; }
      var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lanzate//Turnos//ES", "BEGIN:VEVENT",
        "UID:" + Date.now() + "@example.com", "DTSTART:" + stamp(start), "DTEND:" + stamp(end),
        "SUMMARY:" + (values.servicio || "Turno") + (values.profesional ? " con " + values.profesional : ""),
        "LOCATION:Calle Ejemplo 123, Buenos Aires", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
      a.download = "turno.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    renderCal();
    goTo(0);
    render();
  });

  var libBar = document.querySelector(".lib-bar");
  var libHeader = document.querySelector(".lib-header");
  if (libBar && libHeader) {
    var libLinks = Array.prototype.slice.call(document.querySelectorAll("[data-section-link]"));
    var libSections = Array.prototype.slice.call(document.querySelectorAll("[data-section]"));
    var compactLibrary = window.matchMedia("(max-width: 575.98px)");
    var shownSection;
    function filterLibrary() {
      var target = document.getElementById(location.hash.slice(1));
      shownSection = target && target.closest("[data-section]") || libSections[0];
      libSections.forEach(function (section) {
        section.hidden = compactLibrary.matches && section !== shownSection;
      });
    }
    function libOffset() {
      var h = libHeader.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--lib-header", h + "px");
      document.documentElement.style.setProperty("--lib-offset", (h + libBar.getBoundingClientRect().height + 16) + "px");
    }
    function libSpy() {
      var line = libHeader.getBoundingClientRect().height + libBar.getBoundingClientRect().height + 24;
      var current = libSections[0];
      libSections.forEach(function (section) {
        if (!section.hidden && section.getBoundingClientRect().top <= line) current = section;
      });
      if (compactLibrary.matches) current = shownSection;
      if (!current) return;
      libLinks.forEach(function (link) {
        var on = link.getAttribute("href") === "#" + current.id;
        link.classList.toggle("is-on", on);
        if (on) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }
    function updateLibrary() {
      filterLibrary();
      libOffset();
      libSpy();
    }
    libLinks.forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (!compactLibrary.matches || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        var hash = link.hash;
        if (location.hash !== hash) history.pushState(null, "", hash);
        updateLibrary();
        shownSection.scrollIntoView();
      });
    });
    compactLibrary.addEventListener("change", updateLibrary);
    window.addEventListener("hashchange", updateLibrary);
    updateLibrary();
    window.addEventListener("resize", libOffset);
    document.addEventListener("scroll", libSpy, { passive: true });
  }

  var landingSections = Array.prototype.slice.call(document.querySelectorAll(":is(.landing-page, .landing-page > main) > section[data-module]"));
  if (landingSections.length) {
    var SECTION_IDS = {
      "navegacion": "inicio",
      "hero-full-imagen": "portada",
      "quienes-somos": "nosotros",
      "imagen-texto": "historia",
      "servicios-productos": "servicios",
      "planes": "planes",
      "beneficios": "beneficios",
      "productos": "productos",
      "galeria-imagenes": "galeria",
      "carrusel-imagenes": "destacados",
      "video-destacado": "video",
      "casos-exito": "casos",
      "resenas-google": "resenas",
      "equipo": "equipo",
      "proceso": "proceso",
      "preguntas-frecuentes": "preguntas",
      "donde-nos-encontramos": "ubicacion",
      "reserva-turno": "turnos",
      "lista-precios": "precios",
      "cifras": "cifras",
      "llamado": "llamado",
      "marcas": "marcas",
      "agenda": "agenda",
      "footer": "contacto"
    };
    var CONTACT = ["footer", "donde-nos-encontramos", "reserva-turno"];
    var LINK_RULES = [
      [/^(inicio|home)$|volver arriba/, ["navegacion"]],
      [/fechas|eventos|cartelera|programacion|proximas/, ["agenda"]],
      [/reserv|turno|agend/, ["reserva-turno"]],
      [/contact|escrib|hablemos|consult|presupuesto|tasa|cotiz|whatsapp|@/, CONTACT],
      [/pregunta|faq|dudas/, ["preguntas-frecuentes"]],
      [/como trabajamos|proceso|metodo|paso/, ["proceso"]],
      [/ubicacion|donde|sucursal|mapa|llegar/, ["donde-nos-encontramos"]],
      [/resena|testimonio|opinion/, ["resenas-google", "casos-exito"]],
      [/caso|proyecto|trabajos|portfolio/, ["casos-exito", "galeria-imagenes", "productos"]],
      [/profesional|profesor|docente|barbero|equipo|staff/, ["equipo"]],
      [/precio|plan|tarifa|membresia|club|carta|menu/, ["lista-precios", "planes", "servicios-productos", "productos"]],
      [/destino|galeria|foto/, ["galeria-imagenes", "carrusel-imagenes", "productos"]],
      [/promo|paquete|escapada|luna de miel|oferta|producto|propiedad|comprar|alquil|emprendimiento|catalogo|tienda|coleccion/, ["productos", "carrusel-imagenes", "planes", "servicios-productos"]],
      [/servicio|tratamiento|curso|corte/, ["servicios-productos", "planes", "productos"]],
      [/beneficio|por que/, ["beneficios"]],
      [/video/, ["video-destacado"]],
      [/nosotros|quienes somos|historia|sobre/, ["quienes-somos", "imagen-texto", "beneficios"]]
    ];
    var groupOf = function (section) {
      var mod = section.getAttribute("data-module");
      var hit = "";
      Object.keys(SECTION_IDS).forEach(function (g) {
        if ((mod === g || mod.indexOf(g + "-") === 0) && g.length > hit.length) hit = g;
      });
      return hit;
    };
    var byGroup = {};
    landingSections.forEach(function (section) {
      var group = groupOf(section);
      if (!group) return;
      if (!section.id) {
        var base = SECTION_IDS[group], id = base, n = 2;
        while (document.getElementById(id)) id = base + "-" + n++;
        section.id = id;
      }
      if (!byGroup[group]) byGroup[group] = section;
    });
    var firstOf = function (groups) {
      for (var i = 0; i < groups.length; i++) if (byGroup[groups[i]]) return byGroup[groups[i]];
      return null;
    };
    var navSection = byGroup["navegacion"];
    var navOffset = function () {
      if (!navSection) return 0;
      var stuck = navSection.classList.contains("is-stuck");
      navSection.classList.add("is-stuck", "is-measuring");
      var h = navSection.offsetHeight;
      navSection.classList.remove("is-measuring");
      if (!stuck) navSection.classList.remove("is-stuck");
      return h;
    };
    if (navSection) {
      var syncNav = function () {
        var prev = navSection.previousElementSibling;
        var naturalTop = prev ? prev.getBoundingClientRect().bottom + window.pageYOffset : 0;
        navSection.classList.toggle("is-stuck", window.pageYOffset > naturalTop + 40);
      };
      var syncNavHeight = function () {
        document.documentElement.style.setProperty("--nx-nav-h", navOffset() + "px");
      };
      syncNav();
      syncNavHeight();
      window.addEventListener("scroll", syncNav, { passive: true });
      window.addEventListener("resize", syncNavHeight);
    }
    var contactSection = firstOf(CONTACT);
    var mailLink = document.querySelector(".landing-page a[href^='mailto:']");
    var contactHref = contactSection ? "#" + contactSection.id : mailLink ? mailLink.getAttribute("href") : "#" + landingSections[0].id;
    var plainText = function (el) {
      return (el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    };
    var resolveLink = function (text) {
      for (var i = 0; i < LINK_RULES.length; i++) {
        if (LINK_RULES[i][0].test(text)) return { contact: LINK_RULES[i][1] === CONTACT, section: firstOf(LINK_RULES[i][1]) };
      }
      return null;
    };

    document.querySelectorAll(":is(.landing-page, .landing-page > main) > section[data-module] a[href]").forEach(function (a) {
      var href = a.getAttribute("href");
      var own = a.closest("section[data-module]");
      var isHash = href.charAt(0) === "#";
      if (a.hasAttribute("data-bs-toggle") || a.hasAttribute("data-bs-slide") || a.hasAttribute("role") && a.getAttribute("role") === "button") return;
      if (isHash && href.length > 1 && document.getElementById(href.slice(1))) return;
      if (!isHash && href.indexOf("mailto:") !== 0) return;
      var text = plainText(a);
      var hit = a.classList.contains("nx-brand") ? { section: landingSections[0] } : resolveLink(text);
      var target = hit && hit.section;
      if (!isHash) {
        if (!target || hit.contact || target === own) return;
      } else if (!target || (target === own && target !== landingSections[0] && target !== contactSection)) {
        a.setAttribute("href", contactHref);
        return;
      }
      a.setAttribute("href", "#" + target.id);
    });

    document.addEventListener("click", function (e) {
      var a = e.target.closest(".landing-page a[href^='#']");
      if (!a || a.getAttribute("href").length < 2) return;
      var target = document.getElementById(a.getAttribute("href").slice(1));
      if (!target || landingSections.indexOf(target) === -1) return;
      e.preventDefault();
      if (a.classList.contains("nav-link")) {
        a.closest("nav, header, .nx").querySelectorAll(".nav-link.is-active").forEach(function (l) { l.classList.remove("is-active"); });
        a.classList.add("is-active");
      }
      if (history.replaceState) history.replaceState(null, "", "#" + target.id);
      var pick = a.getAttribute("data-filter-pick");
      var filterBtn = pick && target.querySelector('[data-filter="' + pick + '"]');
      if (filterBtn && !filterBtn.classList.contains("is-on")) filterBtn.click();
      var go = function () {
        var top = target === landingSections[0] ? 0 : target.getBoundingClientRect().top + window.pageYOffset - navOffset();
        window.scrollTo({ top: top, behavior: "smooth" });
      };
      var open = a.closest(".offcanvas.show, .collapse.show");
      var isOffcanvas = open && open.classList.contains("offcanvas");
      var Ctor = open && window.bootstrap && (isOffcanvas ? window.bootstrap.Offcanvas : window.bootstrap.Collapse);
      var inst = Ctor && Ctor.getInstance(open);
      if (!inst) { go(); return; }
      open.addEventListener(isOffcanvas ? "hidden.bs.offcanvas" : "hidden.bs.collapse", go, { once: true });
      inst.hide();
    });

    if (location.hash.length > 1) {
      var initial = document.getElementById(location.hash.slice(1));
      if (initial && landingSections.indexOf(initial) !== -1) {
        setTimeout(function () { window.scrollTo({ top: initial.getBoundingClientRect().top + window.pageYOffset - navOffset(), behavior: "instant" }); }, 0);
      }
    }
  }

  /* Cifras que suben hasta su valor. Lee el texto tal como está escrito (+350, 4,9, 1.200, 48 h)
     y vuelve siempre al texto original al terminar. */
  function countUp(scope) {
    [].forEach.call(scope.querySelectorAll(".stat-n, .hero-stats-row h3, .split-stat strong"), function (el) {
      if (el.children.length || el.getAttribute("data-lz-counted")) return;
      var txt = el.textContent, m = /^(\D*?)(\d[\d.,]*)(.*)$/.exec(txt);
      if (!m) return;
      var raw = m[2].replace(/[.,]+$/, ""), dec = 0, sep = ",";
      var d = /([.,])(\d+)$/.exec(raw);
      if (d && d[2].length !== 3) { dec = d[2].length; sep = d[1]; }
      var thousands = dec ? (sep === "," ? "." : ",") : (/[.,]/.test(raw) ? raw.match(/[.,]/)[0] : "");
      var clean = raw.split(thousands || "\u0000").join("");
      if (dec) clean = clean.replace(sep, ".");
      var target = parseFloat(clean);
      if (!isFinite(target) || target <= 0) return;
      el.setAttribute("data-lz-counted", "1");
      el.setAttribute("aria-label", txt);
      var t0 = null, dur = 1400;
      function fmt(v) {
        var out = v.toFixed(dec).split(".");
        if (thousands) out[0] = out[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
        return m[1] + out.join(dec ? sep : "") + m[3];
      }
      function tick(t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = k >= 1 ? txt : fmt(target * e);
        if (k < 1) requestAnimationFrame(tick);
      }
      el.textContent = fmt(0);
      requestAnimationFrame(tick);
    });
  }

  var animMode = document.body.getAttribute("data-anim");
  if (animMode && !document.body.classList.contains("has-tools") && "IntersectionObserver" in window &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var animBlocks = [].slice.call(document.querySelectorAll(".mq-block")).filter(function (b) {
      return !b.querySelector(".nx-nav, .nx-wa");
    });
    document.body.classList.add("lz-anim");
    animBlocks.forEach(function (b) {
      b.classList.add("lz-pre");
      b.querySelectorAll(".row").forEach(function (row) {
        [].forEach.call(row.children, function (c, i) { c.style.setProperty("--lz-i", Math.min(i, 8)); });
      });
      var texts = [].filter.call(b.querySelectorAll("h1, h2, .nx-display, .nx-kicker, .nx-lead"), function (el) {
        return !el.closest(".accordion, .modal, .lz-txt, .hero-motion");
      });
      texts.forEach(function (el, i) {
        el.classList.add("lz-txt");
        el.style.setProperty("--lz-t", Math.min(i, 5));
      });
    });
    var animIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.remove("lz-pre");
        en.target.classList.add("lz-in");
        countUp(en.target);
        animIo.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    animBlocks.forEach(function (b) { animIo.observe(b); });
  }



  /* Cortes entre secciones: pinta cada forma con el color de la sección que sigue. */
  (function cortes() {
    var blocks = [].slice.call(document.querySelectorAll(".mq-block[data-corte]"));
    if (!blocks.length) return;
    function parse(c) {
      var m = /rgba?\(([^)]+)\)/.exec(c || "");
      if (!m) return null;
      var p = m[1].split(",").map(parseFloat);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    function paint(el) {
      var st = getComputedStyle(el), c = parse(st.backgroundColor);
      if (c && c.a > 0.5) return c;
      if (/gradient/.test(st.backgroundImage)) {
        var g = (st.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(function (x) { return x && x.a > 0.5; });
        if (g.length) return g[0];
      }
      return null;
    }
    function next(block) {
      var n = block.nextElementSibling;
      while (n && !n.classList.contains("mq-block")) n = n.nextElementSibling;
      return n;
    }
    function colorOf(block) {
      var nx = block.querySelector(".mq-frame > .nx") || block.querySelector(".nx");
      return (nx && paint(nx)) || paint(document.body) || { r: 255, g: 255, b: 255, a: 1 };
    }
    var same = function (a, b) { return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 6; };
    var working = false;
    function run() {
      working = true;
      blocks.forEach(function (block) {
        var after = next(block);
        if (!after) { block.classList.add("lz-corte-flat"); return; }
        var fill = colorOf(after), own = colorOf(block);
        var value = "rgb(" + Math.round(fill.r) + ", " + Math.round(fill.g) + ", " + Math.round(fill.b) + ")";
        if (block.style.getPropertyValue("--lz-corte") !== value) block.style.setProperty("--lz-corte", value);
        block.classList.toggle("lz-corte-flat", same(fill, own));
      });
      setTimeout(function () { working = false; }, 0);
    }
    var timer = null;
    function later() { clearTimeout(timer); timer = setTimeout(run, 80); }
    run();
    window.addEventListener("load", run);
    window.addEventListener("resize", later);
    new MutationObserver(function (records) {
      if (working) return;
      for (var i = 0; i < records.length; i++) {
        if (records[i].target.hasAttribute && records[i].target.hasAttribute("data-lz-c")) continue;
        later();
        return;
      }
    }).observe(document.body, { attributes: true, attributeFilter: ["style", "class"], subtree: true });
  })();

  /* Heroes con movimiento (video, parallax, trazo, tipográfico).
     Respeta "reducir movimiento" del sistema y el interruptor Movimiento del constructor. */
  (function heroMotion() {
    var heroes = [].slice.call(document.querySelectorAll(".hero-motion"));
    if (!heroes.length) return;
    var body = document.body;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var tools = body.classList.contains("has-tools");
    var wanted = !body.classList.contains("landing-page") || body.hasAttribute("data-anim");
    var motion = wanted && !reduce;
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var small = window.matchMedia("(max-width: 700px)");

    function words(el) {
      var out = document.createDocumentFragment();
      el.childNodes.forEach(function (node) {
        if (node.nodeType === 3) {
          node.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { out.appendChild(document.createTextNode(" ")); return; }
            out.appendChild(unit(document.createTextNode(part)));
          });
        } else if (node.nodeType === 1 && node.matches(".lz-rotate, .lz-draw")) {
          out.appendChild(unit(node));
        } else if (node.nodeType === 1 && !/^(svg|br)$/i.test(node.tagName)) {
          var copy = node.cloneNode(false);
          copy.appendChild(words(node));
          out.appendChild(copy);
        } else {
          out.appendChild(node.cloneNode(true));
        }
      });
      return out;
    }
    function unit(content) {
      var outer = document.createElement("span"), inner = document.createElement("span");
      outer.className = "lz-w"; inner.className = "lz-wi";
      inner.appendChild(content); outer.appendChild(inner);
      return outer;
    }
    function split(h) {
      var frag = words(h), i = 0;
      h.replaceChildren(frag);
      h.querySelectorAll(".lz-wi").forEach(function (w) { w.style.setProperty("--i", i++); });
    }
    function rotate(el, hero, visible) {
      var list = (el.getAttribute("data-words") || "").split("|").filter(Boolean);
      if (list.length < 2) return;
      var inner = document.createElement("span");
      inner.className = "lz-rw"; inner.textContent = el.textContent.trim();
      el.textContent = ""; el.appendChild(inner);
      var widest = 0;
      list.forEach(function (w) { inner.textContent = w; widest = Math.max(widest, inner.getBoundingClientRect().width); });
      inner.textContent = list[0];
      el.style.minWidth = Math.ceil(widest) + "px";
      var n = 0;
      setInterval(function () {
        if (document.hidden || !visible() || !hero.classList.contains("lz-go")) return;
        el.classList.add("lz-out");
        setTimeout(function () {
          n = (n + 1) % list.length;
          inner.textContent = list[n];
          el.classList.remove("lz-out");
          el.classList.add("lz-in-start");
          void el.offsetWidth;
          el.classList.remove("lz-in-start");
        }, 320);
      }, 3000);
    }

    heroes.forEach(function (hero) {
      var inView = true;
      var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { inView = en.isIntersecting; });
      }, { threshold: 0.1 }) : null;
      if (io) io.observe(hero);

      /* Video: si no corresponde moverse o el visitante ahorra datos, queda la foto de portada. */
      var video = hero.querySelector(".hero-video-bg");
      var toggle = hero.querySelector(".hero-video-toggle");
      if (video) {
        if (!motion || saveData) {
          video.remove();
        } else {
          var userPaused = false;
          var vio = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting && !userPaused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
              else video.pause();
            });
          }, { threshold: 0.05 }) : null;
          if (vio) vio.observe(hero);
          if (toggle) {
            toggle.hidden = false;
            toggle.addEventListener("click", function () {
              userPaused = !userPaused;
              if (userPaused) video.pause(); else video.play();
              toggle.setAttribute("aria-pressed", String(userPaused));
              toggle.setAttribute("aria-label", userPaused ? "Reproducir video" : "Pausar video");
              toggle.firstElementChild.className = "bi " + (userPaused ? "bi-play-fill" : "bi-pause-fill");
            });
          }
        }
      }

      /* Entradas de texto y líneas: no se tocan los textos mientras se edita. */
      if (motion && !tools) {
        hero.querySelectorAll(".lz-split").forEach(split);
        hero.classList.add("lz-hero-on");
        hero.querySelectorAll(".lz-rotate").forEach(function (el) { rotate(el, hero, function () { return inView; }); });
        var go = function () { hero.classList.add("lz-go"); };
        if ("IntersectionObserver" in window) {
          var gio = new IntersectionObserver(function (entries) {
            if (entries.some(function (e) { return e.isIntersecting; })) { go(); gio.disconnect(); }
          }, { threshold: 0.2 });
          gio.observe(hero);
        } else go();
      }
    });

    /* Parallax: la foto de fondo se mueve más lento que la página. */
    var layers = motion ? [].slice.call(document.querySelectorAll("[data-parallax]")) : [];
    if (layers.length) {
      var ticking = false;
      var update = function () {
        ticking = false;
        layers.forEach(function (layer) {
          if (small.matches) { layer.style.transform = ""; return; }
          var host = layer.parentElement, box = host.getBoundingClientRect();
          if (box.bottom < -200 || box.top > innerHeight + 200) return;
          var speed = parseFloat(layer.getAttribute("data-parallax")) || 0.25;
          var room = Math.max(0, (layer.offsetHeight - host.offsetHeight) / 2);
          var shift = (box.top + box.height / 2 - innerHeight / 2) * -speed;
          layer.style.transform = "translate3d(0," + Math.max(-room, Math.min(room, shift)).toFixed(1) + "px,0)";
        });
      };
      var request = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      addEventListener("scroll", request, { passive: true });
      addEventListener("resize", request);
      update();
    }
  })();

  if (document.body.classList.contains("lib-page") && window.LanzateReglas && window.LanzateReglas.contrast) {
    document.querySelectorAll(".mq-block").forEach(function (block) {
      var found = window.LanzateReglas.contrast(block, window);
      if (!found.length) return;
      var note = document.createElement("p");
      note.className = "mq-contrast";
      note.textContent = found[0].text + " " + found[0].detail;
      var caption = block.querySelector(".mq-caption");
      if (caption) caption.after(note);
    });
  }

  if (document.body.classList.contains("lib-page") && window.matchMedia("(max-width: 700px)").matches) {
    var sections = [].slice.call(document.querySelectorAll(".lib-section"));
    function openSection() {
      var hash = location.hash.slice(1);
      var current = document.getElementById(hash);
      var owner = current && current.closest(".lib-section");
      if (!owner) owner = sections[0];
      sections.forEach(function (section) {
        section.querySelectorAll(".mq-frame").forEach(function (frame) {
          frame.hidden = section !== owner;
        });
      });
    }
    openSection();
    window.addEventListener("hashchange", openSection);
  }
  /* Contraste garantizado: cada vez que cambian los colores (paleta, colores por sección, menú abierto),
     revisa el texto contra el fondo que tiene detrás y, si no llega a 4,5:1, lo corrige hasta ~7:1.
     Los botones y etiquetas conservan su texto y se ajusta su fondo. No toca texto sobre fotos. */
  (function contrastGuard() {
    if (document.body.classList.contains("lib-page") || !document.querySelector(".nx, .landing-page, [data-module]")) return;
    var MIN_TEXT = 4.5, GOAL_TEXT = 7, MIN_ICON = 3, GOAL_ICON = 4.5;
    var SKIP = "script, style, noscript, svg, template, iframe, .visually-hidden, .lp-tools, .mq-caption, [data-lz-no-contrast]";
    var CONTROL = ".btn-nx, .btn-nx-outline, .btn-nx-light, .nx-wa, .badge, .plan-badge, .tag, .chip, button, .btn";
    var busy = false;

    function rgba(value) {
      var m = String(value || "").match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    function lum(c) {
      function ch(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
      return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
    }
    function ratio(a, b) {
      var x = lum(a), y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    function over(top, under) {
      var a = top.a;
      return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
    }
    function hex(c) {
      return "#" + [c.r, c.g, c.b].map(function (v) { return Math.round(v).toString(16).padStart(2, "0"); }).join("");
    }
    function toward(c, target, t) {
      return { r: c.r + (target.r - c.r) * t, g: c.g + (target.g - c.g) * t, b: c.b + (target.b - c.b) * t, a: 1 };
    }
    var BLACK = { r: 0, g: 0, b: 0, a: 1 }, WHITE = { r: 255, g: 255, b: 255, a: 1 };
    /* Lleva "move" hacia negro o blanco (lo que más contraste dé contra "fixed") hasta llegar a goal. */
    function adjust(move, fixed, goal) {
      var end = ratio(BLACK, fixed) >= ratio(WHITE, fixed) ? BLACK : WHITE;
      var lo = 0, hi = 1;
      if (ratio(end, fixed) < goal) return end;
      for (var i = 0; i < 18; i++) {
        var mid = (lo + hi) / 2;
        if (ratio(toward(move, end, mid), fixed) >= goal) hi = mid; else lo = mid;
      }
      return toward(move, end, hi);
    }
    function hasMedia(style) {
      return /url\(/.test(style.backgroundImage);
    }
    function gradientColors(style) {
      if (!/gradient/.test(style.backgroundImage)) return null;
      var list = style.backgroundImage.match(/rgba?\([^)]+\)/g) || [];
      return list.map(rgba).filter(Boolean);
    }
    /* Fondo real detrás del elemento: color sólido (mezclando transparencias) o null si hay foto/video. */
    function backdrop(el, fore) {
      var layers = [], node = el, source = null;
      while (node && node.nodeType === 1) {
        var st = getComputedStyle(node);
        if (hasMedia(st) || /^(IMG|VIDEO|PICTURE|CANVAS)$/.test(node.tagName)) {
          /* Una pastilla casi opaca sobre una foto: se mide contra el peor caso (foto clara u oscura). */
          var keep = 1;
          layers.forEach(function (l) { keep *= 1 - l.a; });
          if (!layers.length || keep > 0.3 || !fore) return null;
          var worstBase = [BLACK, WHITE].map(function (b) {
            var acc = b;
            for (var k = layers.length - 1; k >= 0; k--) acc = over(layers[k], acc);
            return acc;
          }).reduce(function (a, b) { return ratio(fore, b) < ratio(fore, a) ? b : a; });
          return { color: worstBase, source: source || document.body, pill: true };
        }
        var g = gradientColors(st);
        if (g && g.length) {
          var opaque = g.filter(function (c) { return c.a > 0.85; });
          if (opaque.length) {
            var worst = opaque.reduce(function (acc, c) { return lum(c) > lum(acc) ? c : acc; });
            layers.push({ r: worst.r, g: worst.g, b: worst.b, a: 1 });
            source = source || node;
            break;
          }
        }
        var c = rgba(st.backgroundColor);
        if (c && c.a > 0) {
          layers.push(c);
          if (!source) source = node;
          if (c.a > 0.95) break;
        }
        node = node.parentElement;
      }
      var base = WHITE;
      for (var i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
      return { color: base, source: source || document.body };
    }
    /* Pastilla translúcida sobre una foto: se mide contra el peor caso (foto clara u oscura). */
    function pillBack(el, fore) {
      for (var node = el; node && node.nodeType === 1 && node !== document.body; node = node.parentElement) {
        var st = getComputedStyle(node);
        if (hasMedia(st)) return null;
        var c = rgba(st.backgroundColor);
        if (!c || c.a === 0) continue;
        if (c.a < 0.6 || c.a > 0.99) return null;
        var base = [BLACK, WHITE].map(function (b) { return over(c, b); })
          .reduce(function (a, b) { return ratio(fore, b) < ratio(fore, a) ? b : a; });
        return { color: base, source: node, pill: true };
      }
      return null;
    }
    /* Algo absoluto con imagen (foto del hero, overlay) tapado por el texto: no se puede medir. */
    function onPhoto(el, box) {
      if (box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth) {
        var x = Math.min(Math.max(box.left + box.width / 2, 0), innerWidth - 1);
        var y = Math.min(Math.max(box.top + box.height / 2, 0), innerHeight - 1);
        var stack = document.elementsFromPoint(x, y);
        for (var i = 0; i < stack.length; i++) {
          var n = stack[i];
          if (n === el || el.contains(n)) continue;
          if (n.contains(el)) {
            var st = getComputedStyle(n);
            if (hasMedia(st)) return true;
            var bg = rgba(st.backgroundColor);
            if (bg && bg.a > 0.95) return false;
            continue;
          }
          if (/^(IMG|VIDEO|PICTURE|CANVAS)$/.test(n.tagName) || hasMedia(getComputedStyle(n))) return true;
          var nb = rgba(getComputedStyle(n).backgroundColor);
          if (nb && nb.a > 0.95) return false;
        }
        return false;
      }
      var section = el.closest("section, header, nav, footer, .nx");
      if (!section) return false;
      var media = section.querySelectorAll("img, video, picture, [style*='url(']");
      for (var j = 0; j < media.length; j++) {
        var m = media[j];
        if (m.contains(el) || el.contains(m)) continue;
        var pos = getComputedStyle(m).position;
        var host = m.closest("[class*='hero'], [class*='media'], [class*='bg']");
        if (pos !== "absolute" && pos !== "fixed" && !host) continue;
        var r = m.getBoundingClientRect();
        if (r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top) return true;
      }
      return false;
    }
    function ownText(el) {
      for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
      return /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    }
    function restore() {
      document.querySelectorAll("[data-lz-c], [data-lz-bg]").forEach(function (el) {
        ["c", "bg"].forEach(function (k) {
          var key = "lz" + (k === "c" ? "C" : "Bg");
          if (el.dataset[key] == null) return;
          var prop = k === "c" ? "color" : "background-color";
          var parts = el.dataset[key].split("|");
          if (el.style.getPropertyValue(prop) === parts[2]) {
            if (parts[0]) el.style.setProperty(prop, parts[0], parts[1]); else el.style.removeProperty(prop);
          }
          delete el.dataset[key];
        });
      });
    }
    function setFixed(el, prop, value) {
      var key = prop === "color" ? "lzC" : "lzBg";
      if (el.dataset[key] == null) el.dataset[key] = el.style.getPropertyValue(prop) + "|" + el.style.getPropertyPriority(prop) + "|";
      el.style.setProperty(prop, value, "important");
      var parts = el.dataset[key].split("|");
      el.dataset[key] = parts[0] + "|" + parts[1] + "|" + el.style.getPropertyValue(prop);
    }
    function run() {
      if (busy) return;
      busy = true;
      /* Sin transiciones mientras mide: si no, lee colores a mitad de animación. */
      var still = document.createElement("style");
      still.textContent = "*, *::before, *::after { transition: none !important; }";
      document.head.appendChild(still);
      try {
        restore();
        var fixedBg = new Set();
        document.querySelectorAll("body *").forEach(function (el) {
          if (el.closest(SKIP)) return;
          var icon = el.classList.contains("bi");
          if (!icon && !ownText(el)) return;
          var st = getComputedStyle(el);
          if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) < 0.1) return;
          if (/text/.test(st.webkitBackgroundClip || st.backgroundClip || "")) return;
          var box = el.getBoundingClientRect();
          if (box.width < 1 || box.height < 1) return;
          var fore = rgba(st.color);
          if (!fore || fore.a === 0) return;
          var back = backdrop(el, fore);
          if (!back) return;
          if (!back.pill && onPhoto(el, box)) {
            back = pillBack(el, fore);
            if (!back) return;
          }
          if (fore.a < 1) fore = over(fore, back.color);
          var min = icon ? MIN_ICON : MIN_TEXT, goal = icon ? GOAL_ICON : GOAL_TEXT;
          if (ratio(fore, back.color) >= min) return;
          var src = back.source, sbox = src !== document.body && src.getBoundingClientRect();
          var small = sbox && sbox.width * sbox.height < 40000 && !/^(SECTION|HEADER|NAV|FOOTER|MAIN|BODY)$/.test(src.tagName);
          var control = src !== document.body && src.matches && (src.matches(CONTROL) || small) &&
            (src === el || src.contains(el)) ? src : null;
          if (control && !fixedBg.has(control)) {
            var bg = adjust(back.color, fore, min + 0.6);
            if (ratio(fore, bg) >= min) {
              setFixed(control, "background-color", hex(bg));
              control.style.setProperty("background-image", "none", "important");
              fixedBg.add(control);
              return;
            }
          }
          /* Si el texto quedó del mismo lado que el fondo (oscuro sobre oscuro), pasa casi al extremo. */
          var flipped = ratio(fore, back.color) < 2.5;
          setFixed(el, "color", hex(adjust(fore, back.color, flipped ? 12 : goal)));
        });
      } finally {
        still.remove();
        setTimeout(function () { busy = false; }, 0);
      }
    }
    var timer = null;
    function later() {
      if (busy) return;
      clearTimeout(timer);
      timer = setTimeout(run, 120);
    }
    window.LanzateContraste = run;
    if (document.readyState === "complete") later(); else window.addEventListener("load", later);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
    new MutationObserver(function (records) {
      if (busy) return;
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === "attributes" && r.attributeName === "style" && r.target.dataset &&
            (r.target.dataset.lzC != null || r.target.dataset.lzBg != null) && busy) continue;
        later();
        return;
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open"] });
    window.addEventListener("resize", later);
  })();
})();
