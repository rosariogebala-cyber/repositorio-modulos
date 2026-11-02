/* Intermediario de Cloudflare Workers para publicar desde GitHub Pages sin token en el navegador.
   Variables del worker:
     GITHUB_TOKEN  (secreto) token fine-grained con Contents: Read and write sobre el repo
     CLAVE         (secreto) clave compartida del equipo
     REPO          rosariogebala-cyber/repositorio-modulos
     ORIGEN        https://rosariogebala-cyber.github.io (se pueden separar varios con comas) */

function sameText(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(req, env) {
    const origins = String(env.ORIGEN || "").split(",").map((o) => o.trim()).filter(Boolean);
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": origins.includes(origin) ? origin : origins[0] || "",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, X-GitHub-Api-Version, X-Nexoia-Clave",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const reply = (status, body) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!sameText(req.headers.get("X-Nexoia-Clave") || "", env.CLAVE || "")) return reply(401, { message: "Clave incorrecta" });

    const url = new URL(req.url);
    const repo = "/repos/" + env.REPO;
    const path = url.pathname.replace(/^\/github/, "");
    if (path !== repo && !path.startsWith(repo + "/git/")) return reply(403, { message: "Ruta no permitida" });
    if (path === repo && req.method !== "GET") return reply(403, { message: "Ruta no permitida" });

    const headers = {
      Authorization: "Bearer " + env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "nexoia-publicar",
    };
    const init = { method: req.method, headers };
    if (req.method !== "GET") {
      headers["Content-Type"] = "application/json";
      init.body = await req.text();
    }
    const res = await fetch("https://api.github.com" + path + url.search, init);
    return reply(res.status, await res.text());
  },
};
