# TerraPulse

Monitoreo satelital de los cambios de la superficie terrestre: agua, bosques, agricultura, humedad del suelo, hielo y deformación.
NASA Space Apps Challenge 2026 · Reto 5 *Dancing with the SARs*.

## Cómo correrlo (web + API en este equipo)

```bash
npm install          # una vez
npm run dev          # levanta la API (FastAPI, 127.0.0.1:8000) y la web (Vite)
```

Abre la dirección que muestra la terminal (normalmente http://localhost:5173).

- La web llama a `/api/...` y Vite la reenvía a la API local (ver `vite.config.js`).
- `npm run dev` usa el Python de `backend/.venv`; si no existe, el de `../backend-observatorio/.venv`.
- Si no hay ninguno con las dependencias: `npm run setup` (crea `backend/.venv` e instala `backend/requirements.txt`).
- La primera vez copia `.env` y `.events_cache.json` desde `../backend-observatorio` si faltan en `backend/`.

## Estructura

- `backend/` API FastAPI: eventos (GDACS, NASA FIRMS, EONET, ITS_LIVE), escenas SAR (ASF), máquina del tiempo (NASA GIBS) y proyección de riesgo.
- `src/` interfaz (CesiumJS): eventos en vivo, módulos, análisis por pestañas, PULSE (voz), reportes PDF.
"# TerraPulse" 
