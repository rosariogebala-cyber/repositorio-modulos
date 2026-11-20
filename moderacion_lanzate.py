"""Moderación conservadora de cambios solicitados desde el portal.

Decisiones: aceptar (aplicable y claramente válido), rechazar (error explícito),
revisar (no hay evidencia suficiente). No interpreta HTML ni ejecuta enlaces.
"""
import re
import unicodedata
from urllib.parse import urlsplit

MALAS_PALABRAS = re.compile(
    r"\b(?:pelotud[oa]s?|bolud[oa]s?|mierda|puta(?:s)?|puto(?:s)?|"
    r"conchud[oa]s?|forr[oa]s?|hdp|fuck|fucking|shit|idiota(?:s)?)\b", re.I
)
PRUEBAS = re.compile(
    r"(?i)\b(?:x{4,}|z{5,}|asdf\w*|qwerty\w*|lorem\s+ipsum|"
    r"texto\s+de\s+prueba|prueba\s+123|placeholder|"
    r"pendiente\s+de\s+(?:completar|definir)|todo\s*[:\-])\b"
)
HTML_PELIGROSO = re.compile(r"(?i)<\s*/?\s*(?:script|iframe|object|embed|form|style)\b|javascript:|data:text/html")
SIMBOLOS = re.compile(r"^[\W_]+$", re.UNICODE)
REPETICION = re.compile(r"(?i)([a-záéíóúñ])\1{4,}")
SHORTENER = {"bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rebrand.ly"}


def _plain(text):
    return unicodedata.normalize("NFKC", str(text or "")).strip()


def evaluar_cambio(change):
    """Devuelve (decision, motivo), sin modificar la solicitud."""
    tipo = change.get("tipo")
    despues = _plain(change.get("despues"))
    if tipo == "foto":
        return "revisar", "La foto necesita revisión visual antes de publicarse."
    if tipo not in ("texto", "link"):
        return "revisar", "Tipo de modificación no reconocido."
    if not despues:
        return "rechazar", "El contenido está vacío."
    if PRUEBAS.search(despues) or REPETICION.search(despues):
        return "rechazar", "Parece texto de prueba o contenido incompleto."
    if MALAS_PALABRAS.search(despues):
        return "rechazar", "Contiene lenguaje inapropiado para una web comercial."
    if HTML_PELIGROSO.search(despues):
        return "rechazar", "Contiene código o contenido no permitido."
    if tipo == "texto":
        if SIMBOLOS.fullmatch(despues):
            return "rechazar", "No contiene texto legible."
        if len(despues) > 600 or len(despues.split()) > 90:
            return "revisar", "Texto extenso; verificar redacción y formato."
        if re.search(r"[!?.,]{4,}", despues):
            return "revisar", "Puntuación repetida; posible error de escritura."
        if len(despues) > 35 and not re.search(r"\s", despues) and not re.match(r"\S+@\S+", despues):
            return "revisar", "Texto muy largo sin espacios; posible error."
        return "aceptar", "Texto sin problemas evidentes."
    # Enlaces: solo HTTP(S), emails, WhatsApp o perfiles de Instagram reconocidos.
    from_server = despues
    if from_server.startswith("@") and re.fullmatch(r"@[\w.]{2,40}", from_server):
        return "aceptar", "Perfil de Instagram válido."
    if re.fullmatch(r"[\w.+-]+@[\w-]+\.[\w.]+", from_server):
        return "aceptar", "Dirección de correo con formato válido."
    if re.fullmatch(r"[+\d\s()-]{8,20}", from_server) and 8 <= len(re.sub(r"\D", "", from_server)) <= 15:
        return "aceptar", "Número de contacto con formato válido."
    url = from_server if re.match(r"(?i)^https?://", from_server) else (
        "https://" + from_server if re.match(r"(?i)^www\.", from_server) else "")
    if not url:
        return "rechazar", "El enlace no tiene un formato permitido."
    p = urlsplit(url)
    hostname = (p.hostname or "").lower()
    if p.username or p.password or p.scheme not in ("https", "http") or not hostname or "." not in hostname:
        return "rechazar", "La dirección web no es válida."
    if hostname.startswith("xn--") or hostname in SHORTENER or p.scheme != "https":
        return "revisar", "Enlace externo que requiere verificación."
    if any(ch.isspace() for ch in url) or len(url) > 500:
        return "rechazar", "El enlace contiene espacios o es demasiado largo."
    return "revisar", "Enlace externo con formato válido, pero el destino requiere verificación."
