#!/usr/bin/env python3
"""Servidor de la plataforma Lanzate.

Sirve el repositorio como `python3 -m http.server` y expone una API para
gestionar clientes y sus landings. Los datos viven en Postgres (Supabase):
clientes, landings con su HTML, logos, vistas previas y reglas. Cada landing
se publica en /l/<cliente>/<landing>/.

En Vercel, api/index.py usa el mismo Handler. En local:
    python3 server.py [puerto]   (por defecto 8877)
La conexión y la clave de acceso salen de las variables DATABASE_URL y
LANZATE_CLAVE, o de ~/.lanzate/lanzate.env (fuera del repositorio).
"""

import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import unicodedata
from contextlib import contextmanager
from functools import partial
from html import escape, unescape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, unquote, urlsplit
from urllib.request import Request, urlopen

import psycopg
from lxml import etree, html as html_dom
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".lanzate")
LOCAL_ENV = os.path.join(CONFIG_DIR, "lanzate.env")
REGLAS_JSON = os.path.join(ROOT, "data", "reglas.json")


def load_local_env():
    if not os.path.isfile(LOCAL_ENV):
        return
    with open(LOCAL_ENV, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


load_local_env()

ON_VERCEL = bool(os.environ.get("VERCEL"))
MAX_BODY = 40 * 1024 * 1024
MAX_LOGO = 2 * 1024 * 1024
SESSION_DAYS = 30
COOKIE = "lz_sesion"

CLIENT_FIELDS = ("nombre", "contacto", "email", "telefono", "rubro", "sitio", "direccion", "horario",
                 "instagram", "facebook", "linkedin", "logo_modo", "color_primario", "color_secundario", "notas", "estado",
                 "ga4", "gtm", "meta_pixel")
TRACKING = {
    "ga4": (re.compile(r"^G-[A-Z0-9]{4,20}$"), "el código de Google Analytics empieza con G- (por ejemplo, G-AB12CD34EF)"),
    "gtm": (re.compile(r"^GTM-[A-Z0-9]{4,12}$"), "el código de Tag Manager empieza con GTM- (por ejemplo, GTM-AB12CD3)"),
    "meta_pixel": (re.compile(r"^\d{8,20}$"), "el píxel de Meta es un número de 15 o 16 dígitos"),
}
COLOR_DEFAULTS = {"color_primario": "#1b5e42", "color_secundario": "#e7f3ee"}
ESTADOS = ("activo", "pausado")
LOGO_MODOS = ("imagen", "imagen-texto", "texto")
LOGO_TYPES = ("image/png", "image/jpeg", "image/webp", "image/svg+xml")

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
HTML_REF = re.compile(r'((?:src|href)=")((?:img|css|js)/[^"#?]+|\.\./assets/[^"#?]+)(")')
URL_REF = re.compile(r"(url\(\s*(?:&quot;|['\"])?)((?:img|css|js)/[^'\")&]+|\.\./assets/[^'\")&]+)")
COVER_RE = re.compile(r"""(?:src="|url\(\s*(?:&quot;|['"])?)(/(?:maquetas|assets)/(?!modulos/)[^"')&]+\.(?:jpe?g|png|webp))""", re.I)
IMG_TOKEN = re.compile(r"lzimg:(\d+):(\d+)")

ROUTES = [
    (re.compile(r"^/api/sesion$"), "sesion"),
    (re.compile(r"^/api/login$"), "login"),
    (re.compile(r"^/api/logout$"), "logout"),
    (re.compile(r"^/api/clientes$"), "clientes"),
    (re.compile(r"^/api/clientes/(\d+)$"), "cliente"),
    (re.compile(r"^/api/landings$"), "landings"),
    (re.compile(r"^/api/landings/(\d+)$"), "landing"),
    (re.compile(r"^/api/landings/(\d+)/duplicate$"), "duplicate"),
    (re.compile(r"^/api/landings/(\d+)/preview$"), "preview"),
    (re.compile(r"^/api/reglas$"), "reglas"),
    (re.compile(r"^/api/ia$"), "ia"),
    (re.compile(r"^/api/consultas$"), "consultas"),
    (re.compile(r"^/api/consultas/nueva$"), "consulta-nueva"),
    (re.compile(r"^/api/consultas/(\d+)$"), "consulta"),
]
PUBLIC_ROUTES = ("sesion", "login", "logout", "preview", "consulta-nueva")
PANEL_PAGES = {
    "/maquetas/" + name + ".html"
    for name in ("constructor", "landings", "clientes", "cliente", "consultas", "reglas")
}
LANDING_PAGE = re.compile(r"^/(?:l|Templates)/([a-z0-9-]+)/([a-z0-9-]+)/?$")


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def now_ms():
    return int(time.time() * 1000)


def slugify(text, fallback="landing"):
    text = unicodedata.normalize("NFD", text or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or fallback


# --- Base de datos (Postgres en Supabase) --------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
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
  creado BIGINT NOT NULL,
  actualizado BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS landings (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id),
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  estilo TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL DEFAULT '',
  portada TEXT NOT NULL DEFAULT '',
  preview TEXT NOT NULL DEFAULT '',
  creado BIGINT NOT NULL,
  actualizado BIGINT NOT NULL,
  UNIQUE (cliente_id, slug)
);
CREATE TABLE IF NOT EXISTS ajustes (
  clave TEXT PRIMARY KEY,
  valor JSONB NOT NULL
);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS privacidad_url TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS terminos_url TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_cliente TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS instagram TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS facebook TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS linkedin TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logo_modo TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ga4 TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS gtm TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS meta_pixel TEXT NOT NULL DEFAULT '';
ALTER TABLE landings ADD COLUMN IF NOT EXISTS ignorados JSONB NOT NULL DEFAULT '[]';
ALTER TABLE landings ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT '';
ALTER TABLE landings ADD COLUMN IF NOT EXISTS animacion TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS consultas (
  id BIGSERIAL PRIMARY KEY,
  landing_id BIGINT NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'contacto',
  datos JSONB NOT NULL DEFAULT '{}',
  origen TEXT NOT NULL DEFAULT '',
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  creado BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS consultas_landing ON consultas (landing_id, creado DESC);
ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE landings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes ENABLE ROW LEVEL SECURITY;
"""

_schema_ready = False


@contextmanager
def tx():
    """Conexión por pedido; confirma al salir bien y deshace si hay error."""
    global _schema_ready
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise ApiError(500, "Falta la conexión con la base de datos (DATABASE_URL).")
    try:
        con = psycopg.connect(url, row_factory=dict_row, prepare_threshold=None, connect_timeout=15)
    except psycopg.OperationalError:
        raise ApiError(503, "No se pudo conectar con la base de datos. Probá de nuevo en unos segundos.")
    with con:
        if not _schema_ready:
            con.execute(SCHEMA)
            _schema_ready = True
        yield con


def read_rules():
    with tx() as con:
        row = con.execute("SELECT valor FROM ajustes WHERE clave = 'reglas'").fetchone()
    if row and isinstance(row["valor"], dict):
        return row["valor"]
    try:
        with open(REGLAS_JSON, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_rules(data):
    if not isinstance(data.get("textos"), dict) or not isinstance(data.get("imagenes"), dict):
        raise ApiError(400, "Las reglas no tienen el formato esperado")
    data["actualizado"] = now_ms()
    with tx() as con:
        con.execute(
            "INSERT INTO ajustes (clave, valor) VALUES ('reglas', %s) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor",
            (Jsonb(data),),
        )
    return data


# --- Sesión ----------------------------------------------------------------------

def access_key():
    return os.environ.get("LANZATE_CLAVE") or ""


def session_secret():
    return (os.environ.get("LANZATE_SECRETO") or ("lanzate:" + access_key())).encode("utf-8")


def make_session():
    expires = str(int(time.time()) + SESSION_DAYS * 86400)
    sig = hmac.new(session_secret(), expires.encode(), hashlib.sha256).hexdigest()
    return expires + "." + sig


def valid_session(value):
    try:
        expires, sig = value.split(".", 1)
        good = hmac.new(session_secret(), expires.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, good) and int(expires) > time.time()
    except (ValueError, AttributeError):
        return False


def login_required():
    """En Vercel siempre hace falta la clave; en local, solo si está configurada."""
    return ON_VERCEL or bool(access_key())


# --- Clientes ----------------------------------------------------------------

def client_type(row):
    saved = row.get("tipo_cliente")
    if saved in ("real", "demo"):
        return saved
    domain = row["email"].strip().lower().rpartition("@")[2]
    return "demo" if domain in ("example.com", "example.net", "example.org") else "real"


def client_dict(row, count=None):
    data = {k: row[k] for k in row.keys() if k not in ("n", "logo")}
    data["tipo_cliente"] = client_type(row)
    data["logo_url"] = row["logo"]
    data["carpeta"] = "/l/" + row["slug"] + "/"
    if count is not None:
        data["landings"] = count
    return data


def get_client_row(con, client_id):
    row = con.execute("SELECT * FROM clientes WHERE id = %s", (client_id,)).fetchone()
    if not row:
        raise ApiError(404, "El cliente no existe")
    return row


def legal_url(value):
    if not value or any(char.isspace() or ord(char) < 32 for char in value):
        return ""
    try:
        parsed = urlsplit(value)
        if parsed.scheme in ("http", "https") and parsed.hostname and not parsed.username and not parsed.password:
            return value
    except ValueError:
        pass
    return ""


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
    if values["logo_modo"] not in LOGO_MODOS:
        values["logo_modo"] = ""
    if values["estado"] not in ESTADOS:
        values["estado"] = "activo"
    for field, (pattern, hint) in TRACKING.items():
        value = re.sub(r"\s+", "", values[field]).upper()
        if value and not pattern.match(value):
            raise ApiError(400, "Revisá la medición: " + hint)
        values[field] = value
    if "tipo_cliente" in data:
        if data["tipo_cliente"] not in ("real", "demo"):
            raise ApiError(400, "Elegí si el cliente es real o demo")
        values["tipo_cliente"] = data["tipo_cliente"]
    for key, label in (("privacidad_url", "Privacidad"), ("terminos_url", "Términos")):
        if key in data:
            value = str(data[key] or "").strip()
            values[key] = legal_url(value)
            if value and not values[key]:
                raise ApiError(400, "Ingresá un enlace web válido para " + label)
    return values


def unique_client_slug(con, nombre, exclude_id=0):
    base = slugify(nombre, "cliente")
    slug, n = base, 2
    while con.execute("SELECT 1 FROM clientes WHERE slug = %s AND id <> %s", (slug, exclude_id)).fetchone():
        slug, n = "%s-%d" % (base, n), n + 1
    return slug


def clean_logo(data_url):
    match = re.match(r"^data:([\w/+.-]+);base64,(.+)$", data_url or "", re.S)
    if not match or match.group(1) not in LOGO_TYPES:
        raise ApiError(400, "El logo tiene que ser PNG, JPG, WEBP o SVG")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except ValueError:
        raise ApiError(400, "No se pudo leer el logo")
    if len(raw) > MAX_LOGO:
        raise ApiError(400, "El logo pesa más de 2 MB")
    return "data:%s;base64,%s" % (match.group(1), base64.b64encode(raw).decode())


def list_clients():
    with tx() as con:
        rows = con.execute(
            "SELECT c.*, (SELECT COUNT(*) FROM landings l WHERE l.cliente_id = c.id) AS n "
            "FROM clientes c ORDER BY lower(c.nombre)"
        ).fetchall()
        return [client_dict(r, r["n"]) for r in rows]


def get_client(client_id):
    with tx() as con:
        row = get_client_row(con, client_id)
        landings = con.execute(LANDING_SELECT + " WHERE l.cliente_id = %s ORDER BY l.actualizado DESC", (client_id,)).fetchall()
        data = client_dict(row, len(landings))
        data["lista"] = [landing_dict(l) for l in landings]
        return data


def create_client(data):
    values = clean_client(data)
    with tx() as con:
        values["slug"] = unique_client_slug(con, values["nombre"])
        values["logo"] = clean_logo(data["logo_data"]) if data.get("logo_data") else ""
        values["creado"] = values["actualizado"] = now_ms()
        cols = list(values)
        new_id = con.execute(
            "INSERT INTO clientes (%s) VALUES (%s) RETURNING id" % (", ".join(cols), ", ".join(["%s"] * len(cols))),
            list(values.values()),
        ).fetchone()["id"]
        return client_dict(get_client_row(con, new_id), 0)


def update_client(client_id, data):
    values = clean_client(data)
    with tx() as con:
        get_client_row(con, client_id)
        if data.get("logo_data"):
            values["logo"] = clean_logo(data["logo_data"])
        elif data.get("logo_quitar"):
            values["logo"] = ""
        values["actualizado"] = now_ms()
        con.execute(
            "UPDATE clientes SET %s WHERE id = %%s" % ", ".join(k + " = %s" for k in values),
            list(values.values()) + [client_id],
        )
        count = con.execute("SELECT COUNT(*) AS n FROM landings WHERE cliente_id = %s", (client_id,)).fetchone()["n"]
        return client_dict(get_client_row(con, client_id), count)


def delete_client(client_id):
    with tx() as con:
        row = get_client_row(con, client_id)
        count = con.execute("SELECT COUNT(*) AS n FROM landings WHERE cliente_id = %s", (client_id,)).fetchone()["n"]
        if count:
            raise ApiError(409, "«%s» tiene %d landing%s. Eliminalas o pasalas a otro cliente antes de borrarlo."
                           % (row["nombre"], count, "" if count == 1 else "s"))
        con.execute("DELETE FROM clientes WHERE id = %s", (client_id,))
        return row["nombre"]


# --- Landings ----------------------------------------------------------------

LANDING_SELECT = (
    "SELECT l.id, l.cliente_id, l.nombre, l.slug, l.items, l.estilo, l.ignorados, l.descripcion, l.animacion, l.portada, l.creado, l.actualizado, "
    "(l.preview <> '') AS tiene_preview, (l.html <> '') AS disponible, "
    "c.nombre AS cliente, c.slug AS cliente_slug, "
    "(SELECT COUNT(*) FROM consultas q WHERE q.landing_id = l.id) AS consultas, "
    "(SELECT COUNT(*) FROM consultas q WHERE q.landing_id = l.id AND NOT q.leida) AS consultas_nuevas "
    "FROM landings l JOIN clientes c ON c.id = l.cliente_id"
)


def landing_dict(row):
    url = "/l/%s/%s/" % (row["cliente_slug"], row["slug"])
    preview = "/api/landings/%d/preview?v=%d" % (row["id"], row["actualizado"]) if row["tiene_preview"] else row["portada"]
    return {
        "preview": preview,
        "portada": row["portada"],
        "descripcion": row.get("descripcion") or "",
        "animacion": row.get("animacion") or "",
        "id": row["id"],
        "cliente_id": row["cliente_id"],
        "cliente": row["cliente"],
        "cliente_slug": row["cliente_slug"],
        "nombre": row["nombre"],
        "slug": row["slug"],
        "items": row["items"] or [],
        "estilo": row["estilo"],
        "ignorados": row["ignorados"] or [],
        "consultas": row.get("consultas") or 0,
        "consultas_nuevas": row.get("consultas_nuevas") or 0,
        "creado": row["creado"],
        "actualizado": row["actualizado"],
        "url": url,
        "path": url.lstrip("/"),
        "disponible": row["disponible"],
    }


def get_landing_row(con, landing_id):
    row = con.execute(LANDING_SELECT + " WHERE l.id = %s", (landing_id,)).fetchone()
    if not row:
        raise ApiError(404, "La landing no existe")
    return row


def list_landings(client_id=None):
    with tx() as con:
        if client_id:
            rows = con.execute(LANDING_SELECT + " WHERE l.cliente_id = %s ORDER BY l.actualizado DESC", (client_id,)).fetchall()
        else:
            rows = con.execute(LANDING_SELECT + " ORDER BY l.actualizado DESC").fetchall()
        return [landing_dict(r) for r in rows]


def get_landing(landing_id):
    with tx() as con:
        return landing_dict(get_landing_row(con, landing_id))


def publish_html(html, items, logo):
    """Deja el HTML listo para servir desde /l/: rutas absolutas y las imágenes en su lugar."""
    html = HTML_REF.sub(lambda m: m.group(1) + absolute_ref(m.group(2)) + m.group(3), html)
    html = URL_REF.sub(lambda m: m.group(1) + absolute_ref(m.group(2)), html)

    def image(match):
        try:
            return items[int(match.group(1))]["imagenes"][match.group(2)]["src"]
        except (IndexError, KeyError, TypeError, ValueError):
            return match.group(0)

    html = IMG_TOKEN.sub(image, html)
    return html.replace("lzlogo:", logo) if logo else html


def absolute_ref(ref):
    return "/assets/" + ref[len("../assets/"):] if ref.startswith("../assets/") else "/maquetas/" + ref


def cover_of(html):
    match = COVER_RE.search(html)
    return match.group(1) if match else ""


DEMO_PLACEHOLDERS = re.compile(
    r"\bexample\.(?:com|net|org)\b|\b5491123456789\b|\b2345\s+6789\b|"
    r"\b(?:marca ejemplo|calle ejemplo|lorem ipsum)\b",
    re.IGNORECASE,
)


def save_landing(data, landing_id=None):
    nombre = str(data.get("nombre") or "").strip()
    html = str(data.get("html") or "")
    items = data.get("items") or []
    estilo = str(data.get("estilo") or "")
    try:
        client_id = int(data.get("cliente_id") or 0)
    except (TypeError, ValueError):
        client_id = 0
    if not client_id:
        raise ApiError(400, "Elegí el cliente de la landing")
    if not nombre or not html:
        raise ApiError(400, "Faltan el nombre o el HTML")
    if not isinstance(items, list):
        raise ApiError(400, "Los módulos no tienen el formato esperado")
    ignorados = data.get("ignorados") or []
    ignorados = [str(k)[:300] for k in ignorados][:200] if isinstance(ignorados, list) else []
    descripcion = " ".join(str(data.get("descripcion") or "").split())[:300]
    animacion = str(data.get("animacion") or "")
    if animacion not in ("", "suave", "marcada"):
        animacion = ""

    with tx() as con:
        client = get_client_row(con, client_id)
        if landing_id:
            get_landing_row(con, landing_id)
        slug = slugify(nombre)
        clash = con.execute(
            "SELECT 1 FROM landings WHERE cliente_id = %s AND slug = %s AND id <> %s",
            (client_id, slug, landing_id or 0),
        ).fetchone()
        if clash:
            raise ApiError(409, "«%s» ya tiene una landing llamada así. Usá otro nombre o editá la existente." % client["nombre"])
        html = publish_html(html, items, client["logo"])
        if client_type(client) == "real":
            placeholder = DEMO_PLACEHOLDERS.search(unescape(html))
            if placeholder:
                raise ApiError(400, "Reemplazá el dato de ejemplo «%s» antes de publicar." % placeholder.group())
        stamp = now_ms()
        values = (client_id, nombre, slug, Jsonb(items), estilo, Jsonb(ignorados), descripcion, animacion, html, cover_of(html), stamp)
        if landing_id:
            con.execute(
                "UPDATE landings SET cliente_id = %s, nombre = %s, slug = %s, items = %s, estilo = %s, ignorados = %s, descripcion = %s, animacion = %s, html = %s, "
                "portada = %s, preview = '', actualizado = %s WHERE id = %s",
                values + (landing_id,),
            )
        else:
            landing_id = con.execute(
                "INSERT INTO landings (cliente_id, nombre, slug, items, estilo, ignorados, descripcion, animacion, html, portada, creado, actualizado) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                values + (stamp,),
            ).fetchone()["id"]
        return landing_dict(get_landing_row(con, landing_id))


def duplicate_landing(landing_id):
    with tx() as con:
        row = con.execute("SELECT * FROM landings WHERE id = %s", (landing_id,)).fetchone()
        if not row:
            raise ApiError(404, "La landing no existe")
        n = 1
        while True:
            nombre = row["nombre"] + (" (copia)" if n == 1 else " (copia %d)" % n)
            slug = slugify(nombre)
            if not con.execute("SELECT 1 FROM landings WHERE cliente_id = %s AND slug = %s", (row["cliente_id"], slug)).fetchone():
                break
            n += 1
        html = re.sub(r"<title>.*?</title>", lambda m: "<title>" + escape(nombre) + "</title>", row["html"], count=1, flags=re.S)
        stamp = now_ms()
        new_id = con.execute(
            "INSERT INTO landings (cliente_id, nombre, slug, items, estilo, ignorados, descripcion, animacion, html, portada, preview, creado, actualizado) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (row["cliente_id"], nombre, slug, Jsonb(row["items"]), row["estilo"], Jsonb(row["ignorados"] or []), row["descripcion"], row["animacion"], html, row["portada"], row["preview"], stamp, stamp),
        ).fetchone()["id"]
        return landing_dict(get_landing_row(con, new_id))


def delete_landing(landing_id):
    with tx() as con:
        row = get_landing_row(con, landing_id)
        con.execute("DELETE FROM landings WHERE id = %s", (landing_id,))
        return row["nombre"]


def landing_preview(landing_id):
    with tx() as con:
        row = con.execute("SELECT preview FROM landings WHERE id = %s", (landing_id,)).fetchone()
    match = re.match(r"^data:(image/[\w+.-]+);base64,(.+)$", (row or {}).get("preview") or "", re.S)
    if not match:
        return None
    return match.group(1), base64.b64decode(match.group(2))


def accessible_button_color(color):
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color or ""):
        return None
    rgb = tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))

    def linear(channel):
        value = channel / 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

    for percent in range(100, -1, -1):
        candidate = tuple(round(channel * percent / 100) for channel in rgb)
        luminance = sum(weight * linear(channel) for weight, channel in zip((0.2126, 0.7152, 0.0722), candidate))
        if 1.05 / (luminance + 0.05) >= 4.5:
            return "#%02x%02x%02x" % candidate


def accessible_landing(markup, title, legacy_jimena=False, primary_color=None, legal_links=None):
    document = html_dom.document_fromstring(markup)
    body = document.find("body")
    if body is None or "landing-page" not in body.get("class", "").split():
        return markup

    if legacy_jimena:
        assets = "https://rosariogebala-cyber.github.io/jimenavidal/assets/img/"
        for image in document.xpath('//img[starts-with(@src, "/maquetas/img/jimena/faq/")]'):
            image.set("src", assets + "faq/" + image.get("src").rsplit("/", 1)[-1])
        for frame in document.xpath('//article[@data-oferta]/div[button/img[starts-with(@src, "/api/landings/26/ofertas/")]]'):
            frame.getparent().remove(frame)
        for meta in document.xpath('//meta[@property="og:image" and contains(@content, "/maquetas/img/jimena/compartir.jpg")]'):
            meta.set("content", assets + "compartir.jpg")
        for carousel in document.xpath('//*[@id="heroJimena"]'):
            carousel.attrib.pop("data-bs-ride", None)
            carousel.set("data-bs-interval", "false")
            for video in carousel.xpath(".//video"):
                video.attrib.pop("autoplay", None)
                video.attrib.pop("loop", None)
        style = etree.SubElement(document.find("head"), "style")
        style.text = (
            ":root{--green:#c2410c}"
            "#heroJimena .nx-hero-slide{background-image:url("
            + assets + "compartir.jpg)}"
            "@media(max-width:767.98px){#heroJimena .nx-hero-slide .container{"
            "width:100%;min-width:0;padding-inline:24px;margin-inline:auto}"
            "#heroJimena .nx-hero-slide .container>div{max-width:100%;margin-inline:0}}"
        )

    cta_color = accessible_button_color("#c2410c" if legacy_jimena else primary_color)
    if cta_color:
        style = etree.SubElement(document.find("head"), "style")
        style.text = ".landing-page .btn-nx:not(:hover):not(:active){background-color:" + cta_color + ";color:#fff}"
    for trap in body.xpath('.//form//input[@name="web" and @aria-hidden="true"]'):
        trap.set("hidden", "")
        trap.set("tabindex", "-1")

    for module in body.xpath('.//section[@data-module]'):
        module_id = module.get("data-module")
        if module_id.startswith(("hero", "navegacion", "whatsapp")):
            continue
        for image in module.xpath(".//img"):
            if not image.get("loading") and image.get("fetchpriority") != "high":
                image.set("loading", "lazy")
            if not image.get("decoding"):
                image.set("decoding", "async")

    for link in body.xpath('.//footer//a[starts-with(@href, "#footer")]'):
        label = " ".join(link.text_content().casefold().split())
        key = {"privacidad": "privacidad_url", "términos": "terminos_url"}.get(label)
        if not key:
            continue
        destination = legal_url((legal_links or {}).get(key, ""))
        if destination:
            link.set("href", destination)
        else:
            tail = re.sub(r"^\s*[·|]\s*", "", link.tail or "")
            previous = link.getprevious()
            parent = link.getparent()
            if previous is None:
                parent.text = (parent.text or "") + tail
            else:
                separator = previous.tail or ""
                if link.getnext() is None:
                    separator = re.sub(r"\s*[·|]\s*$", "", separator)
                previous.tail = separator + tail
            parent.remove(link)

    ids = set(document.xpath("//@id"))

    def unique_id(base):
        value = base
        number = 2
        while value in ids:
            value = f"{base}-{number}"
            number += 1
        ids.add(value)
        return value

    main = body.find("main")
    if main is None:
        modules = body.xpath("./section[@data-module]")
        content = [module for module in modules
                   if not module.get("data-module").startswith(("navegacion", "whatsapp", "footer"))]
        if content:
            first, last = body.index(content[0]), body.index(content[-1])
            main = etree.Element("main")
            for element in list(body)[first:last + 1]:
                main.append(element)
            body.insert(first, main)
        else:
            return markup

    if not main.get("id"):
        main.set("id", unique_id("contenido-principal"))
    main.set("tabindex", "-1")
    if not body.xpath('./a[contains(concat(" ", normalize-space(@class), " "), " lib-skip-link ")]'):
        skip = etree.Element("a", {"class": "lib-skip-link", "href": "#" + main.get("id")})
        skip.text = "Saltar al contenido"
        body.insert(0, skip)

    headings = main.xpath(".//h1")
    if not headings:
        candidates = main.xpath(".//section[starts-with(@data-module, 'hero')][1]//h2")
        heading = next((h for h in candidates
                        if not h.xpath("ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' carousel-item ')]")), None)
        if heading is None:
            heading = etree.Element("h1", {"class": "visually-hidden"})
            heading.text = title
            main.insert(0, heading)
        else:
            heading.tag = "h1"
    for heading in headings[1:]:
        heading.tag = "h2"

    for index, nav in enumerate(body.xpath(".//nav"), 1):
        if not nav.get("aria-label") and not nav.get("aria-labelledby"):
            label = "Navegación del pie" if nav.xpath("ancestor::footer") else "Navegación"
            nav.set("aria-label", f"{label} {index}")

    for section in main.xpath("./section[@data-module]"):
        if section.get("aria-label") or section.get("aria-labelledby"):
            continue
        headings = section.xpath(".//h1|.//h2[not(contains(concat(' ', normalize-space(@class), ' '), ' modal-title '))]")
        if headings:
            heading = headings[0]
            if not heading.get("id"):
                heading.set("id", unique_id((section.get("id") or "seccion") + "-titulo"))
            section.set("aria-labelledby", heading.get("id"))
    return "<!DOCTYPE html>\n" + html_dom.tostring(document, encoding="unicode")


def landing_page(cliente_slug, slug, origin=""):
    with tx() as con:
        row = con.execute(
            "SELECT l.id, l.nombre, l.html, l.descripcion, l.portada, l.actualizado, (l.preview <> '') AS tiene_preview, "
            "c.nombre AS cliente, c.logo, c.direccion, c.telefono, c.email, c.tipo_cliente, c.color_primario, c.privacidad_url, c.terminos_url, c.ga4, c.gtm, c.meta_pixel "
            "FROM landings l JOIN clientes c ON c.id = l.cliente_id "
            "WHERE c.slug = %s AND l.slug = %s",
            (cliente_slug, slug),
        ).fetchone()
    if not row or not row["html"]:
        return None
    head = '<meta name="lz-landing" content="%d">' % row["id"] + share_head(row, origin, "/l/%s/%s/" % (cliente_slug, slug))
    html = row["html"].replace("</head>", head + "</head>", 1)
    html = accessible_landing(
        html, row["nombre"],
        legacy_jimena=row["id"] == 26 and cliente_slug == "jimena-vidal",
        primary_color=row["color_primario"],
        legal_links=row,
    )
    return add_tracking_consent(html, row)


def auto_description(html):
    """Si no cargaron descripción, usa el primer párrafo que sigue al título principal."""
    after = html.split("</h1>", 1)[1] if "</h1>" in html else html.split("<body", 1)[-1]
    match = re.search(r"<p\b[^>]*>(.*?)</p>", after, re.S)
    text = " ".join(unescape(re.sub(r"<[^>]+>", " ", match.group(1))).split()) if match else ""
    if len(text) > 160:
        text = text[:157].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    return text


def share_head(row, origin, path):
    """Lo que muestran Google y las redes al compartir el link."""
    desc = row["descripcion"] or auto_description(row["html"])
    if row["portada"]:
        image = origin + row["portada"]
    elif row["tiene_preview"]:
        image = "%s/api/landings/%d/preview?v=%d" % (origin, row["id"], row["actualizado"])
    else:
        image = ""
    tags = [
        ("name", "description", desc),
        ("property", "og:type", "website"),
        ("property", "og:title", row["nombre"]),
        ("property", "og:description", desc),
        ("property", "og:site_name", row["cliente"]),
        ("property", "og:url", origin + path),
        ("property", "og:image", image),
        ("name", "twitter:card", "summary_large_image" if image else "summary"),
    ]
    if client_type(row) == "demo":
        tags.append(("name", "robots", "noindex, nofollow"))
    out = "".join('<meta %s="%s" content="%s">' % (attr, key, escape(value)) for attr, key, value in tags if value)
    icon = row["logo"] or "/assets/favicon-lanzate.svg"
    return out + '<link rel="icon" href="%s"><link rel="canonical" href="%s">' % (
        escape(icon, quote=True), escape(origin + path, quote=True)
    ) + local_business_head(row, origin + path)


def local_business_head(row, url):
    address = row["direccion"].strip()
    if not address or "ejemplo" in address.casefold() or client_type(row) == "demo":
        return ""
    business = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": row["cliente"],
        "url": url,
        "address": {"@type": "PostalAddress", "streetAddress": address},
    }
    if re.fullmatch(r"\+[1-9]\d{7,14}", row["telefono"]):
        business["telephone"] = row["telefono"]
    payload = json.dumps(business, ensure_ascii=False).replace("<", "\\u003c")
    return '<script type="application/ld+json">%s</script>' % payload


def tracking_scripts(c):
    """Códigos de medición del cliente; se validan al guardarlos (solo letras, números y guiones)."""
    out = ""
    if c["gtm"]:
        out += ("<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});"
                "var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;"
                "j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})"
                "(window,document,'script','dataLayer','%s');</script>" % c["gtm"])
    if c["ga4"]:
        out += ('<script async src="https://www.googletagmanager.com/gtag/js?id=%s"></script>'
                "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}"
                "gtag('js',new Date());gtag('config','%s');</script>" % (c["ga4"], c["ga4"]))
    if c["meta_pixel"]:
        out += ("<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?"
                "n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;"
                "n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];"
                "s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');"
                "fbq('init','%s');fbq('track','PageView');</script>" % c["meta_pixel"])
    return out


TRACKING_CONSENT_UI = """
<template data-lz-tracking>__TRACKING__</template>
<style>
[data-lz-consent]{position:fixed;inset:auto 1rem 1rem;z-index:1090;max-width:34rem;padding:1rem;border:1px solid #555;border-radius:.75rem;background:#fff;color:#171717;box-shadow:0 4px 24px #0003}
[data-lz-consent][hidden]{display:none}
[data-lz-consent] p{margin:0 0 .75rem}
[data-lz-consent] div{display:flex;flex-wrap:wrap;gap:.5rem}
[data-lz-consent] button,[data-lz-consent-open]{min-height:44px;padding:.5rem .75rem;border:1px solid #222;border-radius:.35rem;background:#fff;color:#171717}
[data-lz-consent] button:focus-visible,[data-lz-consent-open]:focus-visible{outline:3px solid #2358a0;outline-offset:2px}
[data-lz-consent-open]{display:block;margin:1rem}
</style>
<button type="button" data-lz-consent-open>Preferencias de cookies</button>
<section data-lz-consent aria-label="Preferencias de cookies" hidden>
<p>Podés permitir o rechazar las cookies de medición y marketing. Tu elección se puede cambiar desde Preferencias de cookies.</p>
<div>
<button type="button" data-choice="denied">Rechazar</button>
<button type="button" data-choice="allowed">Aceptar</button>
</div>
</section>
<script>
(function () {
  var template = document.querySelector("[data-lz-tracking]");
  var panel = document.querySelector("[data-lz-consent]");
  var opener = document.querySelector("[data-lz-consent-open]");
  var key = "lanzate:tracking:v1:__LANDING_ID__";
  var choice = "";
  var started = false;
  try { choice = localStorage.getItem(key) || ""; } catch (error) {}

  function start() {
    if (started) return;
    started = true;
    template.content.querySelectorAll("script").forEach(function (source) {
      var script = document.createElement("script");
      Array.from(source.attributes).forEach(function (attr) {
        script.setAttribute(attr.name, attr.value);
      });
      script.textContent = source.textContent;
      document.head.appendChild(script);
    });
  }

  function save(value) {
    var persisted = false;
    try {
      localStorage.setItem(key, value);
      persisted = true;
    } catch (error) {}
    if (started && value === "denied") {
      location.reload();
      return;
    }
    choice = value;
    panel.hidden = true;
    opener.focus();
    if (choice === "allowed" && persisted) start();
  }

  if (choice === "allowed") start();
  panel.hidden = choice === "allowed" || choice === "denied";
  opener.addEventListener("click", function () {
    panel.hidden = false;
    panel.querySelector("button").focus();
  });
  panel.addEventListener("click", function (event) {
    if (event.target.dataset.choice) save(event.target.dataset.choice);
  });
})();
</script>
"""


def add_tracking_consent(html, landing):
    scripts = tracking_scripts(landing)
    if not scripts:
        return html
    ui = TRACKING_CONSENT_UI.replace("__LANDING_ID__", str(int(landing["id"]))).replace("__TRACKING__", scripts)
    return re.sub(r"</body\s*>", lambda match: ui + match.group(), html, count=1, flags=re.IGNORECASE)


# --- Consultas que llegan desde los formularios de las landings publicadas -----

def new_lead(data):
    if str(data.get("web") or "").strip():
        return {"ok": True}
    try:
        landing_id = int(data.get("landing"))
    except (TypeError, ValueError):
        raise ApiError(400, "Falta la landing")
    datos = data.get("datos")
    if not isinstance(datos, dict):
        raise ApiError(400, "La consulta está vacía")
    clean = {}
    for key, value in list(datos.items())[:20]:
        if isinstance(value, bool):
            value = "Sí" if value else "No"
        value = str("" if value is None else value).strip()[:1000]
        if value:
            clean[str(key)[:40]] = value
    if not clean:
        raise ApiError(400, "La consulta está vacía")
    tipo = "turno" if data.get("tipo") == "turno" else "contacto"
    origen = str(data.get("origen") or "")[:300]
    stamp = now_ms()
    with tx() as con:
        if not con.execute("SELECT 1 FROM landings WHERE id = %s", (landing_id,)).fetchone():
            raise ApiError(404, "La landing no existe")
        recent = con.execute("SELECT COUNT(*) AS n FROM consultas WHERE landing_id = %s AND creado > %s",
                             (landing_id, stamp - 600000)).fetchone()["n"]
        if recent >= 30:
            raise ApiError(429, "Llegaron muchas consultas seguidas. Probá de nuevo en unos minutos.")
        con.execute("INSERT INTO consultas (landing_id, tipo, datos, origen, creado) VALUES (%s, %s, %s, %s, %s)",
                    (landing_id, tipo, Jsonb(clean), origen, stamp))
    return {"ok": True}


def list_leads(query):
    where, params = [], []
    for key, column in (("landing", "q.landing_id"), ("cliente", "c.id")):
        value = (query.get(key) or [""])[0]
        if value.isdigit():
            where.append(column + " = %s")
            params.append(int(value))
    sql = ("SELECT q.id, q.landing_id, q.tipo, q.datos, q.origen, q.leida, q.creado, l.nombre AS landing, l.slug, "
           "c.id AS cliente_id, c.nombre AS cliente, c.slug AS cliente_slug "
           "FROM consultas q JOIN landings l ON l.id = q.landing_id JOIN clientes c ON c.id = l.cliente_id"
           + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY q.creado DESC LIMIT 500")
    with tx() as con:
        rows = con.execute(sql, params).fetchall()
    out = []
    for r in rows:
        item = dict(r)
        item["url"] = "/l/%s/%s/" % (r["cliente_slug"], r["slug"])
        out.append(item)
    return out


def update_lead(lead_id, data):
    with tx() as con:
        row = con.execute("UPDATE consultas SET leida = %s WHERE id = %s RETURNING id", (bool(data.get("leida")), lead_id)).fetchone()
    if not row:
        raise ApiError(404, "La consulta no existe")
    return {"ok": True}


def delete_lead(lead_id):
    with tx() as con:
        con.execute("DELETE FROM consultas WHERE id = %s", (lead_id,))
    return {"ok": True}


# --- IA (textos y módulos sugeridos) ------------------------------------------
# En local la clave vive fuera del repositorio; en Vercel, en sus variables de entorno.

IA_CONFIG = os.path.join(CONFIG_DIR, "ia.json")
IA_PROVIDERS = {
    "anthropic": {"nombre": "Claude (Anthropic)", "modelo": "claude-haiku-5-5", "env": "ANTHROPIC_API_KEY"},
    "openai": {"nombre": "ChatGPT (OpenAI)", "modelo": "gpt-6-luna", "env": "OPENAI_API_KEY"},
}


def ia_settings():
    data = {}
    if not ON_VERCEL and os.path.isfile(IA_CONFIG):
        try:
            with open(IA_CONFIG, encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError):
            data = {}
    provider = data.get("proveedor") if data.get("proveedor") in IA_PROVIDERS else ""
    key = data.get("clave") or ""
    if not key:
        for pid, info in IA_PROVIDERS.items():
            if os.environ.get(info["env"]):
                provider, key = pid, os.environ[info["env"]]
                break
    provider = provider or "anthropic"
    model = data.get("modelo") or IA_PROVIDERS[provider]["modelo"]
    return {"proveedor": provider, "clave": key, "modelo": model}


def ia_status():
    cfg = ia_settings()
    return {"configurada": bool(cfg["clave"]), "proveedor": cfg["proveedor"], "modelo": cfg["modelo"],
            "nombre": IA_PROVIDERS[cfg["proveedor"]]["nombre"]}


def save_ia_settings(data):
    if ON_VERCEL:
        raise ApiError(400, "En la versión online la clave de la IA se carga en Vercel (variable ANTHROPIC_API_KEY u OPENAI_API_KEY).")
    provider = data.get("proveedor")
    if provider not in IA_PROVIDERS:
        raise ApiError(400, "Elegí Claude u OpenAI")
    current = ia_settings()
    key = str(data.get("clave") or "").strip() or (current["clave"] if current["proveedor"] == provider else "")
    if not key:
        raise ApiError(400, "Pegá la clave de la API")
    model = str(data.get("modelo") or "").strip() or IA_PROVIDERS[provider]["modelo"]
    os.makedirs(os.path.dirname(IA_CONFIG), exist_ok=True)
    with open(IA_CONFIG, "w", encoding="utf-8") as fh:
        json.dump({"proveedor": provider, "clave": key, "modelo": model}, fh)
    os.chmod(IA_CONFIG, 0o600)
    return ia_status()


def ia_call(system, prompt, images=None):
    cfg = ia_settings()
    if not cfg["clave"]:
        raise ApiError(400, "Configurá la IA: tocá «Configurar IA» y pegá la clave")
    if cfg["proveedor"] == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": "Bearer " + cfg["clave"], "Content-Type": "application/json"}
        content = prompt
        if images:
            content = [{"type": "image_url", "image_url": {"url": "data:%s;base64,%s" % (m, d)}} for m, d in images]
            content.append({"type": "text", "text": prompt})
        body = {"model": cfg["modelo"], "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": content}]}
    else:
        url = "https://api.anthropic.com/v1/messages"
        headers = {"x-api-key": cfg["clave"], "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
        content = prompt
        if images:
            content = [{"type": "image", "source": {"type": "base64", "media_type": m, "data": d}} for m, d in images]
            content.append({"type": "text", "text": prompt})
        body = {"model": cfg["modelo"], "max_tokens": 16000, "system": system,
                "messages": [{"role": "user", "content": content}]}
    req = Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
    try:
        with urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except HTTPError as err:
        try:
            detail = json.loads(err.read().decode("utf-8")).get("error", {})
            detail = detail.get("message") if isinstance(detail, dict) else str(detail)
        except ValueError:
            detail = ""
        if err.code in (401, 403):
            raise ApiError(400, "La clave de la IA no es válida. Revisala en «Configurar IA».")
        raise ApiError(502, "La IA respondió con un error (%d). %s" % (err.code, detail or ""))
    except (URLError, TimeoutError) as err:
        raise ApiError(502, "No se pudo conectar con la IA: %s" % err)
    if cfg["proveedor"] == "openai":
        text = data["choices"][0]["message"]["content"] or ""
    else:
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    start, end = text.find("{"), text.rfind("}")
    try:
        return json.loads(text[start:end + 1])
    except ValueError:
        raise ApiError(502, "La IA no devolvió una respuesta válida. Probá de nuevo.")


IA_SYSTEM = (
    "Sos redactor y estratega de landing pages para pymes de Argentina. Escribís en español rioplatense, "
    "con voseo, tono cercano y profesional, frases afirmativas y concretas. Nunca inventás datos de contacto, "
    "precios, cifras, premios ni testimonios con nombres reales. Respondés solo con JSON válido, sin texto extra."
)


def ia_client_text(c):
    c = c or {}
    parts = ["Negocio: " + (c.get("nombre") or "sin nombre")]
    for key, label in (("rubro", "Rubro"), ("notas", "Notas del cliente"), ("sitio", "Sitio actual"),
                       ("direccion", "Dirección"), ("horario", "Horario de atención")):
        if c.get(key):
            parts.append("%s: %s" % (label, c[key]))
    return "\n".join(parts)


def ia_suggest_modules(data):
    catalog = data.get("catalogo") or []
    if not catalog:
        raise ApiError(400, "No llegó la lista de módulos")
    prompt = (
        ia_client_text(data.get("cliente")) + "\n"
        + ("Objetivo de la landing: " + data["objetivo"] + "\n" if data.get("objetivo") else "")
        + "\nReglas de estructura:\n" + str(data.get("reglas") or "") + "\n\n"
        + "Módulos disponibles (id · sección · variante · descripción):\n"
        + "\n".join("%s · %s · %s · %s" % (m.get("id"), m.get("grupo"), m.get("variante"), m.get("nota", "")) for m in catalog)
        + "\n\nElegí los módulos para la landing de este negocio, en orden, cumpliendo las reglas de estructura "
        + "(una sola variante por sección). Respondé con este JSON: "
        + '{"modulos": ["id", ...], "motivo": "una o dos frases que expliquen la elección"}'
    )
    out = ia_call(IA_SYSTEM, prompt)
    valid = {m.get("id") for m in catalog}
    ids = [i for i in out.get("modulos") or [] if i in valid]
    if not ids:
        raise ApiError(502, "La IA no sugirió módulos válidos. Probá de nuevo.")
    return {"modulos": ids, "motivo": str(out.get("motivo") or "")}


def ia_write_texts(data):
    textos = data.get("textos") or []
    if not textos:
        raise ApiError(400, "No hay textos para escribir")
    lines = []
    for t in textos:
        limit = ""
        if t.get("max"):
            limit = " (entre %d y %d caracteres)" % (t.get("min") or 0, t["max"])
        lines.append('[%s] %s · %s%s: "%s"' % (t.get("id"), t.get("seccion", ""), t.get("tipo", "texto"), limit, t.get("actual", "")))
    prompt = (
        ia_client_text(data.get("cliente")) + "\n"
        + ("Objetivo de la landing: " + data["objetivo"] + "\n" if data.get("objetivo") else "")
        + "\nEstos son los textos de ejemplo de la landing. Reescribí cada uno para este negocio, "
        + "respetando el tipo de texto y SIEMPRE dentro del límite de caracteres indicado (contando espacios).\n"
        + "- Mantené igual los datos de contacto, el nombre del negocio, los ítems del menú que solo navegan y los textos legales.\n"
        + "- Si un texto no aplica al rubro, adaptalo a algo equivalente y verosímil.\n"
        + "- En títulos podés destacar de 1 a 3 palabras entre *asteriscos*.\n"
        + "- Sin comillas alrededor del texto.\n\n"
        + "\n".join(lines)
        + '\n\nRespondé con este JSON: {"textos": [{"id": "...", "texto": "..."}, ...]} con todos los ids.'
    )
    out = ia_call(IA_SYSTEM, prompt)
    return validate_ia_texts(textos, out)


def ia_fit_texts(data):
    textos = data.get("textos") or []
    if not textos:
        raise ApiError(400, "No hay textos para ajustar")
    lines = ['[%s] %s · %s (entre %d y %d caracteres, hoy tiene %d): "%s"' % (
        t.get("id"), t.get("seccion", ""), t.get("tipo", "texto"), t.get("min") or 0, t.get("max") or 999,
        len(t.get("actual") or ""), t.get("actual", "")) for t in textos]
    prompt = (
        ia_client_text(data.get("cliente")) + "\n"
        + "\nEstos textos de la landing no cumplen el largo. Reescribí cada uno para que quede DENTRO del rango "
        + "de caracteres indicado (contando espacios): acortá los largos y completá los cortos.\n"
        + "- Mantené el sentido, el tono y los datos (nombres, cifras, contacto) del texto original.\n"
        + "- Si el original tiene palabras entre *asteriscos*, podés mantener ese destacado.\n"
        + "- Sin comillas alrededor del texto.\n\n"
        + "\n".join(lines)
        + '\n\nRespondé con este JSON: {"textos": [{"id": "...", "texto": "..."}, ...]} con todos los ids.'
    )
    out = ia_call(IA_SYSTEM, prompt)
    return validate_ia_texts(textos, out)


def validate_ia_texts(slots, response):
    limits = {str(slot.get("id")): (slot.get("min") or 0, slot.get("max")) for slot in slots}
    result = {}
    for item in response.get("textos") or []:
        if not isinstance(item, dict):
            continue
        slot_id = str(item.get("id"))
        value = item.get("texto")
        if slot_id not in limits or not isinstance(value, str):
            continue
        text = value.strip()
        length = len(text.replace("*", ""))
        minimum, maximum = limits[slot_id]
        if text and length >= minimum and (not maximum or length <= maximum):
            result[slot_id] = text
    if result.keys() != limits.keys():
        raise ApiError(502, "La IA no devolvió todos los textos dentro del largo solicitado. Probá de nuevo.")
    return {"textos": [{"id": slot_id, "texto": result[slot_id]} for slot_id in limits]}


def ia_describe_images(data):
    fotos = (data.get("fotos") or [])[:6]
    images, lines = [], []
    for f in fotos:
        m = re.match(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$", str(f.get("imagen") or ""))
        if not m or len(m.group(2)) > 700000:
            continue
        images.append((m.group(1), m.group(2)))
        lines.append("Imagen %d → id [%s] · sección %s%s" % (len(images), f.get("id"), f.get("seccion", ""),
                                                          (" · texto cercano: " + str(f.get("contexto"))[:160]) if f.get("contexto") else ""))
    if not images:
        raise ApiError(400, "No llegaron fotos para describir")
    limit = int(data.get("max") or 125)
    prompt = (
        ia_client_text(data.get("cliente")) + "\n\n"
        + "Escribí el texto alternativo (alt) de cada imagen, en el mismo orden en que llegan:\n"
        + "\n".join(lines)
        + "\n\n- Describí lo que se ve, en una frase concreta de hasta %d caracteres.\n" % limit
        + "- Sin «imagen de» ni «foto de» al principio, sin comillas y sin inventar marcas ni nombres.\n"
        + '\nRespondé con este JSON: {"fotos": [{"id": "...", "alt": "..."}, ...]}'
    )
    out = ia_call(IA_SYSTEM, prompt, images)
    valid = {str(f.get("id")) for f in fotos}
    result = [{"id": str(x.get("id")), "alt": str(x.get("alt") or "").strip()[:limit]}
              for x in out.get("fotos") or [] if str(x.get("id")) in valid and str(x.get("alt") or "").strip()]
    if not result:
        raise ApiError(502, "La IA no describió las fotos. Probá de nuevo.")
    return {"fotos": result}


# --- HTTP ----------------------------------------------------------------------

NOT_FOUND_PAGE = (
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    "<title>Página no encontrada</title><style>body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;"
    "background:#f7f6f2;color:#0e1130}main{text-align:center;padding:24px}h1{font-size:28px;margin:0 0 8px}</style></head>"
    "<body><main><h1>Esta página no existe</h1><p>Revisá el link o pedile uno nuevo a quien te lo&nbsp;compartió.</p></main></body></html>"
)


class Handler(SimpleHTTPRequestHandler):
    extra_headers = ()
    cache_control = "no-store"

    def end_headers(self):
        self.send_header("Cache-Control", self.cache_control)
        super().end_headers()

    def route(self):
        url = urlsplit(self.path)
        query = parse_qs(url.query)
        path = query.pop("__path", [""])[0] or unquote(url.path)
        return path, query

    def send_body(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for name, value in self.extra_headers:
            self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_public_landing(self, html):
        body = html.encode("utf-8")
        etag = '"' + hashlib.sha256(body).hexdigest() + '"'
        validators = {value.strip().removeprefix("W/") for value in self.headers.get("If-None-Match", "").split(",")}
        self.cache_control = "public, no-cache"
        try:
            if etag in validators or "*" in validators:
                self.send_response(304)
                self.send_header("ETag", etag)
                self.end_headers()
            else:
                self.extra_headers = (("ETag", etag),)
                self.send_body(200, body, "text/html; charset=utf-8")
        finally:
            self.cache_control = "no-store"
            self.extra_headers = ()

    def send_json(self, status, payload):
        self.send_body(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

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

    def cookie(self, name):
        for part in (self.headers.get("Cookie") or "").split(";"):
            key, _, value = part.strip().partition("=")
            if key == name:
                return value
        return ""

    def session_cookie(self, value, max_age):
        secure = "; Secure" if ON_VERCEL or self.headers.get("X-Forwarded-Proto") == "https" else ""
        return "%s=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Lax%s" % (COOKIE, value, max_age, secure)

    def origin(self):
        host = (self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "").split(",")[0].strip()
        proto = (self.headers.get("X-Forwarded-Proto") or "http").split(",")[0].strip()
        if not re.match(r"^[\w.-]+(:\d+)?$", host) or proto not in ("http", "https"):
            return ""
        return "%s://%s" % (proto, host)

    def authorized(self):
        if not login_required():
            return True
        return bool(access_key()) and valid_session(self.cookie(COOKIE))

    def serve_lanzate(self, method):
        """Atiende la API y las landings publicadas. Devuelve False si la ruta es un archivo estático."""
        path, query = self.route()
        if path in PANEL_PAGES and method in ("GET", "HEAD"):
            if not self.authorized():
                target = path + ("?" + urlencode(query, doseq=True) if query else "")
                self.send_response(303)
                self.send_header("Location", "/maquetas/login.html?" + urlencode({"volver": target}))
                self.send_header("Content-Length", "0")
                self.end_headers()
            else:
                with open(os.path.join(ROOT, path.lstrip("/")), "rb") as page_file:
                    self.send_body(200, page_file.read(), "text/html; charset=utf-8")
            return True
        if path == "/data/reglas.json" and method in ("GET", "HEAD"):
            if self.authorized():
                self.send_json(200, read_rules())
            else:
                self.send_json(401, {"error": "Ingresá a Lanzate para consultar las reglas."})
            return True
        page = LANDING_PAGE.match(path)
        if page and method in ("GET", "HEAD"):
            try:
                html = landing_page(*page.groups(), origin=self.origin())
            except ApiError as err:
                self.send_body(err.status, NOT_FOUND_PAGE.encode("utf-8"), "text/html; charset=utf-8")
                return True
            if html:
                self.send_public_landing(html)
            else:
                self.send_body(404, NOT_FOUND_PAGE.encode("utf-8"), "text/html; charset=utf-8")
            return True
        for pattern, name in ROUTES:
            match = pattern.match(path)
            if match:
                break
        else:
            if path.startswith("/api/") or ON_VERCEL:
                self.send_json(404, {"error": "Ruta inexistente"})
                return True
            return False
        ident = int(match.group(1)) if match.groups() else None
        try:
            if name not in PUBLIC_ROUTES and not self.authorized():
                raise ApiError(401, "Ingresá la clave para usar la plataforma.")
            if name == "preview":
                shot = landing_preview(ident)
                if not shot:
                    raise ApiError(404, "La landing no tiene vista previa")
                self.send_body(200, shot[1], shot[0])
                return True
            result = self.dispatch(method, name, ident, query)
        except ApiError as err:
            self.send_json(err.status, {"error": str(err)})
        except psycopg.Error as err:
            print("Error de base de datos: %s" % err, file=sys.stderr)
            self.send_json(500, {"error": "No se pudo completar la acción en la base de datos. Probá de nuevo."})
        else:
            self.send_json(200, result)
        return True

    def dispatch(self, method, name, ident, query):
        if name == "sesion" and method == "GET":
            return {"ok": self.authorized(), "requiere": login_required()}
        if name == "login" and method == "POST":
            if not access_key():
                raise ApiError(500, "Falta configurar la clave de acceso (LANZATE_CLAVE).")
            clave = str(self.read_json().get("clave") or "")
            if not hmac.compare_digest(clave.encode("utf-8"), access_key().encode("utf-8")):
                time.sleep(1)
                raise ApiError(401, "La clave no es correcta.")
            self.extra_headers = (("Set-Cookie", self.session_cookie(make_session(), SESSION_DAYS * 86400)),)
            return {"ok": True}
        if name == "logout" and method == "POST":
            self.extra_headers = (("Set-Cookie", self.session_cookie("", 0)),)
            return {"ok": True}
        if name == "clientes":
            if method == "GET":
                return list_clients()
            if method == "POST":
                return create_client(self.read_json())
        if name == "cliente":
            if method == "GET":
                return get_client(ident)
            if method == "PUT":
                return update_client(ident, self.read_json())
            if method == "DELETE":
                delete_client(ident)
                return {"ok": True}
        if name == "landings":
            if method == "GET":
                client = (query.get("cliente") or [""])[0]
                return list_landings(int(client) if client.isdigit() else None)
            if method == "POST":
                return save_landing(self.read_json())
        if name == "landing":
            if method == "GET":
                return get_landing(ident)
            if method == "PUT":
                return save_landing(self.read_json(), ident)
            if method == "DELETE":
                delete_landing(ident)
                return {"ok": True}
        if name == "duplicate" and method == "POST":
            return duplicate_landing(ident)
        if name == "reglas":
            if method == "GET":
                return read_rules()
            if method == "PUT":
                return save_rules(self.read_json())
        if name == "consulta-nueva" and method == "POST":
            return new_lead(self.read_json())
        if name == "consultas" and method == "GET":
            return list_leads(query)
        if name == "consulta":
            if method == "PUT":
                return update_lead(ident, self.read_json())
            if method == "DELETE":
                return delete_lead(ident)
        if name == "ia":
            if method == "GET":
                return ia_status()
            if method == "PUT":
                return save_ia_settings(self.read_json())
            if method == "POST":
                data = self.read_json()
                if data.get("tarea") == "modulos":
                    return ia_suggest_modules(data)
                if data.get("tarea") == "textos":
                    return ia_write_texts(data)
                if data.get("tarea") == "ajustar":
                    return ia_fit_texts(data)
                if data.get("tarea") == "fotos":
                    return ia_describe_images(data)
                raise ApiError(400, "Tarea de IA desconocida")
        raise ApiError(405, "Método no permitido")

    def do_GET(self):
        if not self.serve_lanzate("GET"):
            super().do_GET()

    def do_HEAD(self):
        if not self.serve_lanzate("HEAD"):
            super().do_HEAD()

    def do_POST(self):
        if not self.serve_lanzate("POST"):
            self.send_json(404, {"error": "Ruta inexistente"})

    def do_PUT(self):
        if not self.serve_lanzate("PUT"):
            self.send_json(404, {"error": "Ruta inexistente"})

    def do_DELETE(self):
        if not self.serve_lanzate("DELETE"):
            self.send_json(404, {"error": "Ruta inexistente"})


def main():
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8877))
    host = os.environ.get("HOST") or "127.0.0.1"
    if not os.environ.get("DATABASE_URL"):
        print("Falta DATABASE_URL: agregala en %s" % LOCAL_ENV, file=sys.stderr)
        sys.exit(1)
    with tx():
        pass
    server = ThreadingHTTPServer((host, port), partial(Handler, directory=ROOT))
    print("Lanzate en http://%s:%d/" % (host, port))
    print("  Constructor → /maquetas/constructor.html")
    print("  Landings    → /maquetas/landings.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
