"""Pruebas de punta a punta de la API, en modo online (como en Vercel) con GitHub y Redis simulados.

    python3 scripts/test-api.py

Levanta el panel en un puerto libre con datos de prueba (tests/fixtures) y prueba lo que no se puede romper:
acceso, límites de intentos, guardados simultáneos, portal, pedidos con fotos, visitas, consultas y publicar.
"""
import base64
import json
import os
import re
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


ARMADO = {}


def armado_url():
    """Levanta una vez la función de armado en Node (api/armar.mjs) para las pruebas de Publicar."""
    if "url" not in ARMADO:
        ARMADO["url"] = None
        node = shutil.which("node")
        if node and (ROOT / "node_modules" / "jsdom").is_dir():
            port = free_port()
            env = dict(os.environ, LANZATE_SECRETO="secreto-de-prueba-0123456789abcdefghij")
            proc = subprocess.Popen([node, str(ROOT / "scripts" / "servidor-armado.mjs"), str(port)], cwd=str(ROOT),
                                    env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            if proc.stdout.readline().strip() == b"listo":
                ARMADO["url"], ARMADO["proc"] = "http://127.0.0.1:%d" % port, proc
    return ARMADO["url"]


class ApiTest(unittest.TestCase):
    EXTRA_ENV = {}

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
        env.pop("LANZATE_ARMADO", None)
        if armado_url():
            env["LANZATE_ARMADO_URL"] = armado_url()
        env.update(cls.EXTRA_ENV)
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

    # --- Mejoras de la auditoría ---------------------------------------------------------
    def test_landing_preview_has_no_third_party_scripts(self):
        """Dentro del panel la landing no lleva medición ni registra visitas, y tiene la política del panel."""
        path = "/l/%s/%s/" % (self.slug, self.landing["slug"])
        with urllib.request.urlopen(urllib.request.Request(self.base + path)) as resp:
            body = resp.read().decode("utf-8")
            self.assertIn("connect-src 'self'", resp.headers.get("Content-Security-Policy", ""))
        self.assertNotIn('name="lz-api"', body)
        self.assertNotIn("googletagmanager.com/gtm.js", body)

    def test_requests_out_of_plan_are_marked_and_paused_accounts_blocked(self):
        planes = self.team.call("GET", "/api/planes")[1]
        self.assertTrue(planes, "las pruebas necesitan al menos un plan")
        clave = self.portal_access("plan-portal")
        portal = Client(self.base, "10.9.0.1")
        self.assertEqual(portal.call("POST", "/api/portal/login", {"usuario": "plan-portal", "clave": clave, "sitio": self.slug})[0], 200)
        try:
            self.assertEqual(self.team.call("PUT", "/api/clientes/%d/plan" % self.client_id,
                                            {"plan": planes[0]["id"], "plan_vence": "2020-01-01"})[0], 200)
            status, out = portal.call("POST", "/api/portal/pedidos?sitio=" + self.slug, {"nota": "Pedido con el plan vencido"})
            self.assertEqual(status, 200, out)
            row = next(c for c in read_js("lanzate-datos", "data/clientes.js") if c["id"] == self.client_id)
            pedido = next(p for p in row["pedidos"] if p["id"] == out["id"])
            self.assertEqual(pedido.get("fuera_de_plan"), "plan vencido")
            ficha = self.team.call("GET", "/api/clientes/%d" % self.client_id)[1]
            self.assertEqual(self.team.call("PUT", "/api/clientes/%d" % self.client_id, dict(ficha, estado="pausado"))[0], 200)
            status, out = portal.call("POST", "/api/portal/pedidos?sitio=" + self.slug, {"nota": "Pedido con la cuenta pausada"})
            self.assertEqual(status, 403, out)
        finally:
            ficha = self.team.call("GET", "/api/clientes/%d" % self.client_id)[1]
            self.team.call("PUT", "/api/clientes/%d" % self.client_id, dict(ficha, estado="activo"))
            self.team.call("PUT", "/api/clientes/%d/plan" % self.client_id, {"plan": "", "plan_vence": ""})

    def test_bad_input_gets_a_json_error_instead_of_a_cut_connection(self):
        status, out = self.team.call("DELETE", "/api/clientes/%d/pedidos?fecha=abc" % self.client_id)
        self.assertEqual(status, 400, out)
        self.assertIn("error", out)

    def test_portfolio_is_private_and_has_no_portal_secrets(self):
        anon = Client(self.base, "10.80.0.1")
        self.assertEqual(anon.call("GET", "/api/gestion-clientes")[0], 401)
        self.assertEqual(anon.call("GET", "/api/gestion-clientes/%d" % self.client_id)[0], 401)
        self.assertEqual(anon.call("POST", "/api/gestion-clientes/%d/pagos" % self.client_id, {})[0], 401)
        status, dashboard = self.team.call("GET", "/api/gestion-clientes")
        self.assertEqual(status, 200, dashboard)
        self.assertIn("resumen", dashboard)
        self.assertTrue(dashboard["clientes"])
        self.assertFalse(any("portal_clave" in row or "portal" in row for row in dashboard["clientes"]))
        self.assertTrue(any(row["id"] == self.client_id for row in dashboard["clientes"]))
        self.assertNotIn("monto_centavos", str(dashboard.get("password", "")))

    def test_commercial_contract_and_payments_are_scoped_to_each_landing(self):
        client_id = self.client_id
        landing_id = self.landing["id"]
        status, profile = self.team.call("GET", "/api/gestion-clientes/%d" % client_id)
        self.assertEqual(status, 200, profile)
        self.assertTrue(any(lp["id"] == landing_id for lp in profile["webs"]))
        self.assertEqual(self.team.call("PUT", "/api/gestion-clientes/%d/inicio" % client_id,
                                    {"inicio": "2026-11-01"})[0], 200)
        contract = {"inicio": "2026-11-01", "dia_vencimiento": 15, "abono": "19900.50",
                    "moneda": "ARS", "notas": "Pago por transferencia"}
        status, account = self.team.call("PUT", "/api/gestion-clientes/%d/landings/%d" % (client_id, landing_id), contract)
        self.assertEqual(status, 200, account)
        site = next(lp for lp in account["webs"] if lp["id"] == landing_id)
        self.assertEqual(site["abono_centavos"], 1990050)
        self.assertEqual(site["inicio"], "2026-11-01")
        self.assertNotEqual(site["cobro"]["estado"], "pagado", "Configurar un abono no implica haber cobrado")
        payment = {"landing_id": landing_id, "periodo": "2026-11", "fecha_pago": "2026-11-23",
                   "monto": "19900.50", "referencia": "Transferencia ABC",
                   "request_id": "prueba-registro-unico-123"}
        status, paid = self.team.call("POST", "/api/gestion-clientes/%d/pagos" % client_id, payment)
        self.assertEqual(status, 200, paid)
        site = next(lp for lp in paid["webs"] if lp["id"] == landing_id)
        self.assertTrue(site["pagos"])
        self.assertEqual(site["pagos"][-1]["moneda"], "ARS")
        self.assertEqual(site["pagos"][-1]["monto_centavos"], 1990050)
        self.assertEqual(len(site["pagos"]), 1)
        status, again = self.team.call("POST", "/api/gestion-clientes/%d/pagos" % client_id, payment)
        self.assertEqual(status, 200, again)
        self.assertEqual(len(next(lp for lp in again["webs"] if lp["id"] == landing_id)["pagos"]), 1,
                         "Reintentar la misma solicitud no debe duplicar cobros")
        payment_id = site["pagos"][0]["id"]
        status, voided = self.team.call("POST", "/api/gestion-clientes/%d/pagos/%d/anular" %
                                         (client_id, payment_id), {"motivo": "Pago registrado por error"})
        self.assertEqual(status, 200, voided)
        site = next(lp for lp in voided["webs"] if lp["id"] == landing_id)
        self.assertTrue(site["pagos"][0]["anulado"])
        self.assertNotEqual(site["cobro"]["estado"], "pagado")
        self.assertEqual(self.team.call("POST", "/api/gestion-clientes/%d/pagos/%d/anular" %
                                         (client_id, payment_id), {"motivo": "Duplicado"})[0], 409)
        self.assertTrue(sim.repo_file("lanzate-datos", "gestion/clientes.json"))
        self.assertFalse(sim.repo_file("repositorio-modulos", "gestion/clientes.json"),
                         "Los movimientos financieros no deben guardarse en el repositorio público.")
        # Los registros comerciales no aparecen en las API públicas.
        public_status, public_row = self.team.call("GET", "/api/clientes/%d" % client_id)
        self.assertEqual(public_status, 200)
        self.assertNotIn("pagos", public_row)
        self.assertNotIn("contratos", public_row)
        another_status, other = self.team.call("POST", "/api/clientes", {"nombre":"Otro cliente test"})
        self.assertEqual(another_status, 200, other)
        self.assertEqual(self.team.call("PUT", "/api/gestion-clientes/%d/landings/%d" %
                                        (other["id"], landing_id), contract)[0], 403)
        self.assertEqual(self.team.call("POST", "/api/gestion-clientes/%d/pagos" % other["id"], {
            "landing_id": landing_id, "periodo": "2026-11", "fecha_pago": "2026-11-23", "monto": "100"
        })[0], 403)
        self.team.call("DELETE", "/api/clientes/%d" % other["id"])

    def test_commercial_validation_prevents_fake_payments(self):
        lid = self.landing["id"]
        cid = self.client_id
        status, out = self.team.call("PUT", "/api/gestion-clientes/%d/landings/%d" % (cid, lid),
                                      {"inicio":"2026-02-30", "dia_vencimiento":31, "abono":-3, "moneda":"ARS"})
        self.assertEqual(status, 400, out)
        status, out = self.team.call("POST", "/api/gestion-clientes/%d/pagos" % cid,
                                      {"landing_id": lid, "periodo":"2026-99",
                                       "fecha_pago":"2026-11-23", "monto":10})
        self.assertEqual(status, 400, out)

    def test_client_list_does_not_send_portal_passwords(self):
        self.portal_access("lista-portal")
        listado = self.team.call("GET", "/api/clientes")[1]
        self.assertFalse(any(c.get("portal_clave") for c in listado))
        self.assertTrue(self.team.call("GET", "/api/clientes/%d" % self.client_id)[1].get("portal_clave"))
        row = next(c for c in read_js("lanzate-datos", "data/clientes.js") if c["id"] == self.client_id)
        self.assertTrue(row["portal"]["clave"].startswith("v2:"), "la copia de la contraseña va cifrada con AES-GCM")

    def test_client_can_delete_a_lead(self):
        clave = self.portal_access("consultas-portal")
        portal = Client(self.base, "10.10.0.1")
        portal.call("POST", "/api/portal/login", {"usuario": "consultas-portal", "clave": clave, "sitio": self.slug})
        Client(self.base, "10.10.0.2").call("POST", "/api/consultas/nueva", {"l": self.landing["id"], "datos": {"nombre": "Ana"}})
        lead_id = next(iter(sim.STORE.get("lz:c:%d" % self.client_id)))
        status, out = portal.call("DELETE", "/api/portal/consultas/%s?sitio=%s" % (lead_id, self.slug))
        self.assertEqual(status, 200, out)
        self.assertNotIn(lead_id, sim.STORE.get("lz:c:%d" % self.client_id) or {})
        self.assertEqual(Client(self.base, "10.10.0.3").call("DELETE", "/api/portal/consultas/%s?sitio=%s" % (lead_id, self.slug))[0], 401)

    def test_borrador_revision_aprobacion_publicacion(self):
        """El borrador nunca actualiza la página pública hasta publicar una versión aprobada."""
        original = next(l for l in read_js("lanzate-datos", "data/landings.js")
                        if l["id"] == self.landing["id"])
        before = sim.repo_file("repositorio-modulos",
                               "l/%s/%s/index.html" % (self.slug, original["slug"]))
        body = {"cliente_id": original["cliente_id"], "nombre": original["nombre"],
                "plan_id": original.get("plan_id") or "express",
                "html": original["html"], "items": original["items"],
                "estilo": original.get("estilo") or "",
                "descripcion": "Descripción de prueba para SEO", "animacion": ""}
        status, draft = self.team.call("PUT", "/api/landings/%d/borrador" % original["id"], body)
        self.assertEqual(status, 200, draft)
        self.assertEqual(draft["borrador_estado"], "borrador")
        self.assertEqual(original["html"], next(l for l in read_js("lanzate-datos", "data/landings.js")
                         if l["id"] == original["id"])["html"])
        self.assertEqual(before, sim.repo_file("repositorio-modulos",
                         "l/%s/%s/index.html" % (self.slug, original["slug"])))
        status, out = self.team.call("POST", "/api/landings/%d/publicar" % original["id"],
                                      {"revision": draft["borrador_revision"]})
        self.assertEqual(status, 409, out)
        # No publicar ni cambiar el HTML público si falla la validación de QA.
        status, out = self.team.call("POST", "/api/landings/%d/revision" % original["id"],
                                      {"revision": draft["borrador_revision"]})
        if status == 400:
            self.assertIn("Corregí", out.get("error", "") or str(out))
            return
        self.assertEqual(status, 200, out)
        self.assertEqual(out["borrador_estado"], "revision")
        status, out = self.team.call("POST", "/api/landings/%d/aprobar" % original["id"],
                                      {"revision": draft["borrador_revision"]})
        self.assertEqual(status, 200, out)
        self.assertEqual(out["borrador_estado"], "aprobado")
        status, out = self.team.call("POST", "/api/landings/%d/publicar" % original["id"],
                                      {"revision": draft["borrador_revision"]})
        self.assertEqual(status, 200, out)
        self.assertEqual(out["borrador_estado"], "sin_borrador")
        self.assertEqual(self.team.call("GET", "/api/landings/%d/borrador" % original["id"])[1]["borrador_estado"],
                         "sin_borrador")

    def test_borrador_nuevo_no_crea_pagina_publica_y_se_puede_descartar(self):
        original = self.landing
        body = {"cliente_id": original["cliente_id"], "nombre": "Borrador QA no publicar",
                "plan_id": original.get("plan_id") or "express", "html": original["html"],
                "items": original["items"], "descripcion": "Descripción de control"}
        status, result = self.team.call("POST", "/api/borradores", body)
        self.assertEqual(status, 200, result)
        self.assertFalse(result["publicada"])
        self.assertEqual(result["borrador_estado"], "borrador")
        row = next(l for l in read_js("lanzate-datos", "data/landings.js") if l["id"] == result["id"])
        self.assertEqual(row.get("html"), "")
        self.assertEqual(self.team.call("GET", "/api/landings/%d" % result["id"])[1]["borrador_estado"],
                         "borrador")
        public = "/l/%s/%s/" % (self.slug, row["slug"])
        self.assertEqual(self.team.call("GET", public, raw=True)[0], 404)
        status, discard = self.team.call("DELETE", "/api/landings/%d/borrador" % result["id"],
                                         {"revision": result["borrador_revision"]})
        self.assertEqual(status, 200, discard)
        self.assertFalse(any(l["id"] == result["id"] for l in read_js("lanzate-datos", "data/landings.js")))

    def test_borrador_privado_control_de_revision(self):
        original = self.landing
        body = {"cliente_id": original["cliente_id"], "nombre": original["nombre"],
                "plan_id": original.get("plan_id") or "express",
                "html": original["html"], "items": original["items"]}
        status, draft = self.team.call("PUT", "/api/landings/%d/borrador" % original["id"], body)
        self.assertEqual(status, 200, draft)
        anon = Client(self.base, "10.88.9.1")
        self.assertEqual(anon.call("GET", "/api/landings/%d/borrador/vista" % original["id"])[0], 401)
        self.assertEqual(anon.call("GET", "/api/landings/%d/borrador" % original["id"])[0], 401)
        body["base_revision"] = draft["borrador_revision"] - 1
        self.assertEqual(self.team.call("PUT", "/api/landings/%d/borrador" % original["id"], body)[0], 409)

    def test_publish(self):
        before = read_js("lanzate-datos", "data/landings.js")
        status, out = self.team.call("POST", "/api/publicar", {"mensaje": "Prueba"})
        self.assertEqual(status, 200, out)
        self.assertTrue(all(r["ok"] for r in out["resultados"]), out)
        self.assertEqual(out["armado"], "comparar")
        armado = next(r for r in out["resultados"] if r["carpeta"] == "Armado desde los datos")
        if armado_url():
            # Por defecto el servidor arma cada landing desde sus datos y solo compara: no cambia lo guardado.
            self.assertRegex(armado["detalle"], r"de \d+ landings dan igual", armado)
        self.assertEqual([l.get("html") for l in before], [l.get("html") for l in read_js("lanzate-datos", "data/landings.js")])

    # --- Versiones, direcciones viejas y sitemap ---------------------------------------------
    def test_versions_and_old_address_redirect(self):
        status, copy = self.team.call("POST", "/api/landings/%d/duplicate" % self.landing["id"])
        self.assertEqual(status, 200, copy)
        lid = copy["id"]
        row = next(l for l in read_js("lanzate-datos", "data/landings.js") if l["id"] == lid)
        body = {"cliente_id": row["cliente_id"], "nombre": row["nombre"], "html": row["html"], "items": row["items"],
                "estilo": row.get("estilo") or "", "descripcion": "Primera descripción", "animacion": row.get("animacion") or ""}
        self.assertEqual(self.team.call("PUT", "/api/landings/%d" % lid, body)[0], 200)
        status, versions = self.team.call("GET", "/api/landings/%d/versiones" % lid)
        self.assertEqual(status, 200, versions)
        self.assertEqual(len(versions), 1, versions)
        self.assertEqual(versions[0]["nombre"], row["nombre"])
        # Guardar lo mismo otra vez no suma una versión repetida... pero cambiar el nombre sí, y mueve la dirección.
        old_slug = copy["slug"]
        renamed = dict(body, nombre="Nombre nuevo de prueba")
        status, saved = self.team.call("PUT", "/api/landings/%d" % lid, renamed)
        self.assertEqual(status, 200, saved)
        versions = self.team.call("GET", "/api/landings/%d/versiones" % lid)[1]
        self.assertEqual([v["nombre"] for v in versions], [row["nombre"], row["nombre"]])
        status, old = self.team.call("GET", "/api/landings/%d/versiones?fecha=%d" % (lid, versions[-1]["fecha"]))
        self.assertEqual(status, 200, old)
        self.assertEqual(old["items"], row["items"])
        # La dirección vieja redirige (301) a la nueva, y queda una página de redirección para la copia estática.
        status, _ = Client(self.base, "10.0.9.1").call("GET", "/l/%s/%s/" % (self.slug, old_slug), raw=True)
        self.assertEqual(status, 301)
        stub = sim.repo_file("repositorio-modulos", "l/%s/%s/index.html" % (self.slug, old_slug)).decode("utf-8")
        self.assertIn('content="/l/%s/%s/"' % (self.slug, saved["slug"]), stub)
        self.assertIn("http-equiv=\"refresh\"", stub)
        status, page = Client(self.base, "10.0.9.1").call("GET", "/l/%s/%s/" % (self.slug, saved["slug"]), raw=True)
        self.assertEqual(status, 200)
        # Al publicar, la redirección se mantiene (no se borra como carpeta huérfana).
        self.team.call("POST", "/api/publicar", {"mensaje": "Prueba de redirección"})
        self.assertIsNotNone(sim.repo_file("repositorio-modulos", "l/%s/%s/index.html" % (self.slug, old_slug)))
        # Al eliminar la landing se van también su redirección y sus versiones.
        self.assertEqual(self.team.call("DELETE", "/api/landings/%d" % lid)[0], 200)
        self.assertIsNone(sim.repo_file("repositorio-modulos", "l/%s/%s/index.html" % (self.slug, old_slug)))
        self.assertIsNone(sim.repo_file("lanzate-datos", "versiones/%d.json" % lid))

    def test_sitemap_has_dates_and_business_data_only_for_real_clients(self):
        status, client = self.team.call("POST", "/api/clientes", {
            "nombre": "Negocio Real", "tipo_cliente": "real", "telefono": "+54 11 4555-1234", "email": "hola@negocioreal.com.ar",
            "direccion": "Av. Corrientes 1234, CABA", "instagram": "@negocioreal"})
        self.assertEqual(status, 200, client)
        row = next(l for l in read_js("lanzate-datos", "data/landings.js") if l["id"] == self.landing["id"])
        clean = re.sub(r"(?i)example\.(com|net|org)", "negocioreal.com.ar", row["html"])
        clean = re.sub(r"(?i)\b(marca|calle) ejemplo\b", "Negocio Real", clean)
        body = {"cliente_id": client["id"], "nombre": "Inicio", "html": clean, "items": row["items"],
                "estilo": row.get("estilo") or "", "descripcion": "Un negocio de prueba", "animacion": ""}
        status, saved = self.team.call("POST", "/api/landings", body)
        self.assertEqual(status, 200, saved)
        page = sim.repo_file("repositorio-modulos", "l/%s/inicio/index.html" % client["slug"]).decode("utf-8")
        data = json.loads(page.split('<script type="application/ld+json">', 1)[1].split("</script>", 1)[0])
        self.assertEqual(data["telephone"], "+541145551234")
        self.assertEqual(data["sameAs"], ["https://www.instagram.com/negocioreal"])
        self.assertEqual(data["address"]["streetAddress"], "Av. Corrientes 1234, CABA")
        sitemap = sim.repo_file("repositorio-modulos", "sitemap.xml").decode("utf-8")
        self.assertRegex(sitemap, r"/l/%s/inicio/</loc><lastmod>\d{4}-\d{2}-\d{2}</lastmod>" % client["slug"])
        self.team.call("DELETE", "/api/landings/%d" % saved["id"])
        self.team.call("DELETE", "/api/clientes/%d" % client["id"])


@unittest.skipUnless(armado_url(), "hace falta Node con jsdom (npm ci)")
class DataBuildTest(unittest.TestCase):
    """LANZATE_ARMADO=datos: Publicar arma las landings en el servidor, sin abrir el constructor."""
    EXTRA_ENV = {"LANZATE_ARMADO": "datos"}
    setUpClass = classmethod(ApiTest.setUpClass.__func__)
    tearDownClass = classmethod(ApiTest.tearDownClass.__func__)

    def setUp(self):
        sim.reset_redis()

    def test_publish_only_syncs_previously_approved_data(self):
        """Incluso con LANZATE_ARMADO=datos, publicar global no reescribe ninguna landing."""
        status, session = self.team.call("GET", "/api/sesion")
        self.assertEqual(session["armado"], "datos")
        before = read_js("lanzate-datos", "data/landings.js")
        status, out = self.team.call("POST", "/api/publicar", {"mensaje": "Sincronizar aprobadas"})
        self.assertEqual(status, 200, out)
        self.assertTrue(all(r["ok"] for r in out["resultados"]), out)
        armado = next(r for r in out["resultados"] if r["carpeta"] == "Armado desde los datos")
        self.assertIn("dan igual", armado["detalle"])
        after = read_js("lanzate-datos", "data/landings.js")
        self.assertEqual([row.get("html") for row in before], [row.get("html") for row in after])
        self.assertEqual([row.get("items") for row in before], [row.get("items") for row in after])
        # La función de armado mantiene su firma obligatoria.
        request = urllib.request.Request(armado_url() + "/api/armar", data=b'{"pedidos": []}', method="POST")
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(request, timeout=10)
        self.assertEqual(error.exception.code, 403)


if __name__ == "__main__":
    try:
        unittest.main(verbosity=2)
    finally:
        if ARMADO.get("proc"):
            ARMADO["proc"].terminate()
