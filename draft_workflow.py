"""Flujo de revisión de landings. Los borradores viven en lanzate-datos, nunca en el HTML público.

El módulo recibe el servidor como dependencia explícita: también funciona cuando server.py corre como __main__.
"""
import json
import re
from html import unescape


def path(landing_id):
    return "borradores/%d.json" % int(landing_id)


def read(s, landing_id):
    raw = s.FILES.read("datos", path(landing_id))
    if not raw:
        return None
    try:
        result = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeError):
        raise s.ApiError(500, "El borrador guardado está dañado.")
    if not isinstance(result, dict) or not isinstance(result.get("contenido"), dict):
        raise s.ApiError(500, "El borrador no tiene un formato válido.")
    return result


def write(s, landing_id, draft):
    s.FILES.write("datos", path(landing_id),
                  json.dumps(draft, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def project(s, landing_id):
    with s.store("clientes", "landings", save=False) as db:
        row = s.find_landing(db, landing_id)
        client = s.find_client(db, row["cliente_id"])
        result = s.landing_dict(row, client)
    draft = read(s, landing_id)
    result["publicada"] = bool(row.get("html"))
    result["borrador_estado"] = "sin_borrador"
    if not draft:
        return result
    content = draft["contenido"]
    for key in ("nombre", "items", "estilo", "ignorados", "descripcion", "animacion", "plan_id"):
        if key in content:
            result[key] = content[key]
    result["borrador_estado"] = draft["estado"]
    result["borrador_revision"] = draft["revision"]
    result["borrador_actualizado"] = draft["actualizado"]
    plan_id = result.get("plan_id")
    plans = s.read_data("planes", {}).get("planes") or []
    plan = next((p for p in plans if p.get("id") == plan_id), None)
    if plan:
        result["plan_nombre"] = plan.get("nombre", "")
        result["secciones_incluidas"] = plan.get("secciones", 0)
        result["secciones_contenido"] = len(s.content_sections(result.get("items") or []))
        result["plan_individual"] = True
    return result


def validate_payload(s, data):
    if not isinstance(data, dict):
        raise s.ApiError(400, "El borrador debe ser un objeto.")
    keys = ("cliente_id", "nombre", "plan_id", "html", "items", "estilo", "ignorados", "descripcion", "animacion")
    content = {key: data[key] for key in keys if key in data}
    if not str(content.get("nombre") or "").strip() or not str(content.get("html") or "").strip():
        raise s.ApiError(400, "Ingresá el nombre y armá la landing antes de guardar.")
    if not isinstance(content.get("items"), list) or not content["items"]:
        raise s.ApiError(400, "Agregá módulos antes de guardar.")
    if len(content["html"].encode("utf-8")) > 4_000_000:
        raise s.ApiError(413, "El borrador supera el tamaño permitido (4 MB).")
    return content


def save(s, data, landing_id=None):
    """Guardar no toca l/<cliente>/<landing> ni sitemap. Reserva el ID para landings nuevas."""
    content = validate_payload(s, data)
    with s.store("clientes", "landings") as db:
        client = s.find_client(db, int(content.get("cliente_id") or 0))
        if landing_id:
            row = s.find_landing(db, landing_id)
            if row["cliente_id"] != client["id"]:
                raise s.ApiError(409, "No se permite cambiar el cliente desde un borrador.")
        else:
            name = str(content["nombre"]).strip()
            slug = s.slugify(name)
            if any(r["cliente_id"] == client["id"] and r["slug"] == slug for r in db["landings"]):
                raise s.ApiError(409, "Ya existe una landing con ese nombre para este cliente.")
            plan_id = content.get("plan_id") or client.get("plan")
            plan = next((p for p in (s.read_data("planes", {}).get("planes") or [])
                         if p.get("id") == plan_id), None)
            if not plan:
                raise s.ApiError(400, "Seleccioná un plan válido.")
            stamp = s.now_ms()
            row = {"id": s.next_id(db["landings"]), "cliente_id": client["id"], "nombre": name,
                   "slug": slug, "creado": stamp, "actualizado": stamp,
                   "html": "", "items": [], "estilo": "", "ejemplo": False,
                   "plan_id": plan_id, "plan_condiciones": dict(plan)}
            db["landings"].append(row)
        landing_id = row["id"]
        row["borrador_estado"] = "borrador"
        row["borrador_modulos"] = len(content.get("items") or [])
    previous = read(s, landing_id)
    if previous and data.get("base_revision") is not None and data["base_revision"] != previous.get("revision"):
        raise s.ApiError(409, "Hay una versión más nueva del borrador. Recargá para evitar sobrescribirla.")
    stamp = s.now_ms()
    revision = max(stamp, int(previous.get("revision", 0)) + 1) if previous else stamp
    write(s, landing_id, {"contenido": content, "estado": "borrador", "revision": revision,
                          "aprobada_revision": None, "actualizado": stamp})
    return project(s, landing_id)


def content_warnings(s, html, client):
    """Lista de verificación editorial/SEO/rendimiento: sugerencias, no certificación WCAG."""
    warnings = []
    try:
        doc = s.html_dom.document_fromstring(html)
    except (ValueError, TypeError):
        return ["El HTML no se pudo interpretar para analizar su contenido."]
    images = doc.xpath("//img")
    if images and any(not (image.get("width") and image.get("height")) for image in images):
        warnings.append("Hay imágenes sin dimensiones explícitas; verificá cambios de diseño (CLS).")
    if len(images) > 6 and not any(image.get("loading") == "lazy" for image in images[2:]):
        warnings.append("Hay varias imágenes sin carga diferida; revisá LCP y carga en móvil.")
    if any("plantillas/" in (image.get("src") or "") or "rubros/" in (image.get("src") or "") for image in images):
        warnings.append("Revisá fotos de la biblioteca de ejemplo; reemplazalas por fotografías autorizadas del negocio.")
    if any(not (image.get("src") or "").strip() for image in images):
        warnings.append("Hay imágenes sin origen.")
    ids = doc.xpath("//*[@id]/@id")
    if len(ids) != len(set(ids)):
        warnings.append("Hay IDs duplicados que pueden afectar navegación y lectores de pantalla.")
    if any(not (link.get("href") or "").strip() or link.get("href") == "#" for link in doc.xpath("//a")):
        warnings.append("Hay enlaces sin destino real; completalos antes de publicar.")
    for field in doc.xpath("//input[not(@type='hidden') and not(@type='submit') and not(@type='button')] | //textarea | //select"):
        identity = field.get("id") or ""
        if field.get("aria-label") or field.get("aria-labelledby") or field.xpath("ancestor::label"):
            continue
        if identity and doc.xpath("//label[@for=$id]", id=identity):
            continue
        warnings.append("Hay campos de formulario sin etiqueta accesible.")
        break
    if not any((client.get(key) or "").strip() for key in ("telefono", "email", "sitio")):
        warnings.append("Falta un canal de contacto confirmado en la ficha del cliente.")
    return warnings


def quality_errors(s, landing_id, draft):
    content = draft["contenido"]
    with s.store("clientes", "landings", save=False) as db:
        row = s.find_landing(db, landing_id)
        client = s.find_client(db, row["cliente_id"])
    errors = []
    rules = s.read_rules()
    items = content.get("items") or []
    html = content.get("html") or ""
    errors.extend(s.structure_errors(items, rules))
    errors.extend(s.image_metadata_errors(html, rules))
    plan_id = content.get("plan_id") or row.get("plan_id") or client.get("plan")
    plan = next((p for p in (s.read_data("planes", {}).get("planes") or [])
                 if p.get("id") == plan_id), None)
    if not plan:
        errors.append("el plan no está configurado")
    elif len(s.content_sections(items)) > int(plan.get("secciones") or 0) and not draft.get("extras_aprobados"):
        errors.append("hay secciones adicionales sin aprobación comercial")
    public_html = s.publish_html(html, items, s.logo_ref(client))
    rendered = s.accessible_landing(public_html, content.get("nombre") or "",
                                    client.get("color_primario"), client)
    errors.extend(s.published_structure_errors(rendered))
    if s.client_type(client) == "real" and s.DEMO_PLACEHOLDERS.search(unescape(public_html)):
        errors.append("hay textos de ejemplo que deben reemplazarse")
    if s.client_type(client) == "real" and re.search(
            r"(?i)informaci[oó]n pendiente|contenido por completar|agreg[aá] informaci[oó]n",
            s.html_dom.document_fromstring(rendered).text_content()):
        errors.append("quedó contenido sin confirmar; reemplazá las indicaciones de ejemplo")
    if not str(content.get("descripcion") or "").strip():
        errors.append("falta la descripción para SEO")
    return errors


def move(s, landing_id, action, data):
    draft = read(s, landing_id)
    if not draft:
        raise s.ApiError(404, "No hay borrador para revisar.")
    if not isinstance(data, dict) or data.get("revision") != draft.get("revision"):
        raise s.ApiError(409, "El borrador cambió; recargá para continuar.")
    if action == "revision" and draft["estado"] == "borrador":
        errors = [error for error in quality_errors(s, landing_id, draft)
                  if error != "hay secciones adicionales sin aprobación comercial"]
        if errors:
            raise s.ApiError(400, "Corregí antes de revisar: " + "; ".join(errors[:8]))
        draft["estado"] = "revision"
    elif action == "aprobar" and draft["estado"] == "revision":
        if data.get("aprobar_adicionales") is True:
            draft["extras_aprobados"] = True
            draft["aprobacion_comercial_fecha"] = s.now_ms()
        errors = quality_errors(s, landing_id, draft)
        if errors:
            raise s.ApiError(400, "Corregí antes de aprobar: " + "; ".join(errors[:8]))
        draft["estado"] = "aprobado"
        draft["aprobada_revision"] = draft["revision"]
    elif action == "publicar" and draft["estado"] == "aprobado":
        if draft.get("aprobada_revision") != draft["revision"]:
            raise s.ApiError(409, "La versión aprobada ya no coincide con el borrador.")
        errors = quality_errors(s, landing_id, draft)
        if errors:
            raise s.ApiError(400, "Publicación bloqueada: " + "; ".join(errors[:8]))
        # ÚNICO punto que escribe la landing pública.
        published = s.save_landing(draft["contenido"], landing_id, origen="aprobado_por_equipo")
        s.FILES.delete("datos", path(landing_id))
        published["borrador_estado"] = "sin_borrador"
        return published
    else:
        raise s.ApiError(409, "Transición no permitida. Guardá, enviá a revisión y aprobá primero.")
    write(s, landing_id, draft)
    with s.store("landings") as db:
        row = s.find_landing(db, landing_id)
        row["borrador_estado"] = draft["estado"]
    return project(s, landing_id)


def discard(s, landing_id, data):
    """Descarta solo el borrador; conserva intacta la última publicación."""
    draft = read(s, landing_id)
    if not draft:
        raise s.ApiError(404, "No hay borrador para descartar.")
    if not isinstance(data, dict) or data.get("revision") != draft.get("revision"):
        raise s.ApiError(409, "El borrador cambió. Recargá antes de descartarlo.")
    with s.store("clientes", "landings") as db:
        row = s.find_landing(db, landing_id)
        if not row.get("html"):
            db["landings"].remove(row)
        else:
            row["borrador_estado"] = "sin_borrador"
            row["borrador_modulos"] = 0
    s.FILES.delete("datos", path(landing_id))
    return {"ok": True, "borrador_estado": "sin_borrador", "id": landing_id}


def qa_summary(s, landing_id):
    draft = read(s, landing_id)
    if not draft:
        raise s.ApiError(404, "Guardá un borrador antes de analizarlo.")
    content = draft["contenido"]
    errors = quality_errors(s, landing_id, draft)
    sections = len(s.content_sections(content.get("items") or []))
    plan_id = content.get("plan_id")
    plan = next((p for p in (s.read_data("planes", {}).get("planes") or [])
                 if p.get("id") == plan_id), None)
    with s.store("clientes", "landings", save=False) as db:
        client = s.find_client(db, s.find_landing(db, landing_id)["cliente_id"])
    warnings = content_warnings(s, content.get("html") or "", client)
    if not content.get("descripcion"):
        warnings.append("Revisá la descripción SEO.")
    html = content.get("html") or ""
    if len(html.encode("utf-8")) > 1_000_000:
        warnings.append("El documento HTML supera 1 MB; revisá imágenes incrustadas y peso de página.")
    return {"apto_para_revision": not errors, "errores": errors, "advertencias": warnings,
            "plan": plan.get("nombre") if plan else "",
            "secciones": sections, "limite": int(plan.get("secciones") or 0) if plan else 0,
            "extras_aprobados": bool(draft.get("extras_aprobados")),
            "estado": draft.get("estado"), "revision": draft.get("revision")}


def preview(s, landing_id):
    draft = read(s, landing_id)
    if not draft:
        raise s.ApiError(404, "No hay borrador para previsualizar.")
    with s.store("clientes", "landings", save=False) as db:
        row = s.find_landing(db, landing_id)
        client = s.find_client(db, row["cliente_id"])
    content = draft["contenido"]
    html = s.publish_html(content["html"], content["items"], s.logo_ref(client))
    return s.accessible_landing(html, content["nombre"], client.get("color_primario"), client)
