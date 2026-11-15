// Cliente de la API local de TerraPulse (FastAPI). Vite reenvía /api a 127.0.0.1:8000 (vite.config.js),
// así la web y la API corren juntas en este equipo con `npm run dev`.
import { conn } from './connection.js';
export const API_BASE_URL = '';
export const API_LABEL = 'API local (127.0.0.1:8000)';

async function get(path, params = {}, timeoutMs = 30000, method = 'GET') {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${conn.base}${path}${qs.toString() ? '?' + qs : ''}`, { signal: ctrl.signal, method });
    if (res.status === 502 || res.status === 504) throw new Error('La API local no está encendida. Inicia el proyecto con: npm run dev');
    if (!res.ok) throw new Error(`La API local respondió con error ${res.status}. Revisa la terminal donde corre npm run dev.`);
    if (!(res.headers.get('content-type') || '').includes('json')) throw new Error('La API local no está conectada. Detén el servidor (Ctrl + C) y vuelve a iniciar con: npm run dev');
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('El backend tardó demasiado en responder.');
    if (e instanceof TypeError) throw new Error('No se pudo conectar con la API local. Inicia el proyecto con: npm run dev');
    throw e;
  } finally { clearTimeout(t); }
}

// 1. Monitoreo global en vivo
export const getDisasters = (filters = {}) => get('/api/v1/disasters', filters);
// 2. Evidencia de radar SAR (ASF puede tardar)
export const getSarAnalysis = (lat, lon, days_back = 60, max_results = 10) =>
  get('/api/v1/sar-analysis', { lat, lon, days_back, max_results }, 90000);
// 3. Máquina del tiempo
export const getTimeMachine = (lat, lon, before_date, after_date, mode) =>
  get('/api/v1/timemachine', { lat, lon, before_date, after_date, mode });
// 4. Predicción de riesgo
export const getRisk = (lat, lon, disaster_type, horizon_days = 30) =>
  get('/api/v1/predict-risk', { lat, lon, disaster_type, horizon_days });
// Estado y sincronización manual de fuentes
export const getHealth = () => get('/api/v1/health', {}, 5000).catch(e => get('/api/v1/disasters', { lat: 0, lon: 0, radius_km: 1 }, 8000).then(() => ({ status: 'ok' })).catch(() => { throw e; }));
export const syncNow = () => get('/api/v1/sync-test', {}, 120000, 'POST');
