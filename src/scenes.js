// Escenas reales y despejadas de Landsat 8/9 y Sentinel-2 (NASA HLS, 30 m) sobre un punto.
// Se consulta el catálogo NASA CMR para saber qué días pasó el satélite por ese lugar y con cuántas
// nubes; así solo se muestran imágenes completas y nítidas, sin huecos de órbita.
import { gibsTemplate } from './connection.js';

const CMR = 'https://cmr.earthdata.nasa.gov/search/granules.json';
const SATS = [
  { short: 'HLSS30', name: 'Sentinel-2', layer: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance' },
  { short: 'HLSL30', name: 'Landsat 8/9', layer: 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance' },
];
const DIST = 'OPERA_L3_DIST-ALERT-HLS_Color_Index';
const cache = new Map();
const iso = d => new Date(d).toISOString().slice(0, 10);

export async function findClearScenes(lat, lon, from, to, maxCloud = 30) {
  const key = [lat.toFixed(2), lon.toFixed(2), iso(from), iso(to), maxCloud].join('|');
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const lists = await Promise.all(SATS.map(async s => {
      const url = `${CMR}?short_name=${s.short}&point=${lon.toFixed(4)},${lat.toFixed(4)}&temporal=${iso(from)}T00:00:00Z,${iso(to)}T23:59:59Z&cloud_cover=0,${maxCloud}&page_size=200&sort_key=-start_date`;
      try {
        const j = await fetch(url).then(r => r.json());
        return (j.feed?.entry || []).map(g => ({ date: g.time_start.slice(0, 10), sat: s.name, layer: s.layer, cloud: +(g.cloud_cover ?? 100), id: g.producer_granule_id || g.title }));
      } catch { return []; }
    }));
    // una escena por día (la de menos nubes)
    const byDay = {};
    lists.flat().forEach(s => { if (!byDay[s.date] || s.cloud < byDay[s.date].cloud) byDay[s.date] = s; });
    return Object.values(byDay).sort((a, b) => (a.date < b.date ? -1 : 1));
  })();
  cache.set(key, p);
  return p;
}

// La mejor escena cerca de una fecha: pocas nubes y pocos días de diferencia (sin pasarse de la fecha si se puede)
export function bestScene(scenes, date, maxDays = 120) {
  const t = new Date(date).getTime();
  let best = null, bestScore = Infinity;
  for (const s of scenes) {
    const dd = (t - new Date(s.date).getTime()) / 864e5;
    if (Math.abs(dd) > maxDays) continue;
    const score = Math.abs(dd) + s.cloud * 2 + (dd < 0 ? 15 : 0);
    if (score < bestScore) { best = s; bestScore = score; }
  }
  return best;
}

// Reparte n escenas a lo largo del periodo, prefiriendo las más despejadas
export function spreadScenes(scenes, n = 12) {
  if (scenes.length <= n) return scenes;
  const out = [], step = scenes.length / n;
  for (let k = 0; k < n; k++) {
    const slice = scenes.slice(Math.floor(k * step), Math.floor((k + 1) * step));
    out.push(slice.reduce((a, b) => (b.cloud < a.cloud ? b : a)));
  }
  return out;
}

export const sceneUrl = s => gibsTemplate(s.layer, s.date, 12, 'png');
export const damageUrl = date => gibsTemplate(DIST, date, 12, 'png');
export const fillUrl = year => {   // mosaico anual Sentinel-2 sin nubes para rellenar bordes
  const y = Math.min(2025, Math.max(2016, year === 2017 ? 2018 : year));
  return `https://tiles.maps.eox.at/wmts/1.0.0/${y === 2016 ? 's2cloudless_3857' : `s2cloudless-${y}_3857`}/default/g/{z}/{y}/{x}.jpg`;
};
