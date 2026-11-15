// Zonas delimitadas por el usuario (a mano, por radio o área visible) con índices de vegetación y anomalías
import { drawZone, removeZone, drawSectors, clearSectors, setIndexLayer, setImageLayer, setIndexAlpha, clearIndexLayer, flyToLonLat, getViewRect } from './map.js';
import { INDICES, classify, vegetationIndices, detectAnomalies, indexTileUrl, localRange, surfaceHeat, heatTileUrl, sectors, anomalyLevel, CMAP } from './vegetation.js';
import { nisarAnalysis, radarReading } from './nisar.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const R = 6371, rad = d => d * Math.PI / 180;
const COLORS = ['#A855F7', '#00CFFF', '#F59E0B', '#22C55E', '#EC4899', '#F97316'];
export const MAX_KM2 = 1500;

export function areaKm2(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)));
  }
  return Math.abs(s * R * R / 2);
}
export function inPolygon([x, y], pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function circleRing(lat, lon, km, n = 32) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return [lon + (km / (111.32 * Math.max(Math.cos(rad(lat)), 0.05))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)];
  });
}
const fmtKm2 = a => a < 1 ? `${(a * 100).toFixed(1)} ha` : `${a.toLocaleString('es-MX', { maximumFractionDigits: a < 100 ? 1 : 0 })} km²`;

// Qué se puede preguntar de una zona ya encerrada
export const TEMAS = {
  vegetacion: { label: 'Vegetación', layer: 'NDVI' }, humedad: { label: 'Humedad', layer: 'NDMI' }, calor: { label: 'Temperatura', layer: 'LST' },
  incendios: { label: 'Incendios', layer: 'NBR' }, suelo: { label: 'Suelos', layer: 'BSI' }, radar: { label: 'Radar NISAR', layer: 'NISAR' },
  completo: { label: 'Anomalías (todo)', layer: 'NDVI' },
};
const LAYER_NAME = { NDVI: 'Vigor de la vegetación (NDVI)', EVI: 'Vigor en vegetación densa (EVI)', SAVI: 'Vegetación en zonas áridas (SAVI)', NDMI: 'Humedad de la vegetación (NDMI)',
  NBR: 'Índice de quema (NBR)', NDWI: 'Agua superficial (NDWI)', BSI: 'Suelo desnudo (BSI)', LST: 'Temperatura de la superficie (°C)', NISAR: 'Radar NISAR banda L' };
const GRAD = { rdylgn: 'linear-gradient(90deg,#a50026,#f46d43,#fee08b,#a6d96a,#006837)', rdylgn_r: 'linear-gradient(90deg,#006837,#a6d96a,#fee08b,#f46d43,#a50026)',
  rdylbu: 'linear-gradient(90deg,#a50026,#f46d43,#ffffbf,#74add1,#313695)', blues: 'linear-gradient(90deg,#f7fbff,#9ecae1,#3182bd,#08306b)',
  turbo: 'linear-gradient(90deg,#30123b,#4686fb,#1be5b5,#a4fc3c,#fbb938,#e3440a,#7a0403)' };
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fecha = d => { const [y, m, dd] = d.split('-'); return `${+dd} de ${MES[+m - 1]} de ${y}`; };
const sg = (v, dec = 0) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dec)}`;
const pc = v => `${Math.abs(v).toFixed(0)} por ciento ${v >= 0 ? 'más' : 'menos'}`;
const pts = v => `${v >= 0 ? 'subió' : 'bajó'} ${Math.abs(v).toFixed(2)} puntos`;
const burn = d => d < 0.1 ? 'sin señales de quema' : d < 0.27 ? 'posible quema de baja severidad o vegetación más seca' : d < 0.44 ? 'posible quema de severidad moderada' : d < 0.66 ? 'posible quema de severidad moderada a alta' : 'posible quema de alta severidad';

let zones = [], seq = 0, activeId = null, hooks = {}, layerAlpha = 0.85;
const busy = new Set();
export const listZones = () => zones.map(z => ({ id: z.id, name: z.name, area_km2: +z.area.toFixed(2), kind: z.kind, analizado: Object.keys(TEMAS).filter(t => z.done?.[t]),
  ndvi: z.indices ? +z.indices.stats.NDVI.mean.toFixed(3) : null, anomaly: z.anomaly?.level.label ?? null }));
export const getZone = id => zones.find(z => z.id === id || z.name.toLowerCase() === String(id).toLowerCase());
export const activeZone = () => getZone(activeId) || zones.at(-1) || null;

export function addZone(ring, { name, kind = 'polígono' } = {}) {
  const area = areaKm2(ring);
  if (area < 0.005) throw new Error('La zona es demasiado pequeña (mínimo media hectárea).');
  if (area > MAX_KM2) throw new Error(`La zona mide ${fmtKm2(area)} y el máximo para analizar es ${MAX_KM2} kilómetros cuadrados. Acércate o encierra una zona más pequeña.`);
  const id = `z${++seq}`;
  const z = { id, name: (name || `Zona ${seq}`).slice(0, 40), ring, area, kind, color: COLORS[(seq - 1) % COLORS.length], indices: null, anomaly: null, heat: null, nisar: null, done: {}, tema: null };
  zones.push(z); activeId = id; clearSectors(); clearIndexLayer();
  drawZone(id, ring, z.color, z.name);
  render(); openCard();
  return z;
}
export function zoneFromView(name) {
  const r = getViewRect();
  if (!r) throw new Error('Acerca el mapa a una zona primero.');
  return addZone([[r.west, r.south], [r.east, r.south], [r.east, r.north], [r.west, r.north]], { name, kind: 'área visible' });
}
export function zoneFromCircle(lat, lon, km, name) { return addZone(circleRing(lat, lon, km), { name, kind: `polígono circular de ${km} km de radio` }); }

export function removeZoneById(id) {
  const z = getZone(id); if (!z) return false;
  removeZone(z.id); zones = zones.filter(x => x !== z);
  if (activeId === z.id) { activeId = zones.at(-1)?.id ?? null; clearSectors(); clearIndexLayer(); }
  render(); return true;
}
export function clearZones() { [...zones].forEach(z => removeZone(z.id)); zones = []; activeId = null; clearSectors(); clearIndexLayer(); render(); }
export function focusZone(id) { const z = getZone(id); if (!z) return null; activeId = z.id; flyToLonLat(z.ring, 0.2); if (z.tema) showLayer(z, z.layer); render(); return z; }
export function renameZone(id, name) { const z = getZone(id); if (!z) return null; z.name = String(name).slice(0, 40); drawZone(z.id, z.ring, z.color, z.name); render(); return z; }

const NEED = { vegetacion: ['indices'], humedad: ['indices'], suelo: ['indices'], calor: ['heat'], radar: ['nisar'], incendios: ['anomaly', 'heat'], completo: ['anomaly', 'heat', 'nisar'] };
const grid = z => sectors(z.ring, 3, inPolygon);
const LOAD = {
  indices: async (z, p) => { if (!z.indices) z.indices = await vegetationIndices(z.ring, new Date(), p); },
  anomaly: async (z, p) => { if (!z.anomaly) { const a = await detectAnomalies(z.ring, inPolygon, { grid: 3, onProgress: p }); z.anomaly = a; z.indices = { scene: a.scene, stats: a.stats }; } },
  heat: async (z, p) => { if (!z.heat) z.heat = await surfaceHeat(z.ring, new Date(), 3, p); },
  nisar: async (z, p) => { if (!z.nisar) z.nisar = await nisarAnalysis(z.ring, inPolygon, grid(z), p); },
};

// Analiza un tema de una zona encerrada. Devuelve datos y una explicación clara en español.
export async function analyze(id, tema = 'completo') {
  const z = getZone(id) || activeZone();
  if (!z) throw new Error('Primero hay que encerrar la zona con un polígono. Puedes dibujarlo en el mapa o pedirme que lo trace, por ejemplo: «encierra dos kilómetros alrededor de aquí».');
  if (!TEMAS[tema]) throw new Error('Tema desconocido.');
  if (busy.has(z.id)) throw new Error('Todavía estoy analizando esa zona; dame unos segundos.');
  busy.add(z.id); activeId = z.id; z.error = null; z.warn = {}; z.tema = tema;
  flyToLonLat(z.ring, 0.25);
  try {
    const res = await Promise.allSettled(NEED[tema].map(k => LOAD[k](z, m => { z.msg = m; render(); })));
    res.forEach((r, i) => { if (r.status === 'rejected') z.warn[NEED[tema][i]] = r.reason?.message || 'Sin datos'; });
    if (res.every(r => r.status === 'rejected')) throw new Error(res[0].reason?.message || 'No hay datos para esta zona.');
    z.done[tema] = true; z.fires = hooks.firesIn?.(z.ring) ?? null;
    paintSectors(z, tema);
    showLayer(z, TEMAS[tema].layer === 'NISAR' && !z.nisar?.latest ? 'NDVI' : TEMAS[tema].layer);
    return { zona: z.name, area: fmtKm2(z.area), tema: TEMAS[tema].label, explicacion: explain(z, tema), datos: dataOf(z, tema) };
  } catch (e) { z.error = e.message; throw e; }
  finally { busy.delete(z.id); z.msg = null; render(); }
}
export const computeIndices = id => analyze(id, 'vegetacion');
export const computeAnomalies = id => analyze(id, 'completo');

function paintSectors(z, tema) {
  clearSectors();
  if ((tema === 'completo' || tema === 'incendios' || tema === 'vegetacion') && z.anomaly) drawSectors(z.anomaly.cells);
  else if (tema === 'radar' && z.nisar?.cells?.length) {
    const g = grid(z);
    drawSectors(z.nisar.cells.map((c, i) => c.change == null ? {} : { ...g[i], pct: c.change, text: `${c.id}\nradar ${sg(c.change)}%`,
      level: { color: c.change <= -15 ? '#E74C3C' : c.change >= 15 ? '#3498DB' : '#2ECC71' } }));
  }
}
function showLayer(z, key) {
  z.layer = key; z.legend = null;
  if (key === 'NISAR') { if (!z.nisar?.latest) return false; setImageLayer(z.nisar.latest.url, z.nisar.latest.bbox, layerAlpha).catch(() => {}); z.legend = { text: `NISAR · ${z.nisar.latest.date} · vista previa de unos 120 m por píxel · tonos claros = señal fuerte (bosque, edificios); oscuros = agua o suelo liso` }; }
  else if (key === 'LST') { if (!z.heat) return false; const t = heatTileUrl(z.heat); setIndexLayer(t.url, z.ring, layerAlpha); z.legend = { grad: GRAD.turbo, lo: `${t.range[0]} °C`, hi: `${t.range[1]} °C` }; }
  else { if (!z.indices || !INDICES[key]) return false; const r = localRange(z.indices.stats[key], key); setIndexLayer(indexTileUrl(z.indices.scene, key, r), z.ring, layerAlpha);
    z.legend = { grad: GRAD[CMAP[key]], lo: r[0].toFixed(2), hi: r[1].toFixed(2) }; }
  render(); return true;
}
export function showIndexLayer(id, key = 'NDVI') { const z = getZone(id) || activeZone(); return z ? showLayer(z, key) : false; }

// ---------- Explicaciones en lenguaje claro (las usa la tarjeta y la voz de Terra) ----------
const ix = (z, k) => z.indices.stats[k].mean;
const P = {
  vegetacion: z => z.indices && `El vigor de la vegetación, que se mide con el índice NDVI en una escala de menos uno a uno, donde arriba de cero punto seis es vegetación densa y sana, es de ${ix(z, 'NDVI').toFixed(2)}. Eso significa: ${classify('NDVI', ix(z, 'NDVI')).toLowerCase()}. El dato viene de la imagen de Sentinel-2 del ${fecha(z.indices.scene.date)}.`
    + (z.anomaly ? ` Comparado con la misma época de años anteriores, hay ${pc(z.anomaly.zone.NDVI.pct)} vigor de lo normal.` : ''),
  humedad: z => z.indices && `La humedad de la vegetación, medida con el índice NDMI en una escala de menos uno a uno, donde los valores negativos indican plantas secas, es de ${ix(z, 'NDMI').toFixed(2)}: ${classify('NDMI', ix(z, 'NDMI')).toLowerCase()}. El índice de agua superficial, NDWI, es de ${ix(z, 'NDWI').toFixed(2)}: ${classify('NDWI', ix(z, 'NDWI')).toLowerCase()}. Imagen de Sentinel-2 del ${fecha(z.indices.scene.date)}.`,
  suelo: z => z.indices && `El índice de suelo desnudo, BSI, que va de menos uno a uno y sube cuando hay más tierra expuesta, es de ${ix(z, 'BSI').toFixed(2)}: ${classify('BSI', ix(z, 'BSI')).toLowerCase()}. El índice SAVI, que mide la vegetación descontando el brillo del suelo, es de ${ix(z, 'SAVI').toFixed(2)}: vegetación ${classify('SAVI', ix(z, 'SAVI')).toLowerCase()}.`,
  calor: z => z.heat && `La temperatura de la superficie del terreno, que no es la del aire, medida por ${z.heat.scene.sat} el ${fecha(z.heat.scene.date)} a media mañana, es de ${z.heat.now.mean.toFixed(1)} grados Celsius en promedio, con un punto máximo de ${z.heat.now.max.toFixed(1)} grados.`
    + (z.heat.diff != null ? ` Es ${Math.abs(z.heat.diff).toFixed(1)} grados ${z.heat.diff >= 0 ? 'más caliente' : 'más fresca'} que el promedio de la misma época en ${z.heat.base.map(b => b.year).join(', ')}. La temperatura del terreno cambia mucho de un día a otro, así que tómalo como referencia.` : ' No encontré años anteriores sin nubes para compararla.'),
  incendios: z => {
    const t = [];
    if (z.anomaly) { const d = z.anomaly.zone.NBR.mean - z.anomaly.zone.NBR.now; t.push(`El índice de quema, NBR, que baja cuando la vegetación se quema, es de ${z.anomaly.zone.NBR.now.toFixed(2)}, frente a ${z.anomaly.zone.NBR.mean.toFixed(2)} que es lo normal en esta época. La diferencia es de ${d.toFixed(2)}: ${burn(d)}.`); }
    if (z.fires != null) t.push(z.fires ? `Hay ${z.fires} ${z.fires === 1 ? 'foco de calor activo detectado' : 'focos de calor activos detectados'} por los satélites de NASA FIRMS dentro del polígono; un foco de calor no confirma por sí solo un incendio.` : 'No hay focos de calor activos de NASA FIRMS dentro del polígono.');
    if (z.heat?.diff != null) t.push(`La superficie está ${Math.abs(z.heat.diff).toFixed(1)} grados Celsius ${z.heat.diff >= 0 ? 'más caliente' : 'más fresca'} de lo normal para esta época.`);
    return t.join(' ');
  },
  radar: z => { const n = z.nisar; if (!n) return ''; if (!n.count) return 'El radar NISAR todavía no tiene pasadas publicadas sobre esta zona.';
    let t = `El radar NISAR, de la NASA y la agencia espacial de la India, que ve el terreno aunque haya nubes o sea de noche, tiene ${n.count} ${n.count === 1 ? 'pasada' : 'pasadas'} sobre esta zona. La más reciente es del ${fecha(n.latest.date)}.`;
    if (n.partial) return t + ' Esa pasada solo cubre una parte del polígono, así que no calculé el cambio.';
    if (n.ref) t += ` Comparada con la pasada del ${fecha(n.ref.date)}, la señal de radar que rebota del terreno es ${pc(n.change)} intensa: ${radarReading(n.change)}. Es una estimación hecha con las imágenes de vista previa, y parte del cambio puede deberse a la estación del año.`;
    else t += ' Aún no hay una pasada anterior de la misma órbita para medir el cambio.';
    return t; },
  completo: z => {
    const t = [];
    if (z.anomaly) { const a = z.anomaly, bad = a.cells.filter(c => c.level && (c.level.key === 'severa' || c.level.key === 'moderada'));
      t.push(`Resultado general: ${a.level.label.toLowerCase()}. El vigor de la vegetación, NDVI, es de ${a.zone.NDVI.now.toFixed(2)} frente a ${a.zone.NDVI.mean.toFixed(2)} que es lo normal en esta época; es decir, ${pc(a.zone.NDVI.pct)} de lo normal. La humedad de la vegetación, índice NDMI, ${pts(a.zone.NDMI.now - a.zone.NDMI.mean)} respecto a lo normal y ahora es de ${a.zone.NDMI.now.toFixed(2)}.`);
      const d = a.zone.NBR.mean - a.zone.NBR.now; t.push(`En cuanto a incendios: ${burn(d)}.`);
      t.push(bad.length ? `De ${a.cells.length} sectores en que dividí la zona, ${bad.length} están por debajo de lo normal${bad.length <= 4 ? `: ${bad.map(c => c.id).join(', ')}` : ''}.` : 'Ningún sector está por debajo de lo normal.'); }
    if (z.fires) t.push(`Hay ${z.fires} ${z.fires === 1 ? 'foco de calor activo' : 'focos de calor activos'} de NASA FIRMS dentro del polígono.`);
    if (z.heat?.diff != null) t.push(`La temperatura de la superficie es de ${z.heat.now.mean.toFixed(1)} grados Celsius, ${Math.abs(z.heat.diff).toFixed(1)} grados ${z.heat.diff >= 0 ? 'más caliente' : 'más fresca'} de lo normal.`);
    if (z.nisar?.count) t.push(z.nisar.ref ? `Según el radar NISAR, la señal del terreno es ${pc(z.nisar.change)} intensa el ${fecha(z.nisar.latest.date)} que el ${fecha(z.nisar.ref.date)}: ${radarReading(z.nisar.change).split(',')[0]}; es una estimación.` : `El radar NISAR tiene ${z.nisar.count} pasadas sobre la zona; la última, del ${fecha(z.nisar.latest.date)}.`);
    else if (z.nisar) t.push('El radar NISAR todavía no tiene pasadas publicadas sobre esta zona.');
    return t.join(' ');
  },
};
export function explain(z, tema) { return `${z.name}. ${P[tema](z) || 'No hay datos suficientes para este tema.'}${Object.values(z.warn || {}).length ? ` Aviso: ${Object.values(z.warn).join(' ')}` : ''}`; }
function dataOf(z, tema) {
  const d = {};
  if (z.indices && tema !== 'calor' && tema !== 'radar') d.indices = Object.fromEntries(Object.keys(INDICES).map(k => [k, +ix(z, k).toFixed(3)])), d.fecha_sentinel2 = z.indices.scene.date;
  if (z.anomaly && (tema === 'completo' || tema === 'incendios')) d.anomalia = { resultado: z.anomaly.level.label, ndvi_cambio_pct: +z.anomaly.zone.NDVI.pct.toFixed(0), anos: z.anomaly.base.map(b => b.year),
    sectores: z.anomaly.cells.filter(c => c.level).map(c => ({ id: c.id, cambio_pct: +c.pct.toFixed(0), nivel: c.level.key })) };
  if (z.heat && NEED[tema].includes('heat')) d.temperatura_superficie_c = { promedio: +z.heat.now.mean.toFixed(1), maxima: +z.heat.now.max.toFixed(1), diferencia_vs_normal: z.heat.diff == null ? null : +z.heat.diff.toFixed(1), fecha: z.heat.scene.date };
  if (z.nisar && NEED[tema].includes('nisar')) d.nisar = { pasadas: z.nisar.count, ultima: z.nisar.latest?.date ?? null, comparada_con: z.nisar.ref?.date ?? null, cambio_senal_pct: z.nisar.change == null ? null : +z.nisar.change.toFixed(0) };
  if (z.fires != null) d.focos_firms = z.fires;
  return d;
}

// ---------- Interfaz ----------
function openCard() { document.body.classList.remove('hide-right'); $('zonesCard').closest('.glass-card').classList.remove('collapsed'); }
const bar = (v, lo, hi, col) => `<i class="ix-bar"><b style="width:${Math.max(2, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%;background:${col}"></b></i>`;
const ixColor = v => v < 0.1 ? '#a0522d' : v < 0.2 ? '#d4a017' : v < 0.4 ? '#c9d64a' : v < 0.6 ? '#7cc243' : '#1f9e4a';
const KEYS = { vegetacion: ['NDVI', 'EVI', 'SAVI'], humedad: ['NDMI', 'NDWI'], suelo: ['BSI', 'SAVI'], incendios: ['NBR', 'NDVI'], completo: Object.keys(INDICES) };

function resultsHtml(z) {
  let h = '';
  if (z.msg) h += `<p class="note" role="status"><span class="spin"></span> ${esc(z.msg)}</p>`;
  if (z.error) h += `<p class="note err" role="alert">${esc(z.error)}</p>`;
  if (!z.tema || !z.done[z.tema]) return h;
  const t = z.tema, a = z.anomaly;
  if ((t === 'completo' || t === 'incendios') && a) h += `<div class="anom" style="--c:${a.level.color}"><b>${esc(a.level.label)}</b></div>`;
  h += `<p class="zone-say">${esc(P[t](z) || 'No hay datos suficientes para este tema.')}</p>`;
  Object.values(z.warn || {}).forEach(w => (h += `<p class="note err">${esc(w)}</p>`));
  if (KEYS[t] && z.indices) {
    const s = z.indices.stats;
    h += `<table class="ix-table"><caption class="sr-only">Índices de ${esc(z.name)}</caption><thead><tr><th scope="col">Índice</th><th scope="col">Valor</th><th scope="col">Qué significa</th></tr></thead><tbody>${KEYS[t].map(k => `
      <tr><th scope="row" title="${esc(INDICES[k].what)}">${k}</th><td>${s[k].mean.toFixed(2)} ${bar(s[k].mean, -0.5, 1, k === 'NDWI' ? '#3498db' : k === 'BSI' ? '#b9770e' : ixColor(s[k].mean))}</td><td>${esc(classify(k, s[k].mean))}</td></tr>`).join('')}</tbody></table>`;
  }
  if ((t === 'calor' || t === 'incendios' || t === 'completo') && z.heat) h += `<dl class="kv"><dt>Superficie</dt><dd>${z.heat.now.mean.toFixed(1)} °C (máx. ${z.heat.now.max.toFixed(1)} °C) · ${z.heat.scene.sat} · ${z.heat.scene.date}</dd>
      ${z.heat.base.length ? `<dt>Años previos</dt><dd>${z.heat.base.map(b => `${b.year}: ${b.mean.toFixed(1)} °C`).join(' · ')}</dd>` : ''}</dl>`;
  if ((t === 'radar' || t === 'completo') && z.nisar?.count) h += `<dl class="kv"><dt>NISAR</dt><dd>${z.nisar.count} pasada(s) GCOV banda L · última ${z.nisar.latest.date} (${z.nisar.latest.dir})</dd>
      ${z.nisar.ref ? `<dt>Cambio</dt><dd>${sg(z.nisar.change)}% frente a ${z.nisar.ref.date} (estimado con vistas previas)</dd>` : ''}</dl>`;
  if ((t === 'completo' || t === 'incendios' || t === 'vegetacion') && a) h += `<p class="muted">Sectores: <i class="lg" style="--c:#E74C3C"></i>anomalía severa <i class="lg" style="--c:#F39C12"></i>bajo lo normal <i class="lg" style="--c:#2ECC71"></i>normal <i class="lg" style="--c:#3498DB"></i>más verde. El porcentaje es el cambio del vigor frente a ${a.base.map(b => b.year).join(', ')}.</p>`;
  const layers = [...(z.indices ? Object.keys(INDICES) : []), ...(z.heat ? ['LST'] : []), ...(z.nisar?.latest ? ['NISAR'] : [])];
  if (layers.length) h += `<label class="sat-op">Imagen sobre la zona <select id="zLayer" aria-label="Imagen que se pinta sobre la zona">${layers.map(k => `<option value="${k}"${k === z.layer ? ' selected' : ''}>${LAYER_NAME[k]}</option>`).join('')}</select></label>
      <label class="sat-op">Opacidad <input type="range" id="zAlpha" min="0" max="100" value="${Math.round(layerAlpha * 100)}" aria-label="Opacidad de la imagen"></label>
      ${z.legend?.grad ? `<div class="z-legend" role="img" aria-label="Escala de color de ${z.legend.lo} a ${z.legend.hi}"><span>${z.legend.lo}</span><i style="background:${z.legend.grad}"></i><span>${z.legend.hi}</span></div><p class="muted">El color se ajusta al rango real de la zona para resaltar las diferencias.</p>` : z.legend?.text ? `<p class="muted">${esc(z.legend.text)}</p>` : ''}`;
  return h;
}

export function render() {
  const el = $('zonesCard'); if (!el) return;
  const list = zones.map(z => `
    <li class="zone${z.id === activeId ? ' on' : ''}" style="--c:${z.color}">
      <button class="zone-name" data-act="focus" data-id="${z.id}" aria-label="Ver ${esc(z.name)} en el mapa"><i class="lg"></i>${esc(z.name)} <span class="muted">· ${fmtKm2(z.area)} · ${esc(z.kind)}</span></button>
      ${z.id === activeId ? `<p class="zone-q">¿Qué quieres saber de esta zona?</p>
      <div class="zone-acts" role="group" aria-label="Temas de análisis">${Object.entries(TEMAS).map(([k, t]) => `<button class="${k === 'completo' ? 'primary' : 'ghost'} sm${z.tema === k ? ' sel' : ''}" data-act="tema" data-tema="${k}" data-id="${z.id}"${busy.has(z.id) ? ' disabled' : ''} aria-pressed="${z.tema === k}">${t.label}</button>`).join('')}</div>
      <div class="zone-res" aria-live="polite">${resultsHtml(z)}</div>` : ''}
      <div class="zone-acts"><button class="ghost sm" data-act="rename" data-id="${z.id}" aria-label="Renombrar ${esc(z.name)}">Renombrar</button>
        <button class="ghost sm" data-act="del" data-id="${z.id}" aria-label="Borrar ${esc(z.name)}">Borrar</button></div>
    </li>`).join('');
  el.innerHTML = `
    <p class="muted"><b>1.</b> Encierra la zona con un polígono. <b>2.</b> Elige qué quieres saber: vegetación, humedad, temperatura, incendios, suelos, radar NISAR o todas las anomalías.</p>
    <div class="actions">
      <button id="zDraw" class="primary sm">Dibujar polígono</button>
      <button id="zCircle" class="ghost sm">Alrededor del punto</button>
      <button id="zView" class="ghost sm">Área visible</button>
    </div>
    ${zones.length ? `<ul class="zones">${list}</ul>${zones.length > 1 ? '<button id="zClear" class="ghost sm">Borrar todas</button>' : ''}` : '<p class="muted">Aún no hay zonas. También puedes pedírselo a Terra: «encierra dos kilómetros alrededor de aquí y dime si hay anomalías».</p>'}`;
  $('zDraw').onclick = () => hooks.beginDraw?.();
  $('zCircle').onclick = () => { const c = hooks.current?.(); if (!c) return alertNote('Primero haz clic en un punto del mapa.'); try { zoneFromCircle(c.lat, c.lon, Math.min(c.radius || 2, 20), /^(coordenadas|centro)/i.test(c.lugar || '') ? undefined : c.lugar?.split(',')[0]); } catch (e) { alertNote(e.message); } };
  $('zView').onclick = () => { try { zoneFromView(); } catch (e) { alertNote(e.message); } };
  $('zClear')?.addEventListener('click', () => { if (confirm(`¿Borrar las ${zones.length} zonas? No se puede deshacer.`)) clearZones(); });
  el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id, z = getZone(id);
    if (b.dataset.act === 'focus') focusZone(id);
    if (b.dataset.act === 'tema') analyze(id, b.dataset.tema).catch(() => {});
    if (b.dataset.act === 'rename') { const n = prompt('Nuevo nombre de la zona', z.name); if (n?.trim()) renameZone(id, n.trim()); }
    if (b.dataset.act === 'del' && confirm(`¿Borrar «${z.name}»?`)) removeZoneById(id);
  });
  $('zLayer')?.addEventListener('change', e => showLayer(activeZone(), e.target.value));
  $('zAlpha')?.addEventListener('input', e => { layerAlpha = e.target.value / 100; setIndexAlpha(layerAlpha); });
}
function alertNote(msg) { const p = document.createElement('p'); p.className = 'note err'; p.setAttribute('role', 'alert'); p.textContent = msg; $('zonesCard').prepend(p); setTimeout(() => p.remove(), 6000); }

export function initZones(h) { hooks = h; render(); }
