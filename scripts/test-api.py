"""Pruebas de punta a punta de la API, en modo online (como en Vercel) con GitHub y Redis simulados.

    python3 scripts/test-api.py

Levanta el panel en un puerto libre con datos de prueba (tests/fixtures) y prueba lo que no se puede romper:
acceso, límites de intentos, guardados simultáneos, portal, pedidos con fotos, visitas, consultas y publicar.
"""
import base64
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import servicios_simulados as sim  # noqa: E402

TEAM = {"usuario": "equipo", "clave": "clave-del-equipo-123"}
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Client:
    """Pedidos HTTP con cookies a mano: las cookies son Secure (como en Vercel) y acá se prueba por http."""

    def __init__(self, base, ip="10.0.0.1"):
        self.base, self.ip, self.cookies = base, ip, {}

    def call(self, method, path, body=None, raw=False, headers=None):
        h = {"Content-Type": "application/json", "X-Real-IP": self.ip}
        if self.cookies:
            h["Cookie"] = "; ".join("%s=%s" % kv for kv in self.cookies.items())
        h.update(headers or {})
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=h)

        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *a, **k):
                return None
        opener = urllib.request.build_opener(NoRedirect())
        try:
            resp = opener.open(req, timeout=60)
            status, out, headers_out = resp.status, resp.read(), resp.headers
        except urllib.error.HTTPError as err:
            status, out, headers_out = err.code, err.read(), err.headers
        for c in headers_out.get_all("Set-Cookie") or []:
            k, _, v = c.split(";")[0].partition("=")
            if v:
                self.cookies[k] = v
            else:
                self.cookies.pop(k, None)
        if raw:
            return status, out
        try:
            return status, json.loads(out or b"null")
        except ValueError:
            return status, out

    def login(self, usuario=TEAM["usuario"], clave=TEAM["clave"]):
        return self.call("POST", "/api/login", {"usuario": usuario, "clave": clave})[0]


def read_js(repo, path):
    text = sim.repo_file(repo, path).decode("utf-8")
    return json.loads(text[text.index("=") + 1:text.rindex(";")])


class ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        datos = Path(cls.tmp, "datos")
        shutil.copytree(ROOT / "tests" / "fixtures" / "datos", datos)
        sim.load("repositorio-modulos", str(ROOT))
        sim.load("lanzate-datos", str(datos))
        sim.load("lanzate", str(ROOT / "tests" / "fixtures" / "sitio"))
        github, redis = sim.start()
        port = free_port()
        env = dict(os.environ, VERCEL="1", GITHUB_TOKEN="token-de-prueba", LANZATE_GITHUB_API=github,
                   LANZATE_REPO="prueba/repositorio-modulos", LANZATE_SITIO_REPO="prueba/lanzate",
                   LANZATE_DATOS_REPO="prueba/lanzate-datos", KV_REST_API_URL=redis, KV_REST_API_TOKEN="x",
                   LANZATE_USUARIO=TEAM["usuario"], LANZATE_CLAVE=TEAM["clave"],
                   LANZATE_SECRETO="secreto-de-prueba-0123456789abcdefghij", HOME=cls.tmp)
        cls.proc = subprocess.Popen([sys.executable, str(ROOT / "server.py"), str(port)], cwd=str(ROOT), env=env,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        cls.base = "http://127.0.0.1:%d" % port
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base + "/api/sesion", timeout=1)
                break
            except OSError:
                time.sleep(0.1)
        cls.team = Client(cls.base, "10.0.0.1")
        assert cls.team.login() == 200, "no se pudo entrar con la clave del equipo"
        cls.client_id = read_js("lanzate-datos", "data/clientes.js")[0]["id"]
        cls.slug = read_js("lanzate-datos", "data/clientes.js")[0]["slug"]
        cls.landing = read_js("lanzate-datos", "data/landings.js")[0]

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def setUp(self):
        sim.reset_redis()

    # --- Acceso ---------------------------------------------------------------------------
    def test_private_data_needs_team_session(self):
        anon = Client(self.base, "10.1.0.1")
        self.assertEqual(anon.call("GET", "/api/clientes")[0], 401)
        self.assertEqual(anon.call("GET", "/data/clientes.js", raw=True)[0], 401)
        self.assertEqual(anon.call("GET", "/data/landings.js", raw=True)[0], 401)
        self.assertEqual(anon.call("GET", "/maquetas/clientes.html", raw=True)[0], 303)
        self.assertEqual(self.team.call("GET", "/data/clientes.js", raw=True)[0], 200)

    def test_csp_on_panel_and_portal(self):
        req = urllib.request.Request(self.base + "/portal/%s/" % self.slug)
        with urllib.request.urlopen(req) as resp:
            self.assertIn("frame-ancestors 'self'", resp.headers.get("Content-Security-Policy", ""))

    def test_login_lockout_is_per_user_and_connection(self):
        attacker = Client(self.base, "10.2.0.1")
        codes = [attacker.login(clave="mala") for _ in range(6)]
        self.assertEqual(codes[:5], [401] * 5)
        self.assertEqual(codes[5], 429, "al 6.º intento desde la misma conexión tiene que bloquear")
        owner = Client(self.base, "10.2.0.2")
        self.assertEqual(owner.login(), 200, "el dueño, desde otra conexión, tiene que poder entrar")

    def test_login_limit_per_connection(self):
        bot = Client(self.base, "10.3.0.1")
        codes = [bot.call("POST", "/api/portal/login", {"usuario": "u%d" % n, "clave": "x"})[0] for n in range(21)]
        self.assertEqual(codes[-1], 429)

    # --- Guardados ------------------------------------------------------------------------
    def test_simultaneous_saves_are_all_kept(self):
        ids = []
        for n in range(4):
            status, out = self.team.call("POST", "/api/clientes", {"nombre": "Simultáneo %d" % n})
            self.assertEqual(status, 200, out)
            ids.append(out["id"])
        rows = {i: self.team.call("GET", "/api/clientes/%d" % i)[1] for i in ids}
        results = {}

        def save(i):
            body = dict(rows[i], notas="nota-%d" % i)
            results[i] = self.team.call("PUT", "/api/clientes/%d" % i, body)[0]
        threads = [threading.Thread(target=save, args=(i,)) for i in ids]
        [t.start() for t in threads]
        [t.join() for t in threads]
        self.assertEqual(sorted(results.values()), [200] * 4)
        saved = {c["id"]: c.get("notas") for c in read_js("lanzate-datos", "data/clientes.js")}
        for i in ids:
            self.assertEqual(saved[i], "nota-%d" % i, "se perdió el guardado del cliente %d" % i)
        for i in ids:
            self.team.call("DELETE", "/api/clientes/%d" % i)

    def test_private_data_never_written_to_public_repo(self):
        self.team.call("POST", "/api/clientes", {"nombre": "Solo privado"})
        for path in ("data/clientes.js", "data/landings.js"):
            self.assertIsNone(sim.repo_file("repositorio-modulos", path))
            self.assertIsNotNone(sim.repo_file("lanzate-datos", path))

    # --- Portal ---------------------------------------------------------------------------
    def portal_access(self, usuario="prueba-portal"):
        status, out = self.team.call("POST", "/api/clientes/%d/acceso" % self.client_id, {"usuario": usuario, "clave": ""})
        self.assertEqual(status, 200, out)
        return out["clave_nueva"]

    def test_portal_password_is_visible_to_the_team_and_stored_encrypted(self):
        clave = self.portal_access()
        self.assertGreaterEqual(len(clave), 8)
        row = next(c for c in read_js("lanzate-datos", "data/clientes.js") if c["id"] == self.client_id)
        self.assertIn("clave", row["portal"], "el equipo tiene que poder ver la contraseña")
        self.assertNotIn(clave, sim.repo_file("lanzate-datos", "data/clientes.js").decode("utf-8"), "se guarda cifrada")
        self.assertEqual(self.team.call("GET", "/api/clientes/%d" % self.client_id)[1].get("portal_clave"), clave)
        status, out = self.team.call("POST", "/api/clientes/%d/acceso" % self.client_id, {"usuario": "prueba-portal", "clave": "una-clave-elegida"})
        self.assertEqual(status, 200, out)
        self.assertEqual(self.team.call("GET", "/api/clientes/%d" % self.client_id)[1].get("portal_clave"), "una-clave-elegida")
        portal = Client(self.base, "10.4.0.1")
        status, _ = portal.call("POST", "/api/portal/login", {"usuario": "prueba-portal", "clave": "una-clave-elegida", "sitio": self.slug})
        self.assertEqual(status, 200)

    def test_portal_request_with_photo_is_private(self):
        clave = self.portal_access("pedido-portal")
        portal = Client(self.base, "10.5.0.1")
        portal.call("POST", "/api/portal/login", {"usuario": "pedido-portal", "clave": clave, "sitio": self.slug})
        foto = "data:image/png;base64," + base64.b64encode(PNG).decode()
        status, out = portal.call("POST", "/api/portal/pedidos?sitio=" + self.slug, {
            "landing": self.landing["slug"], "nota": "Cambiar la foto de portada",
            "cambios": [{"tipo": "imagen", "seccion": "Portada", "antes": "", "despues": "", "detalle": "foto nueva"}],
            "fotos": [{"data": foto, "cambio": 0, "nota": "Portada"}]})
        self.assertEqual(status, 200, out)
        row = next(c for c in read_js("lanzate-datos", "data/clientes.js") if c["id"] == self.client_id)
        fotos = [f for p in row.get("pedidos", []) for f in (p.get("fotos") or [])]
        self.assertTrue(fotos, "el pedido tiene que guardar la foto")
        path = fotos[-1] if isinstance(fotos[-1], str) else fotos[-1].get("ruta") or fotos[-1].get("src")
        self.assertTrue(path.startswith("/pedidos/"), path)
        self.assertIsNotNone(sim.repo_file("lanzate-datos", path.lstrip("/")))
        self.assertIsNone(sim.repo_file("repositorio-modulos", path.lstrip("/")))
        self.assertEqual(Client(self.base, "10.5.0.9").call("GET", path, raw=True)[0], 404)
        self.assertEqual(portal.call("GET", path, raw=True)[0], 200)
        self.assertEqual(self.team.call("GET", path, raw=True)[0], 200)

    def test_review_before_after_is_private_and_does_not_publish(self):
        """El original y la propuesta son dos lecturas; ningún dato publicado cambia."""
        clave = self.portal_access("comparador-portal")
        portal = Client(self.base, "10.5.0.22")
        status, _ = portal.call("POST", "/api/portal/login", {
            "usuario": "comparador-portal", "clave": clave, "sitio": self.slug})
        self.assertEqual(status, 200)
        before = sim.repo_file("lanzate-datos", "data/landings.js")
        status, result = portal.call("POST", "/api/portal/pedidos?sitio=" + self.slug, {
            "landing": self.landing["slug"],
            "cambios": [{"tipo": "texto", "seccion": "Propiedades",
                         "antes": "Propiedades destacadas",
                         "despues": "Propiedades para vos"}]})
        self.assertEqual(status, 200, result)
        path = "/api/clientes/%d/pedidos/%s/vista" % (self.client_id, result["id"])
        self.assertEqual(Client(self.base, "10.5.0.23").call("GET", path, raw=True)[0], 401)
        original_status, original = self.team.call("GET", path + "?vista=original", raw=True)
        proposal_status, proposal = self.team.call("GET", path, raw=True)
        self.assertEqual((original_status, proposal_status), (200, 200))
        self.assertIn(b"Propiedades destacadas", original)
        self.assertNotIn(b"Propiedades para vos", original)
        self.assertIn(b"Propiedades para vos", proposal)
        self.assertIn(b"data-lz-cambio", proposal)
        self.assertEqual(before, sim.repo_file("lanzate-datos", "data/landings.js"),
                         "Mirar las propuestas no debe modificar la landing")

    def test_forgot_password_is_limited(self):
        bot = Client(self.base, "10.6.0.1")
        codes = [bot.call("POST", "/api/portal/olvide", {"usuario": "nadie"})[0] for _ in range(11)]
        self.assertEqual(codes[:10], [200] * 10)
        self.assertEqual(codes[10], 429)

    # --- Visitas y consultas --------------------------------------------------------------
    def test_visits_count_once_per_connection_and_day(self):
        bot = Client(self.base, "10.7.0.1")
        for _ in range(20):
            bot.call("POST", "/api/visita", {"l": self.landing["id"], "r": ""}, headers={"User-Agent": "Mozilla/5.0"})
        Client(self.base, "10.7.0.2").call("POST", "/api/visita", {"l": self.landing["id"], "r": ""}, headers={"User-Agent": "Mozilla/5.0"})
        stats = sim.STORE.get("lz:v:%d" % self.landing["id"]) or {}
        self.assertEqual(sum(int(v) for v in stats.values()), 2)

    def test_leads_are_limited_per_connection(self):
        bot = Client(self.base, "10.8.0.1")
        codes = [bot.call("POST", "/api/consultas/nueva", {"l": self.landing["id"], "datos": {"mensaje": "spam %d" % n}})[0]
                 for n in range(7)]
        self.assertEqual(codes[:5], [200] * 5)
        self.assertEqual(codes[5:], [429, 429])

    # --- Logo SVG y publicar --------------------------------------------------------------
    def test_svg_logo_is_cleaned(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><circle r="4"/></svg>'
        status, out = self.team.call("POST", "/api/clientes", {
            "nombre": "Logo SVG", "logo_data": "data:image/svg+xml;base64," + base64.b64encode(svg).decode()})
        self.assertEqual(status, 200, out)
        stored = sim.repo_file("repositorio-modulos", "l/logo-svg/logo.svg")
        self.assertIsNotNone(stored)
        self.assertNotIn(b"alert", stored)
        self.assertIn(b"circle", stored)
        self.team.call("DELETE", "/api/clientes/%d" % out["id"])

    def test_publish(self):
        status, out = self.team.call("POST", "/api/publicar", {"mensaje": "Prueba"})
        self.assertEqual(status, 200, out)
        self.assertTrue(all(r["ok"] for r in out["resultados"]), out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
