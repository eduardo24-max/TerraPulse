// Historias animadas por tipo de desastre: qué satélite y producto se usan, qué fechas se recorren
// y qué se explica en cada fase (antes / durante / después / pronóstico).
import { GIBS_LAYERS, gibsUrl, sideInfo } from './satelliteSources.js';
import { gibsTemplate } from './connection.js';
import { findClearScenes, spreadScenes, sceneUrl, damageUrl, fillUrl } from './scenes.js';

const DAY = 864e5;
const iso = d => d.toISOString().slice(0, 10);

export const STORIES = {
  fuego: {
    title: 'Incendio', icon: 'fire',
    products: [
      { key: 'hls_clear', label: 'Landsat + Sentinel-2 · 30 m, pasadas sin nubes', kind: 'scenes', before: 120, after: 240, damage: true },
      { key: 'modis_721', label: 'Falso color 7-2-1 · cicatriz de quema', kind: 'daily', before: 24, after: 48, step: 6 },
      { key: 'viirs_tc', label: 'Color real · humo', kind: 'daily', before: 8, after: 10, step: 2 },
      { key: 's2annual', label: 'Sentinel-2 anual · recuperación', kind: 'annual' },
      { key: 'goes_fire', label: 'GOES · temperatura de fuego (últimas horas)', kind: 'live' },
    ],
    captions: {
      before: 'Antes del incendio: la vegetación está intacta. En falso color 7-2-1 la vegetación sana se ve verde.',
      during: 'Incendio activo: aparece el humo (color real) y el área que arde se ve en tonos rojizos y anaranjados (falso color).',
      after: 'Después: queda la cicatriz de quema, una mancha café-rojiza que puede tardar años en recuperarse.',
      general: 'Recorre las fechas para ver cómo cambia la vegetación.',
    },
  },
  inundacion: {
    title: 'Inundación', icon: 'flood',
    products: [
      { key: 'hls_clear', label: 'Landsat + Sentinel-2 · 30 m, pasadas sin nubes', kind: 'scenes', before: 90, after: 120 },
      { key: 'modis_721', label: 'Falso color 7-2-1 · agua en azul oscuro', kind: 'daily', before: 12, after: 30, step: 4 },
      { key: 'viirs_flood', label: 'VIIRS · agua de inundación', kind: 'daily', before: 8, after: 16, step: 2 },
      { key: 'opera_dswx_s1', label: 'OPERA radar Sentinel-1 · agua (a través de nubes)', kind: 'daily', before: 12, after: 24, step: 3 },
    ],
    captions: {
      before: 'Antes: ríos, lagos y humedales en su cauce normal.',
      during: 'Inundación: el agua cubre zonas que antes eran tierra; en falso color se ve azul oscuro o negro.',
      after: 'Después: el agua se retira poco a poco y deja sedimentos y suelos saturados.',
      general: 'Observa cómo se expanden y retraen el agua y los humedales.',
    },
  },
  ciclon: {
    title: 'Ciclón / tormenta', icon: 'storm',
    products: [
      { key: 'goes_geo', label: 'GOES GeoColor · nubes cada 30 min', kind: 'live' },
      { key: 'viirs_tc', label: 'Color real diario · trayectoria', kind: 'daily', before: 6, after: 6, step: 1 },
    ],
    captions: {
      before: 'Formación: las nubes se organizan en espiral sobre el océano cálido.',
      during: 'Impacto: el ojo del ciclón y sus bandas de lluvia avanzan sobre la costa.',
      after: 'Después: la tormenta se debilita; pueden quedar inundaciones en la costa.',
      general: 'Movimiento real de las nubes visto desde órbita geoestacionaria.',
    },
  },
  sequia: {
    title: 'Sequía y cultivos', icon: 'drought',
    products: [
      { key: 'hls_clear', label: 'Landsat + Sentinel-2 · 30 m, pasadas sin nubes', kind: 'scenes', before: 365, after: 0 },
      { key: 'modis_ndvi', label: 'NDVI · vigor de la vegetación (mensual)', kind: 'monthly', months: 12 },
      { key: 'smap_l4s', label: 'SMAP · humedad del suelo (diaria)', kind: 'daily', before: 30, after: 0, step: 3 },
      { key: 's2annual', label: 'Sentinel-2 anual · cambio de cultivos', kind: 'annual' },
    ],
    captions: {
      before: 'Temporada húmeda: verde intenso indica cultivos y vegetación vigorosos.',
      during: 'Estrés hídrico: el verde se vuelve amarillo/café; el suelo pierde humedad.',
      after: 'Recuperación o pérdida: compara cómo vuelve (o no) la vegetación.',
      general: 'Mes a mes: el verde intenso es vegetación sana; el café, vegetación seca.',
    },
  },
  humedad: {
    title: 'Humedad del suelo', icon: 'drop',
    products: [
      { key: 'smap_l4s', label: 'SMAP · humedad superficial', kind: 'daily', before: 30, after: 0, step: 3 },
      { key: 'smap_l4', label: 'SMAP · humedad en raíces', kind: 'daily', before: 30, after: 0, step: 3 },
    ],
    captions: { general: 'Azul = suelo húmedo, café = suelo seco. Las lluvias se ven como manchas azules que avanzan y se secan.' },
  },
  hielo: {
    title: 'Hielo y nieve', icon: 'ice',
    products: [
      { key: 'modis_snow', label: 'MODIS · cobertura de nieve (cada 15 días)', kind: 'daily', before: 180, after: 0, step: 15 },
      { key: 'viirs_seaice', label: 'VIIRS · hielo marino', kind: 'daily', before: 90, after: 0, step: 7 },
    ],
    captions: { general: 'Avance y retroceso de la nieve y el hielo con las estaciones.' },
  },
  deformacion: {
    title: 'Deformación y cambios del terreno', icon: 'quake',
    products: [
      { key: 'hls_clear', label: 'Landsat + Sentinel-2 · 30 m, pasadas sin nubes', kind: 'scenes', before: 730, after: 0 },
      { key: 's2annual', label: 'Sentinel-2 anual · cambios del terreno', kind: 'annual' },
      { key: 'wayback', label: 'Alta resolución Esri Wayback · cada año', kind: 'annual', from: 2014 },
      { key: 'opera_rtc', label: 'Radar Sentinel-1 (RTC)', kind: 'daily', before: 24, after: 24, step: 6 },
    ],
    captions: {
      before: 'Antes del evento: estado del terreno, edificios y caminos.',
      during: 'Durante: deslaves, grietas o nuevas lavas pueden cambiar el paisaje.',
      after: 'Después: compara daños y reconstrucción año con año.',
      general: 'Time-lapse anual: urbanización, deslaves, minería, cambios en ríos y costas.',
    },
  },
  bosques: {
    title: 'Bosques y deforestación', icon: 'tree',
    products: [
      { key: 'hls_clear', label: 'Landsat + Sentinel-2 · 30 m, pasadas sin nubes', kind: 'scenes', before: 1095, after: 0, damage: true },
      { key: 's2annual', label: 'Sentinel-2 anual · pérdida de bosque', kind: 'annual' },
      { key: 'wayback', label: 'Alta resolución Esri Wayback · cada año', kind: 'annual', from: 2014 },
      { key: 'modis_ndvi', label: 'NDVI mensual', kind: 'monthly', months: 12 },
    ],
    captions: { general: 'Año con año: las zonas verdes que se vuelven café o se fragmentan indican tala, incendios o cambio de uso de suelo.' },
  },
  volcan: {
    title: 'Volcán', icon: 'volcano',
    products: [
      { key: 'hls_clear', label: 'Landsat + Sentinel-2 · 30 m, pasadas sin nubes', kind: 'scenes', before: 60, after: 120 },
      { key: 'viirs_tc', label: 'Color real · columna de ceniza', kind: 'daily', before: 6, after: 12, step: 2 },
      { key: 'modis_721', label: 'Falso color · flujos y zonas calientes', kind: 'daily', before: 12, after: 24, step: 4 },
      { key: 'goes_geo', label: 'GOES GeoColor · últimas horas', kind: 'live' },
    ],
    captions: {
      before: 'Antes de la erupción: el volcán y su entorno.',
      during: 'Erupción: columna de ceniza y gases arrastrados por el viento.',
      after: 'Después: depósitos de ceniza y flujos de lava sobre el terreno.',
      general: 'Sigue la pluma de ceniza y los cambios alrededor del volcán.',
    },
  },
  envivo: {
    title: 'Satélite en vivo', icon: 'sat',
    products: [
      { key: 'goes_geo', label: 'GOES-Este GeoColor · últimas 6 horas', kind: 'live' },
      { key: 'goes_fire', label: 'GOES-Este · temperatura de fuego', kind: 'live' },
    ],
    captions: { general: 'Imagen real de GOES cada 30 minutos (con ~1.5 h de retraso de publicación): nubes, tormentas, humo y fuego en movimiento.' },
  },
};

// Relación con módulos y tipos de evento
export const STORY_FOR_MODULE = { agua: 'inundacion', bosques: 'fuego', agricultura: 'sequia', suelo: 'humedad', hielo: 'hielo', deformacion: 'deformacion' };
export const STORY_FOR_TYPE = { fire: 'fuego', flood: 'inundacion', storm: 'ciclon', quake: 'deformacion', volcano: 'volcan', drought: 'sequia', ice: 'hielo', other: 'fuego' };

// Construye los cuadros de la animación para un producto y una fecha central
export function buildFrames(product, center) {
  const l = GIBS_LAYERS[product.key];
  const lastData = Date.now() - (l.lag ?? 2) * DAY;
  const frames = [];
  if (product.kind === 'live') {
    const end = Date.now() - 100 * 60e3;                 // GOES se publica con ~1.5 h de retraso
    for (let m = 360; m >= 0; m -= 30) {
      const d = new Date(end - m * 60e3); d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 10) * 10, 0, 0);
      const t = d.toISOString().slice(0, 19) + 'Z';
      frames.push({ date: d, label: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), url: gibsTemplate(l.id, t, l.level, l.ext), level: l.level, credit: l.source, key: product.key });
    }
    return frames;
  }
  if (product.kind === 'annual') {
    const to = new Date(lastData).getFullYear() - (product.key === 's2annual' ? 0 : 0);
    const from = product.from || 2016;
    for (let y = from; y <= Math.min(to, product.key === 's2annual' ? 2025 : to); y++) {
      if (product.key === 's2annual' && y === 2017) continue;   // EOX no tiene mosaico 2017
      const date = `${y}-07-01`;
      const i = sideInfo(product.key, date);
      frames.push({ date: new Date(date), label: String(y), url: gibsUrl(product.key, date), level: i.level, credit: i.source, key: i.key, realDate: i.realDate });
    }
    return frames;
  }
  if (product.kind === 'monthly') {
    for (let k = product.months; k >= 0; k--) {
      const d = new Date(lastData - k * 30 * DAY);
      frames.push(frame(product.key, d, d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })));
    }
    return frames;
  }
  // diaria alrededor de la fecha central (sin pasar de la última fecha con datos)
  const c = Math.min(center.getTime(), lastData);
  for (let k = -product.before; k <= product.after; k += product.step) {
    const t = c + k * DAY;
    if (t > lastData) break;
    frames.push(frame(product.key, new Date(t)));
  }
  return frames;
}
function frame(key, d, label) {
  const date = iso(d), i = sideInfo(key, date);
  return { date: d, label: label || d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }), url: gibsUrl(key, date), level: i.level, credit: i.source, key: i.key, realDate: i.realDate };
}

// Fase de un cuadro respecto a la fecha del evento
export function phaseOf(frameDate, eventDate) {
  if (!eventDate) return 'general';
  const diff = (frameDate - eventDate) / DAY;
  if (diff < -2) return 'before';
  if (diff <= 3) return 'during';
  return 'after';
}
export const PHASE_LABEL = { before: 'Antes', during: 'Durante', after: 'Después', general: '', forecast: 'Pronóstico' };

// Cuadros con pasadas reales sin nubes sobre el punto (30 m, sin huecos de órbita)
export async function buildSceneFrames(product, ctx) {
  const center = ctx.date || new Date();
  const from = new Date(center.getTime() - product.before * DAY);
  const to = new Date(Math.min(center.getTime() + product.after * DAY, Date.now()));
  const scenes = spreadScenes(await findClearScenes(ctx.lat, ctx.lon, from, to, 25), 12);
  const frames = scenes.map(s => {
    const d = new Date(s.date + 'T12:00:00');
    return { date: d, label: d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }), url: sceneUrl(s), level: 12,
      credit: 'NASA HLS', key: 'hls_clear', realDate: s.date, sat: s.sat, cloud: s.cloud, overUrl: product.damage ? damageUrl(s.date) : null };
  });
  return { frames, underlay: { url: fillUrl(center.getFullYear()), level: 15, credit: 'EOX Sentinel-2 cloudless' } };
}
