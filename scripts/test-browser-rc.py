"""Launch existing simulated API fixtures for browser smoke tests."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys

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
try:
    fixture.setUpClass()
    import json
    status, access = fixture.team.call("POST", "/api/clientes/%d/acceso" % fixture.client_id, {"usuario": "browser-qa", "clave": ""})
    assert status == 200, "Could not provision fictitious portal account"
    env = dict(os.environ, QA_PORTAL_USER="browser-qa", QA_PORTAL_PASSWORD=access["clave_nueva"], QA_BASE=fixture.base,
               QA_COOKIES=json.dumps(fixture.team.cookies),
               QA_SLUG=fixture.slug)
    subprocess.run(["node", "scripts/browser-rc.mjs"], cwd=ROOT, env=env, check=True)
finally:
    if hasattr(fixture, "proc"):
        fixture.tearDownClass()
    if mod.ARMADO.get("proc"):
        mod.ARMADO["proc"].terminate()
