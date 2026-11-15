import { gibsTemplate } from './connection.js';
// Capas reales y gratuitas de NASA GIBS (sin clave), verificadas en WMTSCapabilities (EPSG:3857).
// lag: días de retraso típico de publicación, para elegir una fecha con datos.
export const GIBS_LAYERS = {
  // Alta resolución para antes/después (se ven nítidas al acercar)
  hls_clear:     { name: 'Landsat + Sentinel-2 · 30 m, pasadas sin nubes', kind: 'scenes', level: 12, lag: 3, start: '2013-04-11', before: 'modis_tc', source: 'NASA HLS (Landsat 8/9 + Sentinel-2)' },
  wayback:       { name: 'Alta resolución · Esri Wayback (2014–hoy)', kind: 'wayback', level: 19, lag: 0, start: '2014-02-20', before: 'modis_tc', source: 'Esri World Imagery Wayback' },
  s2annual:      { name: 'Sentinel-2 anual sin nubes (10 m, 2016–2025)', kind: 'eox', level: 15, lag: 0, start: '2016-01-01', before: 'modis_tc', source: 'Sentinel-2 cloudless · EOX (datos Copernicus)' },
  modis_tc:      { name: 'MODIS Terra · Color real', id: 'MODIS_Terra_CorrectedReflectance_TrueColor', ext: 'jpg', level: 9, lag: 2, start: '2000-02-24', before: 'weld_tc', source: 'NASA GIBS · MODIS Terra' },
  viirs_tc:      { name: 'VIIRS NOAA-20 · Color real', id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', ext: 'jpg', level: 9, lag: 2, start: '2018-01-05', before: 'modis_tc', source: 'NASA GIBS · VIIRS NOAA-20' },
  modis_721:     { name: 'MODIS Terra · Falso color 7-2-1', id: 'MODIS_Terra_CorrectedReflectance_Bands721', ext: 'jpg', level: 9, lag: 2, start: '2000-02-24', before: 'weld_743', source: 'NASA GIBS · MODIS Terra' },
  opera_dswx_s1: { name: 'OPERA · Agua superficial (Sentinel-1 SAR)', id: 'OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1', ext: 'png', level: 12, lag: 3, source: 'NASA JPL OPERA · Sentinel-1' },
  viirs_flood:   { name: 'VIIRS · Inundaciones (2 días)', id: 'VIIRS_Combined_Flood_2-Day', ext: 'png', level: 9, lag: 2, source: 'NASA GIBS · VIIRS Flood' },
  opera_dist:    { name: 'OPERA · Alteración de vegetación (HLS)', id: 'OPERA_L3_DIST-ALERT-HLS_Color_Index', ext: 'png', level: 12, lag: 12, source: 'NASA JPL OPERA · Landsat + Sentinel-2' },
  modis_ndvi:    { name: 'MODIS Terra · NDVI 8 días', id: 'MODIS_Terra_NDVI_8Day', ext: 'png', level: 9, lag: 3, start: '2000-02-24', before: 'weld_ndvi', source: 'NASA GIBS · MODIS NDVI' },
  viirs_ndvi:    { name: 'VIIRS NOAA-21 · NDVI 8 días', id: 'VIIRS_NOAA21_NDVI_8Day', ext: 'png', level: 8, lag: 3, source: 'NASA GIBS · VIIRS NDVI' },
  smap_l3:       { name: 'SMAP · Humedad superficial del suelo', id: 'SMAP_L3_Passive_Enhanced_Day_Soil_Moisture', ext: 'png', level: 6, lag: 4, source: 'NASA SMAP L3' },
  smap_l4:       { name: 'SMAP · Humedad en zona de raíces', id: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', ext: 'png', level: 6, lag: 6, source: 'NASA SMAP L4' },
  modis_snow:    { name: 'MODIS Terra · Cobertura de nieve', id: 'MODIS_Terra_NDSI_Snow_Cover', ext: 'png', level: 8, lag: 2, source: 'NASA GIBS · MODIS Nieve' },
  viirs_seaice:  { name: 'VIIRS NOAA-21 · Hielo marino', id: 'VIIRS_NOAA21_Sea_Ice', ext: 'png', level: 7, lag: 2, source: 'NASA GIBS · VIIRS Hielo marino' },
  weld_tc:       { name: 'Landsat WELD · Color real (histórico)', id: 'Landsat_WELD_CorrectedReflectance_TrueColor_Global_Monthly', ext: 'jpg', level: 12, monthly: true, start: '1984-01-01', end: '2001-11-30', source: 'NASA/USGS Landsat WELD' },
  weld_743:      { name: 'Landsat WELD · Falso color 7-4-3 (histórico)', id: 'Landsat_WELD_CorrectedReflectance_Bands743_Global_Monthly', ext: 'jpg', level: 12, monthly: true, start: '1984-01-01', end: '2001-11-30', source: 'NASA/USGS Landsat WELD' },
  weld_ndvi:     { name: 'Landsat WELD · NDVI (histórico)', id: 'Landsat_WELD_NDVI_Global_Monthly', ext: 'jpg', level: 12, monthly: true, start: '1984-01-01', end: '2001-11-30', source: 'NASA/USGS Landsat WELD' },
  hls_s30:       { name: 'HLS Sentinel-2 · 30 m', id: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance', ext: 'png', level: 12, lag: 9, start: '2015-11-28', source: 'NASA HLS · Sentinel-2' },
  hls_l30:       { name: 'HLS Landsat 8/9 · 30 m', id: 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance', ext: 'png', level: 12, lag: 10, start: '2013-04-11', source: 'NASA HLS · Landsat 8/9' },
  goes_geo:      { name: 'GOES-Este · GeoColor (10 min)', id: 'GOES-East_ABI_GeoColor', ext: 'png', level: 7, live: true, source: 'NOAA GOES-19 ABI' },
  goes_fire:     { name: 'GOES-Este · Temperatura de fuego', id: 'GOES-East_ABI_FireTemp', ext: 'png', level: 7, live: true, source: 'NOAA GOES-19 ABI' },
  smap_l4s:      { name: 'SMAP · Humedad superficial (L4, global)', id: 'SMAP_L4_Analyzed_Surface_Soil_Moisture', ext: 'png', level: 6, lag: 6, start: '2015-03-31', source: 'NASA SMAP L4' },
  opera_rtc:     { name: 'OPERA · Radar Sentinel-1 (RTC)', id: 'OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1', ext: 'png', level: 12, lag: 3, source: 'NASA JPL OPERA · Sentinel-1' },
};

// Qué muestra cada capa y con qué detalle (para la ficha del comparador)
export const LAYER_INFO = {
  hls_clear: { res: '30 m', what: 'Imagen real de Landsat 8/9 o Sentinel-2 del día en que el satélite pasó sobre esta zona con pocas nubes (catálogo NASA CMR). Se ve completa y nítida, sin los huecos de las imágenes diarias. Los bordes que la escena no cubre se rellenan con el mosaico anual de Sentinel-2.' },
  wayback: { res: '0.3–1 m', what: 'Fotografía satelital de muy alta resolución (Maxar, Airbus y otros) tal como estaba publicada en esa fecha. Ideal para ver construcciones, caminos, cuerpos de agua y deforestación local. Si la zona no se actualizó entre dos fechas, ambas imágenes se verán iguales.' },
  s2annual: { res: '10 m', what: 'Mosaico anual de Sentinel-2 sin nubes (Copernicus/ESA). Muestra cómo se veía la superficie ese año: vegetación, agua, zonas quemadas o urbanizadas.' },
  modis_tc: { res: '250 m', what: 'Imagen diaria en color real de MODIS Terra. Útil para nubes, humo, nieve y grandes cambios regionales.' },
  viirs_tc: { res: '375 m', what: 'Imagen diaria en color real de VIIRS (NOAA-20). Cubre el planeta cada día.' },
  modis_721: { res: '500 m', what: 'Falso color 7-2-1: el agua se ve azul oscuro, la vegetación verde y las cicatrices de incendio café rojizo.' },
  modis_ndvi: { res: '250 m', what: 'Índice de vegetación (NDVI) promedio de 8 días. Verde intenso = vegetación densa y sana; café/amarillo = escasa o seca.' },
  viirs_ndvi: { res: '500 m', what: 'Índice de vegetación (NDVI) de 8 días con VIIRS NOAA-21. Verde intenso = vegetación vigorosa.' },
  weld_tc: { res: '30 m (mosaico mensual)', what: 'Archivo histórico Landsat (1984–2001) en color real.' },
  weld_743: { res: '30 m (mosaico mensual)', what: 'Landsat histórico en falso color 7-4-3: el agua se ve oscura y la vegetación verde.' },
  weld_ndvi: { res: '30 m (mosaico mensual)', what: 'NDVI histórico de Landsat (1984–2001).' },
  hls_s30: { res: '30 m', what: 'Imagen armonizada Landsat/Sentinel-2 (HLS) de Sentinel-2. Solo hay datos donde pasó el satélite ese día sin nubes.' },
  hls_l30: { res: '30 m', what: 'Imagen armonizada HLS de Landsat 8/9. Solo hay datos donde pasó el satélite ese día sin nubes.' },
  opera_dswx_s1: { res: '30 m', what: 'Agua superficial detectada con radar Sentinel-1 (OPERA DSWx): azul = agua. Funciona con nubes y de noche.' },
  opera_rtc: { res: '30 m', what: 'Retrodispersión radar Sentinel-1 corregida por relieve (OPERA RTC). Claro = superficie rugosa o construida; oscuro = agua o superficie lisa.' },
  opera_dist: { res: '30 m', what: 'Alerta de alteración de la vegetación (OPERA DIST): colores indican pérdida reciente de cobertura vegetal.' },
  viirs_flood: { res: '375 m', what: 'Inundaciones detectadas por VIIRS en 2 días: zonas con agua fuera de lo normal.' },
  smap_l3: { res: '9 km', what: 'Humedad del suelo superficial (primeros 5 cm) medida por SMAP en banda L.' },
  smap_l4: { res: '9 km', what: 'Humedad en la zona de raíces (0–100 cm), modelo SMAP L4.' },
  smap_l4s: { res: '9 km', what: 'Humedad superficial del suelo SMAP L4, cobertura global sin huecos.' },
  modis_snow: { res: '500 m', what: 'Cobertura de nieve diaria (NDSI) de MODIS Terra.' },
  viirs_seaice: { res: '375 m', what: 'Hielo marino detectado por VIIRS NOAA-21.' },
  goes_geo: { res: '1 km', what: 'Imagen geoestacionaria GeoColor de GOES-Este, actualizada cada 10 minutos.' },
  goes_fire: { res: '2 km', what: 'Temperatura de fuego de GOES-Este: puntos calientes activos.' },
};

// Versiones históricas de Esri Wayback (se cargan una vez)
let wayback = [];
export async function loadWayback() {
  try {
    const j = await fetch('https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json').then(r => r.json());
    wayback = Object.entries(j).map(([id, v]) => ({ id, date: (String(v.itemTitle).match(/(\d{4}-\d{2}-\d{2})/) || [])[1] }))
      .filter(r => r.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  } catch { wayback = []; }
  return wayback.length;
}
function waybackFor(date) {
  if (!wayback.length) return null;
  let r = wayback[0];
  for (const w of wayback) if (w.date <= date) r = w;
  return r;
}
const EOX_YEARS = [2016, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
function eoxYear(date) {
  const y = +date.slice(0, 4);
  return EOX_YEARS.reduce((best, v) => (Math.abs(v - y) < Math.abs(best - y) || (Math.abs(v - y) === Math.abs(best - y) && v <= y) ? v : best), EOX_YEARS[0]);
}

// Módulos de monitoreo: qué proceso muestra, cómo leerlo y qué capas compara.
export const MODULES = [
  { id: 'agua', name: 'Agua y humedales', icon: 'water', color: '#287BFF',
    desc: 'Expansión y retracción de lagos, humedales y llanuras inundables.',
    read: 'En falso color 7-2-1 el agua aparece azul oscuro. Las capas OPERA y VIIRS marcan agua detectada.',
    layers: ['hls_clear', 'wayback', 's2annual', 'opera_dswx_s1', 'modis_721', 'viirs_flood'],
    pending: 'NISAR (banda L) vía ASF Vertex: en integración.' },
  { id: 'bosques', name: 'Bosques e incendios', icon: 'tree', color: '#00E6A0',
    desc: 'Pérdida de cobertura forestal por tala e incendios.',
    read: 'OPERA DIST resalta vegetación alterada. En NDVI, verde intenso = vegetación densa; tonos cafés = escasa.',
    layers: ['hls_clear', 'wayback', 's2annual', 'opera_dist', 'hls_s30', 'hls_l30', 'viirs_tc', 'modis_ndvi'],
    pending: 'Alertas FIRMS (NOAA-20/21) y GOES en tiempo real: en integración.' },
  { id: 'agricultura', name: 'Agricultura', icon: 'sprout', color: '#00FF88',
    desc: 'Cambios en tipo y salud de cultivos a lo largo de la temporada.',
    read: 'El NDVI mide vigor vegetal: verde más intenso = cultivo más sano.',
    layers: ['hls_clear', 'wayback', 's2annual', 'viirs_ndvi', 'modis_ndvi', 'hls_s30', 'hls_l30', 'modis_tc'],
    pending: 'Sentinel-2 a 10 m: en integración.' },
  { id: 'suelo', name: 'Humedad del suelo', icon: 'drop', color: '#00CFFF',
    desc: 'Cómo crece y disminuye la humedad del suelo; señal temprana de sequía.',
    read: 'Azul = suelo más húmedo; café/amarillo = suelo más seco. Resolución regional (~9 km).',
    layers: ['hls_clear', 'wayback', 's2annual', 'smap_l3', 'smap_l4'],
    pending: '' },
  { id: 'hielo', name: 'Hielo y nieve', icon: 'snow', color: '#A5E9FF',
    desc: 'Avance y retroceso de nieve, glaciares y hielo marino.',
    read: 'Las zonas coloreadas indican nieve o hielo detectado ese día.',
    layers: ['hls_clear', 'wayback', 's2annual', 'modis_snow', 'viirs_seaice', 'modis_tc'],
    pending: 'Velocidad de glaciares con SAR: en integración.' },
  { id: 'deformacion', name: 'Deformación del terreno', icon: 'quake', color: '#A855F7',
    desc: 'Hundimientos y movimientos del suelo por sismos, extracción de agua o volcanes.',
    read: 'La capa radar (RTC) muestra la señal Sentinel-1 corregida por relieve. El desplazamiento milimétrico requiere interferometría (InSAR).',
    layers: ['hls_clear', 'wayback', 's2annual', 'opera_rtc', 'modis_tc'],
    pending: 'Desplazamiento InSAR (OPERA DISP / NISAR vía ASF): en integración.' },
];

// Elige la capa con datos para esa fecha: VIIRS (2018+) → MODIS (2000+) → Landsat WELD (1984–2001)
export function resolveLayer(key, date) {
  let k = key, l = GIBS_LAYERS[k];
  while (l?.start && date < l.start && l.before) { k = l.before; l = GIBS_LAYERS[k]; }
  return k;
}
export function layerTime(key, date) {
  const l = GIBS_LAYERS[key];
  if (l.live) return 'default';
  if (l.monthly) { const d = date > l.end ? l.end : date < l.start ? l.start : date; return d.slice(0, 7) + '-01'; }
  return date;
}
export function gibsUrl(key, date) {
  const k = resolveLayer(key, date), l = GIBS_LAYERS[k];
  if (l.kind === 'wayback') {
    const r = waybackFor(date);
    return r ? `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${r.id}/{z}/{y}/{x}`
             : 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  }
  if (l.kind === 'eox') {
    const y = eoxYear(date);
    return `https://tiles.maps.eox.at/wmts/1.0.0/${y === 2016 ? 's2cloudless_3857' : `s2cloudless-${y}_3857`}/default/g/{z}/{y}/{x}.jpg`;
  }
  return gibsTemplate(l.id, layerTime(k, date), l.level, l.ext);
}
// Datos de un lado del comparador: capa usada, fecha real de la imagen, resolución y explicación
export function sideInfo(key, date) {
  const k = resolveLayer(key, date), l = GIBS_LAYERS[k], info = LAYER_INFO[k] || {};
  let realDate = date;
  if (l.kind === 'wayback') realDate = waybackFor(date)?.date || 'actual';
  else if (l.kind === 'eox') realDate = `año ${eoxYear(date)}`;
  else if (l.live) realDate = 'últimos 10 min';
  else if (l.monthly) realDate = layerTime(k, date).slice(0, 7);
  return { key: k, name: l.name, source: l.source, realDate, res: info.res || '—', what: info.what || '', legendId: l.kind ? null : l.id, level: l.level };
}

// Catálogo de satélites: cada uno se conecta a su fuente real
export const SAT_CATALOG = [
  { id: 'goes', name: 'GOES-Este', api: 'NOAA ABI vía NASA GIBS', kind: 'gibs', layers: ['goes_geo', 'goes_fire'], note: 'Imagen geoestacionaria de América cada 10 minutos.' },
  { id: 'firms', name: 'FIRMS VIIRS', api: 'NASA FIRMS vía API local', kind: 'firms', note: 'Focos térmicos de las últimas 24 h (NOAA-21, 375 m).' },
  { id: 'nisar', name: 'NISAR', api: 'ASF Vertex vía API local', kind: 'nisar', note: 'Busca escenas radar de los últimos 60 días en el centro de la vista.' },
  { id: 's1', name: 'Sentinel-1', api: 'NASA OPERA vía GIBS', kind: 'gibs', layers: ['opera_rtc', 'opera_dswx_s1'], note: 'Radar banda C: retrodispersión (RTC) y agua superficial (DSWx). Cobertura por pasada: cambia la fecha si no aparece.' },
  { id: 'hls', name: 'Landsat + Sentinel-2', api: 'NASA HLS vía GIBS', kind: 'gibs', layers: ['hls_s30', 'hls_l30'], note: 'Óptico a 30 m. Solo hay imagen donde el satélite pasó ese día y sin nubes.' },
  { id: 'smap', name: 'SMAP', api: 'NASA SMAP vía GIBS', kind: 'gibs', layers: ['smap_l4s', 'smap_l3'], note: 'Humedad del suelo; azul = húmedo, café = seco (~9 km).' },
  { id: 'modis', name: 'MODIS / VIIRS', api: 'NASA GIBS', kind: 'gibs', layers: ['viirs_tc', 'modis_tc', 'modis_ndvi', 'modis_snow'], note: 'Imagen diaria global; NDVI y nieve.' },
];

let cache;
export async function loadSources() {
  if (!cache) cache = await fetch('/data/fuentes.json').then(r => r.json());
  return cache;
}
