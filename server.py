#!/usr/bin/env python3
"""Servidor local de la plataforma Nexoia.

Sirve el repositorio como `python3 -m http.server` y expone una API para
gestionar clientes y sus landings. Los datos viven en data/nexoia.db (SQLite)
y cada landing se publica en Templates/<cliente>/<landing>/ con su HTML y una
copia de los estilos, scripts e imágenes que usa.

Uso: python3 server.py [puerto]   (por defecto 8877)
"""

import base64
import json
import os
import posixpath
import re
import shutil
import sqlite3
import sys
import tempfile
import threading
import time
import unicodedata
from contextlib import contextmanager
from functools import partial
from html import escape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
MAQUETAS = os.path.join(ROOT, "maquetas")
ASSETS = os.path.join(ROOT, "assets")
TEMPLATES = os.path.join(ROOT, "Templates")
DATA = os.path.join(ROOT, "data")
DB_PATH = os.path.join(DATA, "nexoia.db")
LOGOS = os.path.join(DATA, "logos")
MAX_BODY = 8 * 1024 * 1024
MAX_LOGO = 2 * 1024 * 1024

DEMO_CLIENT = {
    "nombre": "Cliente de ejemplo",
    "contacto": "Ana Pérez",
    "email": "hola@example.com",
    "telefono": "+54 11 5555-0000",
    "rubro": "Ejemplo",
    "sitio": "",
    "color_primario": "#1b5e42",
    "color_secundario": "#e7f3ee",
    "notas": "Agrupa las landings creadas antes de la plataforma. Podés pasarlas a otro cliente desde el constructor.",
    "estado": "activo",
}
CLIENT_FIELDS = ("nombre", "contacto", "email", "telefono", "rubro", "sitio", "color_primario", "color_secundario", "notas", "estado")
COLOR_DEFAULTS = {"color_primario": "#1b5e42", "color_secundario": "#e7f3ee"}
ESTADOS = ("activo", "pausado")
LOGO_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg"}

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
HTML_REF = re.compile(r'((?:src|href)=")((?:img|css|js)/[^"#?]+|\.\./assets/[^"#?]+)(")')
URL_REF = re.compile(r"(url\(\s*['\"]?)([^'\")]+)(['\"]?\s*\))")

ROUTES = [
    (re.compile(r"^/api/clientes$"), "clientes"),
    (re.compile(r"^/api/clientes/(\d+)$"), "cliente"),
    (re.compile(r"^/api/landings$"), "landings"),
    (re.compile(r"^/api/landings/(\d+)$"), "landing"),
    (re.compile(r"^/api/landings/(\d+)/duplicate$"), "duplicate"),
]

LOCK = threading.RLock()


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def now_ms():
    return int(time.time() * 1000)


def slugify(text, fallback="landing"):
    text = unicodedata.normalize("NFD", text or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or fallback


def inside(path, base):
    return os.path.commonpath([path, base]) == base


# --- Base de datos -----------------------------------------------------------

@contextmanager
def tx():
    with LOCK:
        con = sqlite3.connect(DB_PATH)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys = ON")
        try:
            yield con
            con.commit()
        except Exception:
            con.rollback()
            raise
        finally:
            con.close()


def init_db():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(TEMPLATES, exist_ok=True)
    with tx() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS clientes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              slug TEXT NOT NULL UNIQUE,
              nombre TEXT NOT NULL,
              contacto TEXT NOT NULL DEFAULT '',
              email TEXT NOT NULL DEFAULT '',
              telefono TEXT NOT NULL DEFAULT '',
              rubro TEXT NOT NULL DEFAULT '',
              sitio TEXT NOT NULL DEFAULT '',
              logo TEXT NOT NULL DEFAULT '',
              color_primario TEXT NOT NULL DEFAULT '#1b5e42',
              color_secundario TEXT NOT NULL DEFAULT '#e7f3ee',
              notas TEXT NOT NULL DEFAULT '',
              estado TEXT NOT NULL DEFAULT 'activo',
              creado INTEGER NOT NULL,
              actualizado INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS landings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              cliente_id INTEGER NOT NULL REFERENCES clientes(id),
              nombre TEXT NOT NULL,
              slug TEXT NOT NULL,
              items TEXT NOT NULL DEFAULT '[]',
              creado INTEGER NOT NULL,
              actualizado INTEGER NOT NULL,
              UNIQUE (cliente_id, slug)
            );
            """
        )


# --- Clientes ----------------------------------------------------------------

def logo_url(row):
    if not row["logo"]:
        return ""
    path = os.path.join(ROOT, row["logo"])
    stamp = int(os.path.getmtime(path)) if os.path.isfile(path) else 0
    return "/" + row["logo"] + "?v=" + str(stamp)


def client_dict(row, count=None):
    data = {k: row[k] for k in row.keys() if k != "n"}
    data["logo_url"] = logo_url(row)
    data["carpeta"] = "Templates/" + row["slug"] + "/"
    if count is not None:
        data["landings"] = count
    return data


def get_client_row(con, client_id):
    row = con.execute("SELECT * FROM clientes WHERE id = ?", (client_id,)).fetchone()
    if not row:
        raise ApiError(404, "El cliente no existe")
    return row


def clean_client(data):
    values = {}
    for field in CLIENT_FIELDS:
        values[field] = str(data.get(field) or "").strip()
    if not values["nombre"]:
        raise ApiError(400, "El nombre del cliente es obligatorio")
    if values["email"] and not EMAIL_RE.match(values["email"]):
        raise ApiError(400, "Revisá el email: no tiene un formato válido")
    for field, default in COLOR_DEFAULTS.items():
        if not COLOR_RE.match(values[field]):
            values[field] = default
    if values["estado"] not in ESTADOS:
        values["estado"] = "activo"
    return values


def unique_client_slug(con, nombre, exclude_id=0):
    base = slugify(nombre, "cliente")
    slug, n = base, 2
    while (con.execute("SELECT 1 FROM clientes WHERE slug = ? AND id <> ?", (slug, exclude_id)).fetchone()
           or (not exclude_id and os.path.exists(os.path.join(TEMPLATES, slug)))):
        slug, n = "%s-%d" % (base, n), n + 1
    return slug


def save_logo(slug, data_url):
    match = re.match(r"^data:([\w/+.-]+);base64,(.+)$", data_url or "", re.S)
    if not match or match.group(1) not in LOGO_TYPES:
        raise ApiError(400, "El logo tiene que ser PNG, JPG, WEBP o SVG")
    raw = base64.b64decode(match.group(2))
    if len(raw) > MAX_LOGO:
        raise ApiError(400, "El logo pesa más de 2 MB")
    remove_logo(slug)
    os.makedirs(LOGOS, exist_ok=True)
    name = slug + "." + LOGO_TYPES[match.group(1)]
    with open(os.path.join(LOGOS, name), "wb") as fh:
        fh.write(raw)
    return "data/logos/" + name


def remove_logo(slug):
    for ext in LOGO_TYPES.values():
        path = os.path.join(LOGOS, slug + "." + ext)
        if os.path.isfile(path):
            os.remove(path)


def write_client_json(row):
    folder = os.path.join(TEMPLATES, row["slug"])
    os.makedirs(folder, exist_ok=True)
    data = {k: row[k] for k in row.keys() if k not in ("creado", "actualizado")}
    with open(os.path.join(folder, "cliente.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


def list_clients():
    with tx() as con:
        rows = con.execute(
            "SELECT c.*, (SELECT COUNT(*) FROM landings l WHERE l.cliente_id = c.id) AS n "
            "FROM clientes c ORDER BY c.nombre COLLATE NOCASE"
        ).fetchall()
        return [client_dict(r, r["n"]) for r in rows]


def get_client(client_id):
    with tx() as con:
        row = get_client_row(con, client_id)
        landings = con.execute(
            "SELECT l.*, c.nombre AS cliente, c.slug AS cliente_slug FROM landings l "
            "JOIN clientes c ON c.id = l.cliente_id WHERE l.cliente_id = ? ORDER BY l.actualizado DESC",
            (client_id,),
        ).fetchall()
        data = client_dict(row, len(landings))
        data["lista"] = [landing_dict(l) for l in landings]
        return data


def create_client(data):
    values = clean_client(data)
    with tx() as con:
        slug = unique_client_slug(con, values["nombre"])
        values["logo"] = save_logo(slug, data["logo_data"]) if data.get("logo_data") else ""
        stamp = now_ms()
        cols = list(values) + ["slug", "creado", "actualizado"]
        cur = con.execute(
            "INSERT INTO clientes (%s) VALUES (%s)" % (", ".join(cols), ", ".join("?" * len(cols))),
            list(values.values()) + [slug, stamp, stamp],
        )
        row = get_client_row(con, cur.lastrowid)
        write_client_json(row)
        return client_dict(row, 0)


def update_client(client_id, data):
    values = clean_client(data)
    with tx() as con:
        row = get_client_row(con, client_id)
        if data.get("logo_data"):
            values["logo"] = save_logo(row["slug"], data["logo_data"])
        elif data.get("logo_quitar"):
            remove_logo(row["slug"])
            values["logo"] = ""
        values["actualizado"] = now_ms()
        con.execute(
            "UPDATE clientes SET %s WHERE id = ?" % ", ".join(k + " = ?" for k in values),
            list(values.values()) + [client_id],
        )
        row = get_client_row(con, client_id)
        write_client_json(row)
        count = con.execute("SELECT COUNT(*) FROM landings WHERE cliente_id = ?", (client_id,)).fetchone()[0]
        return client_dict(row, count)


def delete_client(client_id):
    with tx() as con:
        row = get_client_row(con, client_id)
        count = con.execute("SELECT COUNT(*) FROM landings WHERE cliente_id = ?", (client_id,)).fetchone()[0]
        if count:
            raise ApiError(409, "«%s» tiene %d landing%s. Eliminalas o pasalas a otro cliente antes de borrarlo."
                           % (row["nombre"], count, "" if count == 1 else "s"))
        con.execute("DELETE FROM clientes WHERE id = ?", (client_id,))
        remove_logo(row["slug"])
        folder = os.path.join(TEMPLATES, row["slug"])
        meta = os.path.join(folder, "cliente.json")
        if os.path.isfile(meta):
            os.remove(meta)
        if os.path.isdir(folder) and not os.listdir(folder):
            os.rmdir(folder)
        return row["nombre"]


# --- Landings ----------------------------------------------------------------

def landing_folder(cliente_slug, slug):
    return os.path.join(TEMPLATES, cliente_slug, slug)


def landing_dict(row):
    rel = "Templates/%s/%s/" % (row["cliente_slug"], row["slug"])
    return {
        "id": row["id"],
        "cliente_id": row["cliente_id"],
        "cliente": row["cliente"],
        "cliente_slug": row["cliente_slug"],
        "nombre": row["nombre"],
        "slug": row["slug"],
        "items": json.loads(row["items"] or "[]"),
        "creado": row["creado"],
        "actualizado": row["actualizado"],
        "url": "/" + rel,
        "path": rel + "index.html",
        "disponible": os.path.isfile(os.path.join(ROOT, rel, "index.html")),
    }


def get_landing_row(con, landing_id):
    row = con.execute(
        "SELECT l.*, c.nombre AS cliente, c.slug AS cliente_slug FROM landings l "
        "JOIN clientes c ON c.id = l.cliente_id WHERE l.id = ?",
        (landing_id,),
    ).fetchone()
    if not row:
        raise ApiError(404, "La landing no existe")
    return row


def list_landings(client_id=None):
    with tx() as con:
        sql = ("SELECT l.*, c.nombre AS cliente, c.slug AS cliente_slug FROM landings l "
               "JOIN clientes c ON c.id = l.cliente_id")
        args = ()
        if client_id:
            sql += " WHERE l.cliente_id = ?"
            args = (client_id,)
        rows = con.execute(sql + " ORDER BY l.actualizado DESC", args).fetchall()
        return [landing_dict(r) for r in rows]


def get_landing(landing_id):
    with tx() as con:
        return landing_dict(get_landing_row(con, landing_id))


def target_for(source):
    """Ruta relativa dentro de la carpeta de la landing para un archivo fuente."""
    if inside(source, MAQUETAS):
        return os.path.relpath(source, MAQUETAS)
    if inside(source, ASSETS):
        return os.path.join("assets", os.path.relpath(source, ASSETS))
    return None


def copy_into(source, dest_dir, rel):
    out = os.path.join(dest_dir, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    shutil.copy2(source, out)


def copy_css(source, dest_dir, rel):
    with open(source, encoding="utf-8") as fh:
        css = fh.read()
    css_dir = os.path.dirname(source)
    rel_dir = os.path.dirname(rel)

    def repl(match):
        url = match.group(2).strip()
        if re.match(r"^(data:|https?:|//|#)", url):
            return match.group(0)
        src = os.path.normpath(os.path.join(css_dir, url))
        dest_rel = target_for(src)
        if not dest_rel or not os.path.isfile(src):
            return match.group(0)
        copy_into(src, dest_dir, dest_rel)
        new_url = posixpath.relpath(dest_rel.replace(os.sep, "/"), rel_dir.replace(os.sep, "/") or ".")
        return match.group(1) + new_url + match.group(3)

    css = URL_REF.sub(repl, css)
    out = os.path.join(dest_dir, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(css)


def build_site(dest, html):
    """Escribe index.html en dest y copia los archivos locales que referencia."""
    copied = set()

    def handle(ref):
        src = os.path.normpath(os.path.join(MAQUETAS, ref))
        dest_rel = target_for(src)
        if not dest_rel or not os.path.isfile(src):
            return None
        if dest_rel not in copied:
            copied.add(dest_rel)
            if src.endswith(".css"):
                copy_css(src, dest, dest_rel)
            else:
                copy_into(src, dest, dest_rel)
        return dest_rel.replace(os.sep, "/")

    def html_repl(match):
        new = handle(match.group(2))
        return match.group(1) + (new or match.group(2)) + match.group(3)

    def url_repl(match):
        url = match.group(2).strip()
        if not re.match(r"^(img/|\.\./assets/)", url):
            return match.group(0)
        new = handle(url)
        return match.group(1) + (new or url) + match.group(3)

    html = HTML_REF.sub(html_repl, html)
    html = URL_REF.sub(url_repl, html)
    with open(os.path.join(dest, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(html)


def write_landing_json(folder, nombre, slug, cliente, items):
    with open(os.path.join(folder, "landing.json"), "w", encoding="utf-8") as fh:
        json.dump({"nombre": nombre, "slug": slug, "cliente": cliente, "items": items}, fh, ensure_ascii=False, indent=2)


def save_landing(data, landing_id=None):
    nombre = str(data.get("nombre") or "").strip()
    html = str(data.get("html") or "")
    items = data.get("items") or []
    try:
        client_id = int(data.get("cliente_id") or 0)
    except (TypeError, ValueError):
        client_id = 0
    if not client_id:
        raise ApiError(400, "Elegí el cliente de la landing")
    if not nombre or not html:
        raise ApiError(400, "Faltan el nombre o el HTML")

    with tx() as con:
        client = get_client_row(con, client_id)
        old = get_landing_row(con, landing_id) if landing_id else None
        slug = slugify(nombre)
        clash = con.execute(
            "SELECT 1 FROM landings WHERE cliente_id = ? AND slug = ? AND id <> ?",
            (client_id, slug, landing_id or 0),
        ).fetchone()
        if clash:
            raise ApiError(409, "«%s» ya tiene una landing llamada así. Usá otro nombre o editá la existente." % client["nombre"])

        parent = os.path.join(TEMPLATES, client["slug"])
        os.makedirs(parent, exist_ok=True)
        tmp = tempfile.mkdtemp(prefix=".tmp-", dir=parent)
        try:
            build_site(tmp, html)
            write_landing_json(tmp, nombre, slug, client["slug"], items)
        except Exception:
            shutil.rmtree(tmp, ignore_errors=True)
            raise

        if old:
            previous = landing_folder(old["cliente_slug"], old["slug"])
            if os.path.isdir(previous):
                shutil.rmtree(previous)
        dest = os.path.join(parent, slug)
        if os.path.isdir(dest):
            shutil.rmtree(dest)
        os.rename(tmp, dest)

        stamp = now_ms()
        payload = json.dumps(items, ensure_ascii=False)
        if old:
            con.execute(
                "UPDATE landings SET cliente_id = ?, nombre = ?, slug = ?, items = ?, actualizado = ? WHERE id = ?",
                (client_id, nombre, slug, payload, stamp, landing_id),
            )
        else:
            landing_id = con.execute(
                "INSERT INTO landings (cliente_id, nombre, slug, items, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?)",
                (client_id, nombre, slug, payload, stamp, stamp),
            ).lastrowid
        write_client_json(client)
        return landing_dict(get_landing_row(con, landing_id))


def duplicate_landing(landing_id):
    with tx() as con:
        row = get_landing_row(con, landing_id)
        src = landing_folder(row["cliente_slug"], row["slug"])
        if not os.path.isdir(src):
            raise ApiError(404, "No se encontró la carpeta de la landing")
        n = 1
        while True:
            nombre = row["nombre"] + (" (copia)" if n == 1 else " (copia %d)" % n)
            slug = slugify(nombre)
            taken = con.execute("SELECT 1 FROM landings WHERE cliente_id = ? AND slug = ?", (row["cliente_id"], slug)).fetchone()
            if not taken and not os.path.exists(landing_folder(row["cliente_slug"], slug)):
                break
            n += 1
        dest = landing_folder(row["cliente_slug"], slug)
        shutil.copytree(src, dest)
        items = json.loads(row["items"] or "[]")
        write_landing_json(dest, nombre, slug, row["cliente_slug"], items)
        index = os.path.join(dest, "index.html")
        with open(index, encoding="utf-8") as fh:
            html = fh.read()
        html = re.sub(r"<title>.*?</title>", "<title>" + escape(nombre) + "</title>", html, count=1, flags=re.S)
        with open(index, "w", encoding="utf-8") as fh:
            fh.write(html)
        stamp = now_ms()
        new_id = con.execute(
            "INSERT INTO landings (cliente_id, nombre, slug, items, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?)",
            (row["cliente_id"], nombre, slug, row["items"], stamp, stamp),
        ).lastrowid
        return landing_dict(get_landing_row(con, new_id))


def delete_landing(landing_id):
    with tx() as con:
        row = get_landing_row(con, landing_id)
        folder = landing_folder(row["cliente_slug"], row["slug"])
        if os.path.isdir(folder):
            shutil.rmtree(folder)
        con.execute("DELETE FROM landings WHERE id = ?", (landing_id,))
        return row["nombre"]


# --- Migración de landings anteriores a la plataforma -------------------------

def migrate_legacy():
    """Pasa las carpetas Templates/<landing>/ sueltas al cliente de ejemplo."""
    legacy = [n for n in sorted(os.listdir(TEMPLATES))
              if os.path.isfile(os.path.join(TEMPLATES, n, "index.html"))]
    if not legacy:
        return
    with tx() as con:
        row = con.execute("SELECT * FROM clientes WHERE nombre = ?", (DEMO_CLIENT["nombre"],)).fetchone()
        if not row:
            slug = unique_client_slug(con, DEMO_CLIENT["nombre"])
            stamp = now_ms()
            cols = list(DEMO_CLIENT) + ["slug", "creado", "actualizado"]
            cur = con.execute(
                "INSERT INTO clientes (%s) VALUES (%s)" % (", ".join(cols), ", ".join("?" * len(cols))),
                list(DEMO_CLIENT.values()) + [slug, stamp, stamp],
            )
            row = get_client_row(con, cur.lastrowid)
        for name in legacy:
            src = os.path.join(TEMPLATES, name)
            meta = {}
            try:
                with open(os.path.join(src, "landing.json"), encoding="utf-8") as fh:
                    meta = json.load(fh)
            except (OSError, ValueError):
                pass
            nombre = meta.get("nombre") or meta.get("name") or name
            items = meta.get("items") or []
            base = slugify(nombre)
            slug, n = base, 2
            while (con.execute("SELECT 1 FROM landings WHERE cliente_id = ? AND slug = ?", (row["id"], slug)).fetchone()
                   or os.path.exists(landing_folder(row["slug"], slug))):
                slug, n = "%s-%d" % (base, n), n + 1
            os.makedirs(os.path.join(TEMPLATES, row["slug"]), exist_ok=True)
            dest = landing_folder(row["slug"], slug)
            os.rename(src, dest)
            write_landing_json(dest, nombre, slug, row["slug"], items)
            stamp = int(os.path.getmtime(os.path.join(dest, "index.html")) * 1000)
            con.execute(
                "INSERT INTO landings (cliente_id, nombre, slug, items, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?)",
                (row["id"], nombre, slug, json.dumps(items, ensure_ascii=False), stamp, stamp),
            )
            print("Landing «%s» asignada a «%s»: %s" % (nombre, row["nombre"], os.path.relpath(dest, ROOT)))
        write_client_json(row)


# --- HTTP ----------------------------------------------------------------------

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_BODY:
            raise ApiError(413, "Contenido vacío o demasiado grande")
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except ValueError:
            raise ApiError(400, "El contenido no es JSON válido")
        if not isinstance(data, dict):
            raise ApiError(400, "El contenido no es JSON válido")
        return data

    def api(self, method):
        url = urlsplit(self.path)
        for pattern, name in ROUTES:
            match = pattern.match(url.path)
            if match:
                break
        else:
            return False
        ident = int(match.group(1)) if match.groups() else None
        try:
            result = self.dispatch(method, name, ident, parse_qs(url.query))
        except ApiError as err:
            self.send_json(err.status, {"error": str(err)})
        except (OSError, sqlite3.Error) as err:
            self.send_json(500, {"error": "No se pudo completar la acción: %s" % err})
        else:
            self.send_json(200, result)
        return True

    def dispatch(self, method, name, ident, query):
        if name == "clientes":
            if method == "GET":
                return list_clients()
            if method == "POST":
                client = create_client(self.read_json())
                print("Cliente dado de alta: " + client["nombre"])
                return client
        if name == "cliente":
            if method == "GET":
                return get_client(ident)
            if method == "PUT":
                return update_client(ident, self.read_json())
            if method == "DELETE":
                print("Cliente eliminado: " + delete_client(ident))
                return {"ok": True}
        if name == "landings":
            if method == "GET":
                client = (query.get("cliente") or [""])[0]
                return list_landings(int(client) if client.isdigit() else None)
            if method == "POST":
                landing = save_landing(self.read_json())
                print("Landing guardada en " + landing["path"])
                return landing
        if name == "landing":
            if method == "GET":
                return get_landing(ident)
            if method == "PUT":
                landing = save_landing(self.read_json(), ident)
                print("Landing actualizada en " + landing["path"])
                return landing
            if method == "DELETE":
                print("Landing eliminada: " + delete_landing(ident))
                return {"ok": True}
        if name == "duplicate" and method == "POST":
            landing = duplicate_landing(ident)
            print("Landing duplicada en " + landing["path"])
            return landing
        raise ApiError(405, "Método no permitido")

    def do_GET(self):
        if not self.api("GET"):
            super().do_GET()

    def do_POST(self):
        if not self.api("POST"):
            self.send_json(404, {"error": "Ruta inexistente"})

    def do_PUT(self):
        if not self.api("PUT"):
            self.send_json(404, {"error": "Ruta inexistente"})

    def do_DELETE(self):
        if not self.api("DELETE"):
            self.send_json(404, {"error": "Ruta inexistente"})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8877
    init_db()
    migrate_legacy()
    handler = partial(Handler, directory=ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print("Nexoia en http://127.0.0.1:%d/maquetas/clientes.html" % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
