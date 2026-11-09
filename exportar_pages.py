"""Landing de Jimena Vidal como sitio estático para GitHub Pages.

  python3 exportar_pages.py --desde-base   copia landing, promos y fotos de Postgres a pages/datos/
  python3 exportar_pages.py                arma el sitio a partir de pages/datos/ (no usa base ni servidor)

El sitio se escribe en ../jimenavidal, el repo que publica https://rosariogebala-cyber.github.io/jimenavidal/.
Las promos se editan en pages/datos/ofertas.json; después se vuelve a armar y se sube ese repo.
"""

import hashlib
import json
import os
import re
import shutil
import sys
from html import escape

import oferta as piezas

ROOT = os.path.dirname(os.path.abspath(__file__))
DATOS = os.path.join(ROOT, "pages", "datos")
FOTOS = os.path.join(DATOS, "fotos")
SALIDA = os.path.join(os.path.dirname(ROOT), "jimenavidal")
LANDING_ID = 26
BASE_URL = "https://rosariogebala-cyber.github.io/jimenavidal/"
EMAIL = "info@jimenavidal.tur.ar"


def leer_json(nombre):
    with open(os.path.join(DATOS, nombre), encoding="utf-8") as f:
        return json.load(f)


def escribir_json(nombre, data):
    with open(os.path.join(DATOS, nombre), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def desde_base():
    import server
    from psycopg.rows import dict_row
    import psycopg

    os.makedirs(FOTOS, exist_ok=True)
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
        datos = server._offer_datos(fila)
        foto = ""
        if fila["foto"]:
            foto = fila["id"] + ".jpg"
            with open(os.path.join(FOTOS, foto), "wb") as f:
                f.write(bytes(fila["foto"]))
        ofertas.append({"id": fila["id"], "estado": fila["estado"], "orden": fila["orden"], "foto": foto, "datos": datos})
    escribir_json("ofertas.json", ofertas)
    print("Copiadas %d ofertas a %s" % (len(ofertas), os.path.relpath(DATOS, ROOT)))


def destacadas(publicadas):
    """Igual que el gestor: sin marcas guardadas, las cuatro primeras van arriba."""
    explicit = any("destacada" in item["datos"] for item in publicadas)
    return {
        item["id"]: bool(item["datos"].get("destacada")) if explicit else index < 4
        for index, item in enumerate(publicadas)
    }


def tarjetas(sitio, ofertas, html):
    brand = piezas.brand_of(sitio["marca"])
    carpeta = os.path.join(SALIDA, "img", "ofertas")
    os.makedirs(carpeta, exist_ok=True)
    publicadas = sorted((o for o in ofertas if o["estado"] == "publicada"), key=lambda o: o["orden"])
    flags = destacadas(publicadas)
    publicadas.sort(key=lambda o: (0 if flags[o["id"]] else 1, o["orden"]))
    cards = []
    for item in publicadas:
        try:
            offer = piezas.build_offer(item["datos"])
        except ValueError as err:
            print("  salteo %s: %s" % (item["datos"].get("destino") or item["id"], err))
            continue
        meta, detail, alt = piezas.promo_copy(offer)
        if len(detail) > 320 or len(meta) > 320 or len(offer["destino"]) > 48:
            print("  salteo %s: queda muy larga" % offer["destino"])
            continue
        foto = None
        if item.get("foto"):
            with open(os.path.join(FOTOS, item["foto"]), "rb") as f:
                foto = piezas.photo_from_bytes(f.read())
        data = piezas.card_bytes(offer, brand, foto)
        with open(os.path.join(carpeta, item["id"] + ".jpg"), "wb") as f:
            f.write(data)
        src = "img/ofertas/%s.jpg?v=%s" % (item["id"], hashlib.sha1(data).hexdigest()[:8])
        href = piezas.offer_href(html, offer["destino"], offer["estadia"], offer.get("fechas", ""), offer.get("precio", ""))
        cards.append(piezas.promo_card(
            item["id"], src, alt, piezas.card_meta_html(offer), offer["destino"],
            piezas.price_html(offer), piezas.includes_html(offer), detail, href,
            featured=flags[item["id"]], filtros=piezas.filter_tags(offer),
        ))
    return cards


def cabecera(sitio):
    imagen = BASE_URL + sitio["imagen"].lstrip("/") if sitio.get("imagen") else ""
    tags = [
        ("name", "description", sitio["descripcion"]),
        ("property", "og:type", "website"),
        ("property", "og:locale", "es_AR"),
        ("property", "og:title", sitio["titulo"]),
        ("property", "og:description", sitio["descripcion"]),
        ("property", "og:site_name", sitio["marca"]["nombre"]),
        ("property", "og:url", BASE_URL),
        ("property", "og:image", imagen),
        ("property", "og:image:alt", sitio["titulo"] if imagen else ""),
        ("name", "twitter:card", "summary_large_image" if imagen else "summary"),
    ]
    out = "".join('<meta %s="%s" content="%s">' % (a, k, escape(v)) for a, k, v in tags if v)
    return out + '<link rel="canonical" href="%s">' % escape(BASE_URL)


MAILTO = """<script>
document.querySelectorAll("[data-mailto-form]").forEach(function (form) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = form.querySelector('input[type="email"]');
    var cuerpo = "Hola, quiero que me escriban a " + (email ? email.value : "") + ".";
    location.href = "mailto:%s?subject=" + encodeURIComponent("Consulta desde la web") + "&body=" + encodeURIComponent(cuerpo);
  });
});
</script>""" % EMAIL


def copiar(ruta):
    origen = os.path.join(ROOT, ruta)
    destino = os.path.join(SALIDA, ruta)
    if not os.path.exists(origen):
        print("  falta %s" % ruta)
        return
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    shutil.copy2(origen, destino)


def armar():
    sitio = leer_json("sitio.json")
    ofertas = leer_json("ofertas.json")
    with open(os.path.join(DATOS, "landing.html"), encoding="utf-8") as f:
        html = f.read()

    os.makedirs(SALIDA, exist_ok=True)
    for nombre in os.listdir(SALIDA):
        if nombre in (".git", "README.md"):
            continue
        ruta = os.path.join(SALIDA, nombre)
        if os.path.isdir(ruta):
            shutil.rmtree(ruta)
        else:
            os.remove(ruta)

    cards = tarjetas(sitio, ofertas, html)
    html = piezas.apply_offers(html, cards, piezas.PUBLIC_NOTE)
    if html is None:
        sys.exit("La landing no tiene sección de promociones.")

    with open(os.path.join(ROOT, "maquetas", "js", "oferta-landing.js"), "rb") as f:
        version = hashlib.sha1(f.read()).hexdigest()[:8]
    html = re.sub(r"<html\b", "<html data-estatico", html, count=1)
    html = html.replace("</head>", cabecera(sitio) + "</head>", 1)
    html = html.replace("data-demo-form", "data-mailto-form")
    html = html.replace(
        "</body>",
        '<script src="maquetas/js/oferta-landing.js?v=%s"></script>%s</body>' % (version, MAILTO),
        1,
    )

    rutas = set()

    def relativa(m):
        ruta = m.group(2)
        rutas.add(ruta.split("?", 1)[0].lstrip("/"))
        return m.group(1) + ruta.lstrip("/")

    html = re.sub(r'((?:src|href|poster)=")(/maquetas/[^"]+)', relativa, html)
    for ruta in sorted(rutas | {"maquetas/js/oferta-landing.js", "assets/modulos/navegacion/compleja.png"}):
        copiar(ruta)
    if sitio.get("imagen"):
        copiar(sitio["imagen"].lstrip("/"))

    with open(os.path.join(SALIDA, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    open(os.path.join(SALIDA, ".nojekyll"), "w").close()
    print("Listo: %d promos en %s" % (len(cards), os.path.relpath(SALIDA, ROOT)))


if __name__ == "__main__":
    if "--desde-base" in sys.argv:
        desde_base()
    armar()
