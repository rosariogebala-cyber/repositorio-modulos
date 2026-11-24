"""Backoffice comercial de Lanzate. Datos privados separados de los sitios publicados.

Importes expresados en centavos de la moneda declarada; no efectuar cobros reales.
No inventar fechas de renovación, cuotas ni pagos para clientes históricos.
"""
import json
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CURRENCIES = ("ARS", "USD")
STATES = ("pendiente", "pagado", "anulado")


def path(client_id):
    return "gestion-clientes/%d.json" % int(client_id)


def check_date(s, value, label, required=False):
    value = str(value or "").strip()
    if not value:
        if required:
            raise s.ApiError(400, "Completá " + label + ".")
        return ""
    if not DATE_RE.fullmatch(value):
        raise s.ApiError(400, label + " debe tener formato AAAA-MM-DD.")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise s.ApiError(400, label + " no es una fecha válida.")
    return value


def load(s, client_id):
    raw = s.FILES.read("datos", path(client_id))
    try:
        data = json.loads(raw.decode("utf-8")) if raw else {}
    except (UnicodeError, ValueError):
        raise s.ApiError(500, "Los datos comerciales no se pudieron leer.")
    if not isinstance(data, dict):
        raise s.ApiError(500, "Los datos comerciales tienen un formato incorrecto.")
    return {"inicio": data.get("inicio") or "", "proximo_contacto": data.get("proximo_contacto") or "",
            "notas": data.get("notas") or "", "movimientos": data.get("movimientos") or [],
            "revision": data.get("revision") or 0}


def client_timeline(client, landings, info):
    """Actividad consolidada y limitada: pedidos, movimientos, landings y seguimiento.
    No se incluyen claves, archivos, HTML ni datos del portal."""
    events = []
    names = {l["id"]: l["nombre"] for l in landings}
    for item in landings:
        timestamp = item.get("creado")
        if type(timestamp) is int and timestamp > 0:
            events.append({"tipo": "landing", "estado": "creada", "fecha": timestamp,
                           "titulo": "Landing creada: " + str(item["nombre"])[:120],
                           "detalle": (item.get("plan_id") or client.get("plan") or "Sin plan"),
                           "landing_id": item["id"]})
        updated = item.get("actualizado")
        if type(updated) is int and updated > (timestamp if type(timestamp) is int else 0):
            events.append({"tipo": "landing", "estado": "actualizada", "fecha": updated,
                           "titulo": "Landing actualizada: " + str(item["nombre"])[:120],
                           "detalle": "Cambios en el constructor", "landing_id": item["id"]})
    for request in client.get("pedidos") or []:
        timestamp = request.get("fecha")
        if type(timestamp) is not int or timestamp <= 0:
            continue
        req_name = str(request.get("landing") or "Pedido general")[:120]
        state = str(request.get("estado") or "pendiente")
        events.append({"tipo": "solicitud", "estado": state, "fecha": timestamp,
                       "titulo": "Solicitud de cambios: " + req_name,
                       "detalle": str(request.get("nota") or "")[:160],
                       "id": str(request.get("id") or timestamp)})
        resolved = request.get("resuelto")
        if type(resolved) is int and resolved > timestamp:
            events.append({"tipo": "solicitud", "estado": state, "fecha": resolved,
                           "titulo": "Solicitud resuelta: " + req_name,
                           "detalle": "Estado: " + state, "id": str(request.get("id") or timestamp)})
    for movement in info.get("movimientos") or []:
        timestamp = movement.get("creado")
        if type(timestamp) is not int or timestamp <= 0:
            continue
        state = movement.get("estado") or "pendiente"
        title = "Cobro registrado" if state == "pagado" else "Movimiento comercial registrado"
        events.append({"tipo": "pago", "estado": state, "fecha": timestamp,
                       "titulo": title, "detalle": str(movement.get("concepto") or "")[:160],
                       "moneda": movement.get("moneda"), "importe_centavos": movement.get("importe_centavos"),
                       "landing": names.get(movement.get("landing_id"), "General")})
    if client.get("creado"):
        events.append({"tipo": "cliente", "estado": "alta", "fecha": client["creado"],
                       "titulo": "Cliente registrado", "detalle": ""})
    return sorted(events, key=lambda ev: ev["fecha"], reverse=True)[:60]


def get(s, client_id):
    with s.store("clientes", "landings", save=False) as db:
        client = s.find_client(db, client_id)
        landings = [l for l in db["landings"] if l["cliente_id"] == client_id]
        requests = client.get("pedidos") or []
        pending = sum(p.get("estado") == "pendiente" for p in requests)
        # No exponer el objeto portal ni contraseñas al endpoint comercial.
        identity = {field: client.get(field) or "" for field in
                    ("nombre", "contacto", "email", "telefono", "rubro", "estado", "sitio")}
        identity["creado"] = client.get("creado") or 0
    data = load(s, client_id)
    data["cliente_id"] = client_id
    data["cliente"] = identity
    data["solicitudes_pendientes"] = pending
    data["landings"] = [{
        "id": row["id"], "nombre": row["nombre"], "slug": row["slug"],
        "plan": (s.landing_plan(row, client) or {}).get("nombre") or "Sin plan",
        "plan_id": row.get("plan_id") or client.get("plan") or "",
        "publicada": bool(row.get("html")),
        "estado_borrador": row.get("borrador_estado") or "sin_borrador",
        "secciones": len(s.content_sections(row.get("items") or [])),
        "cambios": s.plan_status(client, row),
        "url": "/l/%s/%s/" % (client["slug"], row["slug"]),
    } for row in landings]
    data["solicitudes"] = [{
        "id": str(p.get("id") or p.get("fecha") or ""),
        "fecha": p.get("fecha") if type(p.get("fecha")) is int else None,
        "estado": p.get("estado") or "pendiente",
        "landing": str(p.get("landing") or "General")[:120],
        "nota": str(p.get("nota") or "")[:300],
        "fuera_de_plan": str(p.get("fuera_de_plan") or "")[:120],
    } for p in sorted(requests, key=lambda p: p.get("fecha") if type(p.get("fecha")) is int else 0, reverse=True)[:40]]
    zone = ZoneInfo("America/Argentina/Buenos_Aires")
    now = datetime.now(zone)
    data["alertas"] = sorted(followup_alerts(client, data, now.date(), int(now.timestamp() * 1000), zone),
                             key=lambda a: (a["prioridad"], a["fecha"] or "9999-12-31", a["id"]))[:40]
    data["actividad"] = client_timeline(client, landings, data)
    amounts = {ccy: sum(m.get("importe_centavos") or 0 for m in data["movimientos"]
                        if m.get("moneda") == ccy and m.get("estado") == "pendiente") for ccy in CURRENCIES}
    data["resumen_360"] = {
        "landings": len(landings), "publicadas": sum(bool(l.get("html")) for l in landings),
        "cambios_pendientes": pending, "pagos_pendientes": sum(m.get("estado") == "pendiente" for m in data["movimientos"]),
        "saldos_pendientes": amounts, "alertas_urgentes": sum(a["prioridad"] <= 1 for a in data["alertas"]),
        "movimientos_registrados": len(data["movimientos"]),
    }
    return data


def save_settings(s, client_id, payload):
    if not isinstance(payload, dict):
        raise s.ApiError(400, "Datos incorrectos.")
    with s.store("clientes", save=False) as db:
        s.find_client(db, client_id)
    old = load(s, client_id)
    if payload.get("revision") != old["revision"]:
        raise s.ApiError(409, "Estos datos cambiaron en otra pestaña. Volvé a cargar.")
    updates = {
        "inicio": check_date(s, payload.get("inicio"), "Fecha de inicio"),
        "proximo_contacto": check_date(s, payload.get("proximo_contacto"), "Próximo seguimiento"),
        "notas": str(payload.get("notas") or "").strip()[:1500],
    }
    old.update(updates)
    old["revision"] = max(s.now_ms(), old["revision"] + 1)
    s.FILES.write("datos", path(client_id), json.dumps(old, ensure_ascii=False).encode("utf-8"))
    return get(s, client_id)


def movement(s, client_id, payload):
    if not isinstance(payload, dict):
        raise s.ApiError(400, "Movimiento incorrecto.")
    with s.store("clientes", "landings", save=False) as db:
        s.find_client(db, client_id)
        allowed = {row["id"] for row in db["landings"] if row["cliente_id"] == client_id}
    old = load(s, client_id)
    if payload.get("revision") != old["revision"]:
        raise s.ApiError(409, "El historial cambió. Recargá los movimientos antes de continuar.")
    concept = " ".join(str(payload.get("concepto") or "").split())[:160]
    if not concept:
        raise s.ApiError(400, "Describí el concepto del movimiento.")
    cents = payload.get("importe_centavos")
    if type(cents) is not int or cents <= 0 or cents > 100_000_000_000:
        raise s.ApiError(400, "El importe debe ser un número positivo expresado en centavos.")
    currency = str(payload.get("moneda") or "").upper()
    if currency not in CURRENCIES:
        raise s.ApiError(400, "La moneda debe ser ARS o USD.")
    state = str(payload.get("estado") or "pendiente")
    if state not in STATES:
        raise s.ApiError(400, "Estado de pago no permitido.")
    due = check_date(s, payload.get("vencimiento"), "Vencimiento", True)
    paid = check_date(s, payload.get("fecha_pago"), "Fecha de pago")
    if state == "pagado" and not paid:
        raise s.ApiError(400, "Un pago registrado como pagado necesita fecha de pago.")
    if state != "pagado" and paid:
        raise s.ApiError(400, "Solo los pagos realizados llevan fecha de pago.")
    landing_id = payload.get("landing_id")
    if landing_id not in (None, ""):
        if type(landing_id) is not int or landing_id not in allowed:
            raise s.ApiError(400, "La landing no corresponde a este cliente.")
    else:
        landing_id = None
    movements = old["movimientos"]
    if len(movements) >= 300:
        raise s.ApiError(409, "El historial llegó al máximo de 300 movimientos.")
    movements.append({
        "id": max((v.get("id", 0) for v in movements), default=0) + 1,
        "concepto": concept, "importe_centavos": cents, "moneda": currency,
        "estado": state, "vencimiento": due, "fecha_pago": paid,
        "landing_id": landing_id, "creado": s.now_ms(),
    })
    old["revision"] = max(s.now_ms(), old["revision"] + 1)
    s.FILES.write("datos", path(client_id), json.dumps(old, ensure_ascii=False).encode("utf-8"))
    return get(s, client_id)


def followup_alerts(client, info, today, now_ms, zone):
    """Alertas solo lectura, basadas en registros confirmados, sin envíos externos."""
    alerts = []
    cid = client["id"]
    name = client["nombre"]
    base = "cliente.html?id=%d" % cid
    deadline = (today + timedelta(days=7)).isoformat()
    for m in info["movimientos"]:
        if m.get("estado") != "pendiente" or not m.get("vencimiento"):
            continue
        due = m["vencimiento"]
        if not DATE_RE.fullmatch(due) or due > deadline:
            continue
        overdue = due < today.isoformat()
        today_due = due == today.isoformat()
        label = "Pago vencido" if overdue else ("Pago vence hoy" if today_due else "Pago próximo a vencer")
        alerts.append({
            "id": "pago:%d:%s" % (cid, m.get("id", "")), "tipo": "pago",
            "prioridad": 0 if overdue else 1 if today_due else 3,
            "cliente_id": cid, "cliente": name, "titulo": label,
            "detalle": "%s · %s" % (m.get("concepto") or "Cobro registrado", due),
            "fecha": due, "url": base + "#gcFinanceTitle",
            "importe_centavos": m["importe_centavos"], "moneda": m["moneda"],
        })
    followup = info.get("proximo_contacto") or ""
    if DATE_RE.fullmatch(followup) and followup <= deadline:
        is_late = followup < today.isoformat()
        alerts.append({
            "id": "seguimiento:%d:%s" % (cid, followup), "tipo": "seguimiento",
            "prioridad": 1 if is_late else 2 if followup == today.isoformat() else 4,
            "cliente_id": cid, "cliente": name,
            "titulo": "Seguimiento atrasado" if is_late else "Seguimiento de hoy" if followup == today.isoformat() else "Seguimiento próximo",
            "detalle": "Próximo contacto: " + followup, "fecha": followup,
            "url": base + "#gcContractTitle",
        })
    for req in (client.get("pedidos") or []):
        if req.get("estado") != "pendiente":
            continue
        stamp = req.get("fecha")
        try:
            request_day = datetime.fromtimestamp(int(stamp) / 1000, tz=zone).date() if stamp else None
            age = max(0, (now_ms - int(stamp)) // 86400000) if request_day else None
        except (ValueError, TypeError, OverflowError, OSError):
            request_day = None
            age = None
        late = age is not None and age >= 2
        detail = "Pedido pendiente"
        if req.get("landing"):
            detail += " · " + str(req["landing"])[:80]
        if age is not None:
            detail += " · hace %d día(s)" % age
        alerts.append({
            "id": "pedido:%d:%s" % (cid, str(req.get("id") or stamp or "sin-id")),
            "tipo": "cambio", "prioridad": 1 if late else 2,
            "cliente_id": cid, "cliente": name,
            "titulo": "Solicitud demorada" if late else "Solicitud de cambios pendiente",
            "detalle": detail, "fecha": request_day.isoformat() if request_day else "",
            "url": base + "#cf-revisar",
        })
    return alerts


def dashboard(s):
    with s.store("clientes", "landings", save=False) as db:
        clients = list(db["clientes"])
        landings = list(db["landings"])
    zone = ZoneInfo("America/Argentina/Buenos_Aires")
    now = datetime.now(zone)
    today = now.date()
    alerts = []
    result = []
    for c in clients:
        info = load(s, c["id"])
        alerts.extend(followup_alerts(c, info, today, int(now.timestamp() * 1000), zone))
        rows = [l for l in landings if l["cliente_id"] == c["id"]]
        movements = info["movimientos"]
        pending = [m for m in movements if m.get("estado") == "pendiente"]
        paid = [m for m in movements if m.get("estado") == "pagado"]
        due_soon = [m for m in pending if m.get("vencimiento") and
                    m["vencimiento"] <= (today + timedelta(days=7)).isoformat()]
        summary = {
            "id": c["id"], "nombre": c["nombre"], "contacto": c.get("contacto") or "",
            "email": c.get("email") or "", "estado": c.get("estado") or "activo",
            "tipo": s.client_type(c), "inicio": info["inicio"], "creado": c.get("creado") or 0,
            "proximo_contacto": info["proximo_contacto"],
            "landings": len(rows),
            "publicadas": sum(bool(l.get("html")) for l in rows),
            "planes": [dict(id=l["id"], nombre=l["nombre"],
                            plan=(s.landing_plan(l, c) or {}).get("nombre") or "Sin plan",
                            estado=l.get("borrador_estado") or "sin_borrador") for l in rows],
            "solicitudes_pendientes": sum(p.get("estado") == "pendiente" for p in (c.get("pedidos") or [])),
            "pagos_pendientes": len(pending), "pagos_vencidos": sum(m["vencimiento"] < today.isoformat() for m in pending),
            "pagos_proximos": len(due_soon), "pagos_registrados": len(paid),
            "saldos_pendientes": {ccy: sum(m["importe_centavos"] for m in pending if m["moneda"] == ccy)
                                 for ccy in CURRENCIES},
            "proximo_vencimiento": min((m["vencimiento"] for m in pending), default=""),
            "tiene_registro_cobros": bool(movements),
        }
        result.append(summary)
    alerts.sort(key=lambda a: (a["prioridad"], a["fecha"] or "9999-12-31", a["cliente"].lower(), a["id"]))
    return {"clientes": result, "alertas": alerts, "alertas_total": len(alerts),
            "alertas_resumen": {
                "pagos": sum(a["tipo"] == "pago" for a in alerts),
                "cambios": sum(a["tipo"] == "cambio" for a in alerts),
                "seguimientos": sum(a["tipo"] == "seguimiento" for a in alerts),
                "urgentes": sum(a["prioridad"] <= 1 for a in alerts),
            },
            "resumen": {
        "total": len(clients), "activos": sum(c.get("estado") != "pausado" for c in clients),
        "landings_publicadas": sum(bool(l.get("html")) for l in landings),
        "solicitudes_pendientes": sum(r["solicitudes_pendientes"] for r in result),
        "clientes_con_pagos_pendientes": sum(r["pagos_pendientes"] > 0 for r in result),
        "clientes_con_pagos_vencidos": sum(r["pagos_vencidos"] > 0 for r in result),
    }}
