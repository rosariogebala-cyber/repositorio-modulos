/* Vercel: arma landings desde sus datos con el mismo armador que el constructor (scripts/armar-landing.mjs).
   Solo la llama el servidor (api/index.py) al publicar: pide la firma X-Lanzate-Armado, hecha con LANZATE_SECRETO.

   POST { "pedidos": [{ "id", "landing": {nombre, items, estilo, animacion}, "cliente": {...} }] }
   →    { "resultados": [{ "id", "html", "faltan", "perdidos", "items" } | { "id", "error" }] } */
import { createHmac, timingSafeEqual } from "node:crypto";
import { armarVarias } from "../scripts/armar-landing.mjs";

export const FIRMA = "lanzate-armado-v1";

function firmaValida(recibida) {
  const secreto = process.env.LANZATE_SECRETO || "";
  if (!secreto || typeof recibida !== "string") return false;
  const esperada = Buffer.from(createHmac("sha256", secreto).update(FIRMA).digest("hex"));
  const dada = Buffer.from(recibida);
  return dada.length === esperada.length && timingSafeEqual(dada, esperada);
}

function responder(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function leerJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  const partes = [];
  for await (const parte of req) partes.push(parte);
  return JSON.parse(Buffer.concat(partes).toString("utf8") || "{}");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { error: "Usá POST" });
  if (!firmaValida(req.headers["x-lanzate-armado"])) return responder(res, 403, { error: "Sin permiso" });
  let data;
  try {
    data = await leerJson(req);
  } catch {
    return responder(res, 400, { error: "El pedido no es JSON" });
  }
  if (!Array.isArray(data.pedidos)) return responder(res, 400, { error: "Faltan los pedidos" });
  return responder(res, 200, { resultados: armarVarias(data.pedidos) });
}
