"""Bounded, deterministic brand manual extraction. No external AI or network."""
import base64
import hashlib
import io
import re
from collections import Counter

MAX_FILE = 2 * 1024 * 1024
MAX_PAGES = 12
MAX_PIXELS = 8_000_000
HEX = re.compile(r"(?<![0-9a-f])#([0-9a-f]{6})(?![0-9a-f])", re.I)

def decode(s, value):
    match = re.fullmatch(r"data:(application/pdf|image/png|image/jpeg|image/webp);base64,([A-Za-z0-9+/=]+)", str(value or ""))
    if not match or len(match[2]) > (MAX_FILE * 4 // 3 + 8):
        raise s.ApiError(400, "Usá PDF, PNG, JPG o WebP de hasta 2 MB.")
    try:
        raw = base64.b64decode(match[2], validate=True)
    except ValueError:
        raise s.ApiError(400, "Archivo inválido.")
    if not raw or len(raw) > MAX_FILE:
        raise s.ApiError(400, "El manual supera 2 MB.")
    return match[1], raw

def raster(raw):
    from PIL import Image
    with Image.open(io.BytesIO(raw)) as im:
        if im.width * im.height > MAX_PIXELS:
            raise ValueError("Imagen demasiado grande")
        im.thumbnail((640, 640))
        rgb = im.convert("RGBA")
        small = rgb.copy()
        small.thumbnail((160, 160))
        # Ignore transparent, near-white and near-black pixels in palette candidates.
        counts = Counter((r//16*16+8,g//16*16+8,b//16*16+8) for r,g,b,a in small.getdata()
                         if a >= 220 and max(r,g,b)>24 and min(r,g,b)<235)
        colors = ["#%02x%02x%02x" % c for c,n in counts.most_common(8)]
        buf = io.BytesIO()
        rgb.save(buf, format="PNG")
        preview = buf.getvalue()
        return colors, "data:image/png;base64," + base64.b64encode(preview).decode() if len(preview)<450_000 else ""

def analyze(s, data):
    mime, raw = decode(s, data.get("archivo"))
    colors, fonts, candidates, warnings = [], [], [], []
    text = ""
    try:
        if mime == "application/pdf":
            from pypdf import PdfReader
            pdf = PdfReader(io.BytesIO(raw), strict=False)
            if pdf.is_encrypted or len(pdf.pages)>MAX_PAGES:
                raise s.ApiError(400, "El PDF debe estar sin contraseña y tener hasta 12 páginas.")
            for page in pdf.pages:
                text += (page.extract_text() or "")[:8000] + "\n"
                resources = page.get("/Resources", {})
                resources = resources.get_object() if hasattr(resources,"get_object") else resources
                for ref in (resources.get("/Font") or {}).get_object().values() if resources.get("/Font") else []:
                    name = str(ref.get_object().get("/BaseFont") or "").lstrip("/")
                    name = re.sub(r"^[A-Z]{6}[+]", "", name)
                    if name and name not in fonts:
                        fonts.append(name[:100])
                if len(candidates)<4:
                    for im in list(page.images)[:4]:
                        if len(candidates)>=4:
                            break
                        try:
                            palette, preview = raster(im.data)
                            if preview and not any(c["imagen"]==preview for c in candidates):
                                candidates.append({"imagen":preview,"etiqueta":"Imagen extraída; confirmá si corresponde al logo"})
                            colors.extend(palette)
                        except Exception:
                            continue
            explicit = ["#"+m.lower() for m in HEX.findall(text)]
            colors = explicit + colors
            warnings.append("Los códigos HEX del texto tienen prioridad; los demás colores son aproximaciones de imágenes.")
            warnings.append("Las fuentes incrustadas pueden pertenecer al manual y no necesariamente a la marca.")
            if not text.strip():
                warnings.append("PDF sin texto extraíble: no se realizó OCR ni se identificaron logos vectoriales.")
        else:
            colors, preview = raster(raw)
            if preview:
                candidates.append({"imagen":preview,"etiqueta":"Imagen del manual; usar solo si es un logo aislado"})
            warnings.append("Paleta aproximada de píxeles. No se detectan nombres de fuentes desde una imagen.")
    except s.ApiError:
        raise
    except Exception:
        raise s.ApiError(400, "No se pudo interpretar el manual. Probá con un PDF simple o una imagen válida.")
    return {"colores":list(dict.fromkeys(colors))[:16],"tipografias":fonts[:20],
            "candidatos":candidates,"advertencias":warnings,"sha256":hashlib.sha256(raw).hexdigest()}

def clean(s, data):
    if not isinstance(data, dict):
        raise s.ApiError(400, "Identidad de marca inválida.")
    out = {}
    for key in ("tipografia_titulos","tipografia_textos","tono","reglas","manual_nombre"):
        value = data.get(key,"")
        if not isinstance(value,str) or len(value)> (1500 if key in ("tono","reglas") else 150):
            raise s.ApiError(400,"Revisá los campos de identidad de marca.")
        out[key] = value.strip()
    for key in ("acento","fondo"):
        value = data.get(key,"")
        if value and not re.fullmatch(r"#[0-9a-fA-F]{6}",str(value)):
            raise s.ApiError(400,"Color de marca inválido.")
        out[key] = str(value).lower()
    return out

def persist(s, row, data):
    if "marca" not in data and "manual_archivo" not in data:
        return
    brand = clean(s, data.get("marca") or row.get("marca") or {})
    if data.get("manual_archivo"):
        mime, raw = decode(s, data["manual_archivo"])
        # Verify content, not just the client-provided MIME.
        analyze(s, {"archivo":data["manual_archivo"]})
        s.check_private_repo()
        ext = {"application/pdf":"pdf","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[mime]
        folder = "marca/%s" % row["id"]
        s.FILES.delete("datos", folder)
        s.FILES.write("datos", folder+"/manual."+ext, raw)
        brand["manual_sha256"] = hashlib.sha256(raw).hexdigest()
    elif row.get("marca",{}).get("manual_sha256"):
        brand["manual_sha256"] = row["marca"]["manual_sha256"]
    row["marca"] = brand
