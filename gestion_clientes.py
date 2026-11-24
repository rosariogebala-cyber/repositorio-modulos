"""Cartera comercial de Lanzate: datos privados, sin inferir pagos ni montos contratados."""
import datetime as dt
import json
import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

PATH = "gestion/clientes.json"
CURRENCIES = ("ARS", "USD")


def today():
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).date()


def iso_date(value, required=False):
    value = str(value or "").strip()
    if not value and not required:
        return ""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Ingresá una fecha válida AAAA-MM-DD.")
    try:
        dt.date.fromisoformat(value)
    except ValueError:
        raise ValueError("La fecha no existe en el calendario.")
    return value


def money_cents(value):
    try:
        number = Decimal(str(value).strip().replace(",", "."))
        if not number.is_finite() or number < 0 or number > 100_000_000:
            raise ValueError()
        rounded = number.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if rounded != number:
            raise ValueError()
        return int(rounded * 100)
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("El importe debe ser un número positivo, de hasta dos decimales.")


def read(s):
    raw = s.FILES.read("datos", PATH)
    if not raw:
        s.check_private_repo()
        return {"contratos": {}, "pagos": [], "inicios": {}, "revision": 0}
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeError, ValueError):
        raise s.ApiError(500, "No se pudo interpretar la cartera comercial privada.")
    if not isinstance(payload, dict) or not isinstance(payload.get("contratos", {}), dict) or not isinstance(payload.get("pagos", []), list):
        raise s.ApiError(500, "El registro comercial no tiene un formato válido.")
    return {"contratos": payload.get("contratos") or {}, "pagos": payload.get("pagos") or [],
            "inicios": payload.get("inicios") or {}, "revision": int(payload.get("revision") or 0)}


def write(s, data):
    s.FILES.write("datos", PATH, json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def pending_requests(client, landing=None):
    requests = [p for p in (client.get("pedidos") or []) if p.get("estado") == "pendiente"]
    if landing is None:
        return len(requests)
    slug = landing["slug"]
    names = {slug, landing["nombre"]}
    return sum(1 for item in requests if item.get("landing_slug") == slug or
               (not item.get("landing_slug") and item.get("landing") in names) or
               (not item.get("landing_slug") and not item.get("landing") and
                len(client.get("_landing_slugs") or []) == 1))


def _period_due(period, day):
    year, month = map(int, period.split("-"))
    return dt.date(year, month, day)


def payment_status(contract, payments, current=None):
    if not contract or not contract.get("inicio") or not contract.get("abono_centavos"):
        return {"estado": "sin_configurar", "vencimiento": "", "pagado_centavos": 0, "saldo_centavos": 0}
    current = current or today()
    period = current.strftime("%Y-%m")
    due = _period_due(period, contract["dia_vencimiento"])
    start = dt.date.fromisoformat(contract["inicio"])
    if start > current:
        return {"estado": "no_iniciado", "vencimiento": due.isoformat(), "pagado_centavos": 0,
                "saldo_centavos": contract["abono_centavos"]}
    paid = sum(int(p["monto_centavos"]) for p in payments
               if p.get("periodo") == period and p.get("moneda") == contract["moneda"] and not p.get("anulado") and p.get("concepto", "mensual") == "mensual")
    total = contract["abono_centavos"]
    state = ("pagado" if paid >= total else
             ("parcial_vencido" if current > due else "parcial") if paid > 0 else
             ("vencido" if current > due else "pendiente"))
    return {"estado": state, "vencimiento": due.isoformat(), "pagado_centavos": paid,
            "saldo_centavos": max(0, total - paid)}


def _client_rows(s, db, ledger, client_id=None):
    clients = db["clientes"]
    landings = db["landings"]
    all_payments = ledger["pagos"]
    rows = []
    for c in clients:
        if client_id is not None and c["id"] != client_id:
            continue
        sites = [lp for lp in landings if lp["cliente_id"] == c["id"]]
        c_view = dict(c, _landing_slugs=[lp["slug"] for lp in sites])
        lp_rows = []
        for lp in sites:
            agreement = ledger["contratos"].get(str(lp["id"])) or {}
            movements = [p for p in all_payments if p.get("landing_id") == lp["id"] and p.get("cliente_id") == c["id"]]
            plan = s.landing_plan(lp, c)
            setup_due = int(agreement.get("alta_centavos") or 0)
            setup_paid = sum(int(p["monto_centavos"]) for p in movements
                             if p.get("concepto") in ("alta_anticipo", "alta_saldo") and
                             p.get("moneda") == (agreement.get("moneda") or "ARS") and not p.get("anulado"))
            setup_balance = max(0, setup_due - setup_paid)
            lp_rows.append({
                "id": lp["id"], "nombre": lp["nombre"], "slug": lp["slug"],
                "url": "/l/%s/%s/" % (c["slug"], lp["slug"]),
                "publicada": bool(lp.get("html")),
                "estado": lp.get("borrador_estado") or ("publicada" if lp.get("html") else "sin_publicar"),
                "plan_id": plan.get("id") if plan else "",
                "plan": plan.get("nombre") if plan else "Sin plan",
                "secciones": plan.get("secciones") if plan else 0,
                "cambios_pendientes": pending_requests(c_view, lp),
                "cambios_mes": s.plan_status(c, lp).get("cambios_usados") or 0,
                "cambios_limite": s.plan_status(c, lp).get("cambios_mes") or 0,
                "inicio": agreement.get("inicio") or "",
                "dia_vencimiento": agreement.get("dia_vencimiento") or None,
                "abono_centavos": agreement.get("abono_centavos") or 0,
                "alta_centavos": setup_due, "alta_pagado_centavos": setup_paid,
                "alta_saldo_centavos": setup_balance,
                "alta_estado": ("sin_configurar" if not setup_due else
                                "pagado" if not setup_balance else "parcial" if setup_paid else "pendiente"),
                "moneda": agreement.get("moneda") or "ARS",
                "notas": agreement.get("notas") or "",
                "catalogo_mensual": plan.get("mensual") if plan else None,
                "catalogo_inicial": plan.get("inicial") if plan else None,
                "cobro": payment_status(agreement, movements),
                "pagos": sorted(movements, key=lambda p: (p["fecha_pago"], p["id"]), reverse=True) if client_id else [],
            })
        statuses = [site["cobro"]["estado"] for site in lp_rows]
        worst = ("vencido" if "vencido" in statuses or "parcial_vencido" in statuses else "parcial" if "parcial" in statuses else
                 "pendiente" if "pendiente" in statuses else "pagado" if statuses and all(x=="pagado" for x in statuses)
                 else "sin_configurar")
        client_row = {
            "id": c["id"], "nombre": c["nombre"], "rubro": c.get("rubro") or "",
            "contacto": c.get("contacto") or "", "email": c.get("email") or "",
            "telefono": c.get("telefono") or "", "tipo_cliente": s.client_type(c),
            "estado": c.get("estado") or "activo",
            "alta": dt.datetime.fromtimestamp(c["creado"]/1000, tz=dt.timezone.utc).date().isoformat() if c.get("creado") else "",
            "inicio": ledger["inicios"].get(str(c["id"])) or "",
            "plan_vence": c.get("plan_vence") or "",
            "landings": len(sites), "publicadas": sum(1 for lp in sites if lp.get("html")),
            "cambios_pendientes": pending_requests(c_view),
            "cobro_estado": worst,
            "webs": lp_rows,
        }
        rows.append(client_row)
    return rows


def portfolio(s, client_id=None):
    with s.store("clientes", "landings", save=False) as db:
        if client_id is not None:
            s.find_client(db, client_id)
        with s._lock:
            ledger = read(s)
            rows = _client_rows(s, db, ledger, client_id)
    if client_id is not None:
        return rows[0]
    return {"clientes": sorted(rows, key=lambda c: c["nombre"].casefold()), "resumen": {
        "clientes_activos": sum(1 for row in rows if row["estado"] == "activo" and row["tipo_cliente"] == "real"),
        "landings_publicadas": sum(row["publicadas"] for row in rows if row["tipo_cliente"] == "real"),
        "pagos_pendientes": sum(1 for row in rows for site in row["webs"]
                                 if row["tipo_cliente"] == "real" and site["cobro"]["estado"] in ("pendiente", "vencido", "parcial", "parcial_vencido")),
        "pagos_vencidos": sum(1 for row in rows for site in row["webs"]
                               if row["tipo_cliente"] == "real" and site["cobro"]["estado"] in ("vencido", "parcial_vencido")),
        "cambios_pendientes": sum(row["cambios_pendientes"] for row in rows if row["tipo_cliente"] == "real"),
        "altas_por_cobrar": sum(1 for row in rows for site in row["webs"]
                                if row["tipo_cliente"] == "real" and site["alta_saldo_centavos"] > 0),
    }}


def update_start(s, client_id, data):
    try:
        start = iso_date(data.get("inicio"))
    except ValueError as error:
        raise s.ApiError(400, str(error))
    with s._lock:
        with s.store("clientes", save=False) as db:
            s.find_client(db, client_id)
        ledger = read(s)
        ledger["inicios"][str(client_id)] = start
        ledger["revision"] += 1
        write(s, ledger)
    return portfolio(s, client_id)


def update_contract(s, client_id, landing_id, data):
    try:
        start = iso_date(data.get("inicio"))
        day = int(data.get("dia_vencimiento") or 0)
        if day not in range(1, 29):
            raise ValueError("El día de vencimiento debe estar entre 1 y 28.")
        currency = str(data.get("moneda") or "ARS").upper()
        if currency not in CURRENCIES:
            raise ValueError("Elegí ARS o USD.")
        amount = money_cents(data.get("abono"))
        setup_amount = money_cents(data.get("alta") or 0)
        notes = " ".join(str(data.get("notas") or "").split())[:400]
    except (ValueError, TypeError) as error:
        raise s.ApiError(400, str(error))
    if not start:
        raise s.ApiError(400, "Ingresá la fecha de inicio de esta landing.")
    with s._lock:
        with s.store("clientes", "landings", save=False) as db:
            s.find_client(db, client_id)
            lp = s.find_landing(db, landing_id)
            if lp["cliente_id"] != client_id:
                raise s.ApiError(403, "La landing no corresponde al cliente.")
        ledger = read(s)
        key = str(landing_id)
        current = ledger["contratos"].get(key) or {}
        if any(p["landing_id"] == landing_id for p in ledger["pagos"]) and current.get("moneda") not in ("", None, currency):
            raise s.ApiError(409, "Ya hay pagos registrados en otra moneda. No se puede cambiar la moneda del contrato.")
        ledger["contratos"][key] = {"inicio": start, "dia_vencimiento": day,
                                    "abono_centavos": amount, "alta_centavos": setup_amount,
                                    "moneda": currency, "notas": notes,
                                    "actualizado": s.now_ms()}
        ledger["revision"] += 1
        write(s, ledger)
    return portfolio(s, client_id)


def add_payment(s, client_id, data):
    try:
        lid = int(data.get("landing_id") or 0)
        period = str(data.get("periodo") or "")
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", period):
            raise ValueError("El período debe tener formato AAAA-MM.")
        date = iso_date(data.get("fecha_pago"), required=True)
        concept = str(data.get("concepto") or "mensual")
        if concept not in ("mensual", "alta_anticipo", "alta_saldo", "adicional"):
            raise ValueError("Elegí un concepto de pago válido.")
        amount = money_cents(data.get("monto"))
        if amount <= 0:
            raise ValueError("El pago debe ser mayor a cero.")
        reference = " ".join(str(data.get("referencia") or "").split())[:120]
        request_id = str(data.get("request_id") or "").strip()
        if request_id and not re.fullmatch(r"[A-Za-z0-9-]{16,80}", request_id):
            raise ValueError("El identificador del registro no es válido.")
    except (ValueError, TypeError) as error:
        raise s.ApiError(400, str(error))
    with s._lock:
        with s.store("clientes", "landings", save=False) as db:
            s.find_client(db, client_id)
            lp = s.find_landing(db, lid)
            if lp["cliente_id"] != client_id:
                raise s.ApiError(403, "La landing no corresponde al cliente.")
        ledger = read(s)
        contract = ledger["contratos"].get(str(lid)) or {}
        if not contract.get("inicio"):
            raise s.ApiError(409, "Configurá primero la fecha de inicio de la landing.")
        if concept == "mensual" and not contract.get("abono_centavos"):
            raise s.ApiError(409, "Configurá primero el abono mensual de la landing.")
        if concept in ("alta_anticipo", "alta_saldo") and not contract.get("alta_centavos"):
            raise s.ApiError(409, "Configurá primero el precio de creación de la landing.")
        currency = contract["moneda"]
        if request_id and any(p.get("request_id") == request_id and p.get("cliente_id") == client_id
                              for p in ledger["pagos"]):
            return portfolio(s, client_id)
        latest = max([int(p.get("id") or 0) for p in ledger["pagos"]] or [0]) + 1
        ledger["pagos"].append({"id": latest, "cliente_id": client_id, "landing_id": lid,
                              "periodo": period, "concepto": concept, "fecha_pago": date, "monto_centavos": amount,
                              "moneda": currency, "referencia": reference, "registrado": s.now_ms(),
                              "request_id": request_id, "anulado": False})
        ledger["revision"] += 1
        write(s, ledger)
    return portfolio(s, client_id)


def void_payment(s, client_id, payment_id, data):
    """Anulación con motivo y fecha; nunca se borra un cobro del historial de auditoría."""
    reason = " ".join(str((data or {}).get("motivo") or "").split())[:200]
    if len(reason) < 5:
        raise s.ApiError(400, "Escribí el motivo de la anulación (al menos 5 caracteres).")
    with s._lock:
        with s.store("clientes", save=False) as db:
            s.find_client(db, client_id)
        ledger = read(s)
        payment = next((entry for entry in ledger["pagos"] if entry.get("id") == payment_id and
                        entry.get("cliente_id") == client_id), None)
        if payment is None:
            raise s.ApiError(404, "No existe ese pago en este cliente.")
        if payment.get("anulado"):
            raise s.ApiError(409, "Este movimiento ya está anulado.")
        payment.update(anulado=True, motivo_anulacion=reason, fecha_anulacion=s.now_ms())
        ledger["revision"] += 1
        write(s, ledger)
    return portfolio(s, client_id)
