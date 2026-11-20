"""Control conservador de gasto de IA para Lanzate.

Redis/Upstash en producción: reserva atómica antes de cada llamada.
Archivo local fuera del repo para desarrollo. Si no hay almacenamiento persistente
en Vercel, falla cerrado. No almacena claves, prompts ni imágenes.
"""
import datetime
import hashlib
import json
import math
import os
import threading
from pathlib import Path
from urllib.request import Request, urlopen

MONTHLY_CENTS = 200
WARNING_CENTS = 100
RESERVE_TEXT_CENTS = 25
RESERVE_IMAGE_CENTS = 75
MAX_TEXT_CHARS = 8000
MAX_IMAGE_BYTES = 450_000
LOCK = threading.RLock()
LOCAL = Path.home() / ".lanzate" / "ia-presupuesto.json"


class BudgetError(Exception):
    pass


def _redis():
    for name in sorted(os.environ):
        for suffix, token_suffix in (("KV_REST_API_URL", "KV_REST_API_TOKEN"),
                                     ("REDIS_REST_URL", "REDIS_REST_TOKEN")):
            if name.endswith(suffix):
                token = os.environ.get(name[:-len(suffix)] + token_suffix)
                if os.environ[name] and token:
                    return os.environ[name].rstrip("/"), token
    return None


def _command(*args):
    config = _redis()
    if not config:
        raise BudgetError("Sin Redis persistente: IA bloqueada para evitar gastos sin control.")
    url, token = config
    req = Request(url, data=json.dumps(list(args)).encode("utf-8"), method="POST",
                  headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    with urlopen(req, timeout=12) as response:
        result = json.load(response)
    if result.get("error"):
        raise BudgetError("No se pudo verificar el presupuesto de IA.")
    return result.get("result")


def _month():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m")


def _key():
    return "lanzate:ia:budget:v1:" + _month()


def _local_transaction(reserve=0, refund=0):
    # Exclusión entre procesos para desarrollo local. Nunca usar en Vercel.
    import fcntl
    LOCAL.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with open(LOCAL, "a+", encoding="utf-8") as file:
        fcntl.flock(file, fcntl.LOCK_EX)
        file.seek(0)
        try:
            state = json.load(file)
        except (ValueError, OSError):
            state = {}
        month = _month()
        used = int(state.get(month, 0))
        if reserve and used + reserve > MONTHLY_CENTS:
            raise BudgetError("Presupuesto mensual de IA agotado (US$ 2).")
        used = max(0, used + reserve - refund)
        state = {month: used}
        file.seek(0)
        file.truncate()
        json.dump(state, file)
        file.flush()
        os.fsync(file.fileno())
        return used


RESERVE_SCRIPT = """
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local reserve = tonumber(ARGV[1])
if used + reserve > tonumber(ARGV[2]) then return -1 end
redis.call('INCRBY', KEYS[1], reserve)
redis.call('EXPIRE', KEYS[1], 4000000)
return used + reserve
"""
REFUND_SCRIPT = """
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local next = math.max(0, used - tonumber(ARGV[1]))
redis.call('SET', KEYS[1], next, 'EX', 4000000)
return next
"""


def _online():
    return bool(os.environ.get("VERCEL"))


def _change(reserve=0, refund=0):
    if _online():
        if reserve:
            val = _command("EVAL", RESERVE_SCRIPT, 1, _key(), reserve, MONTHLY_CENTS)
            if int(val) == -1:
                raise BudgetError("Presupuesto mensual de IA agotado (US$ 2).")
            return int(val)
        return int(_command("EVAL", REFUND_SCRIPT, 1, _key(), refund))
    with LOCK:
        return _local_transaction(reserve, refund)


def _used():
    if _online():
        return int(_command("GET", _key()) or 0)
    with LOCK:
        return _local_transaction()


def status():
    used = _used()
    return {
        "presupuesto_usd": 2.0,
        "consumo_reservado_usd": round(used / 100, 2),
        "disponible_usd": round(max(0, MONTHLY_CENTS-used) / 100, 2),
        "alerta": used >= WARNING_CENTS,
        "umbral_alerta_usd": 1.0,
        "bloqueada": used >= MONTHLY_CENTS,
        "automatico": True,
        "cache_activada": True,
        "bloqueo_activado": True,
        "mes_utc": _month(),
    }


def _cache_key(provider, model, system, prompt, images):
    h = hashlib.sha256()
    for value in (provider, model, system, prompt):
        h.update(value.encode("utf-8"))
        h.update(b"\x00")
    for media_type, data in (images or []):
        h.update(media_type.encode("utf-8"))
        h.update(hashlib.sha256(data.encode("ascii")).digest())
    return "lanzate:ia:cache:v1:" + h.hexdigest()


def cached(provider, model, system, prompt, images):
    key = _cache_key(provider, model, system, prompt, images)
    if _online():
        obj = _command("GET", key)
        return (key, json.loads(obj)) if obj else (key, None)
    cache_path = LOCAL.parent / "ia-cache" / key.rsplit(":", 1)[-1]
    if cache_path.exists():
        try:
            return key, json.loads(cache_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
    return key, None


def cache_result(key, value):
    try:
        encoded = json.dumps(value, ensure_ascii=False)
        if len(encoded) > 30000:
            return
        if _online():
            _command("SETEX", key, 2592000, encoded)
        else:
            path = LOCAL.parent / "ia-cache" / key.rsplit(":", 1)[-1]
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            path.write_text(encoded, encoding="utf-8")
            path.chmod(0o600)
    except (OSError, BudgetError, ValueError):
        pass  # La caché es optativa: nunca debe causar un segundo cobro.


def begin(system, prompt, images):
    if len(system) + len(prompt) > MAX_TEXT_CHARS:
        raise BudgetError("Solicitud demasiado extensa. Reducí el texto para ahorrar tokens.")
    if images:
        if len(images) > 2 or any(len(data) > MAX_IMAGE_BYTES for _, data in images):
            raise BudgetError("Máximo dos imágenes pequeñas por consulta de IA.")
    reserve = RESERVE_IMAGE_CENTS if images else RESERVE_TEXT_CENTS
    _change(reserve=reserve)
    return reserve


def finish(reservation_cents, usage, provider):
    # Tarifas configurables conservadoras; el valor real del proveedor puede variar.
    input_tokens = int((usage or {}).get("input_tokens") or (usage or {}).get("prompt_tokens") or 0)
    output_tokens = int((usage or {}).get("output_tokens") or (usage or {}).get("completion_tokens") or 0)
    default_input, default_output = (5.0, 25.0)
    input_rate = float(os.environ.get("LANZATE_IA_INPUT_USD_M", default_input))
    output_rate = float(os.environ.get("LANZATE_IA_OUTPUT_USD_M", default_output))
    if input_rate <= 0 or output_rate <= 0 or not input_tokens:
        return  # No refundamos ante métricas incompletas.
    cents = max(1, math.ceil((input_tokens * input_rate + output_tokens * output_rate) / 10000))
    if cents < reservation_cents:
        _change(refund=reservation_cents-cents)
    # Si el cálculo supera la reserva se conserva esta última y se debe elevar
    # RESERVE_* y/o ajustar tarifas antes de habilitar tráfico real.


def abort(reservation_cents):
    _change(refund=reservation_cents)
