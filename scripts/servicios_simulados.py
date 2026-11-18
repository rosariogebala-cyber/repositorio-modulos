"""GitHub (API de git) y Upstash Redis (REST) simulados, en memoria, para las pruebas de scripts/test-api.py.

Cada repo simulado arranca con los archivos de una carpeta. Los commits se aplican en memoria y rechazan
(422) los que no parten de la última versión, igual que GitHub.
"""
import base64
import hashlib
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

LOCK = threading.Lock()
REPOS = {}
BLOBS = {}
TREES = {}
COMMITS = {}
PRIVATE = {"lanzate-datos"}
LOG = []


def sha(data):
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def load(name, base):
    """Carga una carpeta como repo simulado `name`."""
    files = {}
    for dirpath, dirs, names in os.walk(base):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__")]
        for n in names:
            p = os.path.join(dirpath, n)
            rel = os.path.relpath(p, base).replace(os.sep, "/")
            with open(p, "rb") as fh:
                files[rel] = fh.read()
    REPOS[name] = {"files": files, "head": 1}


def repo_file(name, path):
    with LOCK:
        return REPOS[name]["files"].get(path)


class GH(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, status, body, raw=False):
        data = body if raw else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"null")

    def route(self, method):
        path = unquote(urlsplit(self.path).path)
        parts = path.strip("/").split("/")
        if parts[0] != "repos" or len(parts) < 3:
            return self.reply(404, {})
        repo = REPOS.get(parts[2])
        if repo is None:
            return self.reply(404, {})
        rest = parts[3:]
        LOG.append((method, path))
        with LOCK:
            if not rest:
                return self.reply(200, {"private": parts[2] in PRIVATE, "name": parts[2]})
            if rest[0] == "contents":
                data = repo["files"].get("/".join(rest[1:]))
                return self.reply(200, data, raw=True) if data is not None else self.reply(404, {})
            if rest[:2] == ["git", "ref"]:
                return self.reply(200, {"object": {"sha": "%s-%d" % (parts[2], repo["head"])}})
            if rest[:2] == ["git", "commits"] and method == "GET":
                return self.reply(200, {"tree": {"sha": "head"}})
            if rest[:2] == ["git", "trees"] and method == "GET":
                return self.reply(200, {"tree": [{"path": p, "type": "blob", "sha": sha(d)} for p, d in repo["files"].items()]})
            if rest[:2] == ["git", "blobs"]:
                data = base64.b64decode(self.body()["content"])
                BLOBS[sha(data)] = data
                return self.reply(201, {"sha": sha(data)})
            if rest[:2] == ["git", "trees"]:
                key = "t%d" % len(TREES)
                TREES[key] = self.body()["tree"]
                return self.reply(201, {"sha": key})
            if rest[:2] == ["git", "commits"]:
                b = self.body()
                key = "c%d" % len(COMMITS)
                COMMITS[key] = b
                return self.reply(201, {"sha": key})
            if rest[:2] == ["git", "refs"]:
                b = self.body()
                commit = COMMITS[b["sha"]]
                if commit["parents"] != ["%s-%d" % (parts[2], repo["head"])]:
                    return self.reply(422, {"message": "Update is not a fast forward"})
                for e in TREES[commit["tree"]]:
                    if e["sha"] is None:
                        repo["files"].pop(e["path"], None)
                    else:
                        repo["files"][e["path"]] = BLOBS[e["sha"]]
                repo["head"] += 1
                return self.reply(200, {})
        return self.reply(404, {})

    def do_GET(self):
        self.route("GET")

    def do_POST(self):
        self.route("POST")

    def do_PATCH(self):
        self.route("PATCH")


STORE = {}
EXPIRES = {}


class Redis(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        cmds = json.loads(self.rfile.read(n))
        out = []
        with LOCK:
            now = time.time()
            for k in [k for k, t in EXPIRES.items() if t <= now]:
                STORE.pop(k, None)
                EXPIRES.pop(k, None)
            for c in cmds:
                op = c[0].upper()
                if op == "HINCRBY":
                    h = STORE.setdefault(c[1], {})
                    h[c[2]] = int(h.get(c[2], 0)) + int(c[3])
                    out.append({"result": h[c[2]]})
                elif op == "HGETALL":
                    h = STORE.get(c[1]) or {}
                    flat = []
                    for k, v in h.items():
                        flat += [k, str(v)]
                    out.append({"result": flat})
                elif op == "HSET":
                    STORE.setdefault(c[1], {})[c[2]] = c[3]
                    out.append({"result": 1})
                elif op == "HDEL":
                    (STORE.get(c[1]) or {}).pop(c[2], None)
                    out.append({"result": 1})
                elif op == "GET":
                    v = STORE.get(c[1])
                    out.append({"result": None if v is None else str(v)})
                elif op == "INCR":
                    STORE[c[1]] = int(STORE.get(c[1], 0)) + 1
                    out.append({"result": STORE[c[1]]})
                elif op == "EXPIRE":
                    EXPIRES[c[1]] = now + int(c[2])
                    out.append({"result": 1})
                elif op == "SET":
                    flags = [str(x).upper() for x in c[3:]]
                    if "NX" in flags and c[1] in STORE:
                        out.append({"result": None})
                        continue
                    STORE[c[1]] = c[2]
                    if "EX" in flags:
                        EXPIRES[c[1]] = now + int(c[3 + flags.index("EX") + 1])
                    out.append({"result": "OK"})
                elif op == "DEL":
                    STORE.pop(c[1], None)
                    out.append({"result": 1})
                else:
                    out.append({"error": "unknown " + op})
        data = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def start():
    """Arranca GitHub y Redis simulados en puertos libres. Devuelve (url_github, url_redis)."""
    gh = ThreadingHTTPServer(("127.0.0.1", 0), GH)
    rd = ThreadingHTTPServer(("127.0.0.1", 0), Redis)
    for srv in (gh, rd):
        threading.Thread(target=srv.serve_forever, daemon=True).start()
    return "http://127.0.0.1:%d" % gh.server_port, "http://127.0.0.1:%d" % rd.server_port


def reset_redis():
    with LOCK:
        STORE.clear()
        EXPIRES.clear()
