"""Pasa al repo ../jimenavidal lo que el sitio estático toma de Lanzate.

  python3 exportar_pages.py                copia oferta.py, fuentes, oferta-landing.js y las imágenes de la landing
  python3 exportar_pages.py --desde-base   además pisa datos/ con la landing y las promos de Postgres

Las promos ahora se editan en https://rosariogebala-cyber.github.io/jimenavidal/gestion/, que guarda en
datos/ofertas.json de ese repo. --desde-base borra esos cambios: usarlo solo para volver a sembrar.
El sitio lo arma GitHub Actions con herramientas/armar.py.
"""

import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(os.path.dirname(ROOT), "jimenavidal")
DATOS = os.path.join(DESTINO, "datos")
FOTOS = os.path.join(DATOS, "fotos")
LANDING_ID = 26
FIJOS = ("maquetas/js/oferta-landing.js", "assets/modulos/navegacion/compleja.png")


def escribir_json(nombre, data):
    with open(os.path.join(DATOS, nombre), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def desde_base():
    import server  # noqa: F401  carga ~/.lanzate/lanzate.env
    from psycopg.rows import dict_row
    import psycopg

    if os.path.isdir(FOTOS):
        shutil.rmtree(FOTOS)
    os.makedirs(FOTOS)
    with psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row) as con:
        landing = con.execute(
            "SELECT l.nombre, l.html, l.descripcion, l.portada, c.nombre AS nombre_cliente, c.slug, c.telefono, "
            "c.instagram, c.direccion, c.color_primario FROM landings l JOIN clientes c ON c.id = l.cliente_id "
            "WHERE l.id = %s",
            (LANDING_ID,),
        ).fetchone()
        filas = con.execute(
            "SELECT id, estado, orden, datos, foto FROM ofertas WHERE landing_id = %s ORDER BY estado DESC, orden, creado",
            (LANDING_ID,),
        ).fetchall()

    with open(os.path.join(DATOS, "landing.html"), "w", encoding="utf-8") as f:
        f.write(landing["html"])
    escribir_json("sitio.json", {
        "titulo": landing["nombre"],
        "descripcion": landing["descripcion"],
        "imagen": landing["portada"],
        "marca": {
            "nombre": landing["nombre_cliente"], "slug": landing["slug"], "telefono": landing["telefono"],
            "instagram": landing["instagram"], "direccion": landing["direccion"],
            "color_primario": landing["color_primario"],
        },
    })
    ofertas = []
    for fila in filas:
        datos = fila["datos"] if isinstance(fila["datos"], dict) else {}
        foto = ""
        if fila["foto"]:
            foto = fila["id"] + ".jpg"
            with open(os.path.join(FOTOS, foto), "wb") as f:
                f.write(bytes(fila["foto"]))
        ofertas.append({"id": fila["id"], "estado": fila["estado"], "orden": fila["orden"], "foto": foto, "datos": datos})
    escribir_json("ofertas.json", ofertas)
    print("Copiadas %d ofertas a datos/" % len(ofertas))


def copiar(origen, destino):
    if not os.path.exists(origen):
        print("  falta %s" % os.path.relpath(origen, ROOT))
        return
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    shutil.copy2(origen, destino)


def sincronizar():
    herramientas = os.path.join(DESTINO, "herramientas")
    copiar(os.path.join(ROOT, "oferta.py"), os.path.join(herramientas, "oferta.py"))
    for nombre in os.listdir(os.path.join(ROOT, "fonts")):
        if nombre.endswith((".ttf", ".txt")):
            copiar(os.path.join(ROOT, "fonts", nombre), os.path.join(herramientas, "fonts", nombre))

    with open(os.path.join(DATOS, "landing.html"), encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(DATOS, "sitio.json"), encoding="utf-8") as f:
        sitio = json.load(f)
    rutas = {m.split("?", 1)[0].lstrip("/") for m in re.findall(r'(?:src|href|poster)="(/maquetas/[^"]+)"', html)}
    rutas |= set(FIJOS)
    if sitio.get("imagen"):
        rutas.add(sitio["imagen"].lstrip("/"))
    for ruta in sorted(rutas):
        copiar(os.path.join(ROOT, ruta), os.path.join(DESTINO, ruta))
    print("Sincronizado %s (%d archivos de la landing)" % (os.path.relpath(DESTINO, ROOT), len(rutas)))


if __name__ == "__main__":
    os.makedirs(DATOS, exist_ok=True)
    if "--desde-base" in sys.argv:
        desde_base()
    sincronizar()
