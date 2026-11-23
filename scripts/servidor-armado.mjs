/* Sirve la función de armado (api/armar.mjs) en la compu, para las pruebas: node scripts/servidor-armado.mjs PUERTO
   El servidor de Python la usa si LANZATE_ARMADO_URL=http://127.0.0.1:PUERTO */
import { createServer } from "node:http";
import handler from "../api/armar.mjs";

const port = Number(process.argv[2] || 8765);
createServer((req, res) => {
  if (req.url.split("?")[0] !== "/api/armar") {
    res.statusCode = 404;
    return res.end();
  }
  handler(req, res).catch((error) => {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(error) }));
  });
}).listen(port, "127.0.0.1", () => process.stdout.write("listo\n"));
