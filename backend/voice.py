"""Asistente de voz: entrega tokens temporales de Gemini Live al navegador.

La clave GEMINI_API_KEY se queda en backend/.env y nunca viaja al navegador. El navegador recibe
un token de un solo uso que caduca en minutos y que solo sirve para abrir una sesión de Live API.
Sin clave, el asistente funciona en modo local (reconocimiento de voz del navegador + reglas).
"""
import os
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

try:
    import edge_tts   # voz neuronal gratuita, sin clave
except ImportError:
    edge_tts = None

load_dotenv()
router = APIRouter()
EDGE_VOICE = os.getenv("TERRA_VOICE", "es-MX-DaliaNeural")


async def _edge(text: str) -> bytes:
    buf = bytearray()
    async for ch in edge_tts.Communicate(text, EDGE_VOICE, rate=os.getenv("TERRA_VOICE_RATE", "+3%")).stream():
        if ch["type"] == "audio":
            buf += ch["data"]
    if not buf:
        raise RuntimeError("la voz neuronal no devolvió audio")
    return bytes(buf)

MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview")
WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained"
_recent: dict[str, list[datetime]] = {}


def _limit(ip: str, per_min: int = 6, kind: str = "token") -> None:
    ip = f"{kind}:{ip}"
    now = datetime.now(timezone.utc)
    hits = [t for t in _recent.get(ip, []) if now - t < timedelta(minutes=1)]
    if len(hits) >= per_min:
        raise HTTPException(429, "Demasiadas peticiones de voz seguidas. Espera un minuto.")
    _recent[ip] = hits + [now]


@router.get("/api/v1/voice/config")
def voice_config():
    return {"gemini": bool(os.getenv("GEMINI_API_KEY")), "model": MODEL, "elevenlabs": bool(os.getenv("ELEVENLABS_API_KEY")),
            "tts": bool(edge_tts or os.getenv("ELEVENLABS_API_KEY"))}


@router.post("/api/v1/voice/token")
def voice_token(request: Request):
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(503, "No hay GEMINI_API_KEY en backend/.env; el asistente usa el modo local.")
    host = request.client.host if request.client else "?"
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(403, "Los tokens de voz solo se entregan al sitio local.")
    _limit(host)
    now = datetime.now(timezone.utc)
    body = {
        "uses": 1,
        "expireTime": (now + timedelta(minutes=30)).isoformat().replace("+00:00", "Z"),
        "newSessionExpireTime": (now + timedelta(minutes=1)).isoformat().replace("+00:00", "Z"),
    }
    last = None
    for ver in ("v1alpha", "v1beta"):
        try:
            r = httpx.post(f"https://generativelanguage.googleapis.com/{ver}/auth_tokens",
                           headers={"x-goog-api-key": key}, json=body, timeout=15)
        except httpx.HTTPError as e:
            last = str(e)
            continue
        if r.status_code == 200 and r.json().get("name"):
            return {"token": r.json()["name"], "model": MODEL, "wsUrl": WS_URL}
        last = f"{r.status_code} {r.text[:200]}"
    raise HTTPException(502, f"Gemini no entregó el token: {last}")


# ── Voz y oído naturales con ElevenLabs ─────────────────────────────────────────────────────────
# La clave ELEVENLABS_API_KEY se queda en backend/.env; el navegador solo recibe audio o texto.
ELEVEN = "https://api.elevenlabs.io/v1"
VOICE = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")   # voz femenina incluida en todas las cuentas
TTS_MODELS = list(dict.fromkeys(m for m in (os.getenv("ELEVENLABS_TTS_MODEL"), "eleven_turbo_v2_5", "eleven_multilingual_v2") if m))
STT_MODEL = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v1")


def _eleven(request: Request, kind: str, per_min: int) -> str:
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        raise HTTPException(503, "No hay ELEVENLABS_API_KEY en backend/.env.")
    host = request.client.host if request.client else "?"
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(403, "La voz solo se entrega al sitio local.")
    _limit(host, per_min, kind)
    return key


def _why(r: httpx.Response) -> str:
    if r.status_code == 401:
        return "la clave de ElevenLabs no es válida o se quedó sin créditos"
    if r.status_code == 429:
        return "ElevenLabs está saturado o se alcanzó el límite del plan"
    return f"ElevenLabs respondió {r.status_code}: {r.text[:160]}"


class Say(BaseModel):
    text: str = Field(min_length=1, max_length=900)


@router.post("/api/v1/voice/tts")
async def voice_tts(body: Say, request: Request):
    host = request.client.host if request.client else "?"
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(403, "La voz solo se entrega al sitio local.")
    _limit(host, 90, "tts")
    key = os.getenv("ELEVENLABS_API_KEY")
    last = "no hay voz natural instalada (pip install edge-tts)"
    async with httpx.AsyncClient(timeout=30) as c:
        for model in (TTS_MODELS if key else []):
            payload = {"text": body.text, "model_id": model,
                       "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.3, "use_speaker_boost": True}}
            if "v2_5" in model:
                payload["language_code"] = "es"
            try:
                r = await c.post(f"{ELEVEN}/text-to-speech/{VOICE}", params={"output_format": "mp3_44100_128"},
                                 headers={"xi-api-key": key}, json=payload)
            except httpx.HTTPError as e:
                last = str(e)
                continue
            if r.status_code == 200:
                return Response(r.content, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
            last = _why(r)
            if r.status_code in (401, 429):
                break
    if edge_tts:   # voz por defecto, y respaldo si ElevenLabs falla
        try:
            return Response(await _edge(body.text), media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
        except Exception as e:
            last = f"la voz neuronal falló: {e}"
    raise HTTPException(502, last)


@router.post("/api/v1/voice/stt")
async def voice_stt(request: Request):
    key = _eleven(request, "stt", 60)
    audio = await request.body()
    if not 2000 < len(audio) < 2_000_000:
        raise HTTPException(400, "Audio vacío o demasiado largo.")
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{ELEVEN}/speech-to-text", headers={"xi-api-key": key},
                             data={"model_id": STT_MODEL, "language_code": "es", "tag_audio_events": "false"},
                             files={"file": ("voz.wav", audio, "audio/wav")})
    except httpx.HTTPError as e:
        raise HTTPException(502, str(e))
    if r.status_code != 200:
        raise HTTPException(502, _why(r))
    return {"text": r.json().get("text", "")}
