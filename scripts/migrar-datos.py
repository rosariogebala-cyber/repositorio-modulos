#!/usr/bin/env python3
"""Pasa los clientes y landings de Supabase a los archivos de data/ y genera las páginas de l/.

Uso, desde la carpeta Lanzate_modulos:
    python3 scripts/migrar-datos.py            usa Supabase (DATABASE_URL de ~/.lanzate/lanzate.env)
    python3 scripts/migrar-datos.py db.json    usa una copia local (data/db.json)

Para leer Supabase hace falta psycopg:  python3 -m pip install "psycopg[binary]"
Se puede correr más de una vez: reemplaza data/clientes.js y data/landings.js.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import server  # noqa: E402

PLAN_ANTERIOR = {"Base": "express", "Pro": "pro"}
CLIENT_KEYS = server.CLIENT_FIELDS + ("id", "slug", "privacidad_url", "terminos_url", "tipo_cliente",
                                      "plan", "plan_vence", "creado", "actualizado")
LANDING_KEYS = ("id", "cliente_id", "nombre", "slug", "items", "estilo", "ignorados", "descripcion",
                "animacion", "html", "portada", "creado", "actualizado")


def from_supabase():
    env = os.path.join(os.path.expanduser("~"), ".lanzate", "lanzate.env")
    url = os.environ.get("DATABASE_URL")
    if not url and os.path.isfile(env):
        for line in open(env, encoding="utf-8"):
            if line.strip().startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip("'\"")
    if not url:
        sys.exit("No encontré DATABASE_URL en ~/.lanzate/lanzate.env.")
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError:
        sys.exit('Falta psycopg. Instalalo con:  python3 -m pip install "psycopg[binary]"')
    with psycopg.connect(url, row_factory=dict_row, prepare_threshold=None, connect_timeout=20) as con:
        data = {t: con.execute("SELECT * FROM %s ORDER BY id" % t).fetchall() for t in ("clientes", "landings")}
        data["ajustes"] = con.execute("SELECT * FROM ajustes").fetchall()
        pending = con.execute("SELECT id, nombre FROM landings WHERE revision_estado = 'pendiente'").fetchall()
    for row in pending:
        print("Aviso: «%s» tenía cambios del cliente sin aprobar. Esos cambios no se pasan." % row["nombre"])
    return data


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else ""
    if source:
        path = source if os.path.isabs(source) else os.path.join(ROOT, "data", os.path.basename(source))
        data = json.load(open(path, encoding="utf-8"))
        print("Leyendo %s" % path)
    else:
        data = from_supabase()
        print("Leyendo Supabase")

    clients, logos = [], {}
    for row in data["clientes"]:
        client = {k: row.get(k, "") for k in CLIENT_KEYS}
        client["plan"] = PLAN_ANTERIOR.get(row.get("plan") or "", row.get("plan") or "")
        for key in ("plan_vence", "privacidad_url", "terminos_url", "tipo_cliente"):
            client[key] = client[key] or ""
        client["logo"] = ""
        if row.get("logo"):
            try:
                client["logo"] = server.write_logo(client["slug"], row["logo"])
                logos[row["id"]] = "/l/%s/%s" % (client["slug"], client["logo"])
            except server.ApiError as err:
                print("Aviso: no se pudo pasar el logo de %s (%s)." % (client["nombre"], err))
        clients.append(client)

    landings = []
    for row in data["landings"]:
        landing = {k: row.get(k) for k in LANDING_KEYS}
        html = landing["html"] or ""
        logo = logos.get(row["cliente_id"], "")
        html = re.sub(r"/api/clientes/%d/logo(\?v=\d+)?" % row["cliente_id"], logo, html)
        landing["html"] = html
        portada = landing.get("portada") or ""
        landing["portada"] = "" if portada.startswith("data:") else portada
        for key in ("items", "ignorados"):
            landing[key] = landing[key] or []
        for key in ("estilo", "descripcion", "animacion"):
            landing[key] = landing[key] or ""
        landing["ejemplo"] = False
        landings.append(landing)

    # Los ejemplos que hoy muestra el sitio de venta, con su captura (Lanzate_site/img/ejemplos/).
    shown = {"filo-barber-club": "barberia", "alma-estetica": "estetica", "rumbo-viajes": "viajes",
             "umbral-propiedades": "inmobiliaria", "babel-idiomas": "idiomas"}
    slugs = {c["id"]: c["slug"] for c in clients}
    for landing in landings:
        shot = shown.get(slugs.get(landing["cliente_id"]))
        if shot and landing["slug"].startswith("template-"):
            landing["ejemplo"] = True
            landing["captura"] = "img/ejemplos/%s.webp" % shot

    rules = next((a["valor"] for a in data.get("ajustes") or [] if a.get("clave") == "reglas"), None)
    with server._lock:
        server.write_data("clientes", clients)
        server.write_data("landings", landings)
        if rules:
            server.write_data("reglas", rules)
    server.sync_plans()
    count = server.render_all()
    print("Listo: %d clientes, %d landings y %d páginas en l/." % (len(clients), len(landings), count))


if __name__ == "__main__":
    main()
