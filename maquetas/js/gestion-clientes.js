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
    var columns = ["Cliente", "Estado", "Inicio", "Cantidad de landings", "Planes",
      "Pedidos pendientes", "Pagos pendientes", "Pagos vencidos", "Próximo vencimiento",
      "Saldo pendiente ARS", "Saldo pendiente USD"];
    var lines = [columns].concat(rows.map(function (c) {
      return [c.nombre, c.estado, c.inicio, c.landings,
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
    var clientsCreated = {};
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
        tr.appendChild(element("td", "", dateLabel(c.inicio)));
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
    api("GET", "/api/gestion/clientes").then(function (data) {
      clients = data.clientes;
      var summary = data.resumen;
      [["Clientes",summary.total],["Activos",summary.activos],["Landings publicadas",summary.landings_publicadas],
       ["Cambios pendientes",summary.solicitudes_pendientes],
       ["Clientes con pagos pendientes",summary.clientes_con_pagos_pendientes],
       ["Clientes con pagos vencidos",summary.clientes_con_pagos_vencidos]].forEach(function (row) {
        var card = element("article","gc-kpi");
        card.appendChild(element("span","gc-kpi-number",String(row[1])));
        card.appendChild(element("span","gc-muted",row[0])); kpis.appendChild(card);
      });
      render();
    }).catch(function (error) { status.textContent = error.message; status.classList.add("gc-danger"); });
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
    var revision = 0, current;
    function render(data) {
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
        [m.concepto,m.moneda,cents(m.importe_centavos,m.moneda),dateLabel(m.vencimiento),
         m.estado === "pagado" ? "Pagado el "+dateLabel(m.fecha_pago) : m.estado].forEach(function (value) {
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
