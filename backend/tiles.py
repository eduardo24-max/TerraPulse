"""
Proxy local de teselas con caché en disco (backend/.tile_cache).
- /api/v1/tiles/base/{z}/{x}/{y}: imagen satelital de fondo (Esri World Imagery con respaldo
  Sentinel-2 cloudless de EOX). Si un proveedor tarda o falla se usa el siguiente.
- /api/v1/gibs/...: capas NASA GIBS (MODIS, VIIRS, SMAP, OPERA, HLS, GOES, Landsat WELD).
La caché hace que las zonas ya vistas carguen al instante (útil para la demostración).
"""
import hashlib
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, Response

router = APIRouter()
CACHE_DIR = Path(__file__).parent / ".tile_cache"
CACHE_DIR.mkdir(exist_ok=True)
GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
UA = {"User-Agent": "TerraPulse/0.2 (NASA Space Apps Challenge)"}
_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0), follow_redirects=True,
                                    headers=UA, limits=httpx.Limits(max_connections=48))
    return _client


def _path(key: str) -> Path:
    h = hashlib.sha1(key.encode()).hexdigest()
    return CACHE_DIR / h[:2] / h


async def _cached(key: str, urls: list[str], ttl: float | None = None) -> Response:
    p = _path(key)
    meta = p.with_suffix(".type")
    if p.exists() and (ttl is None or time.time() - p.stat().st_mtime < ttl):
        return Response(p.read_bytes(), media_type=meta.read_text() if meta.exists() else "image/jpeg",
                        headers={"Cache-Control": "public, max-age=86400", "X-Cache": "HIT"})
    for url in urls:
        try:
            r = await _http().get(url)
        except Exception:
            continue
        ctype = r.headers.get("content-type", "")
        if r.status_code == 200 and ctype.startswith("image/"):
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(r.content)
            meta.write_text(ctype)
            return Response(r.content, media_type=ctype,
                            headers={"Cache-Control": "public, max-age=86400", "X-Cache": "MISS", "X-Source": url.split('/')[2]})
    return Response(status_code=404)


@router.get("/api/v1/tiles/base/{z}/{x}/{y}")
async def base_tile(z: int, x: int, y: int):
    urls = [
        f"https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        f"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ]
    if z <= 15:  # Sentinel-2 cloudless (EOX, 10 m) como respaldo
        urls.append(f"https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg")
    return await _cached(f"base/{z}/{x}/{y}", urls)


@router.get("/api/v1/gibs/{layer}/{time_}/{tms}/{z}/{y}/{x}.{ext}")
async def gibs_tile(layer: str, time_: str, tms: str, z: int, y: int, x: int, ext: str):
    url = f"{GIBS}/{layer}/default/{time_}/{tms}/{z}/{y}/{x}.{ext}"
    # Capas casi en tiempo real (GOES, cada 10 min) se refrescan; las diarias se guardan
    live = time_ == "default" or "T" in time_
    return await _cached(url, [url], ttl=600 if live else None)
