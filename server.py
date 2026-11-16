#!/usr/bin/env python3
"""Panel de Lanzate: corre en tu computadora y guarda todo en archivos del repositorio.

Los datos viven en archivos JS, con la misma forma que js/config.js del sitio de venta:
    data/config.js    window.LANZATE_CONFIG   (marca, WhatsApp, URL pública)
    data/planes.js    window.LANZATE_PLANES   (copia de los planes del sitio de venta)
    data/clientes.js  window.LANZATE_CLIENTES
    data/landings.js  window.LANZATE_LANDINGS
    data/reglas.js    window.LANZATE_REGLAS
Cada landing se escribe como página estática en l/<cliente>/<landing>/index.html.
Para publicar: botón «Publicar» del panel (git add, commit y push) o a mano con git.
GitHub Pages sirve el repositorio tal cual.

Uso:
    python3 server.py [puerto]   (por defecto 8877)
"""

import base64
import secrets
import hashlib
import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
from contextlib import contextmanager
from functools import lru_cache, partial
from html import escape, unescape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlsplit
from urllib.request import Request, urlopen

from lxml import etree, html as html_dom

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
LANDINGS_DIR = os.path.join(ROOT, "l")
SITIO_VENTA = os.path.normpath(os.path.join(ROOT, "..", "Lanzate_site"))
CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".lanzate")

MAX_BODY = 40 * 1024 * 1024
MAX_LOGO = 2 * 1024 * 1024
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
LOGO_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg"}

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
HTML_REF = re.compile(r'((?:src|href)=")((?:img|css|js)/[^"#?]+|\.\./assets/[^"#?]+)(")')
URL_REF = re.compile(r"(url\(\s*(?:&quot;|['\"])?)((?:img|css|js)/[^'\")&]+|\.\./assets/[^'\")&]+)")
COVER_RE = re.compile(r"""(?:src="|url\(\s*(?:&quot;|['"])?)(/(?:maquetas|assets)/(?!modulos/)[^"')&]+\.(?:jpe?g|png|webp))""", re.I)
IMG_TOKEN = re.compile(r"lzimg:(\d+):(\d+)")
# Rutas absolutas del sitio (/maquetas/…, /assets/…, /l/…) que pasan a relativas en las páginas estáticas.
ABS_REF = re.compile(r"""(?<=["'(\s,=])/(?=(?:maquetas|assets|l|privacidad|terminos)(?:/|["'?#\s)]))|(?<=&quot;)/(?=(?:maquetas|assets|l)/)""")

ROUTES = [
    (re.compile(r"^/api/clientes$"), "clientes"),
    (re.compile(r"^/api/clientes/(\d+)/plan$"), "plan"),
    (re.compile(r"^/api/clientes/(\d+)/pedidos$"), "pedidos"),
    (re.compile(r"^/api/clientes/(\d+)$"), "cliente"),
    (re.compile(r"^/api/landings$"), "landings"),
    (re.compile(r"^/api/landings/(\d+)$"), "landing"),
    (re.compile(r"^/api/landings/(\d+)/duplicate$"), "duplicate"),
    (re.compile(r"^/api/reglas$"), "reglas"),
    (re.compile(r"^/api/planes$"), "planes"),
    (re.compile(r"^/api/config$"), "config"),
    (re.compile(r"^/api/publicar$"), "publicar"),
    (re.compile(r"^/api/ia$"), "ia"),
    (re.compile(r"^/api/sesion$"), "sesion"),
    (re.compile(r"^/api/login$"), "login"),
    (re.compile(r"^/api/clientes/(\d+)/acceso$"), "acceso"),
    (re.compile(r"^/api/clientes/(\d+)/clave-enviada$"), "clave-enviada"),
    (re.compile(r"^/api/portal/login$"), "portal-login"),
    (re.compile(r"^/api/portal/logout$"), "portal-logout"),
    (re.compile(r"^/api/portal/sesion$"), "portal-sesion"),
    (re.compile(r"^/api/portal/olvide$"), "portal-olvide"),
    (re.compile(r"^/api/portal/inicio$"), "portal-inicio"),
    (re.compile(r"^/api/portal/datos\.js$"), "portal-datos"),
    (re.compile(r"^/api/logout$"), "logout"),
]
PUBLIC_ROUTES = ("sesion", "login", "logout", "portal-login", "portal-logout", "portal-sesion", "portal-olvide",
                 "portal-inicio", "portal-datos")
PORTAL_COOKIE = "lz_portal"
PANEL_PAGES = {"/maquetas/%s.html" % name for name in ("constructor", "landings", "clientes", "cliente", "reglas")}
COOKIE = "lz_sesion"
SESSION_DAYS = 30


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def now_ms():
    return int(time.time() * 1000)


def slugify(text, fallback="landing"):
    text = unicodedata.normalize("NFD", text or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or fallback


# --- Archivos de datos (misma forma que js/config.js del sitio de venta) --------

# --- Dónde se guardan los archivos ---------------------------------------------------
# En tu computadora: el disco (y «Publicar» hace git push).
# Online (Vercel, con GITHUB_TOKEN): cada guardado es un commit en GitHub, que publica con GitHub Pages.

def load_local_env():
    env = os.path.join(CONFIG_DIR, "lanzate.env")
    if not os.path.isfile(env):
        return
    with open(env, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


load_local_env()
ON_VERCEL = bool(os.environ.get("VERCEL"))
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN") or ""
REPOS = {
    "modulos": os.environ.get("LANZATE_REPO") or "rosariogebala-cyber/repositorio-modulos",
    "sitio": os.environ.get("LANZATE_SITIO_REPO") or "rosariogebala-cyber/lanzate",
}
BRANCH = os.environ.get("LANZATE_RAMA") or "main"
GITHUB_API = os.environ.get("LANZATE_GITHUB_API") or "https://api.github.com"


class LocalFiles:
    """Archivos en el disco: Lanzate_modulos y, al lado, Lanzate_site."""
    online = False

    def root(self, repo):
        return ROOT if repo == "modulos" else SITIO_VENTA

    def has(self, repo):
        return repo == "modulos" or os.path.isdir(os.path.join(SITIO_VENTA, "js"))

    def read(self, repo, path):
        try:
            return Path(self.root(repo), path).read_bytes()
        except OSError:
            return None

    def write(self, repo, path, data):
        target = Path(self.root(repo), path)
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(data, str):
            data = data.encode("utf-8")
        if target.exists() and target.read_bytes() == data:
            return
        tmp = str(target) + ".tmp"
        Path(tmp).write_bytes(data)
        os.replace(tmp, target)

    def delete(self, repo, path):
        target = Path(self.root(repo), path)
        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)
        elif target.exists():
            target.unlink()

    def listdir(self, repo, path):
        """Archivos (rutas relativas) debajo de path."""
        base = Path(self.root(repo))
        folder = base / path
        if not folder.is_dir():
            return []
        return sorted(str(f.relative_to(base)).replace(os.sep, "/") for f in folder.rglob("*") if f.is_file())

    def begin(self):
        pass

    def commit(self, message):
        return None

    def discard(self):
        pass


class GitHubFiles:
    """Archivos en GitHub. Lee con la API y junta lo que se escribe para hacer un solo commit por pedido."""
    online = True

    def __init__(self, token):
        self.token = token
        self.local = threading.local()

    def state(self):
        if not hasattr(self.local, "pending"):
            self.begin()
        return self.local

    def begin(self):
        self.local.pending = {"modulos": {}, "sitio": {}}
        self.local.cache = {}
        self.local.trees = {}

    def discard(self):
        self.begin()

    def has(self, repo):
        return True

    def call(self, method, url, body=None, raw=False):
        req = Request(GITHUB_API + url, method=method,
                      data=json.dumps(body).encode("utf-8") if body is not None else None,
                      headers={"Authorization": "Bearer " + self.token, "X-GitHub-Api-Version": "2022-11-28",
                               "Accept": "application/vnd.github.raw" if raw else "application/vnd.github+json",
                               "User-Agent": "lanzate-panel", "Content-Type": "application/json"})
        try:
            with urlopen(req, timeout=30) as resp:
                data = resp.read()
        except HTTPError as err:
            if err.code == 404:
                return None
            detail = err.read().decode("utf-8", "replace")[:300]
            if err.code in (401, 403):
                raise ApiError(502, "GitHub no aceptó el token (GITHUB_TOKEN). Revisá que tenga permiso de escritura en los repos.")
            raise ApiError(502, "GitHub respondió con un error (%d): %s" % (err.code, detail))
        except (URLError, TimeoutError) as err:
            raise ApiError(502, "No se pudo conectar con GitHub: %s" % err)
        return data if raw else json.loads(data.decode("utf-8") or "null")

    def read(self, repo, path):
        st = self.state()
        if path in st.pending[repo]:
            return st.pending[repo][path]
        key = (repo, path)
        if key not in st.cache:
            st.cache[key] = self.call("GET", "/repos/%s/contents/%s?ref=%s" % (REPOS[repo], quote(path), BRANCH), raw=True)
        return st.cache[key]

    def write(self, repo, path, data):
        if isinstance(data, str):
            data = data.encode("utf-8")
        if self.read(repo, path) == data:
            return
        self.state().pending[repo][path] = data

    def tree(self, repo):
        st = self.state()
        if repo not in st.trees:
            out = self.call("GET", "/repos/%s/git/trees/%s?recursive=1" % (REPOS[repo], BRANCH)) or {}
            st.trees[repo] = [t["path"] for t in out.get("tree") or [] if t.get("type") == "blob"]
        return st.trees[repo]

    def listdir(self, repo, path):
        prefix = path.rstrip("/") + "/"
        pending = self.state().pending[repo]
        files = {p for p in self.tree(repo) if p.startswith(prefix) and pending.get(p, b"") is not None}
        files.update(p for p, data in pending.items() if p.startswith(prefix) and data is not None)
        return sorted(files)

    def delete(self, repo, path):
        pending = self.state().pending[repo]
        targets = self.listdir(repo, path) or ([path] if self.read(repo, path) is not None else [])
        for target in targets:
            pending[target] = None

    def commit(self, message):
        st = self.state()
        done = []
        for repo, files in st.pending.items():
            if not files:
                continue
            for attempt in range(3):
                try:
                    self.commit_repo(repo, files, message)
                    break
                except ApiError as err:
                    if attempt == 2 or "422" not in str(err) and "409" not in str(err):
                        raise
            done.append(repo)
        self.begin()
        return done

    def commit_repo(self, repo, files, message):
        name = REPOS[repo]
        ref = self.call("GET", "/repos/%s/git/ref/heads/%s" % (name, BRANCH))
        head = ref["object"]["sha"]
        base = self.call("GET", "/repos/%s/git/commits/%s" % (name, head))["tree"]["sha"]
        entries = []
        for path, data in sorted(files.items()):
            if data is None:
                entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})
                continue
            blob = self.call("POST", "/repos/%s/git/blobs" % name,
                             {"content": base64.b64encode(data).decode(), "encoding": "base64"})
            entries.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        existing = set(self.tree(repo))
        entries = [e for e in entries if e["sha"] is not None or e["path"] in existing]
        if not entries:
            return
        tree = self.call("POST", "/repos/%s/git/trees" % name, {"base_tree": base, "tree": entries})
        commit = self.call("POST", "/repos/%s/git/commits" % name,
                           {"message": message, "tree": tree["sha"], "parents": [head]})
        self.call("PATCH", "/repos/%s/git/refs/heads/%s" % (name, BRANCH), {"sha": commit["sha"], "force": False})


FILES = GitHubFiles(GITHUB_TOKEN) if GITHUB_TOKEN else LocalFiles()


def read_text(repo, path):
    data = FILES.read(repo, path)
    return None if data is None else data.decode("utf-8")


DATA_FILES = {
    "config": ("config.js", "LANZATE_CONFIG", "Datos generales de Lanzate. La URL pública es la de GitHub Pages (o el dominio propio)."),
    "planes": ("planes.js", "LANZATE_PLANES", "Planes. Se copian solos desde Lanzate_site/js/config.js: editalos allá."),
    "clientes": ("clientes.js", "LANZATE_CLIENTES", "Clientes. Los guarda el panel (python3 server.py)."),
    "landings": ("landings.js", "LANZATE_LANDINGS", "Landings con sus módulos. Las guarda el panel; la página publicada está en l/<cliente>/<landing>/."),
    "reglas": ("reglas.js", "LANZATE_REGLAS", "Reglas de calidad de las landings. Se editan desde el panel (Reglas)."),
}
DEFAULT_CONFIG = {
    "marca": "Lanzate",
    "whatsapp": "",
    "email": "",
    "urlPublica": "https://rosariogebala-cyber.github.io/repositorio-modulos",
    "urlPanel": "https://lanzate-mu.vercel.app",
}
_lock = threading.RLock()


def data_path(key):
    return "data/" + DATA_FILES[key][0]


def read_data(key, default):
    """Lee window.X = {...}; del archivo. El contenido es JSON válido."""
    text = read_text("modulos", data_path(key))
    if text is None:
        return default
    start = text.find("=", text.find("window."))
    end = text.rfind(";")
    try:
        return json.loads(text[start + 1:end if end > start else None])
    except ValueError:
        raise ApiError(500, "No se pudo leer data/%s: revisá que no se haya roto al editarlo a mano." % DATA_FILES[key][0])


def write_data(key, value):
    name, var, note = DATA_FILES[key]
    body = "/* %s */\nwindow.%s = %s;\n" % (note, var, json.dumps(value, ensure_ascii=False, indent=2))
    FILES.write("modulos", data_path(key), body)


@contextmanager
def store(*keys, save=True):
    """Bloquea, lee los archivos pedidos y los guarda al salir bien."""
    with _lock:
        db = {k: read_data(k, [] if k in ("clientes", "landings") else {}) for k in keys}
        yield db
        if save:
            for k in keys:
                write_data(k, db[k])


def read_config():
    config = dict(DEFAULT_CONFIG)
    config.update(read_data("config", {}) or {})
    config["urlPublica"] = str(config.get("urlPublica") or "").rstrip("/")
    return config


def read_rules():
    data = read_data("reglas", {})
    if data:
        return data
    try:
        with open(os.path.join(DATA, "reglas.json"), encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_rules(data):
    if not isinstance(data.get("textos"), dict) or not isinstance(data.get("imagenes"), dict):
        raise ApiError(400, "Las reglas no tienen el formato esperado")
    data["actualizado"] = now_ms()
    with _lock:
        write_data("reglas", data)
    return data


# --- Clave del equipo -------------------------------------------------------------
# Una sola clave para todo el equipo: LANZATE_USUARIO y LANZATE_CLAVE (en Vercel, en sus variables;
# en tu computadora, en ~/.lanzate/lanzate.env). Si no hay clave cargada en tu computadora, el panel no la pide.

def access_user():
    return os.environ.get("LANZATE_USUARIO") or "Lanzate11"


def access_key():
    return os.environ.get("LANZATE_CLAVE") or ""


def login_required():
    return ON_VERCEL or bool(access_key())


def session_secret():
    return (os.environ.get("LANZATE_SECRETO") or ("lanzate:" + access_key())).encode("utf-8")


def valid_credentials(usuario, clave):
    user_ok = hmac.compare_digest(usuario.encode("utf-8"), access_user().encode("utf-8"))
    key_ok = bool(access_key()) and hmac.compare_digest(clave.encode("utf-8"), access_key().encode("utf-8"))
    return user_ok and key_ok


def make_session():
    expires = str(int(time.time()) + SESSION_DAYS * 86400)
    return expires + "." + hmac.new(session_secret(), expires.encode(), hashlib.sha256).hexdigest()


def valid_session(value):
    try:
        expires, sig = value.split(".", 1)
        good = hmac.new(session_secret(), expires.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, good) and int(expires) > time.time()
    except (ValueError, AttributeError):
        return False


# --- Acceso de cada cliente a su portal ----------------------------------------------
# El repo es público: la contraseña se guarda como hash con un secreto que no está en el repo (LANZATE_SECRETO),
# y una copia cifrada con ese mismo secreto para que el equipo la pueda ver y reenviar.

def portal_secret():
    return hmac.new(session_secret(), b"portal", hashlib.sha256).digest()


def hash_portal_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    peppered = hmac.new(portal_secret(), password.encode("utf-8"), hashlib.sha256).digest()
    digest = hashlib.scrypt(peppered, salt=bytes.fromhex(salt), n=2 ** 14, r=8, p=1).hex()
    return "scrypt$%s$%s" % (salt, digest)


def check_portal_password(stored, password):
    try:
        _, salt, _ = stored.split("$", 2)
    except (ValueError, AttributeError):
        return False
    return len(password) <= 128 and hmac.compare_digest(hash_portal_password(password, salt), stored)


def _keystream(key, nonce, size):
    out, counter = b"", 0
    while len(out) < size:
        out += hashlib.sha256(key + nonce + counter.to_bytes(4, "big")).digest()
        counter += 1
    return out[:size]


def seal_password(password):
    key = hmac.new(portal_secret(), b"ver", hashlib.sha256).digest()
    nonce = secrets.token_bytes(16)
    plain = password.encode("utf-8")
    sealed = bytes(a ^ b for a, b in zip(plain, _keystream(key, nonce, len(plain))))
    tag = hmac.new(key, nonce + sealed, hashlib.sha256).digest()[:16]
    return base64.urlsafe_b64encode(nonce + tag + sealed).decode()


def open_password(stored):
    try:
        raw = base64.urlsafe_b64decode((stored or "").encode())
        nonce, tag, sealed = raw[:16], raw[16:32], raw[32:]
        key = hmac.new(portal_secret(), b"ver", hashlib.sha256).digest()
        if not sealed or not hmac.compare_digest(tag, hmac.new(key, nonce + sealed, hashlib.sha256).digest()[:16]):
            return ""
        return bytes(a ^ b for a, b in zip(sealed, _keystream(key, nonce, len(sealed)))).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return ""


def set_portal_access(client_id, data):
    usuario = re.sub(r"\s+", "", str(data.get("usuario") or "")).lower()
    if not re.fullmatch(r"[a-z0-9._@-]{3,60}", usuario):
        raise ApiError(400, "El usuario usa letras, números, punto, guion o arroba, de 3 a 60 caracteres.")
    clave = str(data.get("clave") or "").strip()
    if not clave:
        clave = "-".join(secrets.choice(PASSWORD_WORDS) for _ in range(3)) + str(secrets.randbelow(90) + 10)
    elif not 8 <= len(clave) <= 128:
        raise ApiError(400, "La contraseña tiene que tener entre 8 y 128 caracteres.")
    with store("clientes") as db:
        row = find_client(db, client_id)
        if any(c["id"] != client_id and (c.get("portal") or {}).get("usuario") == usuario for c in db["clientes"]):
            raise ApiError(409, "Ese usuario ya lo tiene otro cliente. Elegí otro.")
        version = (row.get("portal") or {}).get("version", 0) + 1
        row["portal"] = {"usuario": usuario, "hash": hash_portal_password(clave), "clave": seal_password(clave),
                         "version": version, "pidio_clave": 0}
    return get_client(client_id)


def clear_password_request(client_id):
    with store("clientes") as db:
        row = find_client(db, client_id)
        if row.get("portal"):
            row["portal"]["pidio_clave"] = 0
    return get_client(client_id)


PASSWORD_WORDS = ("sol", "mar", "luna", "rio", "pino", "faro", "nube", "lima", "roble", "trigo", "vela", "cielo",
                  "brisa", "coral", "menta", "arena", "selva", "norte", "lago", "olivo")


def portal_token(client_id, version):
    expires = int(time.time()) + 30 * 86400
    payload = "%d.%d.%d" % (client_id, expires, version)
    return payload + "." + hmac.new(portal_secret(), payload.encode(), hashlib.sha256).hexdigest()


def portal_client(value):
    """El cliente de la sesión del portal, o None."""
    try:
        client_id, expires, version, sig = value.split(".")
        payload = "%s.%s.%s" % (client_id, expires, version)
        if int(expires) <= time.time() or not hmac.compare_digest(
                sig, hmac.new(portal_secret(), payload.encode(), hashlib.sha256).hexdigest()):
            return None
    except (ValueError, AttributeError):
        return None
    for row in read_data("clientes", []):
        if row["id"] == int(client_id) and (row.get("portal") or {}).get("version") == int(version):
            return row
    return None


def portal_login(usuario, clave):
    usuario = str(usuario or "").strip().lower()
    for row in read_data("clientes", []):
        access = row.get("portal") or {}
        if usuario and access.get("usuario") == usuario and check_portal_password(access.get("hash"), str(clave or "")):
            if row.get("estado") == "pausado":
                raise ApiError(403, "Tu cuenta está pausada. Escribinos para reactivarla.")
            return row
    time.sleep(1)
    raise ApiError(401, "El usuario o la contraseña no son correctos.")


def request_password(usuario):
    """El cliente avisa que se olvidó la contraseña: queda marcado en el panel para que el equipo se la reenvíe."""
    usuario = str(usuario or "").strip().lower()
    with store("clientes") as db:
        for row in db["clientes"]:
            access = row.get("portal") or {}
            if usuario and access.get("usuario") == usuario:
                if now_ms() - (access.get("pidio_clave") or 0) > 10 * 60000:
                    access["pidio_clave"] = now_ms()
                break
    return {"ok": True, "mensaje": "Listo. Le avisamos al equipo de Lanzate y te mandamos tu contraseña por WhatsApp o mail."}


def portal_home(client):
    landings = [l for l in read_data("landings", []) if l["cliente_id"] == client["id"] and l.get("html")]
    origin = read_config()["urlPublica"]
    status = plan_status(client)
    return {
        "nombre": client["nombre"], "rubro": client.get("rubro") or "", "usuario": (client.get("portal") or {}).get("usuario"),
        "plan": status, "plan_vence": client.get("plan_vence") or "",
        "landings": [{"nombre": l["nombre"], "url": origin + "/l/%s/%s/" % (client["slug"], l["slug"]),
                      "editor": "/portal/editar/?l=" + quote(client["slug"] + "/" + l["slug"]),
                      "actualizado": l["actualizado"]} for l in sorted(landings, key=lambda l: -l["actualizado"])],
        "whatsapp": re.sub(r"\D", "", read_config().get("whatsapp") or ""),
    }


def portal_data_js(client):
    """Los datos que usa el editor del cliente: solo los suyos y sin datos de acceso."""
    safe = {k: v for k, v in client.items() if k not in ("portal", "notas")}
    landings = [l for l in read_data("landings", []) if l["cliente_id"] == client["id"] and l.get("html")]
    landings = [{k: l[k] for k in ("id", "cliente_id", "nombre", "slug", "actualizado")} | {"html": True} for l in landings]
    config = {k: v for k, v in read_config().items()}
    parts = [("LANZATE_CONFIG", config), ("LANZATE_PLANES", read_data("planes", {})),
             ("LANZATE_CLIENTES", [safe]), ("LANZATE_LANDINGS", landings)]
    return "".join("window.%s = %s;\n" % (name, json.dumps(value, ensure_ascii=False)) for name, value in parts)


# --- Planes: los mismos del sitio de venta ---------------------------------------

def js_literal_to_json(text):
    """Convierte un objeto JS escrito a mano (claves sin comillas, comentarios, comas finales) a JSON."""
    out, i, n = [], 0, len(text)
    while i < n:
        ch = text[i]
        if ch == '"' or ch == "'":
            j, buf = i + 1, []
            while j < n and text[j] != ch:
                if text[j] == "\\":
                    buf.append(text[j:j + 2])
                    j += 2
                    continue
                buf.append(text[j])
                j += 1
            raw = "".join(buf)
            if ch == "'":
                raw = raw.replace('"', '\\"').replace("\\'", "'")
            out.append('"' + raw + '"')
            i = j + 1
        elif text.startswith("//", i):
            i = text.find("\n", i) if text.find("\n", i) >= 0 else n
        elif text.startswith("/*", i):
            i = text.find("*/", i) + 2 if text.find("*/", i) >= 0 else n
        else:
            out.append(ch)
            i += 1
    result = "".join(out)
    result = re.sub(r'([{,]\s*)([A-Za-z_$][\w$]*)\s*:', r'\1"\2":', result)
    result = re.sub(r",(\s*[}\]])", r"\1", result)
    return result


def site_plans():
    """Lee los planes de Lanzate_site/js/config.js si la carpeta del sitio está al lado."""
    try:
        text = read_text("sitio", "js/config.js") if FILES.has("sitio") else None
        if text is None:
            return None
        start = text.find("{", text.find("window.SITE"))
        end = text.rfind("}")
        site = json.loads(js_literal_to_json(text[start:end + 1]))
    except (OSError, ValueError, ApiError):
        return None
    plans = site.get("planes")
    if not isinstance(plans, list):
        return None
    compare = [row for row in site.get("comparar") or [] if isinstance(row, list) and row]
    out = []
    for index, plan in enumerate(plans):
        item = {k: plan.get(k) for k in ("id", "nombre", "para", "inicial", "mensual", "incluye")}
        # La tabla «Compará los planes» del sitio es la que define qué incluye cada plan.
        features = {str(row[0]): row[index + 1] for row in compare if len(row) > index + 1}
        item["caracteristicas"] = features
        item["secciones"] = feature_number(features, "secciones")
        item["cambiosPorMes"] = feature_number(features, "cambios")
        item["turnos"] = feature_flag(features, "turno")
        item["medicion"] = feature_flag(features, "analytics")
        out.append(item)
    return {"planes": out, "whatsapp": site.get("whatsapp") or "", "email": site.get("email") or ""}


def feature_number(features, word):
    for label, value in features.items():
        if label.lower().startswith(word):
            digits = re.sub(r"\D", "", str(value))
            return int(digits) if digits else 0
    return 0


def feature_flag(features, word):
    for label, value in features.items():
        if word in label.lower():
            return value is True or (isinstance(value, str) and value.strip().lower() not in ("", "no", "false", "-", "—"))
    return True


def sync_plans():
    """Copia los planes del sitio de venta a data/planes.js. Si no está el sitio, deja los que hay."""
    found = site_plans()
    with _lock:
        if found:
            current = read_data("planes", {})
            data = {"planes": found["planes"]}
            if current != data:
                write_data("planes", data)
            config = read_data("config", {}) or {}
            changed = False
            for key in ("whatsapp", "email"):
                if found[key] and config.get(key) != found[key]:
                    config[key] = found[key]
                    changed = True
            if changed or FILES.read("modulos", data_path("config")) is None:
                merged = dict(DEFAULT_CONFIG)
                merged.update(config)
                write_data("config", merged)
        elif FILES.read("modulos", data_path("config")) is None:
            write_data("config", DEFAULT_CONFIG)
    return read_data("planes", {}).get("planes") or []


def plan_ids():
    return [p.get("id") for p in (read_data("planes", {}).get("planes") or []) if p.get("id")]


def client_plan(client):
    """El plan del cliente con sus límites, o None si no tiene (sin límites: demos y pruebas)."""
    plan_id = client.get("plan") or ""
    for plan in read_data("planes", {}).get("planes") or []:
        if plan.get("id") == plan_id:
            return plan
    return None


def plan_expired(client, today=None):
    vence = client.get("plan_vence") or ""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", vence):
        return None
    today = today or time.strftime("%Y-%m-%d")
    return vence < today


def plan_days_left(client):
    vence = client.get("plan_vence") or ""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", vence):
        return None
    end = time.mktime(time.strptime(vence, "%Y-%m-%d"))
    start = time.mktime(time.strptime(time.strftime("%Y-%m-%d"), "%Y-%m-%d"))
    return int(round((end - start) / 86400))


def month_key(ms=None):
    return time.strftime("%Y-%m", time.localtime((ms or now_ms()) / 1000))


def changes_this_month(client):
    current = month_key()
    return [p for p in client.get("pedidos") or [] if month_key(p.get("fecha")) == current]


def plan_status(client):
    """Resumen del plan para el panel y el editor del cliente."""
    plan = client_plan(client)
    used = len(changes_this_month(client))
    status = {"plan": plan["nombre"] if plan else "", "vencido": bool(plan_expired(client)),
              "dias": plan_days_left(client), "cambios_usados": used}
    if plan:
        status.update(cambios_mes=plan.get("cambiosPorMes") or 0, secciones=plan.get("secciones") or 0,
                      turnos=bool(plan.get("turnos")), medicion=bool(plan.get("medicion")))
        if status["cambios_mes"]:
            status["cambios_restantes"] = max(0, status["cambios_mes"] - used)
    return status


def content_sections(items):
    """Secciones que cuenta el plan: todo menos la navegación, el footer y el botón de WhatsApp."""
    groups = [str(it.get("id") or "").rsplit("-", 1)[0] for it in items if isinstance(it, dict)]
    return [g for g in groups if g not in ("navegacion", "footer", "whatsapp")]


def plan_errors(client, items):
    plan = client_plan(client)
    if not plan:
        return []
    errors = []
    limit = plan.get("secciones") or 0
    count = len(content_sections(items))
    if limit and count > limit:
        errors.append("el plan %s permite hasta %d secciones y esta landing tiene %d (sin contar navegación ni footer)"
                      % (plan["nombre"], limit, count))
    if not plan.get("turnos") and "reserva-turno" in content_sections(items):
        errors.append("la reserva de turnos no está incluida en el plan %s" % plan["nombre"])
    return errors


def add_change_request(client_id, data):
    nota = " ".join(str(data.get("nota") or "").split())[:300]
    with store("clientes") as db:
        row = find_client(db, client_id)
        row.setdefault("pedidos", []).append({"fecha": now_ms(), "nota": nota})
        row["pedidos"] = row["pedidos"][-60:]
    return get_client(client_id)


def remove_change_request(client_id, fecha):
    with store("clientes") as db:
        row = find_client(db, client_id)
        before = len(row.get("pedidos") or [])
        row["pedidos"] = [p for p in row.get("pedidos") or [] if p.get("fecha") != fecha]
        if len(row["pedidos"]) == before:
            raise ApiError(404, "No encontramos ese pedido.")
    return get_client(client_id)


def set_client_plan(client_id, data):
    plan = str(data.get("plan") or "")
    if plan and plan not in plan_ids():
        raise ApiError(400, "Elegí un plan del sitio de venta: " + ", ".join(plan_ids()) + ".")
    vence = str(data.get("plan_vence") or "").strip()
    if vence and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", vence):
        raise ApiError(400, "La fecha de vencimiento tiene que ser AAAA-MM-DD.")
    with store("clientes") as db:
        row = find_client(db, client_id)
        row.update(plan=plan, plan_vence=vence, actualizado=now_ms())
    render_client_landings(client_id)
    return get_client(client_id)


# --- Clientes ----------------------------------------------------------------

def client_type(row):
    saved = row.get("tipo_cliente")
    if saved in ("real", "demo"):
        return saved
    domain = (row.get("email") or "").strip().lower().rpartition("@")[2]
    return "demo" if domain in ("example.com", "example.net", "example.org") else "real"


def logo_ref(client):
    """Ruta del logo del cliente: l/<cliente>/logo.<ext>."""
    if not client.get("logo"):
        return ""
    return "/l/%s/%s?v=%d" % (client["slug"], client["logo"], client.get("actualizado") or 0)


def find_client(db, client_id):
    for row in db["clientes"]:
        if row["id"] == client_id:
            return row
    raise ApiError(404, "El cliente no existe")


def client_dict(row, count=None):
    data = {k: v for k, v in row.items() if k != "portal"}
    access = row.get("portal") or {}
    data["portal_usuario"] = access.get("usuario") or ""
    data["portal_clave"] = open_password(access.get("clave")) if access else ""
    data["pidio_clave"] = access.get("pidio_clave") or 0
    data["tipo_cliente"] = client_type(row)
    data["logo_url"] = logo_ref(row)
    data["carpeta"] = "/l/" + row["slug"] + "/"
    data["editor"] = editor_url(row)
    data["plan_estado"] = plan_status(row)
    if count is not None:
        data["landings"] = count
    return data


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


def valid_business_hours(value):
    if len(value) > 200 or any(ord(char) < 32 for char in value):
        return False
    if value.casefold().rstrip(".") in {"con turno previo", "solo con turno previo", "a convenir", "24 horas"}:
        return True
    hour = r"(?:[01]?[0-9]|2[0-3])(?::[0-5][0-9])?"
    interval = rf"(?<![0-9:]){hour}(?:\s*h)?\s*(?:a|hasta|[-–—])\s*{hour}(?![0-9:])"
    return bool(re.search(interval, value, re.IGNORECASE))


def clean_client(data, previous=None):
    values = {}
    for field in CLIENT_FIELDS:
        values[field] = str(data.get(field) or "").strip()
    if not values["nombre"]:
        raise ApiError(400, "El nombre del cliente es obligatorio")
    previous = previous or {}
    for field in ("email", "telefono", "sitio", "horario"):
        value = values[field]
        if not value or value == previous.get(field):
            continue
        if field == "email" and not EMAIL_RE.fullmatch(value):
            raise ApiError(400, "Revisá el email: no tiene un formato válido")
        if field == "telefono":
            normalized = re.sub(r"[ ()-]", "", value)
            if not re.fullmatch(r"\+[1-9][0-9]{7,14}", normalized):
                raise ApiError(400, "Ingresá el teléfono con código internacional, por ejemplo +54 11 5555-0000")
            values[field] = normalized
        if field == "sitio" and not legal_url(value):
            raise ApiError(400, "Ingresá un sitio web válido que empiece con https:// o http://")
        if field == "horario" and not valid_business_hours(value):
            raise ApiError(400, "Ingresá un horario como «Lun a Vie, 9 a 18 h» o «Con turno previo»")
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


def unique_client_slug(db, nombre, exclude_id=0):
    base = slugify(nombre, "cliente")
    taken = {c["slug"] for c in db["clientes"] if c["id"] != exclude_id}
    slug, n = base, 2
    while slug in taken:
        slug, n = "%s-%d" % (base, n), n + 1
    return slug


def decode_logo(data_url):
    match = re.match(r"^data:([\w/+.-]+);base64,(.+)$", data_url or "", re.S)
    if not match or match.group(1) not in LOGO_TYPES:
        raise ApiError(400, "El logo tiene que ser PNG, JPG, WEBP o SVG")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except ValueError:
        raise ApiError(400, "No se pudo leer el logo")
    if len(raw) > MAX_LOGO:
        raise ApiError(400, "El logo pesa más de 2 MB")
    return LOGO_TYPES[match.group(1)], raw


def write_logo(slug, data_url):
    ext, raw = decode_logo(data_url)
    remove_logo(slug)
    FILES.write("modulos", "l/%s/logo.%s" % (slug, ext), raw)
    return "logo." + ext


def remove_logo(slug):
    for path in FILES.listdir("modulos", "l/" + slug):
        if path.rsplit("/", 1)[-1].startswith("logo.") and path.count("/") == 2:
            FILES.delete("modulos", path)


def next_id(rows):
    return max([r["id"] for r in rows] or [0]) + 1


def list_clients():
    with store("clientes", "landings", save=False) as db:
        counts = {}
        for landing in db["landings"]:
            counts[landing["cliente_id"]] = counts.get(landing["cliente_id"], 0) + 1
        rows = sorted(db["clientes"], key=lambda c: c["nombre"].lower())
        return [client_dict(r, counts.get(r["id"], 0)) for r in rows]


def get_client(client_id):
    with store("clientes", "landings", save=False) as db:
        row = find_client(db, client_id)
        landings = sorted((l for l in db["landings"] if l["cliente_id"] == client_id),
                          key=lambda l: -l["actualizado"])
        data = client_dict(row, len(landings))
        data["lista"] = [landing_dict(l, row, summary=True) for l in landings]
        return data


def create_client(data):
    values = clean_client(data)
    with store("clientes") as db:
        values["slug"] = unique_client_slug(db, values["nombre"])
        values["id"] = next_id(db["clientes"])
        values["logo"] = write_logo(values["slug"], data["logo_data"]) if data.get("logo_data") else ""
        values["plan"] = values["plan_vence"] = ""
        values["creado"] = values["actualizado"] = now_ms()
        db["clientes"].append(values)
    return client_dict(values, 0)


def update_client(client_id, data):
    with store("clientes") as db:
        row = find_client(db, client_id)
        values = clean_client(data, row)
        if data.get("logo_data"):
            values["logo"] = write_logo(row["slug"], data["logo_data"])
        elif data.get("logo_quitar"):
            remove_logo(row["slug"])
            values["logo"] = ""
        values["actualizado"] = now_ms()
        row.update(values)
    render_client_landings(client_id)
    return get_client(client_id)


def delete_client(client_id):
    with store("clientes", "landings") as db:
        row = find_client(db, client_id)
        count = sum(1 for l in db["landings"] if l["cliente_id"] == client_id)
        if count:
            raise ApiError(409, "«%s» tiene %d landing%s. Eliminalas o pasalas a otro cliente antes de borrarlo."
                           % (row["nombre"], count, "" if count == 1 else "s"))
        db["clientes"].remove(row)
    FILES.delete("modulos", "l/" + row["slug"])
    return row["nombre"]


# --- Landings ----------------------------------------------------------------

def landing_dict(row, client, summary=False):
    url = "/l/%s/%s/" % (client["slug"], row["slug"])
    data = {
        "preview": row.get("portada") or "",
        "portada": row.get("portada") or "",
        "descripcion": row.get("descripcion") or "",
        "animacion": row.get("animacion") or "",
        "ejemplo": bool(row.get("ejemplo")),
        "id": row["id"],
        "cliente_id": row["cliente_id"],
        "cliente": client["nombre"],
        "cliente_slug": client["slug"],
        "nombre": row["nombre"],
        "slug": row["slug"],
        "creado": row["creado"],
        "actualizado": row["actualizado"],
        "url": url,
        "path": url.lstrip("/"),
        "editor": editor_url(client, row),
        "disponible": bool(row.get("html")),
    }
    data["aviso_plan"] = "; ".join(plan_errors(client, row.get("items") or []))
    if summary:
        data["cantidad_modulos"] = len(row.get("items") or [])
    else:
        data.update(items=row.get("items") or [], estilo=row.get("estilo") or "", ignorados=row.get("ignorados") or [])
    return data


def find_landing(db, landing_id):
    for row in db["landings"]:
        if row["id"] == landing_id:
            return row
    raise ApiError(404, "La landing no existe")


def list_landings(client_id=None):
    with store("clientes", "landings", save=False) as db:
        clients = {c["id"]: c for c in db["clientes"]}
        rows = [l for l in db["landings"] if (not client_id or l["cliente_id"] == client_id) and l["cliente_id"] in clients]
        rows.sort(key=lambda l: -l["actualizado"])
        return [landing_dict(r, clients[r["cliente_id"]], summary=True) for r in rows]


def get_landing(landing_id):
    with store("clientes", "landings", save=False) as db:
        row = find_landing(db, landing_id)
        return landing_dict(row, find_client(db, row["cliente_id"]))


def editor_url(client, landing=None):
    """Página donde el cliente arma su pedido de cambios (estática, sin login)."""
    base = read_config().get("urlPanel") or ""
    if landing is None:
        return base + "/portal/"
    return base + "/portal/editar/?l=" + quote(client["slug"] + "/" + landing["slug"])


def fill_image_alts(document):
    for image in document.xpath(".//img"):
        if not (image.get("alt") or "").strip():
            image.set("alt", "imagen")


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


def structure_errors(items, rules):
    """Errores de estructura que bloquean el guardado, con el mismo criterio que maquetas/js/reglas.js."""
    if not (rules.get("general") or {}).get("bloquear"):
        return []
    estructura = rules.get("estructura") or {}
    groups = [str(it.get("id") or "").rsplit("-", 1)[0] for it in items if isinstance(it, dict)]
    flow = [g for g in groups if g != "whatsapp"]
    active = {r.get("id"): r for r in estructura.get("reglas") or [] if r.get("activo") and r.get("nivel") == "error"}
    try:
        with open(os.path.join(ROOT, "data", "modules.json"), encoding="utf-8") as fh:
            names = {m["id"]: m["nombre"] for m in json.load(fh)}
    except (OSError, ValueError, KeyError, TypeError):
        names = {}
    errors = []
    if estructura.get("nivelObligatorios", "error") == "error":
        for group in estructura.get("obligatorios") or []:
            if group not in groups:
                errors.append("falta la sección «%s»" % names.get(group, group))
    if "inicio-navegacion" in active and "navegacion" in flow and flow[0] != "navegacion":
        errors.append("la Navegación tiene que ir primera")
    if "hero-segundo" in active and "hero-full-imagen" in flow:
        expected = flow.index("navegacion") + 1 if "navegacion" in flow else 0
        if flow.index("hero-full-imagen") != expected:
            errors.append("la portada tiene que ir justo después de la Navegación")
    if "fin-footer" in active and "footer" in flow and flow[-1] != "footer":
        errors.append("el Footer tiene que ir al final")
    if "whatsapp" in active and "whatsapp" not in groups:
        errors.append("falta el botón de WhatsApp")
    if "sin-repetidos" in active:
        for group in dict.fromkeys(groups):
            if groups.count(group) > 1:
                errors.append("la sección «%s» está repetida" % names.get(group, group))
    minimum = active.get("min-modulos", {}).get("valor")
    maximum = active.get("max-modulos", {}).get("valor")
    if isinstance(minimum, (int, float)) and len(flow) < minimum:
        errors.append("se necesitan al menos %s secciones" % minimum)
    if isinstance(maximum, (int, float)) and len(flow) > maximum:
        errors.append("se permiten como máximo %s secciones" % maximum)
    return errors


def image_metadata_errors(html, rules):
    if not (rules.get("general") or {}).get("bloquear"):
        return []
    document = html_dom.document_fromstring(html)
    count = len(document.xpath("//img[normalize-space(@src) and not(normalize-space(@alt))]"))
    errors = []
    if count:
        errors.append(f"{count} imagen(es) sin texto alternativo. Describí la imagen, transcribí su texto o escribí «imagen»")
    heavy = 0
    total = 0
    for src in document.xpath("//img/@src"):
        if not src.startswith(("/maquetas/", "/assets/")):
            continue
        try:
            size = os.path.getsize(os.path.join(ROOT, src.lstrip("/").split("?", 1)[0]))
        except OSError:
            continue
        total += size
        if size > 350 * 1024:
            heavy += 1
    if heavy:
        errors.append("%d imagen(es) pesan más de 350 KB. Comprimilas antes de publicar." % heavy)
    if total > 1500 * 1024:
        errors.append("Las imágenes de la landing superan 1,5 MB. Sacá o comprimí fotos.")
    return errors




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
    rules = read_rules()
    errors = structure_errors(items, rules) + image_metadata_errors(html, rules)
    if errors:
        raise ApiError(400, "No se puede guardar: " + "; ".join(errors) + ".")
    ignorados = data.get("ignorados") or []
    ignorados = [str(k)[:300] for k in ignorados][:200] if isinstance(ignorados, list) else []
    descripcion = " ".join(str(data.get("descripcion") or "").split())[:300]
    animacion = str(data.get("animacion") or "")
    if animacion not in ("", "suave", "marcada"):
        animacion = ""

    with store("clientes", "landings") as db:
        client = find_client(db, client_id)
        current = find_landing(db, landing_id) if landing_id else None
        slug = slugify(nombre)
        if any(l["cliente_id"] == client_id and l["slug"] == slug and l["id"] != (landing_id or 0) for l in db["landings"]):
            raise ApiError(409, "«%s» ya tiene una landing llamada así. Usá otro nombre o editá la existente." % client["nombre"])
        limits = plan_errors(client, items)
        if limits:
            raise ApiError(400, "No se puede guardar: " + "; ".join(limits) + ". Cambiá el plan en la ficha del cliente o sacá esas secciones.")
        html = publish_html(html, items, logo_ref(client))
        if (rules.get("general") or {}).get("bloquear"):
            final_markup = accessible_landing(html, nombre, client.get("color_primario"), client)
            errors = published_structure_errors(final_markup)
            if errors:
                raise ApiError(400, "No se puede publicar: " + "; ".join(errors) + ".")
        if client_type(client) == "real":
            placeholder = DEMO_PLACEHOLDERS.search(unescape(html))
            if placeholder:
                raise ApiError(400, "Reemplazá el dato de ejemplo «%s» antes de publicar." % placeholder.group())
        stamp = max(now_ms(), current["actualizado"] + 1) if current else now_ms()
        values = {"cliente_id": client_id, "nombre": nombre, "slug": slug, "items": items, "estilo": estilo,
                  "ignorados": ignorados, "descripcion": descripcion, "animacion": animacion, "html": html,
                  "portada": cover_of(html), "actualizado": stamp}
        if "ejemplo" in data:
            values["ejemplo"] = bool(data.get("ejemplo"))
        previous_path = None
        if current:
            old_client = find_client(db, current["cliente_id"])
            previous_path = (old_client["slug"], current["slug"])
            current.update(values)
            row = current
        else:
            row = dict(values, id=next_id(db["landings"]), creado=stamp, ejemplo=bool(data.get("ejemplo")))
            db["landings"].append(row)
    if previous_path and previous_path != (client["slug"], row["slug"]):
        FILES.delete("modulos", "l/%s/%s" % previous_path)
    render_landing(row, client)
    write_site_files()
    return landing_dict(row, client)


def set_landing_example(landing_id, value):
    with store("clientes", "landings") as db:
        row = find_landing(db, landing_id)
        row["ejemplo"] = bool(value)
        client = find_client(db, row["cliente_id"])
    write_site_files()
    return landing_dict(row, client)


def duplicate_landing(landing_id):
    with store("clientes", "landings") as db:
        row = find_landing(db, landing_id)
        client = find_client(db, row["cliente_id"])
        taken = {l["slug"] for l in db["landings"] if l["cliente_id"] == row["cliente_id"]}
        n = 1
        while True:
            nombre = row["nombre"] + (" (copia)" if n == 1 else " (copia %d)" % n)
            slug = slugify(nombre)
            if slug not in taken:
                break
            n += 1
        html = re.sub(r"<title>.*?</title>", lambda m: "<title>" + escape(nombre) + "</title>", row["html"], count=1, flags=re.S)
        stamp = now_ms()
        copy = json.loads(json.dumps(row))
        copy.update(id=next_id(db["landings"]), nombre=nombre, slug=slug, html=html, ejemplo=False, creado=stamp, actualizado=stamp)
        db["landings"].append(copy)
    render_landing(copy, client)
    return landing_dict(copy, client)


def delete_landing(landing_id):
    with store("clientes", "landings") as db:
        row = find_landing(db, landing_id)
        client = find_client(db, row["cliente_id"])
        db["landings"].remove(row)
    FILES.delete("modulos", "l/%s/%s" % (client["slug"], row["slug"]))
    write_site_files()
    return row["nombre"]


# --- Páginas estáticas -----------------------------------------------------------

def relative_paths(html, depth):
    """Las rutas /maquetas/…, /assets/… y /l/… pasan a relativas para que anden en GitHub Pages."""
    prefix = "../" * depth
    return ABS_REF.sub(prefix, html)


def whatsapp_number(client):
    digits = re.sub(r"\D", "", client.get("telefono") or "")
    return digits if 8 <= len(digits) <= 15 else ""


def landing_page(row, client):
    """HTML final de la landing, con rutas absolutas (/maquetas/…)."""
    if not row.get("html"):
        return None
    origin = read_config()["urlPublica"]
    path = "/l/%s/%s/" % (client["slug"], row["slug"])
    plan = client_plan(client)
    tracking = not plan or plan.get("medicion")
    meta = dict(row, cliente=client["nombre"], cliente_id=client["id"], cliente_actualizado=client.get("actualizado") or 0,
                logo=client.get("logo"), direccion=client.get("direccion") or "", telefono=client.get("telefono") or "",
                email=client.get("email") or "", tipo_cliente=client.get("tipo_cliente"),
                ga4=(client.get("ga4") or "") if tracking else "", gtm=(client.get("gtm") or "") if tracking else "",
                meta_pixel=(client.get("meta_pixel") or "") if tracking else "",
                slug_cliente=client["slug"])
    head = '<meta name="lz-landing" content="%d">' % row["id"]
    number = whatsapp_number(client)
    if number:
        head += '<meta name="lz-whatsapp" content="%s">' % number
    if client.get("email") and client_type(client) == "real":
        head += '<meta name="lz-email" content="%s">' % escape(client["email"], quote=True)
    head += share_head(meta, origin, path)
    html = row["html"].replace("</head>", head + "</head>", 1)
    html = accessible_landing(html, row["nombre"], primary_color=client.get("color_primario"), legal_links=client)
    return add_tracking_consent(html, meta)


def render_landing(row, client):
    html = landing_page(row, client)
    folder = "l/%s/%s" % (client["slug"], row["slug"])
    if not html:
        FILES.delete("modulos", folder)
        return
    FILES.write("modulos", folder + "/index.html", relative_paths(html, 3))


def render_client_landings(client_id):
    with store("clientes", "landings", save=False) as db:
        client = find_client(db, client_id)
        rows = [l for l in db["landings"] if l["cliente_id"] == client_id]
    for row in rows:
        render_landing(row, client)
    write_site_files()


def render_all():
    """Vuelve a generar todas las páginas de l/ y los archivos públicos (sitemap, robots, legales)."""
    with store("clientes", "landings", save=False) as db:
        clients = {c["id"]: c for c in db["clientes"]}
        rows = list(db["landings"])
    expected = set()
    for row in rows:
        client = clients.get(row["cliente_id"])
        if client:
            render_landing(row, client)
            expected.add((client["slug"], row["slug"]))
    for path in FILES.listdir("modulos", "l"):
        parts = path.split("/")
        if len(parts) >= 4 and (parts[1], parts[2]) not in expected:
            FILES.delete("modulos", "/".join(parts[:3]))
    write_site_files()
    return len(expected)


def sitemap_xml(origin, rows):
    paths = ["/l/%s/%s/" % pair for pair in rows]
    entries = "".join("<url><loc>%s</loc></url>" % escape(origin + path) for path in paths)
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries + "</urlset>\n"


def public_examples(db, origin):
    """Landings marcadas como ejemplo: son las que muestra el sitio de venta."""
    clients = {c["id"]: c for c in db["clientes"]}
    out = []
    for row in sorted(db["landings"], key=lambda l: l["creado"]):
        client = clients.get(row["cliente_id"])
        if not client or not row.get("ejemplo") or not row.get("html"):
            continue
        out.append({
            "nombre": client["nombre"],
            "rubro": client.get("rubro") or "",
            "landing": row["nombre"],
            "url": origin + "/l/%s/%s/" % (client["slug"], row["slug"]),
            "portada": (origin + row["portada"]) if row.get("portada") else "",
            "captura": row.get("captura") or "",
            "demo": client_type(client) == "demo",
        })
    return out


def write_site_files():
    """sitemap.xml, robots.txt y la lista de ejemplos para el sitio de venta."""
    config = read_config()
    origin = config["urlPublica"]
    with store("clientes", "landings", save=False) as db:
        clients = {c["id"]: c for c in db["clientes"]}
        real = [(clients[l["cliente_id"]]["slug"], l["slug"]) for l in db["landings"]
                if l["cliente_id"] in clients and l.get("html") and client_type(clients[l["cliente_id"]]) == "real"]
        examples = public_examples(db, origin)
    FILES.write("modulos", "sitemap.xml", sitemap_xml(origin, sorted(real)))
    FILES.write("modulos", "robots.txt",
                "User-agent: *\nDisallow: /maquetas/\nDisallow: /data/\nDisallow: /portal/\nSitemap: %s/sitemap.xml\n" % origin)
    for kind in ("privacidad", "terminos"):
        FILES.write("modulos", kind + "/index.html", legal_page(kind))
    if FILES.has("sitio"):
        body = ("/* Ejemplos que muestra la sección Proyectos. Los genera el panel de Lanzate_modulos con las\n"
                "   landings marcadas como «ejemplo». No lo edites a mano. */\nwindow.EJEMPLOS = %s;\n"
                % json.dumps(examples, ensure_ascii=False, indent=2))
        try:
            FILES.write("sitio", "js/ejemplos.js", body)
        except (OSError, ApiError) as err:
            print("No se pudo escribir la lista de ejemplos del sitio: %s" % err, file=sys.stderr)


# --- Publicar con git -----------------------------------------------------------

def git(folder, *args, timeout=120):
    try:
        done = subprocess.run(("git",) + args, cwd=folder, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        raise ApiError(500, "No está instalado git en esta computadora.")
    except subprocess.TimeoutExpired:
        raise ApiError(504, "git tardó demasiado. Revisá la conexión y probá de nuevo.")
    return done.returncode, (done.stdout + done.stderr).strip()


def publish_repo(folder, message):
    if not os.path.isdir(os.path.join(folder, ".git")):
        return {"carpeta": os.path.basename(folder), "ok": False, "detalle": "La carpeta no es un repositorio de git."}
    git(folder, "add", "-A")
    code, out = git(folder, "diff", "--cached", "--quiet")
    if code == 0:
        changed = False
    else:
        code, out = git(folder, "commit", "-m", message)
        if code != 0:
            return {"carpeta": os.path.basename(folder), "ok": False, "detalle": out[-500:]}
        changed = True
    code, out = git(folder, "pull", "--rebase", "--autostash")
    if code != 0:
        git(folder, "rebase", "--abort")
        return {"carpeta": os.path.basename(folder), "ok": False,
                "detalle": "GitHub tiene cambios que chocan con los tuyos. Resolvelo con git en la Terminal.\n" + out[-400:]}
    code, out = git(folder, "push")
    if code != 0:
        return {"carpeta": os.path.basename(folder), "ok": False, "detalle": out[-500:]}
    return {"carpeta": os.path.basename(folder), "ok": True,
            "detalle": "Cambios publicados." if changed else "No había cambios nuevos; se sincronizó con GitHub."}


def publish(data):
    message = " ".join(str(data.get("mensaje") or "").split())[:200] or "Actualiza landings desde el panel"
    sync_plans()
    render_all()
    if FILES.online:
        repos = FILES.commit(message)
        names = {"modulos": "repositorio-modulos", "sitio": "lanzate"}
        return {"resultados": [{"carpeta": names[r], "ok": True, "detalle": "Cambios publicados."} for r in repos] or
                [{"carpeta": "GitHub", "ok": True, "detalle": "Todo estaba publicado."}],
                "url": read_config()["urlPublica"]}
    results = [publish_repo(ROOT, message)]
    if os.path.isdir(SITIO_VENTA):
        results.append(publish_repo(SITIO_VENTA, message))
    return {"resultados": results, "url": read_config()["urlPublica"]}


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


def sync_landing_footer_menu(body):
    def has_class(name):
        return 'contains(concat(" ", normalize-space(@class), " "), " %s ")' % name

    navs = body.xpath('.//nav[%s]' % has_class("nx-nav"))
    if not navs:
        return
    links = [link for nav in navs for link in nav.xpath('.//a[@href and %s]' % has_class("nav-link"))]
    for footer in body.xpath('.//footer[%s]' % has_class("nx-footer")):
        menus = footer.xpath('.//*[%s or (self::nav and @aria-label="Navegación del pie")]' % has_class("foot-links"))
        for index, menu in enumerate(menus):
            label = menu.getprevious()
            if index or not links:
                if label is not None and "nx-footer-label" in label.get("class", "").split():
                    label.getparent().remove(label)
                menu.getparent().remove(menu)
                continue
            menu.attrib.pop("hidden", None)
            menu.text = None
            existing_style = next((link.get("style") for link in menu.iter("a") if link.get("style")), None)
            for child in list(menu):
                menu.remove(child)
            for source in links:
                parent = etree.SubElement(menu, "li") if menu.tag in ("ul", "ol") else menu
                attrs = {key: source.get(key) for key in ("href", "target", "rel", "aria-label") if key in source.attrib}
                if existing_style:
                    attrs["style"] = existing_style
                etree.SubElement(parent, "a", **attrs).text = source.text_content().strip()


@lru_cache(maxsize=1024)
def local_image_variants(stem):
    variants = [(width, f"{stem}-{width}.webp") for width in (480, 752, 800, 960, 1280, 1600)]
    return [(width, asset) for width, asset in variants if os.path.isfile(os.path.join(ROOT, asset.lstrip("/")))]


def published_structure_errors(markup):
    doc = html_dom.document_fromstring(markup)
    main = doc.xpath("//main")
    if len(main) != 1 or len(main[0].xpath(".//h1")) != 1:
        return ["la página final necesita un contenido principal y un encabezado H1"]
    if doc.xpath("//img[not(normalize-space(@alt))]"):
        return ["hay imágenes sin descripción alternativa"]
    return []


def add_local_responsive_images(body):
    for image in body.xpath(".//img[@src and not(@srcset)]"):
        source = image.get("src")
        if not source.startswith("/maquetas/img/"):
            continue
        path = source.split("?", 1)[0].split("#", 1)[0]
        if not path.startswith("/maquetas/img/") or ".." in path.split("/"):
            continue
        stem, _ = os.path.splitext(path)
        existing = local_image_variants(stem)
        if len(existing) < 2:
            continue
        image.set("srcset", ", ".join(f"{asset} {width}w" for width, asset in existing))
        if not image.get("sizes"):
            image.set("sizes", "100vw")


def accessible_landing(markup, title, primary_color=None, legal_links=None):
    document = html_dom.document_fromstring(markup)
    body = document.find("body")
    if body is None or "landing-page" not in body.get("class", "").split():
        return markup

    sync_landing_footer_menu(body)
    fill_image_alts(body)
    head = document.find("head")
    for link in document.xpath('.//link[contains(@href, "fonts.googleapis") or contains(@href, "fonts.gstatic")]'):
        link.getparent().remove(link)
    if head is not None and not document.xpath('.//link[contains(@href, "css/fonts.css")]'):
        fonts = etree.Element("link", rel="stylesheet", href="/maquetas/css/fonts.css")
        head.insert(0, fonts)

    travel_images = {
        'asesora',
        'cat-aventura',
        'cat-bienestar',
        'cat-ciudades',
        'cat-gastronomia',
        'cat-historia',
        'cat-naturaleza',
        'cat-playa',
        'cat-romance',
        'dest-bariloche',
        'dest-cancun',
        'dest-rio',
        'gal-1',
        'gal-2',
        'gal-3',
        'promo-feature',
        'promo-floripa',
        'promo-madrid',
        'promo-miami',
        'promo-puntacana',
        'promo-salta',
        'promo-ushuaia',
    }
    travel_path = "/maquetas/img/rubros/viajes/"
    for image in body.xpath('.//img[starts-with(@src, "/maquetas/img/rubros/viajes/") and not(@srcset)]'):
        source = image.get("src")
        if source.startswith(travel_path):
            source = source[len(travel_path):]
        if source.endswith(".jpg") and source[:-4] in travel_images:
            image.set("src", travel_path + source[:-4] + ".webp")

    # La paleta guardada por el constructor tiene precedencia sobre la del cliente.
    accent = next((
        match[1]
        for style in document.xpath("./head/style/text()")
        if (match := re.search(r"--green:\s*(#[0-9a-fA-F]{6})\s*(?:;|})", style))
    ), primary_color)
    cta_color = accessible_button_color(accent)
    if cta_color:
        style = etree.SubElement(document.find("head"), "style")
        style.text = ".landing-page .btn-nx:not(:hover):not(:active){background-color:" + cta_color + ";color:#fff}"
    for section in body.xpath('.//section[starts-with(@data-module, "navegacion-media")]'):
        for node in section.xpath(".//*[@style]"):
            cleaned = re.sub(r"background-image\s*:\s*[^;]+;?", "", node.get("style") or "", flags=re.I).strip(" ;")
            if cleaned:
                node.set("style", cleaned)
            else:
                node.attrib.pop("style", None)
        for nav in section.xpath(".//nav[contains(concat(' ', normalize-space(@class), ' '), ' nx-nav ')]"):
            classes = nav.get("class", "")
            if "nx-nav-media" not in classes.split():
                nav.set("class", (classes + " nx-nav-media").strip())
    for brand in body.xpath('.//section[starts-with(@data-module, "navegacion-media")]//a[contains(concat(" ", normalize-space(@class), " "), " nx-brand ")]'):
        images = brand.xpath(".//img")
        label = " ".join("".join(brand.itertext()).split())
        if not label and images:
            label = " ".join((images[0].get("alt") or "").split())
        for image in images:
            image.getparent().remove(image)
        if label and not " ".join(brand.itertext()).strip():
            brand.text = label
    for label in body.xpath(".//h2"):
        classes = " " + " ".join(label.get("class", "").split()) + " "
        if any(token in classes for token in (" kicker ", " eyebrow ", " overline ", " plan-kicker ", " h6 ")):
            label.tag = "p"
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

    for heading in body.xpath('.//footer//h2[not(contains(concat(" ", normalize-space(@class), " "), " nx-display "))]'):
        if len(" ".join(heading.text_content().split())) <= 30:
            heading.tag = "p"
            heading.set("class", "h6 nx-footer-label")

    for link in body.xpath('.//footer//a[starts-with(@href, "#footer")]'):
        label = " ".join(link.text_content().casefold().split())
        key = {"privacidad": "privacidad_url", "términos": "terminos_url"}.get(label)
        if not key:
            continue
        destination = legal_url((legal_links or {}).get(key, ""))
        link.set("href", destination or ("/privacidad" if key == "privacidad_url" else "/terminos"))
        link.set("target", "_blank")
        link.set("rel", "noopener")

    hero_variants = {
        "/maquetas/img/hero-simple-full.jpg": 800,
        "/maquetas/img/hero-media-full.jpg": 800,
        "/maquetas/img/hero-compleja-full.jpg": 800,
        "/maquetas/img/gal-living.jpg": 752,
        "/maquetas/img/rubros/viajes/hero-1.jpg": 1280,
        "/maquetas/img/rubros/viajes/hero-2.jpg": 1280,
        "/maquetas/img/rubros/viajes/hero-3.jpg": 1280,
    }
    slides = body.xpath(
        './/section[starts-with(@data-module, "hero")]'
        '//*[contains(concat(" ", normalize-space(@class), " "), " nx-hero-slide ")]'
    )
    for index, slide in enumerate(slides):
        style = slide.get("style", "")
        match = re.search(r"""(?:^|;)\s*background-image\s*:\s*url\(\s*['"]?([^'"()]+)['"]?\s*\)\s*(?=;|$)""", style)
        if match is None:
            continue
        source = match[1].strip()
        width = hero_variants.get(source)
        base = source[:-4] if source.endswith(".jpg") else source
        description = " ".join(slide.attrib.pop("data-lz-background-alt", "").split()) or "imagen"
        attrs = {
            "class": "lz-hero-photo",
            "src": source,
            "alt": description,
            "sizes": "100vw",
        }
        if width:
            attrs["srcset"] = f"{base}-480.webp 480w, {base}-{width}.webp {width}w"
        attrs["loading"] = "eager" if index == 0 else "lazy"
        attrs["fetchpriority"] = "high" if index == 0 else "low"
        photo = etree.Element("img", attrs)
        slide.set("style", style[:match.start()] + style[match.end():].lstrip(";") if match.start() == 0
                  else style[:match.start()] + style[match.end():])
        slide.insert(0, photo)

    for background in body.xpath('.//section[starts-with(@data-module, "hero")]//*[@data-lz-background-alt or contains(@style, "background-image")]'):
        description = " ".join(background.get("data-lz-background-alt", "").split()) or "imagen"
        if description and not background.xpath('./p[@data-lz-background-description]'):
            alternative = etree.Element("p", {"class": "visually-hidden", "data-lz-background-description": ""})
            alternative.text = description
            background.insert(0, alternative)

    add_local_responsive_images(body)
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
    image = origin + row["portada"] if row.get("portada") and origin else ""
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
    icon = ("/l/%s/%s" % (row["slug_cliente"], row["logo"])) if row.get("logo") else "/assets/favicon-lanzate.svg"
    canonical = '<link rel="canonical" href="%s">' % escape(origin + path, quote=True) if origin else ""
    return out + '<link rel="icon" href="%s">' % escape(icon, quote=True) + canonical + local_business_head(row, origin + path)


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



def legal_page(kind):
    title = "Privacidad" if kind == "privacidad" else "Términos"
    body = (
        "Esta página explica cómo se usan los datos que dejás en el formulario de contacto."
        if kind == "privacidad" else
        "El uso del sitio y de los servicios se acuerda directamente con el negocio que publica esta landing."
    )
    html = (
        "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        "<title>%s · Lanzate</title></head><body style=\"font:16px/1.5 Inter,sans-serif;max-width:40rem;margin:48px auto;padding:0 16px\">"
        "<h1>%s</h1><p>%s</p><p>Si el negocio tiene su propio documento, el enlace del pie de página abre ese documento.</p>"
        "</body></html>"
    ) % (title, title, body)
    return html.encode("utf-8")



# --- IA (textos y módulos sugeridos) ------------------------------------------
# La clave vive fuera del repositorio, en ~/.lanzate/ia.json.

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
        raise ApiError(400, "Online, la clave de la IA se carga en Vercel (variable ANTHROPIC_API_KEY u OPENAI_API_KEY).")
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


IA_CONTENT_RULES = (
    "Usá como hechos solo los datos confirmados de la ficha del cliente. "
    "El objetivo de la landing y los ejemplos de los módulos orientan la redacción. "
    "Los ejemplos no son evidencia del negocio. "
    "No inventes precios, descuentos, reseñas, testimonios, puntuaciones, fotos, "
    "nombres del equipo, certificaciones, horarios, direcciones ni resultados. "
    "Si faltan datos para una afirmación, usá texto neutral o una invitación a consultar."
)


def ia_client_text(c):
    c = c or {}
    parts = ["Negocio: " + (c.get("nombre") or "sin nombre")]
    for key, label in (("rubro", "Rubro"), ("notas", "Notas del cliente"), ("sitio", "Sitio actual"),
                       ("direccion", "Dirección"), ("horario", "Horario de atención")):
        if c.get(key):
            parts.append("%s: %s" % (label, c[key]))
    return "\n".join(parts)


def module_catalog():
    path = Path(ROOT, "maquetas", "index.html")
    document = html_dom.parse(str(path))
    return {
        module.get("id"): section.get("id")
        for section in document.xpath("//section[@data-section and @id]")
        for module in section.xpath(".//section[@id and contains(concat(' ', normalize-space(@class), ' '), ' mq-block ')]")
    }


def validate_module_suggestion(response, available, rules):
    ids = response.get("modulos") if isinstance(response, dict) else None
    if not isinstance(ids, list) or not ids or any(
        not isinstance(module_id, str) or module_id not in available for module_id in ids
    ):
        raise ApiError(502, "La IA sugirió módulos fuera del catálogo. Probá de nuevo.")
    groups = [available[module_id] for module_id in ids]
    if len(groups) != len(set(groups)):
        raise ApiError(502, "La IA sugirió más de una variante de la misma sección. Probá de nuevo.")
    errors = structure_errors([{"id": module_id} for module_id in ids], rules)
    if errors:
        raise ApiError(502, "La propuesta de la IA no cumple las reglas: " + "; ".join(errors) + ".")
    return ids


def ia_suggest_modules(data):
    requested_catalog = data.get("catalogo")
    if not isinstance(requested_catalog, list):
        raise ApiError(400, "No llegó la lista de módulos")
    available = module_catalog()
    catalog = [
        item for item in requested_catalog
        if isinstance(item, dict) and isinstance(item.get("id"), str) and item["id"] in available
    ]
    if not catalog:
        raise ApiError(400, "No llegó la lista de módulos")
    prompt = (
        ia_client_text(data.get("cliente")) + "\n"
        + ("Objetivo de la landing: " + data["objetivo"] + "\n" if data.get("objetivo") else "")
        + "\nReglas de contenido: " + IA_CONTENT_RULES
        + "\nOmití módulos que requieran datos concretos ausentes, como precios, reseñas o fotos del negocio.\n"
        + "\nReglas de estructura:\n" + str(data.get("reglas") or "") + "\n\n"
        + "Módulos disponibles (id · sección · variante · descripción):\n"
        + "\n".join("%s · %s · %s · %s" % (m.get("id"), m.get("grupo"), m.get("variante"), m.get("nota", "")) for m in catalog)
        + "\n\nElegí los módulos para la landing de este negocio, en orden, cumpliendo las reglas de estructura "
        + "(una sola variante por sección). Respondé con este JSON: "
        + '{"modulos": ["id", ...], "motivo": "una o dos frases que expliquen la elección"}'
    )
    out = ia_call(IA_SYSTEM, prompt)
    allowed = {item["id"]: available[item["id"]] for item in catalog}
    ids = validate_module_suggestion(out, allowed, read_rules())
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
        + "- " + IA_CONTENT_RULES + "\n"
        + "- Si un texto no aplica, reemplazalo por una descripción general sin agregar afirmaciones sobre el negocio.\n"
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
        + "- Mantené el sentido, el tono y los datos (nombres, cifras, contacto) del texto original. No agregues hechos nuevos al ajustar el largo.\n"
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
        minimum, maximum = limits[slot_id]
        if maximum:
            visible = text.replace("*", "")
            if len(visible) > maximum:
                text = visible[:maximum].rstrip()
        length = len(text.replace("*", ""))
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
        + "\n\n- Transcribí el texto visible si la imagen representa texto. Si es una foto, describí lo que se ve en hasta %d caracteres.\n" % limit
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




# --- HTTP (solo en tu computadora) ------------------------------------------------

def not_found_page():
    return Path(ROOT, "404.html").read_bytes()


ACTION_NAMES = {"clientes": "Alta de cliente", "cliente": "Actualiza cliente", "plan": "Actualiza plan",
                "pedidos": "Registra pedido de cambios", "landings": "Crea landing", "landing": "Actualiza landing",
                "duplicate": "Duplica landing", "reglas": "Actualiza reglas", "acceso": "Actualiza acceso al portal",
                "clave-enviada": "Marca contraseña enviada", "portal-olvide": "Cliente pide su contraseña"}


class Handler(SimpleHTTPRequestHandler):
    extra_headers = ()

    def cookie(self, name):
        for part in (self.headers.get("Cookie") or "").split(";"):
            key, _, value = part.strip().partition("=")
            if key == name:
                return value
        return ""

    def session_cookie(self, value, max_age, name=COOKIE):
        secure = "; Secure" if ON_VERCEL or self.headers.get("X-Forwarded-Proto") == "https" else ""
        return "%s=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Lax%s" % (name, value, max_age, secure)

    def portal_client(self):
        return portal_client(self.cookie(PORTAL_COOKIE))

    def authorized(self):
        return not login_required() or valid_session(self.cookie(COOKIE))

    def route_path(self):
        url = urlsplit(self.path)
        query = parse_qs(url.query)
        return query.pop("__path", [""])[0] or unquote(url.path), query

    def serve_page(self, path):
        """Páginas del panel (piden la clave) y archivos que viven en GitHub (/l/…, /data/…)."""
        if path == "/data/reglas.json":
            if not self.authorized():
                self.send_json(401, {"error": "Ingresá con la clave del equipo."})
            else:
                self.send_json(200, read_rules())
            return True
        if path in PANEL_PAGES:
            if not self.authorized():
                self.send_response(303)
                self.send_header("Location", "/maquetas/login.html?volver=" + quote(path + ("?" + urlsplit(self.path).query if urlsplit(self.path).query else "")))
                self.send_header("Content-Length", "0")
                self.end_headers()
                return True
            if ON_VERCEL:
                self.send_body(200, Path(ROOT, path.lstrip("/")).read_bytes(), "text/html; charset=utf-8")
                return True
            return False
        if FILES.online and (path.startswith("/l/") or re.match(r"^/data/[a-z]+\.js$", path)):
            rel = path.lstrip("/")
            if rel.endswith("/") or rel.count("/") == 2 and "." not in rel.rsplit("/", 1)[-1]:
                rel = rel.rstrip("/") + "/index.html"
            data = FILES.read("modulos", rel)
            if data is None:
                self.send_body(404, not_found_page(), "text/html; charset=utf-8")
            else:
                kind = {"html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "png": "image/png",
                        "jpg": "image/jpeg", "webp": "image/webp", "svg": "image/svg+xml"}.get(rel.rsplit(".", 1)[-1], "application/octet-stream")
                self.send_body(200, data, kind)
            return True
        return False

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_body(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for name, value in self.extra_headers:
            self.send_header(name, value)
        self.extra_headers = ()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

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

    def same_origin(self):
        """El panel solo acepta cambios desde sus propias páginas."""
        origin = self.headers.get("Origin")
        if not origin:
            return True
        hosts = {(self.headers.get("Host") or "").strip()}
        hosts.update(h.strip() for h in (self.headers.get("X-Forwarded-Host") or "").split(",") if h.strip())
        return urlsplit(origin).netloc in hosts

    def serve_lanzate(self, method):
        path, query = self.route_path()
        if method in ("GET", "HEAD") and self.serve_page(path):
            return True
        for pattern, name in ROUTES:
            match = pattern.match(path)
            if match:
                break
        else:
            if path.startswith("/api/"):
                self.send_json(404, {"error": "Ruta inexistente"})
                return True
            return False
        token = match.group(1) if match.groups() else ""
        ident = int(token) if str(token).isdigit() else None
        FILES.begin()
        try:
            if method != "GET" and not self.same_origin():
                raise ApiError(403, "Pedido rechazado.")
            if name not in PUBLIC_ROUTES and not self.authorized():
                raise ApiError(401, "Ingresá con la clave del equipo.")
            if name == "portal-datos":
                client = self.portal_client()
                if not client and self.authorized():
                    slug = (query.get("c") or [""])[0]
                    client = next((c for c in read_data("clientes", []) if c["slug"] == slug), None)
                if not client:
                    raise ApiError(401, "Ingresá a tu portal.")
                self.send_body(200, portal_data_js(client).encode("utf-8"), "text/javascript; charset=utf-8")
                return True
            result = self.dispatch(method, name, ident, query)
            if method != "GET" and name not in ("publicar", "portal-login", "portal-logout"):
                action = "Borra " + ("cliente" if name == "cliente" else "landing") if method == "DELETE" else ACTION_NAMES.get(name, "Actualiza datos")
                FILES.commit(action + " desde el panel")
        except ApiError as err:
            FILES.discard()
            self.send_json(err.status, {"error": str(err)})
        except OSError as err:
            FILES.discard()
            print("Error de archivos: %s" % err, file=sys.stderr)
            self.send_json(500, {"error": "No se pudo guardar en la carpeta del proyecto: %s" % err})
        else:
            self.send_json(200, result)
        return True

    def dispatch(self, method, name, ident, query):
        if name == "sesion" and method == "GET":
            return {"ok": self.authorized(), "requiere": login_required(), "online": FILES.online}
        if name == "login" and method == "POST":
            if not access_key():
                raise ApiError(500, "Falta configurar la clave del equipo (LANZATE_CLAVE).")
            data = self.read_json()
            if not valid_credentials(str(data.get("usuario") or ""), str(data.get("clave") or "")):
                time.sleep(1)
                raise ApiError(401, "El usuario o la contraseña no son correctos.")
            self.extra_headers = (("Set-Cookie", self.session_cookie(make_session(), SESSION_DAYS * 86400)),)
            return {"ok": True}
        if name == "acceso" and method == "POST":
            return set_portal_access(ident, self.read_json())
        if name == "clave-enviada" and method == "POST":
            return clear_password_request(ident)
        if name == "portal-login" and method == "POST":
            data = self.read_json()
            client = portal_login(data.get("usuario"), data.get("clave"))
            token = portal_token(client["id"], client["portal"]["version"])
            self.extra_headers = (("Set-Cookie", self.session_cookie(token, 30 * 86400, PORTAL_COOKIE)),)
            return {"ok": True}
        if name == "portal-logout" and method == "POST":
            self.extra_headers = (("Set-Cookie", self.session_cookie("", 0, PORTAL_COOKIE)),)
            return {"ok": True}
        if name == "portal-sesion" and method == "GET":
            client = self.portal_client()
            return {"ok": bool(client), "nombre": client["nombre"] if client else ""}
        if name == "portal-olvide" and method == "POST":
            return request_password(self.read_json().get("usuario"))
        if name == "portal-inicio" and method == "GET":
            client = self.portal_client()
            if not client:
                raise ApiError(401, "Ingresá a tu portal.")
            return portal_home(client)
        if name == "logout" and method == "POST":
            self.extra_headers = (("Set-Cookie", self.session_cookie("", 0)),)
            return {"ok": True}
        if name == "config" and method == "GET":
            return read_config()
        if name == "planes" and method == "GET":
            return read_data("planes", {}).get("planes") or []
        if name == "plan" and method == "PUT":
            return set_client_plan(ident, self.read_json())
        if name == "pedidos":
            if method == "POST":
                return add_change_request(ident, self.read_json())
            if method == "DELETE":
                return remove_change_request(ident, int((query.get("fecha") or ["0"])[0] or 0))
        if name == "publicar" and method == "POST":
            return publish(self.read_json())
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
                data = self.read_json()
                if set(data) == {"ejemplo"}:
                    return set_landing_example(ident, data["ejemplo"])
                return save_landing(data, ident)
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

    def send_head(self):
        local = self.translate_path(self.path)
        if not os.path.exists(local):
            self.send_body(404, not_found_page(), "text/html; charset=utf-8")
            return None
        return super().send_head()

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
    host = "127.0.0.1"
    sync_plans()
    if FILES.read("modulos", data_path("clientes")) is None:
        write_data("clientes", [])
        write_data("landings", [])
    server = ThreadingHTTPServer((host, port), partial(Handler, directory=ROOT))
    print("Lanzate en http://%s:%d/" % (host, port))
    print("  Clave del equipo: " + ("activada" if access_key() else "sin clave (cargala en ~/.lanzate/lanzate.env)"))
    print("  Constructor → http://%s:%d/maquetas/constructor.html" % (host, port))
    print("  Landings    → http://%s:%d/maquetas/landings.html" % (host, port))
    print("  Clientes    → http://%s:%d/maquetas/clientes.html" % (host, port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
