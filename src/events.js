// Normalización de eventos del backend: tipo, icono, color por severidad y modo de la máquina del tiempo.

export const SEVERITY = {
  alta: { color: '#FF4D5A', label: 'Alta', rank: 0 },
  media: { color: '#FF9F43', label: 'Media', rank: 1 },
  baja: { color: '#FFD23F', label: 'Baja', rank: 2 },
};
export const sev = s => SEVERITY[String(s || '').toLowerCase()] || SEVERITY.baja;

// Iconos (trazos SVG 24x24) por tipo de evento
const PATHS = {
  fire: '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.7 1.6-3.6C10 10 11 10.6 11 12c1.4-1.2 1.6-4.6 1-9Z"/>',
  flood: '<path d="M3 9c2 0 2-1.5 4.5-1.5S9.5 9 12 9s2-1.5 4.5-1.5S18.5 9 21 9"/><path d="M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2-1.5 4.5-1.5S18.5 15 21 15"/>',
  quake: '<path d="M2 12h4l2-5 3 10 3-12 2 7h6"/>',
  volcano: '<path d="M3 20h18l-6-9h-6Z"/><path d="M10 7c0-2 2-2 2-4M14 7c0-1.5 1.5-2 1.5-3.5"/>',
  storm: '<path d="M20 9a8 8 0 1 0-6 9.7"/><path d="M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0"/><path d="M4 15a8 8 0 0 0 6 5.7"/>',
  drought: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  ice: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/>',
  other: '<path d="M12 7v6M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
};

const TYPES = [
  { key: 'fire', label: 'Incendio', match: ['fuego', 'wf', 'wildfire', 'incendio'], mode: 'incendios', risk: 'Fuego' },
  { key: 'flood', label: 'Inundación', match: ['fl', 'flood', 'inunda'], mode: 'inundaciones_sismos', risk: 'Inundación' },
  { key: 'quake', label: 'Sismo', match: ['eq', 'earthquake', 'sismo', 'landslide', 'deslave'], mode: 'inundaciones_sismos', risk: 'Sismo' },
  { key: 'volcano', label: 'Volcán', match: ['vo', 'volcan'], mode: 'atmosfera_volcanes', risk: 'Volcán' },
  { key: 'storm', label: 'Ciclón / tormenta', match: ['tc', 'storm', 'cyclone', 'tormenta'], mode: 'inundaciones_sismos', risk: 'Inundación' },
  { key: 'drought', label: 'Sequía', match: ['dr', 'drought', 'sequ'], mode: 'agricultura_sequia', risk: 'Sequía' },
  { key: 'ice', label: 'Hielo / glaciar', match: ['hielo', 'ice', 'snow', 'glacier'], mode: 'historico_50_anos', risk: 'Desplazamiento Hielo' },
];
const OTHER = { key: 'other', label: 'Otro', mode: 'incendios', risk: 'Fuego' };

export function typeOf(disasterType) {
  const d = String(disasterType || '').toLowerCase().trim();
  return TYPES.find(t => t.match.some(m => d === m || (m.length > 2 && d.includes(m)))) || OTHER;
}
export const TYPE_LIST = TYPES;

export function iconSvg(typeKey, color, size = 28) {
  const p = PATHS[typeKey] || PATHS.other;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28">` +
    `<circle cx="14" cy="14" r="12.5" fill="${color}" stroke="#fff" stroke-width="2"/>` +
    `<g transform="translate(5 5) scale(.75)" fill="none" stroke="#08130F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${p}</g></svg>`;
}
const cache = {};
export function iconUri(typeKey, severity) {
  const k = typeKey + severity;
  return cache[k] || (cache[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(typeKey, sev(severity).color)));
}

// Fecha del evento (las del backend pueden venir sin zona horaria → UTC)
export function eventDate(props) {
  const ts = props?.event_timestamp || props?.timestamp;
  if (!ts) return null;
  const s = /Z|[+-]\d\d:?\d\d$/.test(ts) ? ts : ts + 'Z';
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function coordsOf(feature) {
  const g = feature?.geometry;
  if (!g) return null;
  if (g.type === 'Point') return { lon: g.coordinates[0], lat: g.coordinates[1] };
  const flat = JSON.stringify(g.coordinates).match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
  if (flat.length < 2) return null;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) { sx += flat[i]; sy += flat[i + 1]; n++; }
  return { lon: sx / n, lat: sy / n };
}

export function sortEvents(features) {
  return [...features].sort((a, b) =>
    sev(a.properties.severity).rank - sev(b.properties.severity).rank ||
    (eventDate(b.properties) || 0) - (eventDate(a.properties) || 0));
}
