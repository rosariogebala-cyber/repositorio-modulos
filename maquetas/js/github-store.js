/* Backend en el navegador para GitHub Pages: el repo es la base de datos.
   Atiende las mismas rutas /api/... que server.py y guarda cada cambio como un commit. */
(function () {
  "use strict";

  var FALLBACK = { owner: "rosariogebala-cyber", repo: "repositorio-modulos", branch: "main" };
  var TOKEN_KEY = "nexoia-github-token";
  var USER_KEY = "nexoia-github-user";
  var onPages = /\.github\.io$/i.test(location.hostname);
  if (!onPages && !/[?&]github=1/.test(location.search)) return;

  var segment = location.pathname.split("/")[1] || "";
  var repo = {
    owner: onPages ? location.hostname.replace(/\.github\.io$/i, "") : FALLBACK.owner,
    repo: onPages && segment && segment !== "maquetas" ? segment : FALLBACK.repo,
    branch: FALLBACK.branch
  };
  var REPO_API = "/repos/" + repo.owner + "/" + repo.repo;
  var siteRoot = location.pathname.replace(/\/maquetas\/[^/]*$/, "/");

  var CLIENT_COLS = ["id", "slug", "nombre", "contacto", "email", "telefono", "rubro", "sitio", "logo",
    "color_primario", "color_secundario", "notas", "estado", "creado", "actualizado"];
  var CLIENT_FIELDS = ["nombre", "contacto", "email", "telefono", "rubro", "sitio", "color_primario", "color_secundario", "notas", "estado"];
  var COLOR_DEFAULTS = { color_primario: "#1b5e42", color_secundario: "#e7f3ee" };
  var LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
  var COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var HTML_REF = /((?:src|href)=")((?:img|css|js)\/[^"#?]+|\.\.\/assets\/[^"#?]+)(")/g;
  var URL_REF = /(url\(\s*['"]?)([^'")]+)(['"]?\s*\))/g;
  var COVER_RE = /(?:src="|url\(\s*['"]?)((?:img|assets)\/(?!modulos\/)[^"')]+\.(?:jpe?g|png|webp))/i;

  /* Utilidades */
  function apiError(status, message) {
    var err = new Error(message);
    err.status = status;
    return err;
  }
  function now() { return Date.now(); }
  function slugify(text, fallback) {
    return String(text || "").normalize("NFD").replace(/[^\x00-\x7f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback || "landing";
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[c];
    });
  }
  function b64ToUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function normPath(path) {
    var out = [];
    var parts = path.split("/");
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i] || parts[i] === ".") continue;
      if (parts[i] === "..") { if (!out.length) return null; out.pop(); } else out.push(parts[i]);
    }
    return out.join("/");
  }
  function dirname(path) {
    var i = path.lastIndexOf("/");
    return i === -1 ? "" : path.slice(0, i);
  }
  function relPath(to, fromDir) {
    var a = fromDir ? fromDir.split("/") : [];
    var b = to.split("/");
    var i = 0;
    while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
    var up = [];
    for (var j = i; j < a.length; j++) up.push("..");
    return up.concat(b.slice(i)).join("/");
  }
  function json(data) { return JSON.stringify(data, null, 2) + "\n"; }

  /* Token y conexión */
  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function login() {
    try { return localStorage.getItem(USER_KEY) || ""; } catch (e) { return ""; }
  }

  function ghMessage(status, data) {
    var text = (data && data.message) || "";
    if (status === 401) return "El token de GitHub no es válido o venció. Volvé a conectarlo.";
    if (status === 403 && /rate limit/i.test(text)) return "GitHub limitó las consultas por un rato. Conectá tu token o probá en unos minutos.";
    if (status === 403) return "El token no tiene permiso para escribir en el repo (hace falta «Contents: Read and write»).";
    if (status === 404) return "No se encontró el repo " + repo.owner + "/" + repo.repo + " o el token no tiene acceso.";
    return text ? "GitHub respondió: " + text : "GitHub no pudo completar la acción.";
  }

  function gh(method, path, body, withToken) {
    var headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    var t = withToken || token();
    if (t) headers.Authorization = "Bearer " + t;
    var opts = { method: method, headers: headers, cache: "no-store" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch("https://api.github.com" + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw apiError(r.status, ghMessage(r.status, data));
        return data;
      });
    }, function () {
      throw apiError(0, "No hay conexión con GitHub. Revisá tu internet.");
    });
  }

  /* Lectura */
  var cache = null;

  function snapshot() {
    return gh("GET", REPO_API + "/git/ref/heads/" + repo.branch).then(function (ref) {
      var commit = ref.object.sha;
      return gh("GET", REPO_API + "/git/commits/" + commit).then(function (c) {
        return gh("GET", REPO_API + "/git/trees/" + c.tree.sha + "?recursive=1").then(function (t) {
          var files = {};
          t.tree.forEach(function (e) { if (e.type === "blob") files[e.path] = e.sha; });
          return { commit: commit, tree: c.tree.sha, files: files };
        });
      });
    });
  }

  function blobText(sha) {
    return gh("GET", REPO_API + "/git/blobs/" + sha).then(function (b) { return b64ToUtf8(b.content); });
  }

  function readDb(snap) {
    var sha = snap.files["data/db.json"];
    if (!sha) return Promise.reject(apiError(500, "Falta data/db.json en el repo."));
    return blobText(sha).then(function (text) { return normalizeDb(JSON.parse(text)); });
  }

  function normalizeDb(db) {
    db.clientes = db.clientes || [];
    db.landings = db.landings || [];
    db.next_id = db.next_id || {};
    ["clientes", "landings"].forEach(function (kind) {
      var max = db[kind].reduce(function (m, r) { return Math.max(m, r.id); }, 0);
      db.next_id[kind] = Math.max(db.next_id[kind] || 0, max + 1);
    });
    return db;
  }

  function load() {
    if (cache && now() - cache.at < 8000) return cache.promise;
    var promise = token()
      ? snapshot().then(function (snap) { return readDb(snap).then(function (db) { return { db: db, files: snap.files }; }); })
      : fetch(siteRoot + "data/db.json?t=" + now(), { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw apiError(r.status, "No se encontraron los datos publicados (data/db.json).");
        return r.json();
      }).then(function (db) { return { db: normalizeDb(db), files: null }; });
    cache = { at: now(), promise: promise };
    promise.catch(function () { cache = null; });
    return promise;
  }

  /* Escritura: un commit por acción */
  function commit(message, mutate) {
    if (!token()) {
      openConnect();
      return Promise.reject(apiError(401, "Para guardar, conectá tu cuenta de GitHub con el botón de arriba."));
    }
    function attempt(retry) {
      return snapshot().then(function (snap) {
        return readDb(snap).then(function (db) {
          var changes = {};
          var entry = function (path, extra) {
            var e = { path: path, mode: "100644", type: "blob" };
            for (var k in extra) e[k] = extra[k];
            changes[path] = e;
          };
          var ctx = {
            db: db,
            files: snap.files,
            put: function (path, content) { entry(path, { content: content }); },
            copy: function (path, sha) { entry(path, { sha: sha }); },
            remove: function (path) {
              if (snap.files[path]) entry(path, { sha: null });
              else delete changes[path];
            },
            removeFolder: function (folder) {
              Object.keys(snap.files).forEach(function (p) { if (p.indexOf(folder) === 0) ctx.remove(p); });
            },
            text: function (path) { return snap.files[path] ? blobText(snap.files[path]) : Promise.resolve(null); },
            blob: function (b64) {
              return gh("POST", REPO_API + "/git/blobs", { content: b64, encoding: "base64" }).then(function (r) { return r.sha; });
            }
          };
          return Promise.resolve(mutate(ctx)).then(function (result) {
            ctx.put("data/db.json", json(db));
            var tree = Object.keys(changes).map(function (k) { return changes[k]; });
            return gh("POST", REPO_API + "/git/trees", { base_tree: snap.tree, tree: tree })
              .then(function (t) { return gh("POST", REPO_API + "/git/commits", { message: message, tree: t.sha, parents: [snap.commit] }); })
              .then(function (c) { return gh("PATCH", REPO_API + "/git/refs/heads/" + repo.branch, { sha: c.sha }); })
              .then(function () {
                cache = null;
                if (result && typeof result === "object") result.publicando = true;
                return result;
              });
          });
        });
      }).catch(function (err) {
        if (retry && (err.status === 409 || err.status === 422)) return attempt(false);
        throw err;
      });
    }
    return attempt(true);
  }

  /* Clientes */
  function clientById(db, id) {
    return db.clientes.filter(function (c) { return c.id === id; })[0] || null;
  }
  function getClient(db, id) {
    var c = clientById(db, id);
    if (!c) throw apiError(404, "El cliente no existe");
    return c;
  }
  function countLandings(db, id) {
    return db.landings.filter(function (l) { return l.cliente_id === id; }).length;
  }
  function clientDict(db, c, count) {
    var data = {};
    CLIENT_COLS.forEach(function (k) { data[k] = c[k] == null ? "" : c[k]; });
    data.logo_url = c.logo ? siteRoot + c.logo + "?v=" + c.actualizado : "";
    data.carpeta = "Templates/" + c.slug + "/";
    if (count !== undefined) data.landings = count;
    return data;
  }
  function cleanClient(body) {
    var values = {};
    CLIENT_FIELDS.forEach(function (f) { values[f] = String(body[f] == null ? "" : body[f]).trim(); });
    if (!values.nombre) throw apiError(400, "El nombre del cliente es obligatorio");
    if (values.email && !EMAIL_RE.test(values.email)) throw apiError(400, "Revisá el email: no tiene un formato válido");
    Object.keys(COLOR_DEFAULTS).forEach(function (f) { if (!COLOR_RE.test(values[f])) values[f] = COLOR_DEFAULTS[f]; });
    if (values.estado !== "activo" && values.estado !== "pausado") values.estado = "activo";
    return values;
  }
  function folderExists(files, folder) {
    return Object.keys(files).some(function (p) { return p.indexOf(folder) === 0; });
  }
  function uniqueClientSlug(ctx, nombre, excludeId) {
    var base = slugify(nombre, "cliente");
    var slug = base;
    var n = 2;
    while (ctx.db.clientes.some(function (c) { return c.slug === slug && c.id !== excludeId; }) ||
           (!excludeId && folderExists(ctx.files, "Templates/" + slug + "/"))) {
      slug = base + "-" + n++;
    }
    return slug;
  }
  function removeLogos(ctx, slug) {
    Object.keys(LOGO_TYPES).forEach(function (type) { ctx.remove("data/logos/" + slug + "." + LOGO_TYPES[type]); });
  }
  function saveLogo(ctx, slug, dataUrl) {
    var match = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(dataUrl || "");
    if (!match || !LOGO_TYPES[match[1]]) return Promise.reject(apiError(400, "El logo tiene que ser PNG, JPG, WEBP o SVG"));
    if (match[2].length * 3 / 4 > 2 * 1024 * 1024) return Promise.reject(apiError(400, "El logo pesa más de 2 MB"));
    removeLogos(ctx, slug);
    var path = "data/logos/" + slug + "." + LOGO_TYPES[match[1]];
    return ctx.blob(match[2]).then(function (sha) { ctx.copy(path, sha); return path; });
  }
  function writeClientJson(ctx, c) {
    var data = {};
    CLIENT_COLS.forEach(function (k) { if (k !== "creado" && k !== "actualizado") data[k] = c[k]; });
    ctx.put("Templates/" + c.slug + "/cliente.json", JSON.stringify(data, null, 2));
  }

  function listClients(db) {
    return db.clientes.slice().sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    }).map(function (c) { return clientDict(db, c, countLandings(db, c.id)); });
  }

  function createClient(body) {
    return commit("Nexoia: nuevo cliente «" + String(body.nombre || "").trim() + "»", function (ctx) {
      var values = cleanClient(body);
      var slug = uniqueClientSlug(ctx, values.nombre, 0);
      return (body.logo_data ? saveLogo(ctx, slug, body.logo_data) : Promise.resolve("")).then(function (logo) {
        var stamp = now();
        var row = { id: ctx.db.next_id.clientes++, slug: slug };
        CLIENT_FIELDS.forEach(function (f) { row[f] = values[f]; });
        row.logo = logo;
        row.creado = stamp;
        row.actualizado = stamp;
        ctx.db.clientes.push(orderClient(row));
        writeClientJson(ctx, row);
        return clientDict(ctx.db, row, 0);
      });
    });
  }

  function orderClient(row) {
    var out = {};
    CLIENT_COLS.forEach(function (k) { out[k] = row[k] == null ? "" : row[k]; });
    return out;
  }

  function updateClient(id, body) {
    return commit("Nexoia: editar cliente «" + String(body.nombre || "").trim() + "»", function (ctx) {
      var values = cleanClient(body);
      var row = getClient(ctx.db, id);
      var logo = Promise.resolve(null);
      if (body.logo_data) logo = saveLogo(ctx, row.slug, body.logo_data);
      else if (body.logo_quitar) { removeLogos(ctx, row.slug); logo = Promise.resolve(""); }
      return logo.then(function (path) {
        CLIENT_FIELDS.forEach(function (f) { row[f] = values[f]; });
        if (path !== null) row.logo = path;
        row.actualizado = now();
        writeClientJson(ctx, row);
        return clientDict(ctx.db, row, countLandings(ctx.db, id));
      });
    });
  }

  function deleteClient(id) {
    return commit("Nexoia: eliminar cliente", function (ctx) {
      var row = getClient(ctx.db, id);
      var count = countLandings(ctx.db, id);
      if (count) {
        throw apiError(409, "«" + row.nombre + "» tiene " + count + " landing" + (count === 1 ? "" : "s") +
          ". Eliminalas o pasalas a otro cliente antes de borrarlo.");
      }
      ctx.db.clientes = ctx.db.clientes.filter(function (c) { return c.id !== id; });
      removeLogos(ctx, row.slug);
      ctx.remove("Templates/" + row.slug + "/cliente.json");
      return { ok: true };
    });
  }

  /* Landings */
  function landingDict(db, l, files) {
    var c = clientById(db, l.cliente_id) || { nombre: "", slug: "" };
    var rel = "Templates/" + c.slug + "/" + l.slug + "/";
    var shot = "data/previews/" + l.id + ".jpg";
    var cover = l.portada ? siteRoot + rel + l.portada : "";
    return {
      preview: files && !files[shot] ? cover : siteRoot + shot + "?v=" + l.actualizado,
      portada: cover,
      id: l.id,
      cliente_id: l.cliente_id,
      cliente: c.nombre,
      cliente_slug: c.slug,
      nombre: l.nombre,
      slug: l.slug,
      items: l.items || [],
      estilo: l.estilo || "",
      creado: l.creado,
      actualizado: l.actualizado,
      url: siteRoot + rel,
      path: rel + "index.html",
      disponible: files ? !!files[rel + "index.html"] : true
    };
  }
  function getLanding(db, id) {
    var l = db.landings.filter(function (x) { return x.id === id; })[0];
    if (!l) throw apiError(404, "La landing no existe");
    return l;
  }
  function byUpdated(a, b) { return b.actualizado - a.actualizado; }

  function targetFor(src) {
    if (src.indexOf("maquetas/") === 0) return src.slice("maquetas/".length);
    if (src.indexOf("assets/") === 0) return src;
    return null;
  }

  function copyCss(ctx, src, dest, rel) {
    return ctx.text(src).then(function (css) {
      var cssDir = dirname(src);
      var relDir = dirname(rel);
      css = css.replace(URL_REF, function (m, open, url, close) {
        url = url.trim();
        if (/^(data:|https?:|\/\/|#)/.test(url)) return m;
        var file = normPath(cssDir + "/" + url);
        var target = file && targetFor(file);
        if (!target || !ctx.files[file]) return m;
        ctx.copy(dest + target, ctx.files[file]);
        return open + relPath(target, relDir) + close;
      });
      ctx.put(dest + rel, css);
    });
  }

  function buildSite(ctx, dest, html) {
    var copied = {};
    var pending = [];
    function handle(ref) {
      var src = normPath("maquetas/" + ref);
      var rel = src && targetFor(src);
      if (!rel || !ctx.files[src]) return null;
      if (!copied[rel]) {
        copied[rel] = true;
        if (/\.css$/i.test(src)) pending.push(copyCss(ctx, src, dest, rel));
        else ctx.copy(dest + rel, ctx.files[src]);
      }
      return rel;
    }
    html = html.replace(HTML_REF, function (m, open, ref, close) {
      return open + (handle(ref) || ref) + close;
    });
    html = html.replace(URL_REF, function (m, open, url, close) {
      url = url.trim();
      if (!/^(img\/|\.\.\/assets\/)/.test(url)) return m;
      return open + (handle(url) || url) + close;
    });
    ctx.put(dest + "index.html", html);
    return Promise.all(pending).then(function () { return html; });
  }

  function writeLandingJson(ctx, folder, nombre, slug, cliente, items, estilo) {
    var meta = { nombre: nombre, slug: slug, cliente: cliente, items: items };
    if (estilo) meta.estilo = estilo;
    ctx.put(folder + "landing.json", JSON.stringify(meta, null, 2));
  }

  function coverOf(html) {
    var m = COVER_RE.exec(html);
    return m ? m[1] : "";
  }

  function saveLanding(body, id) {
    var nombre = String(body.nombre || "").trim();
    return commit("Nexoia: " + (id ? "actualizar" : "crear") + " landing «" + nombre + "»", function (ctx) {
      var html = String(body.html || "");
      var items = body.items || [];
      var estilo = String(body.estilo || "");
      var clientId = Number(body.cliente_id) || 0;
      if (!clientId) throw apiError(400, "Elegí el cliente de la landing");
      if (!nombre || !html) throw apiError(400, "Faltan el nombre o el HTML");
      var client = getClient(ctx.db, clientId);
      var old = id ? getLanding(ctx.db, id) : null;
      var slug = slugify(nombre);
      var clash = ctx.db.landings.some(function (l) { return l.cliente_id === clientId && l.slug === slug && l.id !== (id || 0); });
      if (clash) throw apiError(409, "«" + client.nombre + "» ya tiene una landing llamada así. Usá otro nombre o editá la existente.");

      if (old) {
        var oldClient = clientById(ctx.db, old.cliente_id);
        if (oldClient) ctx.removeFolder("Templates/" + oldClient.slug + "/" + old.slug + "/");
      }
      var dest = "Templates/" + client.slug + "/" + slug + "/";
      ctx.removeFolder(dest);
      return buildSite(ctx, dest, html).then(function (built) {
        writeLandingJson(ctx, dest, nombre, slug, client.slug, items, estilo);
        writeClientJson(ctx, client);
        var stamp = now();
        var row = old || { id: ctx.db.next_id.landings++, creado: stamp };
        row.cliente_id = clientId;
        row.nombre = nombre;
        row.slug = slug;
        row.items = items;
        row.estilo = estilo;
        row.actualizado = stamp;
        row.portada = coverOf(built);
        if (!old) ctx.db.landings.push(orderLanding(row));
        else ctx.db.landings[ctx.db.landings.indexOf(old)] = orderLanding(row);
        return landingDict(ctx.db, row, null);
      });
    });
  }

  function orderLanding(row) {
    return {
      id: row.id, cliente_id: row.cliente_id, nombre: row.nombre, slug: row.slug, items: row.items || [],
      estilo: row.estilo || "", creado: row.creado, actualizado: row.actualizado, portada: row.portada || ""
    };
  }

  function duplicateLanding(id) {
    return commit("Nexoia: duplicar landing", function (ctx) {
      var row = getLanding(ctx.db, id);
      var client = getClient(ctx.db, row.cliente_id);
      var src = "Templates/" + client.slug + "/" + row.slug + "/";
      if (!folderExists(ctx.files, src)) throw apiError(404, "No se encontró la carpeta de la landing");
      var n = 1;
      var nombre;
      var slug;
      while (true) {
        nombre = row.nombre + (n === 1 ? " (copia)" : " (copia " + n + ")");
        slug = slugify(nombre);
        var taken = ctx.db.landings.some(function (l) { return l.cliente_id === row.cliente_id && l.slug === slug; });
        if (!taken && !folderExists(ctx.files, "Templates/" + client.slug + "/" + slug + "/")) break;
        n++;
      }
      var dest = "Templates/" + client.slug + "/" + slug + "/";
      Object.keys(ctx.files).forEach(function (p) {
        if (p.indexOf(src) === 0) ctx.copy(dest + p.slice(src.length), ctx.files[p]);
      });
      writeLandingJson(ctx, dest, nombre, slug, client.slug, row.items || [], row.estilo);
      return ctx.text(src + "index.html").then(function (html) {
        if (html != null) {
          ctx.put(dest + "index.html", html.replace(/<title>[\s\S]*?<\/title>/, "<title>" + escapeHtml(nombre) + "</title>"));
        }
        var stamp = now();
        var copy = orderLanding({
          id: ctx.db.next_id.landings++, cliente_id: row.cliente_id, nombre: nombre, slug: slug,
          items: row.items, estilo: row.estilo, creado: stamp, actualizado: stamp, portada: row.portada
        });
        var shot = "data/previews/" + id + ".jpg";
        if (ctx.files[shot]) ctx.copy("data/previews/" + copy.id + ".jpg", ctx.files[shot]);
        ctx.db.landings.push(copy);
        return landingDict(ctx.db, copy, null);
      });
    });
  }

  function deleteLanding(id) {
    return commit("Nexoia: eliminar landing", function (ctx) {
      var row = getLanding(ctx.db, id);
      var client = clientById(ctx.db, row.cliente_id);
      if (client) ctx.removeFolder("Templates/" + client.slug + "/" + row.slug + "/");
      ctx.remove("data/previews/" + id + ".jpg");
      ctx.db.landings = ctx.db.landings.filter(function (l) { return l.id !== id; });
      return { ok: true };
    });
  }

  /* Router: mismas rutas que server.py */
  function request(method, url, body) {
    var parsed = new URL(url, location.href);
    var path = parsed.pathname.replace(/^.*?\/api\//, "/api/");
    var m;
    try {
      if (path === "/api/clientes") {
        if (method === "GET") return load().then(function (s) { return listClients(s.db); });
        if (method === "POST") return createClient(body || {});
      }
      if ((m = /^\/api\/clientes\/(\d+)$/.exec(path))) {
        var cid = Number(m[1]);
        if (method === "GET") {
          return load().then(function (s) {
            var c = getClient(s.db, cid);
            var lista = s.db.landings.filter(function (l) { return l.cliente_id === cid; }).sort(byUpdated)
              .map(function (l) { return landingDict(s.db, l, s.files); });
            var data = clientDict(s.db, c, lista.length);
            data.lista = lista;
            return data;
          });
        }
        if (method === "PUT") return updateClient(cid, body || {});
        if (method === "DELETE") return deleteClient(cid);
      }
      if (path === "/api/landings") {
        if (method === "GET") {
          var only = Number(parsed.searchParams.get("cliente")) || 0;
          return load().then(function (s) {
            return s.db.landings.filter(function (l) { return !only || l.cliente_id === only; }).sort(byUpdated)
              .map(function (l) { return landingDict(s.db, l, s.files); });
          });
        }
        if (method === "POST") return saveLanding(body || {}, 0);
      }
      if ((m = /^\/api\/landings\/(\d+)$/.exec(path))) {
        var lid = Number(m[1]);
        if (method === "GET") return load().then(function (s) { return landingDict(s.db, getLanding(s.db, lid), s.files); });
        if (method === "PUT") return saveLanding(body || {}, lid);
        if (method === "DELETE") return deleteLanding(lid);
      }
      if ((m = /^\/api\/landings\/(\d+)\/duplicate$/.exec(path)) && method === "POST") return duplicateLanding(Number(m[1]));
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.reject(apiError(404, "Ruta inexistente"));
  }

  /* Barra de conexión */
  var bar = null;
  var dialog = null;

  function renderBar() {
    if (!bar) return;
    if (token()) {
      bar.className = "gh-bar is-on";
      bar.innerHTML = '<i class="bi bi-github" aria-hidden="true"></i>' +
        "<span>Conectado a GitHub" + (login() ? " como <b>" + escapeHtml(login()) + "</b>" : "") +
        ". Cada cambio se publica solo en 1 o 2 minutos.</span>" +
        '<button class="lb-link" type="button" data-gh-disconnect>Desconectar</button>';
    } else {
      bar.className = "gh-bar";
      bar.innerHTML = '<i class="bi bi-github" aria-hidden="true"></i>' +
        "<span>Estás viendo la versión publicada. Para crear o editar, conectá tu cuenta de GitHub.</span>" +
        '<button class="btn-nx btn-sm" type="button" data-gh-connect><i class="bi bi-plug"></i> Conectar GitHub</button>';
    }
  }

  function buildDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "lb-dialog gh-dialog";
    dialog.setAttribute("aria-labelledby", "ghTitle");
    dialog.innerHTML =
      '<form method="dialog" novalidate>' +
      '<div class="lb-dialog-head"><div><h2 id="ghTitle">Conectar GitHub</h2>' +
      "<p>Los clientes y las landings se guardan en el repo <b>" + escapeHtml(repo.owner + "/" + repo.repo) + "</b>. Hace falta un token con permiso de escritura.</p></div>" +
      '<button class="lb-dialog-close" type="button" data-gh-cancel aria-label="Cerrar"><i class="bi bi-x-lg"></i></button></div>' +
      '<ol class="gh-steps">' +
      '<li>Abrí <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Nuevo token <i class="bi bi-box-arrow-up-right"></i></a>.</li>' +
      "<li>En <b>Repository access</b> elegí <b>Only select repositories</b> → <b>" + escapeHtml(repo.repo) + "</b>.</li>" +
      "<li>En <b>Permissions → Repository permissions</b> poné <b>Contents: Read and write</b>.</li>" +
      "<li>Tocá <b>Generate token</b>, copialo y pegalo acá.</li>" +
      "</ol>" +
      '<label class="lb-label" for="ghToken">Token de GitHub</label>' +
      '<input class="lb-input" id="ghToken" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">' +
      '<p class="lb-hint">El token queda guardado solo en este navegador. Usá «Desconectar» en compus compartidas.</p>' +
      '<p class="lb-msg" data-gh-msg role="status" aria-live="polite"></p>' +
      '<div class="pf-form-foot"><span></span><span class="pf-form-actions">' +
      '<button class="btn-nx-outline btn-sm" type="button" data-gh-cancel>Cancelar</button>' +
      '<button class="btn-nx btn-sm" type="submit" data-gh-save><i class="bi bi-plug"></i> Conectar</button></span></div>' +
      "</form>";
    document.body.appendChild(dialog);
    var input = dialog.querySelector("#ghToken");
    var msg = dialog.querySelector("[data-gh-msg]");
    var say = function (text, tone) { msg.textContent = text || ""; msg.className = "lb-msg" + (tone ? " is-" + tone : ""); };
    dialog.querySelectorAll("[data-gh-cancel]").forEach(function (b) { b.addEventListener("click", function () { dialog.close(); }); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    dialog.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var value = input.value.trim();
      if (!value) { say("Pegá el token de GitHub.", "warn"); input.focus(); return; }
      var btn = dialog.querySelector("[data-gh-save]");
      btn.disabled = true;
      say("Verificando el token…");
      gh("GET", REPO_API, undefined, value).then(function (info) {
        if (!info.permissions || !info.permissions.push) throw apiError(403, "El token puede leer el repo pero no escribir. Activá «Contents: Read and write».");
        return gh("GET", "/user", undefined, value).then(function (u) { return u.login; }, function () { return ""; });
      }).then(function (user) {
        try {
          localStorage.setItem(TOKEN_KEY, value);
          localStorage.setItem(USER_KEY, user || "");
        } catch (err) { /* sin almacenamiento: no se puede recordar el token */ }
        cache = null;
        dialog.close();
        location.reload();
      }).catch(function (err) {
        say(err.message, "warn");
      }).then(function () { btn.disabled = false; });
    });
  }

  function openConnect() {
    if (!dialog) buildDialog();
    if (!dialog.open) {
      dialog.querySelector("#ghToken").value = "";
      dialog.querySelector("[data-gh-msg]").textContent = "";
      dialog.showModal();
      dialog.querySelector("#ghToken").focus();
    }
  }

  function mountBar() {
    var header = document.querySelector(".lib-header");
    if (!header) return;
    bar = document.createElement("div");
    header.insertAdjacentElement("afterend", bar);
    renderBar();
    bar.addEventListener("click", function (e) {
      if (e.target.closest("[data-gh-connect]")) openConnect();
      if (e.target.closest("[data-gh-disconnect]")) {
        try {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        } catch (err) { /* noop */ }
        location.reload();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountBar);
  else mountBar();

  window.NexoiaGitHub = { request: request, connected: function () { return !!token(); }, repo: repo };
})();
