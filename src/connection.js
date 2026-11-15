// Detecta cómo llegar a la API local y construye las URLs de teselas.
//  - 'proxy':  npm run dev (Vite reenvía /api a FastAPI) → teselas con caché local.
//  - 'direct': la web no tiene el reenvío pero FastAPI responde en 127.0.0.1:8000.
//  - 'offline': sin API; el mapa usa los servidores públicos directamente.
const DIRECT = 'http://127.0.0.1:8000';
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
export const conn = { mode: 'offline', base: '', tilesViaApi: false };

async function probe(url, ms = 3000) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    // Cualquier respuesta JSON viene de FastAPI (un 404 indica un backend anterior sin /health)
    return (r.headers.get('content-type') || '').includes('json') ? (r.ok ? 'ok' : 'old') : false;
  } catch { return false; } finally { clearTimeout(t); }
}

export async function detectConnection() {
  const p = await probe('/api/v1/health');
  if (p) Object.assign(conn, { mode: 'proxy', base: '', tilesViaApi: p === 'ok', oldBackend: p === 'old' });
  else if (await probe(`${DIRECT}/api/v1/health`)) Object.assign(conn, { mode: 'direct', base: DIRECT, tilesViaApi: true });
  else if (await probe(`${DIRECT}/openapi.json`)) Object.assign(conn, { mode: 'direct', base: DIRECT, tilesViaApi: false }); // backend anterior, sin proxy de teselas
  else Object.assign(conn, { mode: 'offline', base: '', tilesViaApi: false });
  return conn;
}

// Imagen de fondo de alta resolución: CDN de Esri «Clarity» (World Imagery). Medido desde la red del equipo:
// 16 teselas en paralelo en < 0.5 s, mientras server.arcgisonline.com no respondía. Se carga directo
// desde el navegador (HTTP/2 + CDN), que es más rápido que pasarlo por la API local.
export const baseTileUrl = () => 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// Capa NASA GIBS: directo desde el navegador (GIBS también es CDN y responde en ~0.5 s)
export function gibsTemplate(layerId, time, level, ext) {
  return `${GIBS}/${layerId}/default/${time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`;
}
// Las URLs de la máquina del tiempo ya apuntan a GIBS: se usan tal cual
export const viaApi = url => url;
