(function () {
  "use strict";
  function api(method, path, body) {
    var opts = {method: method, credentials: "same-origin", cache: "no-store"};
    if (body !== undefined) {
      opts.headers = {"Content-Type": "application/json"};
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (r) {
      if (r.status === 401) {
        location.href = "/maquetas/login.html?volver=" + encodeURIComponent(location.pathname + location.search);
        throw new Error("La sesión terminó.");
      }
      return r.json().catch(function () { return {}; }).then(function (json) {
        if (!r.ok) throw new Error(json.error || "No se pudo completar el pedido.");
        return json;
      });
    });
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function dateLabel(s) {
    if (!s) return "Sin registrar";
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : "Sin registrar";
  }
  function created(ms) { return ms ? new Date(ms).toLocaleDateString("es-AR") : "Sin registrar"; }
  function cents(value, currency) {
    return new Intl.NumberFormat("es-AR", {style:"currency", currency:currency || "ARS"}).format((value || 0) / 100);
  }
  function element(tag, klass, text) {
    var el = document.createElement(tag);
    if (klass) el.className = klass;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function asCSV(rows) {
    var columns = ["Cliente", "Estado", "Fecha de alta", "Inicio", "Cantidad de landings", "Planes",
      "Pedidos pendientes", "Pagos pendientes", "Pagos vencidos", "Próximo vencimiento",
      "Saldo pendiente ARS", "Saldo pendiente USD"];
    var lines = [columns].concat(rows.map(function (c) {
      return [c.nombre, c.estado, created(c.creado), c.inicio, c.landings,
        c.planes.map(function (l) { return l.nombre + " (" + l.plan + ")"; }).join("; "),
        c.solicitudes_pendientes, c.pagos_pendientes, c.pagos_vencidos,
        c.proximo_vencimiento, (c.saldos_pendientes.ARS || 0) / 100,
        (c.saldos_pendientes.USD || 0) / 100];
    }));
    var csv = "\ufeff" + lines.map(function (row) {
      return row.map(function (cell) { return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"'; }).join(";");
    }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8;"}));
    var link = document.createElement("a");
    link.href = url; link.download = "lanzate-clientes.csv"; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function dashboard() {
    var status = document.querySelector("[data-gc-status]");
    var kpis = document.querySelector("[data-gc-kpis]");
    var body = document.querySelector("[data-gc-rows]");
    var search = document.querySelector("[data-gc-search]");
    var filter = document.querySelector("[data-gc-filter]");
    var empty = document.querySelector("[data-gc-empty]");
    var clients = [];
    var alerts = [];
    var alertType = document.querySelector("[data-gc-alert-type]");
    var alertList = document.querySelector("[data-gc-alert-list]");
    var alertCount = document.querySelector("[data-gc-alert-count]");
    var alertStatus = document.querySelector("[data-gc-alert-status]");
    var alertEmpty = document.querySelector("[data-gc-alert-empty]");
    function renderAlerts() {
      var focusLink = document.activeElement;
      var selectedId = alertList.contains(focusLink) && focusLink.closest(".gc-alert-item")
        ? focusLink.closest(".gc-alert-item").dataset.alertId : null;
      var choice = alertType.value;
      var items = alerts.filter(function (entry) {
        return choice === "todas" || (choice === "urgentes" ? entry.prioridad <= 1 : entry.tipo === choice);
      });
      alertList.replaceChildren();
      items.forEach(function (entry) {
        var li = element("li","gc-alert-item");
        li.dataset.alertId = entry.id;
        var level = element("span",entry.prioridad <= 1 ? "gc-alert-severity is-urgent" : "gc-alert-severity",
          entry.prioridad <= 1 ? "Prioritaria" : "Próxima");
        var text = element("div","gc-alert-content");
        var title = element("strong","",entry.titulo + " · " + entry.cliente);
        text.appendChild(title);
        text.appendChild(element("span","gc-muted",entry.detalle));
        if (entry.tipo === "pago" && entry.importe_centavos) {
          text.appendChild(element("span","gc-muted",cents(entry.importe_centavos,entry.moneda)));
        }
        var link = element("a","gc-alert-action","Ver y resolver");
        // La URL viene exclusivamente del backend autenticado.
        if (!/^cliente\.html\?id=\d+#(?:gcFinanceTitle|gcContractTitle|cf-revisar)$/.test(entry.url)) {
          return;
        }
        link.href = entry.url;
        li.appendChild(level); li.appendChild(text); li.appendChild(link);
        alertList.appendChild(li);
      });
      if (selectedId) {
        var matching = Array.from(alertList.children).find(function (item) { return item.dataset.alertId === selectedId; });
        if (matching) matching.querySelector("a").focus();
      }
      alertCount.textContent = "(" + alerts.length + ")";
      alertEmpty.hidden = items.length > 0;
      alertStatus.textContent = items.length + " alerta(s) visibles de " + alerts.length +
        ". Se actualizan al abrir el panel y cada 5 minutos.";
    }
    function render() {
      var term = search.value.trim().toLowerCase();
      var selected = filter.value;
      var shown = clients.filter(function (c) {
        var match = [c.nombre, c.email].concat(c.planes.map(function (l) { return l.nombre + " " + l.plan; })).join(" ").toLowerCase();
        if (term && match.indexOf(term) < 0) return false;
        if (selected === "pagos") return c.pagos_pendientes > 0;
        if (selected === "vencidos") return c.pagos_vencidos > 0;
        if (selected === "cambios") return c.solicitudes_pendientes > 0;
        if (selected === "sin-registro") return !c.tiene_registro_cobros;
        return true;
      });
      body.replaceChildren();
      shown.forEach(function (c) {
        var tr = document.createElement("tr");
        var client = document.createElement("td");
        var link = element("a", "", c.nombre); link.href = "cliente.html?id=" + c.id;
        client.appendChild(link); client.appendChild(element("small","gc-muted",c.estado === "pausado" ? "Pausado" : "Activo"));
        tr.appendChild(client);
        var dates = document.createElement("td");
        dates.appendChild(element("span", "", "Alta: " + created(c.creado)));
        dates.appendChild(element("small", "gc-muted", "Inicio: " + dateLabel(c.inicio)));
        tr.appendChild(dates);
        var landings = document.createElement("td");
        if (!c.planes.length) landings.textContent = "Sin landings";
        c.planes.forEach(function (p) {
          landings.appendChild(element("div","gc-plan",p.nombre + " · " + p.plan +
            (p.estado !== "sin_borrador" ? " · " + p.estado : "")));
        });
        tr.appendChild(landings);
        var payments = element("td");
        if (!c.tiene_registro_cobros) {
          payments.textContent = "Sin datos";
        } else {
          payments.appendChild(element("strong", c.pagos_vencidos ? "gc-danger" : "", c.pagos_pendientes ?
            c.pagos_pendientes + " pendiente(s)" : "Al día según registros"));
          if (c.saldos_pendientes.ARS) payments.appendChild(element("small","gc-muted",cents(c.saldos_pendientes.ARS,"ARS")));
          if (c.saldos_pendientes.USD) payments.appendChild(element("small","gc-muted",cents(c.saldos_pendientes.USD,"USD")));
        }
        tr.appendChild(payments);
        tr.appendChild(element("td",c.pagos_vencidos ? "gc-danger" : "",dateLabel(c.proximo_vencimiento)));
        tr.appendChild(element("td",c.solicitudes_pendientes ? "gc-warning" : "",String(c.solicitudes_pendientes)));
        var action = document.createElement("td"); var a = element("a","","Ver ficha");
        a.href="cliente.html?id="+c.id; action.appendChild(a); tr.appendChild(action);
        body.appendChild(tr);
      });
      empty.hidden = shown.length !== 0;
      status.textContent = "Mostrando " + shown.length + " de " + clients.length + " clientes.";
    }
    function loadDashboard(silent) {
      return api("GET", "/api/gestion/clientes").then(function (data) {
      clients = data.clientes;
      alerts = data.alertas || [];
      renderAlerts();
      dashboardLoaded = true;
      var summary = data.resumen;
      kpis.replaceChildren();
      [["Clientes",summary.total],["Activos",summary.activos],["Alertas urgentes",(data.alertas_resumen || {}).urgentes || 0],
       ["Landings publicadas",summary.landings_publicadas],
       ["Cambios pendientes",summary.solicitudes_pendientes],
       ["Clientes con pagos pendientes",summary.clientes_con_pagos_pendientes],
       ["Clientes con pagos vencidos",summary.clientes_con_pagos_vencidos]].forEach(function (row) {
        var card = element("article","gc-kpi");
        card.appendChild(element("span","gc-kpi-number",String(row[1])));
        card.appendChild(element("span","gc-muted",row[0])); kpis.appendChild(card);
      });
      render();
      }).catch(function (error) {
        if (!silent) { status.textContent = error.message; status.classList.add("gc-danger"); }
        alertStatus.textContent = "No se pudieron actualizar las alertas: " + error.message;
      });
    }
    loadDashboard(false);
    alertType.addEventListener("change",renderAlerts);
    document.querySelector("[data-gc-alert-refresh]").addEventListener("click",function () { loadDashboard(false); });
    // Actualización periódica mientras el panel está abierto, sin modificar cobros ni pedidos.
    setInterval(function () {
      if (!document.hidden) loadDashboard(true);
    }, 5 * 60 * 1000);
    search.addEventListener("input",render);
    filter.addEventListener("change",render);
    document.querySelector("[data-gc-export]").addEventListener("click",function () { asCSV(clients); });
  }

  function profile() {
    var params = new URLSearchParams(location.search), id = Number(params.get("id"));
    if (!id || !Number.isInteger(id)) return;
    var root = document.querySelector("[data-gc-profile]");
    if (!root) return;
    var status = root.querySelector("[data-gc-profile-status]");
    var overview = root.querySelector("[data-gc-profile-overview]");
    var payments = root.querySelector("[data-gc-payments]");
    var form = root.querySelector("[data-gc-contract]");
    var paymentForm = root.querySelector("[data-gc-payment-form]");
    var addPayment = root.querySelector("[data-gc-new-payment]");
    var summaryRoot = document.querySelector("[data-gc-360]");
    var summaryStatus = summaryRoot.querySelector("[data-gc-360-status]");
    var summaryKpis = summaryRoot.querySelector("[data-gc-360-kpis]");
    var summaryAlerts = summaryRoot.querySelector("[data-gc-360-alerts]");
    var summaryRequests = summaryRoot.querySelector("[data-gc-360-requests]");
    var summaryTimeline = summaryRoot.querySelector("[data-gc-360-timeline]");
    var activityFilter = summaryRoot.querySelector("[data-gc-360-event-filter]");
    var lastTimeline = [];
    function timestampLabel(value) {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "Sin fecha";
      return new Date(value).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});
    }
    function renderTimeline() {
      var type = activityFilter.value;
      var visible = lastTimeline.filter(function (event) { return type === "todas" || type === event.tipo; });
      summaryTimeline.replaceChildren();
      visible.forEach(function (event) {
        var item = element("li","gc-360-timeline-item");
        item.appendChild(element("time","gc-muted",timestampLabel(event.fecha)));
        var content = element("div","gc-360-event");
        content.appendChild(element("strong","",event.titulo));
        if (event.detalle) content.appendChild(element("span","gc-muted",event.detalle));
        if (event.tipo === "pago" && typeof event.importe_centavos === "number" &&
            (event.moneda === "ARS" || event.moneda === "USD")) {
          content.appendChild(element("span","gc-muted",cents(event.importe_centavos,event.moneda)));
        }
        if (event.tipo === "landing" && Number.isInteger(event.landing_id)) {
          var link = element("a","","Abrir editor");
          link.href = "constructor.html?landing="+event.landing_id;
          content.appendChild(link);
        }
        item.appendChild(content);
        summaryTimeline.appendChild(item);
      });
      summaryRoot.querySelector("[data-gc-360-no-activity]").hidden = !!visible.length;
    }
    function render360(data) {
      var client = data.cliente || {}, totals = data.resumen_360 || {};
      var alerts = data.alertas || [], requests = data.solicitudes || [];
      summaryRoot.querySelector("[data-gc-client-name]").textContent = client.nombre || "Cliente";
      summaryRoot.querySelector("[data-gc-client-meta]").textContent =
        [client.rubro,client.contacto,client.email,client.telefono].filter(Boolean).join(" · ") ||
        "Sin contacto registrado";
      summaryRoot.querySelector("[data-gc-create-landing]").href = "constructor.html?cliente="+id;
      summaryKpis.replaceChildren();
      [
        ["Landings",String(totals.landings || 0)],
        ["Publicadas",String(totals.publicadas || 0)],
        ["Cambios pendientes",String(totals.cambios_pendientes || 0)],
        ["Cobros pendientes",String(totals.pagos_pendientes || 0)],
        ["Alertas urgentes",String(totals.alertas_urgentes || 0)],
      ].forEach(function (entry) {
        var card = element("div","gc-kpi");
        card.appendChild(element("span","gc-kpi-number",entry[1]));
        card.appendChild(element("span","gc-muted",entry[0]));
        summaryKpis.appendChild(card);
      });
      var balances = totals.saldos_pendientes || {};
      var balance = element("div","gc-kpi");
      balance.appendChild(element("strong","","Saldos registrados pendientes"));
      balance.appendChild(element("span","gc-muted",
        (balances.ARS ? cents(balances.ARS,"ARS") : "ARS sin saldo pendiente")+
        " · "+(balances.USD ? cents(balances.USD,"USD") : "USD sin saldo pendiente")));
      if (!totals.movimientos_registrados) {
        balance.appendChild(element("small","gc-muted","Sin movimientos registrados; no implica que el cliente esté al día."));
      }
      summaryKpis.appendChild(balance);
      summaryAlerts.replaceChildren();
      alerts.forEach(function (alert) {
        var li = element("li","gc-360-item");
        li.appendChild(element("strong",alert.prioridad <= 1 ? "gc-danger" : "",alert.titulo));
        li.appendChild(element("span","gc-muted",alert.detalle));
        var href = ["pago","cambio","seguimiento"].includes(alert.tipo)
          ? {pago:"#gcFinanceTitle",cambio:"#gc360Requests",seguimiento:"#gcContractTitle"}[alert.tipo] : "#gc360Overview";
        var link = element("a","","Ver detalle"); link.href=href;li.appendChild(link);
        summaryAlerts.appendChild(li);
      });
      summaryRoot.querySelector("[data-gc-360-no-alerts]").hidden = !!alerts.length;
      summaryRequests.replaceChildren();
      requests.forEach(function (request) {
        var li = element("li","gc-360-item");
        li.appendChild(element("strong","",request.landing+" · "+request.estado));
        li.appendChild(element("small","gc-muted",timestampLabel(request.fecha)));
        if (request.nota) li.appendChild(element("p","gc-muted",request.nota));
        if (request.fuera_de_plan) li.appendChild(element("span","gc-danger",request.fuera_de_plan));
        if (request.estado === "pendiente") {
          var link = element("a","","Revisar pedido");link.href="#cf-revisar";li.appendChild(link);
        }
        summaryRequests.appendChild(li);
      });
      summaryRoot.querySelector("[data-gc-360-no-requests]").hidden = !!requests.length;
      lastTimeline = data.actividad || [];
      renderTimeline();
      summaryStatus.textContent = "Ficha actualizada. "+alerts.length+" alertas y "+
        (totals.cambios_pendientes || 0)+" solicitudes de cambios pendientes.";
    }
    activityFilter.addEventListener("change",renderTimeline);
    summaryRoot.querySelector("[data-gc-360-refresh]").addEventListener("click",function () { load(); });
    var revision = 0, current;
    function render(data) {
      render360(data);
      current = data; revision = data.revision;
      form.elements.inicio.value = data.inicio || "";
      form.elements.proximo_contacto.value = data.proximo_contacto || "";
      form.elements.notas.value = data.notas || "";
      overview.replaceChildren();
      data.landings.forEach(function (landing) {
        var card = element("article","gc-landing");
        var title = element("a","",landing.nombre); title.href = "constructor.html?landing=" + landing.id;
        card.appendChild(title);
        card.appendChild(element("span","gc-muted"," · "+landing.plan+" · "+(landing.publicada?"Publicada":"Sin publicar")+
          (landing.estado_borrador !== "sin_borrador"?" · "+landing.estado_borrador:"")));
        var limits = landing.cambios;
        card.appendChild(element("p","gc-muted", "Solicitudes de cambios: "+limits.cambios_usados+
          (limits.cambios_mes ? " de "+limits.cambios_mes+" este mes" : " este mes (sin cupo mensual configurado)") ));
        overview.appendChild(card);
      });
      if (!data.landings.length) overview.textContent="Este cliente todavía no tiene landings.";
      payments.replaceChildren();
      data.movimientos.slice().reverse().forEach(function (m) {
        var tr = document.createElement("tr");
        var relevantLanding = data.landings.find(function (row) { return row.id === m.landing_id; });
        [m.concepto,relevantLanding ? relevantLanding.nombre : "General",m.moneda,cents(m.importe_centavos,m.moneda),
         dateLabel(m.vencimiento), m.estado === "pagado" ? "Pagado el "+dateLabel(m.fecha_pago) : m.estado].forEach(function (value) {
           tr.appendChild(element("td","",value));
         });
        payments.appendChild(tr);
      });
      root.querySelector("[data-gc-payments-empty]").hidden = !!data.movimientos.length;
      var landingSelect = paymentForm.elements.landing_id;
      landingSelect.replaceChildren(new Option("General (cliente)",""));
      data.landings.forEach(function (landing) { landingSelect.add(new Option(landing.nombre, String(landing.id))); });
      status.textContent = "Datos comerciales cargados. " + data.solicitudes_pendientes + " solicitudes pendientes.";
    }
    function load() {
      api("GET","/api/gestion/clientes/"+id).then(render).catch(function(error) {
        status.textContent = error.message; status.classList.add("gc-danger");
        summaryStatus.textContent = error.message;
      });
    }
    form.addEventListener("submit",function (event) {
      event.preventDefault();
      var submit = form.querySelector('[type="submit"]'); submit.disabled=true;
      api("PUT","/api/gestion/clientes/"+id,{inicio:form.elements.inicio.value,
        proximo_contacto:form.elements.proximo_contacto.value,notas:form.elements.notas.value,revision:revision})
        .then(function(data){render(data);status.textContent="Datos comerciales guardados.";})
        .catch(function(error){status.textContent=error.message;}).finally(function(){submit.disabled=false;});
    });
    addPayment.addEventListener("click",function () {
      paymentForm.hidden = !paymentForm.hidden;
      if (!paymentForm.hidden) paymentForm.elements.concepto.focus();
    });
    paymentForm.elements.estado.addEventListener("change",function(){
      var paid = paymentForm.elements.estado.value==="pagado";
      paymentForm.querySelector("[data-gc-paid-row]").hidden=!paid;
      paymentForm.elements.fecha_pago.required=paid;
      if (!paid) paymentForm.elements.fecha_pago.value="";
    });
    paymentForm.addEventListener("submit",function (event) {
      event.preventDefault();
      var amount = Number(paymentForm.elements.importe.value);
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount*100))) {
        status.textContent="Ingresá un importe válido.";return;
      }
      var submit=paymentForm.querySelector('[type="submit"]');submit.disabled=true;
      api("POST","/api/gestion/clientes/"+id+"/movimientos",{
        revision:revision,concepto:paymentForm.elements.concepto.value,
        importe_centavos:Math.round(amount*100),moneda:paymentForm.elements.moneda.value,
        estado:paymentForm.elements.estado.value,
        vencimiento:paymentForm.elements.vencimiento.value,
        fecha_pago:paymentForm.elements.fecha_pago.value,
        landing_id:paymentForm.elements.landing_id.value ? Number(paymentForm.elements.landing_id.value) : null,
      }).then(function(data){render(data);paymentForm.reset();paymentForm.hidden=true;status.textContent="Movimiento registrado."})
        .catch(function(error){status.textContent=error.message;})
        .finally(function(){submit.disabled=false;});
    });
    load();
  }
  if (document.body.getAttribute("data-page")==="gestion-clientes") dashboard();
  if (document.body.getAttribute("data-page")==="cliente") profile();
})();
