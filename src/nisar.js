// NISAR (NASA-ISRO, radar de banda L): busca en el catálogo de ASF las pasadas GCOV que cruzan la zona,
// muestra la más reciente y estima el cambio de la señal de radar contra una pasada anterior de la misma
// órbita. El cambio se calcula con las imágenes de vista previa (no calibradas): es una estimación relativa.
const ASF = 'https://api.daac.asf.alaska.edu/services/search/param';
const cache = new Map();

function loadImage(url) {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo descargar la imagen de NISAR.')); i.src = url; }));
  return cache.get(url);
}
const bboxOf = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };

export async function searchNisar(ring) {
  const wkt = `POLYGON((${[...ring, ring[0]].map(p => `${p[0].toFixed(5)} ${p[1].toFixed(5)}`).join(',')}))`;
  const r = await fetch(`${ASF}?dataset=NISAR&processingLevel=GCOV&intersectsWith=${encodeURIComponent(wkt)}&maxResults=80&output=geojson`, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`El catálogo de ASF respondió ${r.status}.`);
  const seen = new Map();
  for (const f of (await r.json()).features || []) {
    const p = f.properties, url = (p.browse || []).find(u => /_LATLON\.png$/.test(u));
    if (!url || !p.startTime || f.geometry?.type !== 'Polygon') continue;
    const s = { name: p.sceneName, date: p.startTime.slice(0, 10), time: p.startTime, dir: p.flightDirection === 'ASCENDING' ? 'ascendente' : 'descendente',
      track: `${p.pathNumber}-${p.frameNumber}-${p.flightDirection}`, url, bbox: bboxOf(f.geometry.coordinates[0]), prod: /_PR_/.test(p.sceneName) };
    const k = `${s.track}|${s.date}`, old = seen.get(k);
    if (!old || (s.prod && !old.prod)) seen.set(k, s);
  }
  return [...seen.values()].sort((a, b) => b.time.localeCompare(a.time));
}

// Brillo medio de la imagen dentro de la zona y de cada sector, relativo al de toda la escena
async function measure(scene, ring, inPoly, cells) {
  const img = await loadImage(scene.url), [w, s, e, n] = scene.bbox, zb = bboxOf(ring);
  const px = lon => (lon - w) / (e - w) * img.width, py = lat => (n - lat) / (n - s) * img.height;
  const sx = Math.max(0, px(zb[0])), sy = Math.max(0, py(zb[3])), sw = Math.min(img.width, px(zb[2])) - sx, sh = Math.min(img.height, py(zb[1])) - sy;
  if (sw < 2 || sh < 2) return null;
  const k = Math.min(1, 300 / Math.max(sw, sh)), cw = Math.max(2, Math.round(sw * k)), ch = Math.max(2, Math.round(sh * k));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  const d = g.getImageData(0, 0, cw, ch).data;
  let sum = 0, cnt = 0, tot = 0; const acc = cells.map(() => [0, 0]), cb = cells.map(cl => bboxOf(cl.ring));
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const lon = zb[0] + (x + 0.5) / cw * (zb[2] - zb[0]), lat = zb[3] - (y + 0.5) / ch * (zb[3] - zb[1]);
    if (!inPoly([lon, lat], ring)) continue;
    tot++; const i = (y * cw + x) * 4; if (d[i + 3] < 200) continue;
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; sum += v; cnt++;
    for (let q = 0; q < cb.length; q++) if (lon >= cb[q][0] && lon <= cb[q][2] && lat >= cb[q][1] && lat <= cb[q][3]) { acc[q][0] += v; acc[q][1]++; }
  }
  const t = document.createElement('canvas'); t.width = t.height = 96; const tg = t.getContext('2d'); tg.drawImage(img, 0, 0, 96, 96);
  const td = tg.getImageData(0, 0, 96, 96).data; let ss = 0, sc = 0;
  for (let i = 0; i < td.length; i += 4) if (td[i + 3] > 200) { ss += 0.299 * td[i] + 0.587 * td[i + 1] + 0.114 * td[i + 2]; sc++; }
  if (!cnt || !sc) return null;
  const ref = ss / sc;
  return { coverage: cnt / Math.max(tot, 1), zone: sum / cnt / ref, cells: acc.map(a => a[1] > 4 ? a[0] / a[1] / ref : null) };
}

export async function nisarAnalysis(ring, inPoly, cells = [], onProgress) {
  onProgress?.('Buscando pasadas del radar NISAR sobre la zona…');
  const scenes = await searchNisar(ring);
  if (!scenes.length) return { count: 0, dates: [] };
  const dates = [...new Set(scenes.map(s => s.date))];
  let latest = null, mNow = null;
  for (const s of scenes.slice(0, 4)) {
    onProgress?.(`Leyendo la imagen de NISAR del ${s.date}…`);
    const m = await measure(s, ring, inPoly, cells).catch(() => null);
    if (m && m.coverage > 0.6) { latest = s; mNow = m; break; }
  }
  if (!latest) return { count: dates.length, dates, latest: scenes[0], partial: true };
  const out = { count: dates.length, dates, latest, change: null, ref: null, cells: [] };
  const olds = scenes.filter(s => s.track === latest.track && (new Date(latest.date) - new Date(s.date)) >= 10 * 864e5);
  for (const s of olds.slice(-2).reverse()) {
    onProgress?.(`Comparando con la pasada de NISAR del ${s.date}…`);
    const m = await measure(s, ring, inPoly, cells).catch(() => null);
    if (!m || m.coverage < 0.6) continue;
    out.ref = s; out.change = (mNow.zone / m.zone - 1) * 100;
    out.cells = cells.map((c, i) => ({ id: c.id, change: mNow.cells[i] != null && m.cells[i] != null ? (mNow.cells[i] / m.cells[i] - 1) * 100 : null }));
    break;
  }
  return out;
}
export const radarReading = ch => ch == null ? 'no hay una pasada anterior comparable'
  : ch <= -15 ? 'es un descenso notable, que suele indicar pérdida de árboles o de vegetación, por tala o incendio, o un terreno más seco'
  : ch >= 15 ? 'es un aumento notable, que suele indicar más humedad, inundación bajo la vegetación o crecimiento'
  : 'no hay cambios notables en la estructura del terreno';
