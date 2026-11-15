// Índices de vegetación y detección de anomalías por zona con Sentinel-2 L2A (10 m) del
// Microsoft Planetary Computer (catálogo STAC abierto + estadísticas zonales, sin clave).
const PC = 'https://planetarycomputer.microsoft.com/api';
const DAY = 864e5;
const iso = d => d.toISOString().slice(0, 10);

// Reflectancia: desde la línea base 04.00 (2022) los valores llevan +1000 de desplazamiento
const refl = (b, off) => off ? `((${b}-1000)/10000)` : `(${b}/10000)`;
export const INDICES = {
  NDVI: { name: 'NDVI', what: 'Vigor y densidad de la vegetación', f: (B, o) => `(${B('B08')}-${B('B04')})/(${B('B08')}+${B('B04')})`,
    scale: [[0.1, 'Suelo desnudo, roca o agua'], [0.2, 'Vegetación muy escasa'], [0.4, 'Vegetación dispersa o estresada'], [0.6, 'Vegetación moderada'], [9, 'Vegetación densa y sana']] },
  EVI: { name: 'EVI', what: 'Vigor en vegetación densa (corrige atmósfera y suelo)', f: B => `2.5*(${B('B08')}-${B('B04')})/(${B('B08')}+6*${B('B04')}-7.5*${B('B02')}+1)`,
    scale: [[0.1, 'Sin vegetación'], [0.2, 'Escasa'], [0.4, 'Moderada'], [9, 'Densa']] },
  SAVI: { name: 'SAVI', what: 'Vegetación corrigiendo el brillo del suelo (zonas áridas)', f: B => `1.5*(${B('B08')}-${B('B04')})/(${B('B08')}+${B('B04')}+0.5)`,
    scale: [[0.1, 'Suelo desnudo'], [0.25, 'Escasa'], [0.45, 'Moderada'], [9, 'Densa']] },
  NDMI: { name: 'NDMI', what: 'Humedad dentro de las hojas (estrés hídrico)', f: B => `(${B('B08')}-${B('B11')})/(${B('B08')}+${B('B11')})`,
    scale: [[-0.2, 'Muy seca o sin vegetación'], [0, 'Estrés hídrico'], [0.2, 'Humedad moderada'], [9, 'Bien hidratada']] },
  NBR: { name: 'NBR', what: 'Quema: valores bajos indican áreas quemadas', f: B => `(${B('B08')}-${B('B12')})/(${B('B08')}+${B('B12')})`,
    scale: [[-0.1, 'Quemado o suelo muy expuesto'], [0.1, 'Vegetación débil'], [0.3, 'Vegetación moderada'], [9, 'Vegetación sana']] },
  NDWI: { name: 'NDWI', what: 'Agua superficial (positivo = agua)', f: B => `(${B('B03')}-${B('B08')})/(${B('B03')}+${B('B08')})`,
    scale: [[-0.3, 'Vegetación o suelo seco'], [0, 'Sin agua'], [0.2, 'Humedad o agua somera'], [9, 'Agua abierta']] },
  BSI: { name: 'BSI', what: 'Suelo desnudo (valores altos = más suelo expuesto)', f: B => `((${B('B11')}+${B('B04')})-(${B('B08')}+${B('B02')}))/((${B('B11')}+${B('B04')})+(${B('B08')}+${B('B02')}))`,
    scale: [[-0.1, 'Cubierto de vegetación o agua'], [0.05, 'Poco suelo expuesto'], [0.2, 'Suelo parcialmente desnudo'], [9, 'Suelo desnudo o muy degradado']] },
};
export const classify = (key, v) => INDICES[key].scale.find(([max]) => v < max)?.[1] ?? '';
const CLOUD = '((SCL==3)|(SCL>=8)&(SCL<=10))';   // sombras, nubes y cirros del mapa de clasificación

async function j(url, opt, tries = 2) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, opt);
      if (r.ok) return r.json();
      if (i >= tries || r.status < 500) throw new Error(`Planetary Computer respondió ${r.status}`);
    } catch (e) { if (i >= tries) throw e; }
    await new Promise(r => setTimeout(r, 600 * (i + 1)));
  }
}
const feature = ring => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } });

export async function searchScenes(ring, from, to, maxCloud = 40, limit = 60) {
  const body = { collections: ['sentinel-2-l2a'], intersects: feature(ring).geometry, datetime: `${iso(from)}T00:00:00Z/${iso(to)}T23:59:59Z`,
    query: { 'eo:cloud_cover': { lt: maxCloud } }, limit, sortby: [{ field: 'datetime', direction: 'desc' }] };
  const r = await j(`${PC}/stac/v1/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (r.features || []).map(f => ({ id: f.id, date: f.properties.datetime.slice(0, 10), cloud: f.properties['eo:cloud_cover'],
    offset: parseFloat(f.properties['s2:processing_baseline'] || '0') >= 4, sat: f.id.slice(0, 3).replace('S2', 'Sentinel-2') }));
}

// Estadísticas de varias expresiones sobre un polígono en una sola llamada
export async function zoneStats(scene, ring, keys) {
  const B = b => refl(b, scene.offset);
  const exprs = [...keys.map(k => INDICES[k].f(B)), CLOUD];
  const url = `${PC}/data/v1/item/statistics?collection=sentinel-2-l2a&item=${scene.id}&asset_as_band=true&max_size=1024&expression=${encodeURIComponent(exprs.join(';'))}`;
  const r = await j(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(feature(ring)) });
  const st = Object.values(r.properties.statistics);
  const out = { cloud: st.at(-1).mean, pixels: st.at(-1).count };
  keys.forEach((k, i) => (out[k] = { mean: st[i].mean, median: st[i].median, min: st[i].min, max: st[i].max, std: st[i].std,
    p10: st[i].percentile_2 ?? null, hist: st[i].histogram }));
  return out;
}

// Mejor escena con poca nube DENTRO de la zona (no solo en la escena completa)
async function bestInZone(scenes, ring, keys, maxZoneCloud = 0.2, tries = 4, onTry) {
  for (const s of scenes.slice(0, tries)) {
    onTry?.(s);
    try { const st = await zoneStats(s, ring, keys); if (st.cloud <= maxZoneCloud) return { scene: s, stats: st }; } catch {}
  }
  return null;
}

export async function vegetationIndices(ring, date = new Date(), onProgress) {
  onProgress?.('Buscando pasadas de Sentinel-2 sobre la zona…');
  const scenes = await searchScenes(ring, new Date(date.getTime() - 75 * DAY), date, 40);
  if (!scenes.length) throw new Error('No hay pasadas de Sentinel-2 con pocas nubes en los últimos 75 días sobre esta zona.');
  scenes.sort((a, b) => b.date.localeCompare(a.date) || a.cloud - b.cloud);
  const res = await bestInZone(scenes, ring, Object.keys(INDICES), 0.2, 6, s => onProgress?.(`Calculando índices con la pasada del ${s.date}…`));
  if (!res) throw new Error('Todas las pasadas recientes tienen nubes sobre la zona. Prueba más tarde o con otra zona.');
  return { ...res, available: scenes.length };
}

// Línea base: misma época del año en años anteriores
async function baseline(ring, date, years, keys, onProgress) {
  const out = [];
  await Promise.all(Array.from({ length: years }, async (_, i) => {
    const y = date.getFullYear() - (i + 1);
    const c = new Date(date); c.setFullYear(y);
    if (y < 2016) return;
    const sc = (await searchScenes(ring, new Date(c - 40 * DAY), new Date(+c + 40 * DAY), 30, 20).catch(() => []))
      .sort((a, b) => Math.abs(new Date(a.date) - c) - Math.abs(new Date(b.date) - c));
    const r = await bestInZone(sc, ring, keys, 0.2, 3);
    if (r) out.push({ year: y, ...r });
    onProgress?.(`Línea base: ${out.length} de ${years} años listos…`);
  }));
  return out.sort((a, b) => a.year - b.year);
}

const zscore = (v, xs) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.max(Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(xs.length - 1, 1)), 0.03);
  return { mean: m, sd, z: (v - m) / sd, pct: m ? ((v - m) / Math.abs(m)) * 100 : 0 };
};
export const anomalyLevel = z => z <= -2 ? { key: 'severa', label: 'Anomalía severa (mucho menos vegetación de lo normal)', color: '#E74C3C' }
  : z <= -1 ? { key: 'moderada', label: 'Por debajo de lo normal', color: '#F39C12' }
  : z >= 1.5 ? { key: 'alta', label: 'Por encima de lo normal (más verde)', color: '#3498DB' }
  : { key: 'normal', label: 'Dentro de lo normal', color: '#2ECC71' };

// Sectores: divide el rectángulo de la zona en una cuadrícula y conserva las celdas dentro del polígono
export function sectors(ring, n = 3, inPoly) {
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const dx = (x1 - x0) / n, dy = (y1 - y0) / n, cells = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    const c = [x0 + (i + 0.5) * dx, y0 + (k + 0.5) * dy];
    if (inPoly(c, ring)) cells.push({ id: `${String.fromCharCode(65 + k)}${i + 1}`, center: c,
      ring: [[x0 + i * dx, y0 + k * dy], [x0 + (i + 1) * dx, y0 + k * dy], [x0 + (i + 1) * dx, y0 + (k + 1) * dy], [x0 + i * dx, y0 + (k + 1) * dy]] });
  }
  return cells;
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch(() => null); } }));
  return out;
}

export async function detectAnomalies(ring, inPoly, { date = new Date(), years = 4, grid = 3, onProgress } = {}) {
  const now = await vegetationIndices(ring, date, onProgress);
  const keys = ['NDVI', 'NDMI', 'NBR', 'BSI'];
  onProgress?.('Buscando la misma época en años anteriores…');
  const base = await baseline(ring, new Date(now.scene.date), years, keys, onProgress);
  if (base.length < 2) throw new Error('No hay suficientes años despejados en la misma época para comparar (se necesitan al menos 2).');
  const zone = Object.fromEntries(keys.map(k => [k, { now: now.stats[k].mean, ...zscore(now.stats[k].mean, base.map(b => b.stats[k].mean)) }]));
  // Sectores: NDVI actual contra los mismos años, celda por celda
  const cells = sectors(ring, grid, inPoly);
  onProgress?.(`Revisando ${cells.length} sectores de la zona…`);
  const B = s => b => refl(b, s.offset);
  const cellStat = (s, c) => {
    const url = `${PC}/data/v1/item/statistics?collection=sentinel-2-l2a&item=${s.id}&asset_as_band=true&max_size=512&expression=${encodeURIComponent(INDICES.NDVI.f(B(s)) + ';' + CLOUD)}`;
    return j(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(feature(c.ring)) })
      .then(r => { const st = Object.values(r.properties.statistics); return st[1].mean <= 0.3 ? st[0].mean : null; });
  };
  const jobs = cells.flatMap(c => [now.scene, ...base.map(b => b.scene)].map(s => ({ c, s })));
  const vals = await pool(jobs, 8, ({ c, s }) => cellStat(s, c));
  const per = cells.map((c, ci) => {
    const row = vals.slice(ci * (base.length + 1), (ci + 1) * (base.length + 1));
    const hist = row.slice(1).filter(v => v != null);
    if (row[0] == null || hist.length < 2) return { ...c, ndvi: row[0], level: null };
    const zz = zscore(row[0], hist);
    return { ...c, ndvi: row[0], ...zz, level: anomalyLevel(zz.z) };
  });
  return { scene: now.scene, stats: now.stats, base: base.map(b => ({ year: b.year, date: b.scene.date, NDVI: b.stats.NDVI.mean })), zone, level: anomalyLevel(zone.NDVI.z), cells: per };
}

// Capa de mapa con el índice calculado sobre la escena. Con `range` el color se estira al rango real de la
// zona, para que las diferencias dentro del polígono se vean con claridad.
const DEF_RANGE = { NDVI: [-0.1, 0.9], EVI: [-0.1, 0.9], SAVI: [-0.1, 0.8], NDMI: [-0.4, 0.6], NBR: [-0.4, 0.8], NDWI: [-0.6, 0.4], BSI: [-0.4, 0.4] };
export const CMAP = { NDVI: 'rdylgn', EVI: 'rdylgn', SAVI: 'rdylgn', NDMI: 'rdylbu', NBR: 'rdylgn', NDWI: 'blues', BSI: 'rdylgn_r', LST: 'turbo' };
export function localRange(st, key) {
  if (!st?.std) return DEF_RANGE[key];
  const lo = Math.max(st.min, st.mean - 2 * st.std), hi = Math.min(st.max, st.mean + 2 * st.std);
  return hi - lo < 0.05 ? [st.mean - 0.05, st.mean + 0.05] : [lo, hi];
}
export function indexTileUrl(scene, key = 'NDVI', range) {
  const B = b => refl(b, scene.offset), [lo, hi] = range || DEF_RANGE[key];
  return `${PC}/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@2x?collection=sentinel-2-l2a&item=${scene.id}&asset_as_band=true&expression=${encodeURIComponent(INDICES[key].f(B))}&rescale=${lo.toFixed(3)},${hi.toFixed(3)}&colormap_name=${CMAP[key]}&format=png`;
}

// ---------- Temperatura de la superficie (Landsat 8/9, banda térmica, Colección 2 Nivel 2) ----------
const LST = 'lwir11*0.00341802+149.0-273.15';
async function landsatScenes(ring, from, to, maxCloud = 25) {
  const body = { collections: ['landsat-c2-l2'], intersects: feature(ring).geometry, datetime: `${iso(from)}T00:00:00Z/${iso(to)}T23:59:59Z`,
    query: { 'eo:cloud_cover': { lt: maxCloud }, platform: { in: ['landsat-8', 'landsat-9'] } }, limit: 12, sortby: [{ field: 'datetime', direction: 'desc' }] };
  const r = await j(`${PC}/stac/v1/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (r.features || []).map(f => ({ id: f.id, date: f.properties.datetime.slice(0, 10), cloud: f.properties['eo:cloud_cover'], sat: f.properties.platform.replace('landsat-', 'Landsat ') }));
}
// Las nubes son frías y falsean la temperatura: se descarta la pasada si la zona se ve muy brillante en azul (nube o nieve)
async function lstStats(scene, ring) {
  const url = `${PC}/data/v1/item/statistics?collection=landsat-c2-l2&item=${scene.id}&asset_as_band=true&max_size=512&expression=${encodeURIComponent(LST + ';blue*0.0000275-0.2')}`;
  const r = await j(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(feature(ring)) });
  const [st, blue] = Object.values(r.properties.statistics);
  if (!st || !(st.count > 0) || st.median < -50 || st.median > 80 || (blue && blue.median > 0.18)) return null;
  return { mean: st.median, min: st.min, max: st.max, std: st.std };
}
async function firstLst(scenes, ring, tries = 3) {
  for (const s of scenes.slice(0, tries)) { const st = await lstStats(s, ring).catch(() => null); if (st) return { scene: s, st }; }
  return null;
}
export async function surfaceHeat(ring, date = new Date(), years = 3, onProgress) {
  onProgress?.('Buscando la banda térmica de Landsat sobre la zona…');
  const now = await firstLst(await landsatScenes(ring, new Date(date - 75 * DAY), date), ring, 4);
  if (!now) throw new Error('No hay pasadas térmicas de Landsat sin nubes en los últimos 75 días sobre esta zona.');
  const d0 = new Date(now.scene.date), base = [];
  onProgress?.('Comparando la temperatura con años anteriores…');
  await Promise.all(Array.from({ length: years }, async (_, i) => {
    const c = new Date(d0); c.setFullYear(d0.getFullYear() - (i + 1));
    const sc = (await landsatScenes(ring, new Date(c - 30 * DAY), new Date(+c + 30 * DAY), 20).catch(() => []))
      .sort((a, b) => Math.abs(new Date(a.date) - c) - Math.abs(new Date(b.date) - c));
    const r = await firstLst(sc, ring, 3);
    if (r) base.push({ year: c.getFullYear(), date: r.scene.date, mean: r.st.mean });
  }));
  base.sort((a, b) => a.year - b.year);
  // Una pasada con bruma o helada puede salir 15 °C fuera de lo habitual: se descartan los años muy alejados de la mediana
  if (base.length >= 2) { const m = base.map(b => b.mean).sort((x, y) => x - y), med = m[Math.floor(m.length / 2)]; for (let i = base.length - 1; i >= 0; i--) if (Math.abs(base[i].mean - med) > 8) base.splice(i, 1); }
  const normal = base.length ? base.reduce((a, b) => a + b.mean, 0) / base.length : null;
  return { scene: now.scene, now: now.st, base, normal, diff: normal == null ? null : now.st.mean - normal };
}
export function heatTileUrl(heat) {
  const lo = Math.floor(Math.max(heat.now.min, heat.now.mean - 2.5 * heat.now.std)), hi = Math.ceil(Math.min(heat.now.max, heat.now.mean + 2.5 * heat.now.std)) || lo + 1;
  return { url: `${PC}/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@2x?collection=landsat-c2-l2&item=${heat.scene.id}&asset_as_band=true&expression=${encodeURIComponent(LST)}&rescale=${lo},${Math.max(hi, lo + 1)}&colormap_name=turbo&format=png`, range: [lo, Math.max(hi, lo + 1)] };
}
