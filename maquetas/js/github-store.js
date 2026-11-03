/* Backend en el navegador para GitHub Pages.
   Sin clave, lo que se crea queda guardado en este navegador (localStorage).
   Con la clave del equipo (o un token de GitHub), cada cambio se publica como un commit en el repo.
   Atiende las mismas rutas /api/... que server.py. */
(function () {
  "use strict";

  /* URL del intermediario de Cloudflare que guarda el token (ver deploy/publicar-worker.js). */
  var PROXY_URL = "";

  var FALLBACK = { owner: "rosariogebala-cyber", repo: "repositorio-modulos", branch: "main" };
  var TOKEN_KEY = "nexoia-github-token";
  var USER_KEY = "nexoia-github-user";
  var CLAVE_KEY = "nexoia-clave";
  var LOCAL_KEY = "nexoia-local";
  var LOCAL_BASE = 900000;
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

  /* Link de edición: la clave viaja en el hash (no llega al servidor) y se guarda en este navegador */
  var hashClave = /[#&]clave=([^&]+)/.exec(location.hash);
  if (hashClave) {
    try { localStorage.setItem("nexoia-clave", decodeURIComponent(hashClave[1])); } catch (e) { /* sin almacenamiento */ }
    history.replaceState(null, "", location.pathname + location.search);
  }

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
  function readKey(key) {
    try { return localStorage.getItem(key) || ""; } catch (e) { return ""; }
  }
  function writeKey(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch (e) { /* sin almacenamiento */ }
  }

  /* Credenciales para publicar */
  function token() { return readKey(TOKEN_KEY); }
  function clave() { return PROXY_URL ? readKey(CLAVE_KEY) : ""; }
  function canPublish() { return !!(token() || clave()); }
  function currentAuth() {
    if (token()) return { token: token() };
    if (clave()) return { clave: clave() };
    return {};
  }

  function ghMessage(status, data, auth) {
    var text = (data && data.message) || "";
    if (auth.clave && status === 401 && text === "Clave incorrecta") {
      writeKey(CLAVE_KEY, "");
      return "La clave no es correcta o cambió. Pedí el link de edición actualizado.";
    }
    if (auth.clave && status === 401) return "El token del intermediario venció: hay que renovarlo en Cloudflare.";
    if (status === 401) return "El token de GitHub no es válido o venció. Volvé a conectarlo.";
    if (status === 403 && /rate limit/i.test(text)) return "GitHub limitó las consultas por un rato. Probá en unos minutos.";
    if (status === 403) return "No hay permiso para escribir en el repo (hace falta «Contents: Read and write»).";
    if (status === 404) return "No se encontró el repo " + repo.owner + "/" + repo.repo + " o no hay acceso.";
    return text ? "GitHub respondió: " + text : "GitHub no pudo completar la acción.";
  }

  function gh(method, path, body, auth) {
    auth = auth || currentAuth();
    var headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    var base = "https://api.github.com";
    if (auth.token) headers.Authorization = "Bearer " + auth.token;
    else if (auth.clave) {
      base = PROXY_URL.replace(/\/+$/, "") + "/github";
      headers["X-Nexoia-Clave"] = auth.clave;
    }
    var opts = { method: method, headers: headers, cache: "no-store" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(base + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw apiError(r.status, ghMessage(r.status, data, auth));
        return data;
      });
    }, function () {
      throw apiError(0, "No hay conexión para publicar. Revisá tu internet.");
    });
  }

  /* Lectura del repo */
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

  function loadPublished() {
    if (cache && now() - cache.at < 8000) return cache.promise;
    var promise = canPublish()
      ? snapshot().then(function (snap) { return readDb(snap).then(function (db) { return { db: db, files: snap.files }; }); })
      : fetch(siteRoot + "data/db.json?t=" + now(), { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw apiError(r.status, "No se encontraron los datos publicados (data/db.json).");
        return r.json();
      }).then(function (db) { return { db: normalizeDb(db), files: null }; });
    cache = { at: now(), promise: promise };
    promise.catch(function () { cache = null; });
    return promise;
  }

  /* Lo guardado en este navegador se suma encima de lo publicado */
  function localData() {
    var s = null;
    try { s = JSON.parse(readKey(LOCAL_KEY) || "null"); } catch (e) { s = null; }
    s = s || {};
    s.seq = s.seq || LOCAL_BASE;
    s.clientes = s.clientes || {};
    s.landings = s.landings || {};
    return s;
  }
  function saveLocal(s) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
    } catch (e) {
      throw apiError(507, "No queda espacio en este navegador. Publicá o eliminá alguna landing guardada acá.");
    }
  }
  function pendingCount() {
    var s = localData();
    return Object.keys(s.landings).length + Object.keys(s.clientes).length;
  }

  function overlay(db) {
    var s = localData();
    var view = { clientes: [], landings: [], published: { clientes: {}, landings: {} } };
    db.clientes.forEach(function (c) { view.published.clientes[c.id] = true; view.clientes.push(s.clientes[c.id] || c); });
    Object.keys(s.clientes).forEach(function (k) { if (!view.published.clientes[k]) view.clientes.push(s.clientes[k]); });
    db.landings.forEach(function (l) { view.published.landings[l.id] = true; view.landings.push(s.landings[l.id] || l); });
    Object.keys(s.landings).forEach(function (k) { if (!view.published.landings[k]) view.landings.push(s.landings[k]); });
    return view;
  }

  function load() {
    return loadPublished().then(function (p) { return { db: overlay(p.db), files: p.files }; });
  }

  /* Escritura en el repo: un commit por acción */
  function commit(message, mutate) {
    if (!canPublish()) return needUnlock();
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

  function needUnlock(text) {
    openUnlock();
    return Promise.reject(apiError(401, text || "Para publicar en el link, poné la clave del equipo."));
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
  function clientDict(c, count) {
    var data = {};
    CLIENT_COLS.forEach(function (k) { data[k] = c[k] == null ? "" : c[k]; });
    data.logo_url = c.logo_data || (c.logo ? siteRoot + c.logo + "?v=" + c.actualizado : "");
    data.carpeta = "Templates/" + c.slug + "/";
    if (count !== undefined) data.landings = count;
    if (c.local) {
      data.local = true;
      data.publicado = !!c.publicado;
    }
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
  function uniqueClientSlug(clientes, files, nombre, excludeId) {
    var base = slugify(nombre, "cliente");
    var slug = base;
    var n = 2;
    while (clientes.some(function (c) { return c.slug === slug && c.id !== excludeId; }) ||
           (!excludeId && files && folderExists(files, "Templates/" + slug + "/"))) {
      slug = base + "-" + n++;
    }
    return slug;
  }
  function checkLogo(dataUrl) {
    var match = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(dataUrl || "");
    if (!match || !LOGO_TYPES[match[1]]) throw apiError(400, "El logo tiene que ser PNG, JPG, WEBP o SVG");
    if (match[2].length * 3 / 4 > 2 * 1024 * 1024) throw apiError(400, "El logo pesa más de 2 MB");
    return { ext: LOGO_TYPES[match[1]], b64: match[2] };
  }
  function removeLogos(ctx, slug) {
    Object.keys(LOGO_TYPES).forEach(function (type) { ctx.remove("data/logos/" + slug + "." + LOGO_TYPES[type]); });
  }
  function saveLogo(ctx, slug, dataUrl) {
    var logo;
    try { logo = checkLogo(dataUrl); } catch (err) { return Promise.reject(err); }
    removeLogos(ctx, slug);
    var path = "data/logos/" + slug + "." + logo.ext;
    return ctx.blob(logo.b64).then(function (sha) { ctx.copy(path, sha); return path; });
  }
  function writeClientJson(ctx, c) {
    var data = {};
    CLIENT_COLS.forEach(function (k) { if (k !== "creado" && k !== "actualizado") data[k] = c[k]; });
    ctx.put("Templates/" + c.slug + "/cliente.json", JSON.stringify(data, null, 2));
  }
  function orderClient(row) {
    var out = {};
    CLIENT_COLS.forEach(function (k) { out[k] = row[k] == null ? "" : row[k]; });
    return out;
  }

  function listClients(db) {
    return db.clientes.slice().sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    }).map(function (c) { return clientDict(c, countLandings(db, c.id)); });
  }

  function createClient(body) {
    return commit("Nexoia: nuevo cliente «" + String(body.nombre || "").trim() + "»", function (ctx) {
      var values = cleanClient(body);
      var slug = uniqueClientSlug(ctx.db.clientes, ctx.files, values.nombre, 0);
      return (body.logo_data ? saveLogo(ctx, slug, body.logo_data) : Promise.resolve("")).then(function (logo) {
        var stamp = now();
        var row = { id: ctx.db.next_id.clientes++, slug: slug };
        CLIENT_FIELDS.forEach(function (f) { row[f] = values[f]; });
        row.logo = logo;
        row.creado = stamp;
        row.actualizado = stamp;
        ctx.db.clientes.push(orderClient(row));
        writeClientJson(ctx, row);
        return clientDict(row, 0);
      });
    });
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
        return clientDict(row, countLandings(ctx.db, id));
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
    var base = {
      id: l.id,
      cliente_id: l.cliente_id,
      cliente: c.nombre,
      cliente_slug: c.slug,
      nombre: l.nombre,
      slug: l.slug,
      items: l.items || [],
      estilo: l.estilo || "",
      creado: l.creado,
      actualizado: l.actualizado
    };
    if (l.local) {
      base.preview = l.portada || "";
      base.portada = l.portada || "";
      base.url = siteRoot + "maquetas/ver.html?landing=" + l.id;
      base.path = "este navegador";
      base.disponible = true;
      base.local = true;
      base.publicada = !!l.publicada;
      return base;
    }
    var rel = "Templates/" + c.slug + "/" + l.slug + "/";
    var shot = "data/previews/" + l.id + ".jpg";
    var cover = l.portada ? siteRoot + rel + l.portada : "";
    base.preview = files && !files[shot] ? cover : siteRoot + shot + "?v=" + l.actualizado;
    base.portada = cover;
    base.url = siteRoot + rel;
    base.path = rel + "index.html";
    base.disponible = files ? !!files[rel + "index.html"] : true;
    return base;
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

  function cleanLanding(body) {
    var data = {
      nombre: String(body.nombre || "").trim(),
      html: String(body.html || ""),
      items: body.items || [],
      estilo: String(body.estilo || ""),
      clientId: Number(body.cliente_id) || 0
    };
    if (!data.clientId) throw apiError(400, "Elegí el cliente de la landing");
    if (!data.nombre || !data.html) throw apiError(400, "Faltan el nombre o el HTML");
    data.slug = slugify(data.nombre);
    return data;
  }
  function checkClash(db, client, slug, id) {
    var clash = db.landings.some(function (l) { return l.cliente_id === client.id && l.slug === slug && l.id !== (id || 0); });
    if (clash) throw apiError(409, "«" + client.nombre + "» ya tiene una landing llamada así. Usá otro nombre o editá la existente.");
  }

  function saveLanding(body, id) {
    var nombre = String(body.nombre || "").trim();
    return commit("Nexoia: " + (id ? "actualizar" : "crear") + " landing «" + nombre + "»", function (ctx) {
      var data = cleanLanding(body);
      var client = getClient(ctx.db, data.clientId);
      var old = id ? getLanding(ctx.db, id) : null;
      checkClash(ctx.db, client, data.slug, id);
      if (old) {
        var oldClient = clientById(ctx.db, old.cliente_id);
        if (oldClient) ctx.removeFolder("Templates/" + oldClient.slug + "/" + old.slug + "/");
      }
      var dest = "Templates/" + client.slug + "/" + data.slug + "/";
      ctx.removeFolder(dest);
      return buildSite(ctx, dest, data.html).then(function (built) {
        writeLandingJson(ctx, dest, data.nombre, data.slug, client.slug, data.items, data.estilo);
        writeClientJson(ctx, client);
        var stamp = now();
        var row = old || { id: ctx.db.next_id.landings++, creado: stamp };
        row.cliente_id = data.clientId;
        row.nombre = data.nombre;
        row.slug = data.slug;
        row.items = data.items;
        row.estilo = data.estilo;
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

  function copyName(db, row, busy) {
    var n = 1;
    while (true) {
      var nombre = row.nombre + (n === 1 ? " (copia)" : " (copia " + n + ")");
      var slug = slugify(nombre);
      var taken = db.landings.some(function (l) { return l.cliente_id === row.cliente_id && l.slug === slug; });
      if (!taken && !(busy && busy(slug))) return { nombre: nombre, slug: slug };
      n++;
    }
  }

  function duplicateLanding(id) {
    return commit("Nexoia: duplicar landing", function (ctx) {
      var row = getLanding(ctx.db, id);
      var client = getClient(ctx.db, row.cliente_id);
      var src = "Templates/" + client.slug + "/" + row.slug + "/";
      if (!folderExists(ctx.files, src)) throw apiError(404, "No se encontró la carpeta de la landing");
      var name = copyName(ctx.db, row, function (slug) { return folderExists(ctx.files, "Templates/" + client.slug + "/" + slug + "/"); });
      var dest = "Templates/" + client.slug + "/" + name.slug + "/";
      Object.keys(ctx.files).forEach(function (p) {
        if (p.indexOf(src) === 0) ctx.copy(dest + p.slice(src.length), ctx.files[p]);
      });
      writeLandingJson(ctx, dest, name.nombre, name.slug, client.slug, row.items || [], row.estilo);
      return ctx.text(src + "index.html").then(function (html) {
        if (html != null) {
          ctx.put(dest + "index.html", html.replace(/<title>[\s\S]*?<\/title>/, "<title>" + escapeHtml(name.nombre) + "</title>"));
        }
        var stamp = now();
        var copy = orderLanding({
          id: ctx.db.next_id.landings++, cliente_id: row.cliente_id, nombre: name.nombre, slug: name.slug,
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

  /* Guardado en este navegador */
  function localCreateClient(body) {
    return load().then(function (s) {
      var values = cleanClient(body);
      if (body.logo_data) checkLogo(body.logo_data);
      var store = localData();
      var stamp = now();
      var row = { id: ++store.seq, slug: uniqueClientSlug(s.db.clientes, null, values.nombre, 0), logo: "", creado: stamp, actualizado: stamp };
      CLIENT_FIELDS.forEach(function (f) { row[f] = values[f]; });
      row = orderClient(row);
      row.logo_data = body.logo_data || "";
      row.local = true;
      store.clientes[row.id] = row;
      saveLocal(store);
      return clientDict(row, 0);
    });
  }

  function localUpdateClient(id, body) {
    return load().then(function (s) {
      var values = cleanClient(body);
      if (body.logo_data) checkLogo(body.logo_data);
      var current = getClient(s.db, id);
      var row = orderClient(current);
      CLIENT_FIELDS.forEach(function (f) { row[f] = values[f]; });
      row.actualizado = now();
      row.logo_data = current.logo_data || "";
      if (body.logo_data) row.logo_data = body.logo_data;
      else if (body.logo_quitar) { row.logo_data = ""; row.logo = ""; }
      row.local = true;
      row.publicado = !!s.db.published.clientes[id];
      var store = localData();
      store.clientes[id] = row;
      saveLocal(store);
      return clientDict(row, countLandings(s.db, id));
    });
  }

  function localDeleteClient(id) {
    return load().then(function (s) {
      var row = getClient(s.db, id);
      var count = countLandings(s.db, id);
      if (count) {
        throw apiError(409, "«" + row.nombre + "» tiene " + count + " landing" + (count === 1 ? "" : "s") +
          ". Eliminalas o pasalas a otro cliente antes de borrarlo.");
      }
      var store = localData();
      delete store.clientes[id];
      saveLocal(store);
      return { ok: true };
    });
  }

  function localSaveLanding(body, id) {
    return load().then(function (s) {
      var data = cleanLanding(body);
      var client = getClient(s.db, data.clientId);
      var old = id ? getLanding(s.db, id) : null;
      checkClash(s.db, client, data.slug, id);
      var store = localData();
      var stamp = now();
      var cover = coverOf(data.html);
      var row = orderLanding({
        id: old ? old.id : ++store.seq, cliente_id: data.clientId, nombre: data.nombre, slug: data.slug,
        items: data.items, estilo: data.estilo, creado: old ? old.creado : stamp, actualizado: stamp,
        portada: cover ? siteRoot + "maquetas/" + cover : ""
      });
      row.html = data.html;
      row.local = true;
      row.publicada = !!s.db.published.landings[row.id];
      store.landings[row.id] = row;
      saveLocal(store);
      return landingDict(s.db, row, null);
    });
  }

  function localDuplicate(id) {
    return load().then(function (s) {
      var src = getLanding(s.db, id);
      var client = getClient(s.db, src.cliente_id);
      var source = landingDict(s.db, src, s.files);
      var html = src.local
        ? Promise.resolve({ html: src.html, base: src.base || "" })
        : fetch(source.url + "index.html", { cache: "no-store" }).then(function (r) {
          if (!r.ok) throw apiError(404, "No se encontró la landing publicada");
          return r.text().then(function (text) { return { html: text, base: source.url }; });
        });
      return html.then(function (got) {
        var name = copyName(s.db, src);
        var store = localData();
        var stamp = now();
        var row = orderLanding({
          id: ++store.seq, cliente_id: client.id, nombre: name.nombre, slug: name.slug, items: src.items,
          estilo: src.estilo, creado: stamp, actualizado: stamp, portada: source.portada
        });
        row.html = got.html.replace(/<title>[\s\S]*?<\/title>/, "<title>" + escapeHtml(name.nombre) + "</title>");
        if (got.base) row.base = got.base;
        row.local = true;
        store.landings[row.id] = row;
        saveLocal(store);
        return landingDict(s.db, row, null);
      });
    });
  }

  function localDeleteLanding(id) {
    var store = localData();
    delete store.landings[id];
    saveLocal(store);
    return Promise.resolve({ ok: true });
  }

  /* Publicar lo guardado en este navegador */
  function publishClient(id) {
    var c = localData().clientes[id];
    if (!c) return Promise.resolve(id);
    var body = {};
    CLIENT_FIELDS.forEach(function (f) { body[f] = c[f]; });
    if (c.logo_data) body.logo_data = c.logo_data;
    else if (!c.logo) body.logo_quitar = true;
    var req = c.publicado ? updateClient(id, body) : createClient(body);
    return req.then(function (saved) {
      var store = localData();
      delete store.clientes[id];
      Object.keys(store.landings).forEach(function (k) {
        if (store.landings[k].cliente_id === id) store.landings[k].cliente_id = saved.id;
      });
      saveLocal(store);
      return saved.id;
    });
  }

  function publishableHtml(l) {
    if (!l.base) return l.html;
    return l.html
      .replace(/((?:src|href)=")assets\//g, "$1../assets/")
      .replace(/(url\(\s*['"]?)assets\//g, "$1../assets/");
  }

  function publishLanding(id) {
    if (!canPublish()) return needUnlock();
    var l = localData().landings[id];
    if (!l) return Promise.reject(apiError(404, "Esta landing ya está publicada."));
    return publishClient(l.cliente_id).then(function (clientId) {
      var body = { nombre: l.nombre, cliente_id: clientId, html: publishableHtml(l), items: l.items, estilo: l.estilo };
      return saveLanding(body, l.publicada ? id : 0);
    }).then(function (saved) {
      var store = localData();
      delete store.landings[id];
      saveLocal(store);
      return saved;
    });
  }

  function publishAll() {
    if (!canPublish()) return needUnlock();
    var store = localData();
    var chain = Promise.resolve();
    var done = 0;
    Object.keys(store.landings).forEach(function (k) {
      chain = chain.then(function () { return publishLanding(Number(k)); }).then(function () { done++; });
    });
    Object.keys(store.clientes).forEach(function (k) {
      chain = chain.then(function () { return publishClient(Number(k)); });
    });
    return chain.then(function () { return { ok: true, landings: done }; });
  }

  function dropLocal(kind, id) {
    var store = localData();
    if (store[kind][id]) {
      delete store[kind][id];
      saveLocal(store);
    }
  }

  /* Router: mismas rutas que server.py */
  function request(method, url, body) {
    var parsed = new URL(url, location.href);
    var path = parsed.pathname.replace(/^.*?\/api\//, "/api/");
    var m;
    var store = localData();
    var publish = canPublish();
    var locked = "Esta landing está publicada en el link. Para eliminarla, poné la clave del equipo.";
    try {
      if (path === "/api/clientes") {
        if (method === "GET") return load().then(function (s) { return listClients(s.db); });
        if (method === "POST") return publish ? createClient(body || {}) : localCreateClient(body || {});
      }
      if ((m = /^\/api\/clientes\/(\d+)\/publish$/.exec(path)) && method === "POST") {
        if (!publish) return needUnlock();
        return publishClient(Number(m[1])).then(function (cid) { return { ok: true, id: cid, publicando: true }; });
      }
      if ((m = /^\/api\/clientes\/(\d+)$/.exec(path))) {
        var cid = Number(m[1]);
        var localClient = store.clientes[cid];
        if (method === "GET") {
          return load().then(function (s) {
            var c = getClient(s.db, cid);
            var lista = s.db.landings.filter(function (l) { return l.cliente_id === cid; }).sort(byUpdated)
              .map(function (l) { return landingDict(s.db, l, s.files); });
            var data = clientDict(c, lista.length);
            data.lista = lista;
            return data;
          });
        }
        if (method === "PUT") {
          if (!publish) return localUpdateClient(cid, body || {});
          if (localClient && !localClient.publicado) {
            return localUpdateClient(cid, body || {}).then(function () { return publishClient(cid); })
              .then(function (newId) { return load().then(function (s) { return clientDict(getClient(s.db, newId), countLandings(s.db, newId)); }); });
          }
          return updateClient(cid, body || {}).then(function (saved) { dropLocal("clientes", cid); return saved; });
        }
        if (method === "DELETE") {
          if (localClient && !localClient.publicado) return localDeleteClient(cid);
          if (!publish) return needUnlock("Este cliente está publicado en el link. Para eliminarlo, poné la clave del equipo.");
          return deleteClient(cid).then(function (r) { dropLocal("clientes", cid); return r; });
        }
      }
      if (path === "/api/landings") {
        if (method === "GET") {
          var only = Number(parsed.searchParams.get("cliente")) || 0;
          return load().then(function (s) {
            return s.db.landings.filter(function (l) { return !only || l.cliente_id === only; }).sort(byUpdated)
              .map(function (l) { return landingDict(s.db, l, s.files); });
          });
        }
        if (method === "POST") {
          if (!publish) return localSaveLanding(body || {}, 0);
          return publishClient(Number((body || {}).cliente_id)).then(function (clientId) {
            var data = {};
            for (var k in body) data[k] = body[k];
            data.cliente_id = clientId;
            return saveLanding(data, 0);
          });
        }
      }
      if (path === "/api/publicar" && method === "POST") return publishAll();
      if ((m = /^\/api\/landings\/(\d+)\/publish$/.exec(path)) && method === "POST") return publishLanding(Number(m[1]));
      if ((m = /^\/api\/landings\/(\d+)\/duplicate$/.exec(path)) && method === "POST") {
        var did = Number(m[1]);
        if (publish && !store.landings[did]) return duplicateLanding(did);
        return localDuplicate(did).then(function (copy) { return publish ? publishLanding(copy.id) : copy; });
      }
      if ((m = /^\/api\/landings\/(\d+)$/.exec(path))) {
        var lid = Number(m[1]);
        var localLanding = store.landings[lid];
        if (method === "GET") return load().then(function (s) { return landingDict(s.db, getLanding(s.db, lid), s.files); });
        if (method === "PUT") {
          if (!publish) return localSaveLanding(body || {}, lid);
          if (localLanding && !localLanding.publicada) {
            return localSaveLanding(body || {}, lid).then(function () { return publishLanding(lid); });
          }
          return publishClient(Number((body || {}).cliente_id)).then(function (clientId) {
            var data = {};
            for (var k in body) data[k] = body[k];
            data.cliente_id = clientId;
            return saveLanding(data, lid);
          }).then(function (saved) { dropLocal("landings", lid); return saved; });
        }
        if (method === "DELETE") {
          if (localLanding && !localLanding.publicada) return localDeleteLanding(lid);
          if (!publish) return needUnlock(locked);
          return deleteLanding(lid).then(function (r) { dropLocal("landings", lid); return r; });
        }
      }
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.reject(apiError(404, "Ruta inexistente"));
  }

  /* Barra de estado */
  var bar = null;
  var dialog = null;

  function renderBar() {
    if (!bar) return;
    var pending = pendingCount();
    var pendingText = pending ? " Tenés " + pending + " cambio" + (pending === 1 ? "" : "s") + " sin publicar." : "";
    if (canPublish()) {
      bar.className = "gh-bar is-on";
      bar.innerHTML = '<i class="bi bi-cloud-check" aria-hidden="true"></i>' +
        "<span>Publicación activada: cada cambio se ve en el link en 1 o 2 minutos." + pendingText + "</span>" +
        (pending ? '<button class="btn-nx btn-sm" type="button" data-gh-publish-all><i class="bi bi-cloud-upload"></i> Publicar pendientes</button>' : "") +
        (clave() ? '<button class="btn-nx-outline btn-sm" type="button" data-gh-share><i class="bi bi-link-45deg"></i> Copiar link de edición</button>' : "") +
        '<button class="lb-link" type="button" data-gh-lock>Bloquear</button>';
    } else {
      bar.className = "gh-bar";
      bar.innerHTML = '<i class="bi bi-laptop" aria-hidden="true"></i>' +
        "<span>Lo que creás se guarda en este navegador." + pendingText + " Para que se vea en el link, publicalo con la clave del equipo.</span>" +
        '<button class="btn-nx btn-sm" type="button" data-gh-unlock><i class="bi bi-key"></i> Publicar con clave</button>';
    }
  }

  function buildDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "lb-dialog gh-dialog";
    dialog.setAttribute("aria-labelledby", "ghTitle");
    dialog.innerHTML =
      '<form method="dialog" novalidate>' +
      '<div class="lb-dialog-head"><div><h2 id="ghTitle">Publicar en el link</h2>' +
      "<p>Con la clave, lo que crees o edites se publica en el link y lo ve todo el equipo.</p></div>" +
      '<button class="lb-dialog-close" type="button" data-gh-cancel aria-label="Cerrar"><i class="bi bi-x-lg"></i></button></div>' +
      (PROXY_URL
        ? '<label class="lb-label" for="ghClave">Clave del equipo</label>' +
          '<input class="lb-input" id="ghClave" type="password" autocomplete="current-password" placeholder="Clave">'
        : '<p class="lb-hint">La clave del equipo todavía no está configurada. Mientras tanto podés publicar con un token de GitHub.</p>') +
      '<details class="gh-alt"' + (PROXY_URL ? "" : " open") + "><summary>Usar un token de GitHub</summary>" +
      '<ol class="gh-steps">' +
      '<li>Abrí <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Nuevo token <i class="bi bi-box-arrow-up-right"></i></a>.</li>' +
      "<li>En <b>Repository access</b> elegí <b>Only select repositories</b> → <b>" + escapeHtml(repo.repo) + "</b>.</li>" +
      "<li>En <b>Permissions → Repository permissions</b> poné <b>Contents: Read and write</b>.</li>" +
      "<li>Tocá <b>Generate token</b>, copialo y pegalo acá.</li>" +
      "</ol>" +
      '<label class="lb-label" for="ghToken">Token de GitHub</label>' +
      '<input class="lb-input" id="ghToken" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></details>' +
      '<p class="lb-hint">Queda guardado solo en este navegador. Usá «Bloquear» en compus compartidas.</p>' +
      '<p class="lb-msg" data-gh-msg role="status" aria-live="polite"></p>' +
      '<div class="pf-form-foot"><span></span><span class="pf-form-actions">' +
      '<button class="btn-nx-outline btn-sm" type="button" data-gh-cancel>Cancelar</button>' +
      '<button class="btn-nx btn-sm" type="submit" data-gh-save><i class="bi bi-unlock"></i> Activar publicación</button></span></div>' +
      "</form>";
    document.body.appendChild(dialog);
    var claveInput = dialog.querySelector("#ghClave");
    var tokenInput = dialog.querySelector("#ghToken");
    var msg = dialog.querySelector("[data-gh-msg]");
    var say = function (text, tone) { msg.textContent = text || ""; msg.className = "lb-msg" + (tone ? " is-" + tone : ""); };
    dialog.querySelectorAll("[data-gh-cancel]").forEach(function (b) { b.addEventListener("click", function () { dialog.close(); }); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    dialog.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var tokenValue = tokenInput.value.trim();
      var claveValue = claveInput ? claveInput.value : "";
      if (!tokenValue && !claveValue) {
        say(PROXY_URL ? "Escribí la clave del equipo." : "Pegá el token de GitHub.", "warn");
        (claveInput || tokenInput).focus();
        return;
      }
      var auth = tokenValue ? { token: tokenValue } : { clave: claveValue };
      var btn = dialog.querySelector("[data-gh-save]");
      btn.disabled = true;
      say(tokenValue ? "Verificando el token…" : "Verificando la clave…");
      gh("GET", REPO_API, undefined, auth).then(function (info) {
        if (!info.permissions || !info.permissions.push) throw apiError(403, "Hay acceso de lectura pero no de escritura. Activá «Contents: Read and write».");
        return gh("POST", REPO_API + "/git/blobs", { content: "", encoding: "utf-8" }, auth).catch(function (err) {
          if (err.status === 403 || err.status === 404) {
            throw apiError(403, "El token puede leer el repo pero no escribir. En GitHub, editá el token: en «Repository access» elegí «" + repo.repo + "» y en «Permissions → Contents» poné «Read and write».");
          }
          throw err;
        });
      }).then(function () {
        if (!tokenValue) return "";
        return gh("GET", "/user", undefined, auth).then(function (u) { return u.login; }, function () { return ""; });
      }).then(function (user) {
        if (tokenValue) {
          writeKey(TOKEN_KEY, tokenValue);
          writeKey(USER_KEY, user || "");
        } else {
          writeKey(CLAVE_KEY, claveValue);
        }
        cache = null;
        dialog.close();
        location.reload();
      }).catch(function (err) {
        say(err.message, "warn");
      }).then(function () { btn.disabled = false; });
    });
  }

  function openUnlock() {
    if (!dialog) buildDialog();
    if (!dialog.open) {
      dialog.querySelectorAll("input").forEach(function (i) { i.value = ""; });
      dialog.querySelector("[data-gh-msg]").textContent = "";
      dialog.showModal();
      (dialog.querySelector("#ghClave") || dialog.querySelector("#ghToken")).focus();
    }
  }

  function mountBar() {
    var header = document.querySelector(".lib-header");
    if (!header) return;
    bar = document.createElement("div");
    header.insertAdjacentElement("afterend", bar);
    renderBar();
    bar.addEventListener("click", function (e) {
      if (e.target.closest("[data-gh-unlock]")) openUnlock();
      if (e.target.closest("[data-gh-lock]")) {
        writeKey(TOKEN_KEY, "");
        writeKey(USER_KEY, "");
        writeKey(CLAVE_KEY, "");
        location.reload();
      }
      var share = e.target.closest("[data-gh-share]");
      if (share) {
        var link = location.origin + siteRoot + "maquetas/constructor.html#clave=" + encodeURIComponent(clave());
        var done = function () { share.innerHTML = '<i class="bi bi-check2"></i> Link copiado'; };
        if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, function () { prompt("Copiá el link de edición:", link); });
        else prompt("Copiá el link de edición:", link);
      }
      var all = e.target.closest("[data-gh-publish-all]");
      if (all) {
        all.disabled = true;
        all.textContent = "Publicando…";
        publishAll().then(function () { location.reload(); }, function (err) {
          all.disabled = false;
          alert(err.message);
          renderBar();
        });
      }
    });
    window.addEventListener("storage", function (e) { if (e.key === LOCAL_KEY) renderBar(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountBar);
  else mountBar();

  window.NexoiaGitHub = {
    request: function (method, url, body) {
      return request(method, url, body).then(function (data) { renderBar(); return data; });
    },
    connected: canPublish,
    repo: repo
  };
})();
