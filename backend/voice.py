"""Asistente de voz: entrega tokens temporales de Gemini Live al navegador.

La clave GEMINI_API_KEY se queda en backend/.env y nunca viaja al navegador. El navegador recibe
un token de un solo uso que caduca en minutos y que solo sirve para abrir una sesión de Live API.
Sin clave, el asistente funciona en modo local (reconocimiento de voz del navegador + reglas).
"""
import os
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request

load_dotenv()
router = APIRouter()

MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview")
WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained"
_recent: dict[str, list[datetime]] = {}


def _limit(ip: str, per_min: int = 6) -> None:
    now = datetime.now(timezone.utc)
    hits = [t for t in _recent.get(ip, []) if now - t < timedelta(minutes=1)]
    if len(hits) >= per_min:
        raise HTTPException(429, "Demasiadas sesiones de voz seguidas. Espera un minuto.")
    _recent[ip] = hits + [now]


@router.get("/api/v1/voice/config")
def voice_config():
    return {"gemini": bool(os.getenv("GEMINI_API_KEY")), "model": MODEL}


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
