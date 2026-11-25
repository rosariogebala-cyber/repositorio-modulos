"""Launch existing simulated API fixtures for browser smoke tests."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import ssl
import threading
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("api_tests", ROOT / "scripts/test-api.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

# Never inherit production credentials or service URLs.
keep = {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "PLAYWRIGHT_BROWSERS_PATH"}
for key in list(os.environ):
    if key not in keep:
        del os.environ[key]

fixture = mod.ApiTest
proxy = None
try:
    fixture.setUpClass()
    import json
    status, access = fixture.team.call("POST", "/api/clientes/%d/acceso" % fixture.client_id, {"usuario": "browser-qa", "clave": ""})
    assert status == 200, "Could not provision fictitious portal account"
    # The simulated Vercel server issues Secure cookies. Exercise them over TLS,
    # rather than relying on engine-specific HTTP loopback exceptions.
    upstream = urlsplit(fixture.base)
    class Proxy(BaseHTTPRequestHandler):
        def forward(self):
            conn = http.client.HTTPConnection(upstream.hostname, upstream.port, timeout=30)
            try:
                headers = {k: v for k, v in self.headers.items()
                           if k.lower() not in {"connection", "transfer-encoding", "x-forwarded-proto"}}
                headers["X-Forwarded-Proto"] = "https"
                body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                conn.request(self.command, self.path, body=body, headers=headers)
                response = conn.getresponse()
                data = response.read()
                self.send_response(response.status)
                for k, v in response.getheaders():
                    if k.lower() not in {"connection", "transfer-encoding", "content-length", "server", "date"}:
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(data)
            finally:
                conn.close()
        do_GET = do_POST = do_PUT = do_DELETE = do_HEAD = do_OPTIONS = forward
        def log_message(self, *args):
            pass
    cert = Path(fixture.tmp, "qa-cert.pem")
    key = Path(fixture.tmp, "qa-key.pem")
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                    "-days", "1", "-subj", "/CN=127.0.0.1", "-addext",
                    "subjectAltName=IP:127.0.0.1", "-keyout", str(key), "-out", str(cert)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    proxy = ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls.load_cert_chain(cert, key)
    proxy.socket = tls.wrap_socket(proxy.socket, server_side=True)
    threading.Thread(target=proxy.serve_forever, daemon=True).start()
    env = dict(os.environ, QA_PORTAL_USER="browser-qa", QA_PORTAL_PASSWORD=access["clave_nueva"], QA_BASE='https://127.0.0.1:%d' % proxy.server_port,
               QA_COOKIES=json.dumps(fixture.team.cookies),
               QA_SLUG=fixture.slug)
    subprocess.run(["node", "scripts/browser-rc.mjs"], cwd=ROOT, env=env, check=True)
finally:
    if proxy is not None:
        proxy.shutdown()
        proxy.server_close()
    if hasattr(fixture, "proc"):
        fixture.tearDownClass()
    if mod.ARMADO.get("proc"):
        mod.ARMADO["proc"].terminate()
