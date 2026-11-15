import { GIBS_LAYERS, gibsUrl, resolveLayer, sideInfo } from './satelliteSources.js';
import { baseTileUrl, gibsTemplate } from './connection.js';

const C = window.Cesium;
let viewer, cmpLayers = [], changeEntities = [], pin;

export function initMap(el) {
  C.Ion.defaultAccessToken = ''; // sin Cesium Ion
  // Más descargas en paralelo por servidor (los CDN usan HTTP/2); Cesium solo pide las teselas visibles
  C.RequestScheduler.maximumRequestsPerServer = 18;
  C.RequestScheduler.throttleRequests = true;
  viewer = new C.Viewer(el, {
    // Capa base rápida y global (NASA Blue Marble) para que el globo nunca quede vacío
    baseLayer: new C.ImageryLayer(new C.UrlTemplateImageryProvider({
      url: gibsTemplate('BlueMarble_ShadedRelief_Bathymetry', '2004-08-01', 8, 'jpeg'),
      credit: 'NASA Blue Marble', maximumLevel: 8,
    })),
    terrainProvider: new C.EllipsoidTerrainProvider(),
    geocoder: false, baseLayerPicker: false, timeline: false, animation: false,
    sceneModePicker: true, navigationHelpButton: false, homeButton: true, fullscreenButton: false,
    infoBox: false, selectionIndicator: false,
    useBrowserRecommendedResolution: false,           // renderiza a la resolución real de la pantalla
    contextOptions: { webgl: { preserveDrawingBuffer: true } },
  });
  // Imagen satelital de alta resolución encima (Esri / Sentinel-2 cloudless vía API local con caché)
  viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
    url: baseTileUrl(), credit: 'Esri World Imagery', maximumLevel: 19,
  }));
  const g = viewer.scene.globe;
  g.enableLighting = false;
  g.maximumScreenSpaceError = 2;     // detalle nítido sin pedir teselas de más
  g.tileCacheSize = 200;
  g.preloadSiblings = false;          // no descargar zonas fuera de la vista
  viewer.scene.skyAtmosphere.show = true;
  viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(-100, 20, 18e6) });
  // El doble clic se usa para cerrar polígonos, no para seguir entidades
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  return viewer;
}

// ---------- Animación (línea de tiempo tipo Windy) ----------
// Todas las capas del recorrido se cargan a la vez (las que no se ven con opacidad mínima),
// así al reproducir no hay espera: solo se cambia cuál está visible.
let frameLayers = [], forecastEnts = [];
let underLayer = null;
export function setFrames(frames, underlay) {
  clearFrames();
  // Relleno común debajo de todos los cuadros (mosaico anual sin nubes) para que no haya huecos
  if (underlay) underLayer = viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({ url: underlay.url, maximumLevel: underlay.level, credit: underlay.credit }));
  frameLayers = frames.map(f => {
    if (!f.url) return null;
    const mk = (url, level) => { const l = viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({ url, maximumLevel: level, credit: f.credit })); l.alpha = 0.01; return l; };
    return { main: mk(f.url, f.level), over: f.overUrl ? clearBlack(mk(f.overUrl, 12)) : null };
  });
}
export function showFrame(i, alpha = 1, showOver = true) {
  frameLayers.forEach((l, k) => { if (!l) return; l.main.alpha = k === i ? alpha : 0.01; if (l.over) l.over.alpha = k === i && showOver ? 0.9 : 0.01; });
}
export function frameLoaded() {
  // proporción de capas con teselas listas (aprox.: el globo informa cuando no hay pendientes)
  return viewer.scene.globe.tilesLoaded;
}
export function clearFrames() {
  frameLayers.forEach(l => { if (!l) return; viewer.imageryLayers.remove(l.main, true); if (l.over) viewer.imageryLayers.remove(l.over, true); }); frameLayers = [];
  if (underLayer) { viewer.imageryLayers.remove(underLayer, true); underLayer = null; }
  clearForecast();
}
export function drawForecast(lat, lon, km, color, label) {
  clearForecast();
  const e = viewer.entities.add({
    position: C.Cartesian3.fromDegrees(lon, lat),
    ellipse: { semiMajorAxis: km * 1000, semiMinorAxis: km * 1000, height: 0,
      material: C.Color.fromCssColorString(color).withAlpha(0.28), outline: true, outlineColor: C.Color.fromCssColorString(color), outlineWidth: 2 },
    label: { text: label, font: '600 14px sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: C.VerticalOrigin.BOTTOM, pixelOffset: new C.Cartesian2(0, -12),
      disableDepthTestDistance: Number.POSITIVE_INFINITY },
  });
  e._noPick = true; forecastEnts.push(e);
}
export function clearForecast() { forecastEnts.forEach(e => viewer.entities.remove(e)); forecastEnts = []; }

// ---------- Zona visible (para filtrar eventos) ----------
export function getViewRect() {
  const r = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
  if (!r) return null;                          // se ve el espacio: vista global
  const d = C.Math.toDegrees;
  const rect = { west: d(r.west), south: d(r.south), east: d(r.east), north: d(r.north) };
  const width = rect.east >= rect.west ? rect.east - rect.west : rect.east + 360 - rect.west;
  return width > 160 ? null : rect;             // casi todo el globo: no filtrar
}
export function onViewChange(cb) {
  viewer.camera.percentageChanged = 0.1;
  viewer.camera.moveEnd.addEventListener(cb);
}

// ---------- Selección: radio automático o polígono dibujado ----------
let selEntities = [];
export function clearSelection() { selEntities.forEach(e => viewer.entities.remove(e)); selEntities = []; }
export function drawRadius(lat, lon, km) {
  clearSelection();
  const e = viewer.entities.add({
    position: C.Cartesian3.fromDegrees(lon, lat),
    ellipse: { semiMajorAxis: km * 1000, semiMinorAxis: km * 1000, height: 0,
      material: C.Color.fromCssColorString('#00CFFF').withAlpha(0.12), outline: true, outlineColor: C.Color.fromCssColorString('#00CFFF'), outlineWidth: 2 },
  });
  e._noPick = true; selEntities.push(e);
}
export function drawPolygon(lonlat) {
  clearSelection();
  const ring = [...lonlat, lonlat[0]].flat();
  const e = viewer.entities.add({
    polygon: { hierarchy: C.Cartesian3.fromDegreesArray(lonlat.flat()), material: C.Color.fromCssColorString('#A855F7').withAlpha(0.18), height: 0 },
    polyline: { positions: C.Cartesian3.fromDegreesArray(ring), width: 2.5, material: C.Color.fromCssColorString('#A855F7') },
  });
  e._noPick = true; selEntities.push(e);
}
export const cameraHeight = () => viewer.camera.positionCartographic.height;
export function flyToLonLat(points, pad = 0.15) {
  const lons = points.map(p => p[0]), lats = points.map(p => p[1]);
  const w = Math.max(...lons) - Math.min(...lons), h = Math.max(...lats) - Math.min(...lats);
  viewer.camera.flyTo({ destination: C.Rectangle.fromDegrees(Math.min(...lons) - w * pad, Math.min(...lats) - h * pad, Math.max(...lons) + w * pad, Math.max(...lats) + h * pad), duration: 1.2 });
}

// Herramienta de dibujo de polígono
let draw = null;
export const isDrawing = () => !!draw;
export function startDraw(onUpdate) {
  stopDraw();
  draw = { pts: [], mouse: null, handler: new C.ScreenSpaceEventHandler(viewer.scene.canvas), onUpdate };
  const toLL = c => { const k = C.Cartographic.fromCartesian(c); return [C.Math.toDegrees(k.longitude), C.Math.toDegrees(k.latitude)]; };
  const live = () => {
    const pts = draw.mouse ? [...draw.pts, draw.mouse] : draw.pts;
    return pts.length ? C.Cartesian3.fromDegreesArray(pts.flat()) : [];
  };
  draw.entity = viewer.entities.add({
    polyline: { positions: new C.CallbackProperty(() => { const p = live(); return p.length > 1 ? [...p, p[0]] : p; }, false), width: 2.5, material: C.Color.fromCssColorString('#A855F7') },
    polygon: { hierarchy: new C.CallbackProperty(() => new C.PolygonHierarchy(live()), false), material: C.Color.fromCssColorString('#A855F7').withAlpha(0.15), height: 0 },
  });
  draw.entity._noPick = true;
  draw.handler.setInputAction(m => {
    const c = viewer.camera.pickEllipsoid(m.position); if (!c) return;
    const p = toLL(c), last = draw.pts[draw.pts.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 1e-6 && Math.abs(last[1] - p[1]) < 1e-6) return; // clic repetido (doble clic)
    draw.pts.push(p); draw.onUpdate?.(draw.pts.length);
  }, C.ScreenSpaceEventType.LEFT_CLICK);
  draw.handler.setInputAction(m => {
    const c = viewer.camera.pickEllipsoid(m.endPosition); draw.mouse = c ? toLL(c) : null;
  }, C.ScreenSpaceEventType.MOUSE_MOVE);
  draw.handler.setInputAction(() => draw.onUpdate?.(draw.pts.length, true), C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}
export function undoDrawPoint() { if (draw?.pts.length) { draw.pts.pop(); draw.onUpdate?.(draw.pts.length); } }
export function stopDraw() {
  if (!draw) return null;
  const pts = draw.pts;
  draw.handler.destroy(); viewer.entities.remove(draw.entity); draw = null;
  return pts;
}

// ---------- Capa del satélite seleccionado (una a la vez) ----------
let satLayer = null;
export function setSatLayer(url, level, credit, alpha = 0.85) {
  clearSatLayer();
  satLayer = viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({ url, maximumLevel: level, credit }));
  satLayer.alpha = alpha;
  return satLayer;
}
export function clearSatLayer() { if (satLayer) { viewer.imageryLayers.remove(satLayer, true); satLayer = null; } }
export function setSatAlpha(a) { if (satLayer) satLayer.alpha = a; }
export function getViewCenter() {
  const c = viewer.camera.pickEllipsoid(new C.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2));
  if (!c) return null;
  const k = C.Cartographic.fromCartesian(c);
  return { lat: C.Math.toDegrees(k.latitude), lon: C.Math.toDegrees(k.longitude), height: viewer.camera.positionCartographic.height };
}

export function flyTo(lat, lon, height = 25000) {
  viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(lon, lat, height), duration: 2 });
  if (pin) viewer.entities.remove(pin);
  pin = viewer.entities.add({
    position: C.Cartesian3.fromDegrees(lon, lat),
    point: { pixelSize: 11, color: C.Color.fromCssColorString('#22e08a'), outlineColor: C.Color.BLACK, outlineWidth: 2 },
  });
}

// ---------- Eventos en vivo (agrupados para que no se encimen) ----------
let eventSource;
const clusterIcon = n => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="19" fill="rgba(0,207,255,.85)" stroke="#fff" stroke-width="2.5"/>` +
  `<text x="22" y="27" font-family="Arial" font-size="${n > 99 ? 12 : 14}" font-weight="700" text-anchor="middle" fill="#04140F">${n}</text></svg>`);
export function setEvents(items) {
  if (!viewer) return;
  // items: [{lon, lat, icon, size, onClick}]
  if (!eventSource) {
    eventSource = new C.CustomDataSource('eventos');
    eventSource.clustering.enabled = true;
    eventSource.clustering.pixelRange = 36;
    eventSource.clustering.minimumClusterSize = 3;
    eventSource.clustering.clusterEvent.addEventListener((ids, cluster) => {
      cluster.label.show = false;
      cluster.billboard.show = true;
      cluster.billboard.image = clusterIcon(ids.length);
      cluster.billboard.width = cluster.billboard.height = ids.length > 50 ? 44 : 36;
      cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    });
    viewer.dataSources.add(eventSource);
  }
  eventSource.entities.suspendEvents();
  eventSource.entities.removeAll();
  items.forEach(it => {
    const e = eventSource.entities.add({
      position: C.Cartesian3.fromDegrees(it.lon, it.lat),
      billboard: { image: it.icon, width: it.size || 24, height: it.size || 24, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    });
    e._onClick = it.onClick;
  });
  eventSource.entities.resumeEvents();
}
export function showEvents(show) { if (eventSource) eventSource.show = show; }

export function onPick(cb) {
  new C.ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(m => {
    if (draw) return;                 // mientras se dibuja, los clics agregan vértices
    const p = viewer.scene.pick(m.position);
    if (p?.id?._onClick) return p.id._onClick();
    if (Array.isArray(p?.id)) {   // clic en un grupo de eventos: acercar para separarlos
      const cs = p.id.map(e => C.Cartographic.fromCartesian(e.position.getValue(viewer.clock.currentTime)));
      const lon = C.Math.toDegrees(cs.reduce((a, c) => a + c.longitude, 0) / cs.length);
      const lat = C.Math.toDegrees(cs.reduce((a, c) => a + c.latitude, 0) / cs.length);
      return viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(lon, lat, Math.max(20000, viewer.camera.positionCartographic.height / 4)), duration: 1.2 });
    }
    if (p?.id?._noPick) return;
    const cart = viewer.camera.pickEllipsoid(m.position);
    if (!cart) return;
    const c = C.Cartographic.fromCartesian(cart);
    cb(C.Math.toDegrees(c.latitude), C.Math.toDegrees(c.longitude));
  }, C.ScreenSpaceEventType.LEFT_CLICK);
}

// Zonas de cambio (solo demo, colores del comparador)
const CLS = { estable: '#2ecc71', perdida: '#e74c3c', agua: '#3498db', sin_datos: '#7f8c8d' };
export function showChange(cambio) {
  changeEntities.forEach(e => viewer.entities.remove(e));
  changeEntities = (cambio?.zonas || []).map(z => viewer.entities.add({
    polygon: {
      hierarchy: C.Cartesian3.fromDegreesArray(z.poligono.flat()),
      material: C.Color.fromCssColorString(CLS[z.clase] || CLS.sin_datos).withAlpha(0.35),
      outline: true, outlineColor: C.Color.fromCssColorString(CLS[z.clase] || CLS.sin_datos),
    },
  }));
}

// Comparador con deslizador (split nativo de Cesium)
// En la capa de daño OPERA DIST el negro significa «sin cambio»: se vuelve transparente para ver la imagen debajo
function clearBlack(layer) { layer.colorToAlpha = C.Color.BLACK; layer.colorToAlphaThreshold = 0.08; return layer; }
export function compareUrls(left, right, splitterEl) {
  // left/right: { url, level, credit }
  clearCompare();
  const mk = (o, dir) => {
    const lyr = viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({ url: o.url, maximumLevel: o.level, credit: o.credit }));
    lyr.splitDirection = dir;
    return lyr;
  };
  // (ver clearBlack)
  // Opcional: capa de relleno debajo (bordes sin datos) y capa resaltada encima (p. ej. daño OPERA DIST)
  const under = [left, right].map((o, k) => o.under && mk(o.under, k ? C.SplitDirection.RIGHT : C.SplitDirection.LEFT)).filter(Boolean);
  cmpLayers = [mk(left, C.SplitDirection.LEFT), mk(right, C.SplitDirection.RIGHT)];
  const over = [left, right].map((o, k) => o.over && clearBlack(mk(o.over, k ? C.SplitDirection.RIGHT : C.SplitDirection.LEFT))).filter(Boolean);
  cmpLayers = [...under, ...cmpLayers, ...over];
  viewer.scene.splitPosition = 0.5;
  splitterEl.style.left = '50%';
  splitterEl.hidden = false;
  if (!splitterEl._bound) {
    splitterEl._bound = true;
    let drag = false;
    const move = x => {
      const r = splitterEl.parentElement.getBoundingClientRect();
      const f = Math.min(0.98, Math.max(0.02, (x - r.left) / r.width));
      splitterEl.style.left = f * 100 + '%';
      viewer.scene.splitPosition = f;
    };
    splitterEl.addEventListener('pointerdown', e => { drag = true; splitterEl.setPointerCapture(e.pointerId); });
    splitterEl.addEventListener('pointermove', e => drag && move(e.clientX));
    splitterEl.addEventListener('pointerup', () => (drag = false));
  }
}
export function compare(key, dateA, dateB, splitterEl, alpha = 1) {
  // Cada lado usa la capa con datos en su fecha (Wayback/Sentinel-2 → VIIRS → MODIS → Landsat WELD)
  const side = d => { const i = sideInfo(key, d); return { ...i, url: gibsUrl(key, d), credit: i.source }; };
  const L = side(dateA), R = side(dateB);
  compareUrls(L, R, splitterEl);
  setCompareAlpha(alpha);
  return { left: L, right: R };
}
export function setCompareAlpha(a) { cmpLayers.forEach(l => (l.alpha = a)); }
// Nivel máximo de teselas a partir de la URL WMTS de GIBS (GoogleMapsCompatible_LevelN)
export const levelFromUrl = url => +((url.match(/Level(\d+)/) || [])[1] || 9);

// ---------- Capas de análisis: huellas SAR, imagen SAR y zonas de riesgo ----------
let sarEntities = [], zoneEntities = [], sarImage = null;
const ringsOf = g => g?.type === 'Polygon' ? g.coordinates : g?.type === 'MultiPolygon' ? g.coordinates.map(p => p[0]) : [];
function addPolygon(ring, fill, alpha, outline, width = 2) {
  const e = viewer.entities.add({
    polygon: {
      hierarchy: C.Cartesian3.fromDegreesArray(ring.flat()),
      material: C.Color.fromCssColorString(fill).withAlpha(alpha),
      height: 0,
    },
    polyline: { positions: C.Cartesian3.fromDegreesArray(ring.flat()), width, material: C.Color.fromCssColorString(outline), clampToGround: false },
  });
  e._noPick = true;
  return e;
}
export function drawSarFootprint(feature) {
  sarEntities.forEach(e => viewer.entities.remove(e)); sarEntities = [];
  if (!feature) return;
  ringsOf(feature.geometry).forEach(r => sarEntities.push(addPolygon(r, '#00CFFF', 0.12, '#00CFFF', 3)));
  const pts = ringsOf(feature.geometry).flat();
  if (pts.length) {
    const lons = pts.map(p => p[0]), lats = pts.map(p => p[1]);
    viewer.camera.flyTo({ destination: C.Rectangle.fromDegrees(Math.min(...lons) - 0.3, Math.min(...lats) - 0.3, Math.max(...lons) + 0.3, Math.max(...lats) + 0.3), duration: 1.5 });
  }
}
export function overlaySarImage(feature) {
  if (sarImage) { viewer.imageryLayers.remove(sarImage, true); sarImage = null; }
  if (!feature) return;
  const pts = ringsOf(feature.geometry).flat();
  if (!pts.length) return;
  const lons = pts.map(p => p[0]), lats = pts.map(p => p[1]);
  const rect = C.Rectangle.fromDegrees(Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats));
  C.SingleTileImageryProvider.fromUrl(feature.properties.browse_url, { rectangle: rect, credit: 'ASF · ' + (feature.properties.platform || 'SAR') })
    .then(pr => { sarImage = viewer.imageryLayers.addImageryProvider(pr); sarImage.alpha = 0.85; })
    .catch(() => {});
  return rect;
}
export function drawRiskZones(fc) {
  zoneEntities.forEach(e => viewer.entities.remove(e)); zoneEntities = [];
  // del anillo exterior al interior para que el núcleo quede encima
  const all = [];
  [...(fc?.features || [])].reverse().forEach(f => {
    const pr = f.properties || {};
    ringsOf(f.geometry).forEach(r => { all.push(...r); zoneEntities.push(addPolygon(r, pr.fill_color || '#ef4444', pr.fill_opacity ?? 0.3, pr.fill_color || '#ef4444', 1.5)); });
  });
  if (all.length) {
    const lons = all.map(p => p[0]), lats = all.map(p => p[1]);
    viewer.camera.flyTo({ destination: C.Rectangle.fromDegrees(Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)), duration: 1.5 });
  }
}
export const clearSar = () => { drawSarFootprint(null); overlaySarImage(null); };
export const clearRisk = () => { zoneEntities.forEach(e => viewer.entities.remove(e)); zoneEntities = []; };
export function clearAnalysis() {
  drawSarFootprint(null); drawRiskZones(null); overlaySarImage(null);
}
export function flyToBounds(b) {
  if (!b) return;
  viewer.camera.flyTo({ destination: C.Rectangle.fromDegrees(b.min_lon, b.min_lat, b.max_lon, b.max_lat), duration: 2 });
}

export function clearCompare() {
  cmpLayers.forEach(l => viewer.imageryLayers.remove(l, true));
  cmpLayers = [];
}

export const getViewer = () => viewer;

export function snapshot() {
  try { viewer.render(); return viewer.scene.canvas.toDataURL('image/jpeg', 0.85); }
  catch { return null; } // CORS de teselas
}

// ---------- Zonas guardadas, sectores de anomalía y capa de índice ----------
const zoneEnts = new Map(), sectorEnts = [];
let indexLayer = null;
export function drawZone(id, ring, color = '#A855F7', label = '') {
  removeZone(id);
  const col = C.Color.fromCssColorString(color);
  const cen = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
  const e = viewer.entities.add({
    polygon: { hierarchy: C.Cartesian3.fromDegreesArray(ring.flat()), material: col.withAlpha(0.12), height: 0 },
    polyline: { positions: C.Cartesian3.fromDegreesArray([...ring, ring[0]].flat()), width: 2.5, material: col, clampToGround: true },
  });
  const top = ring.reduce((m, q) => (q[1] > m[1] ? q : m), ring[0]);
  const t = viewer.entities.add({ position: C.Cartesian3.fromDegrees(cen[0] * 0 + top[0], top[1]),
    label: { text: label, font: '600 13px Inter, sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE, disableDepthTestDistance: Number.POSITIVE_INFINITY, heightReference: C.HeightReference.CLAMP_TO_GROUND,
      verticalOrigin: C.VerticalOrigin.BOTTOM, pixelOffset: new C.Cartesian2(0, -8), showBackground: true, backgroundColor: C.Color.BLACK.withAlpha(0.55) } });
  e._noPick = t._noPick = true;
  zoneEnts.set(id, [e, t]);
}
export function removeZone(id) { (zoneEnts.get(id) || []).forEach(e => viewer.entities.remove(e)); zoneEnts.delete(id); }
export function drawSectors(cells) {
  clearSectors();
  cells.forEach(c => {
    if (!c.level) return;
    const col = C.Color.fromCssColorString(c.level.color);
    // Relleno muy tenue y borde grueso: el color avisa sin tapar la imagen del satélite
    const e = viewer.entities.add({
      polygon: { hierarchy: C.Cartesian3.fromDegreesArray(c.ring.flat()), material: col.withAlpha(0.1), height: 0 },
      polyline: { positions: C.Cartesian3.fromDegreesArray([...c.ring, c.ring[0]].flat()), width: 3, material: col, clampToGround: true },
      position: C.Cartesian3.fromDegrees(c.center[0], c.center[1]),
      label: { text: c.text || `${c.id}\n${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(0)}%`, font: '700 13px Inter, sans-serif', fillColor: C.Color.WHITE,
        outlineColor: C.Color.BLACK, outlineWidth: 4, style: C.LabelStyle.FILL_AND_OUTLINE, disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true, backgroundColor: col.withAlpha(0.75), backgroundPadding: new C.Cartesian2(6, 4),
        distanceDisplayCondition: new C.DistanceDisplayCondition(0, 400000) },
    });
    e._noPick = true; sectorEnts.push(e);
  });
}
export function clearSectors() { sectorEnts.forEach(e => viewer.entities.remove(e)); sectorEnts.length = 0; }
const ringRect = ring => { const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); return C.Rectangle.fromDegrees(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)); };
let indexReq = 0;
export function setIndexLayer(url, ring, alpha = 0.85) {
  clearIndexLayer();
  indexLayer = viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({ url, maximumLevel: 14, tileWidth: 512, tileHeight: 512,
    rectangle: ringRect(ring), credit: 'Sentinel-2 / Landsat · Microsoft Planetary Computer' }));
  indexLayer.alpha = alpha;
}
// Imagen única georreferenciada (vista previa de NISAR) sobre su huella
export async function setImageLayer(url, bbox, alpha = 0.85, credit = 'NISAR · NASA/ISRO · ASF DAAC') {
  clearIndexLayer(); const req = ++indexReq;
  const pr = await C.SingleTileImageryProvider.fromUrl(url, { rectangle: C.Rectangle.fromDegrees(...bbox), credit });
  if (req !== indexReq) return;
  indexLayer = viewer.imageryLayers.addImageryProvider(pr); indexLayer.alpha = alpha;
}
export function setIndexAlpha(a) { if (indexLayer) indexLayer.alpha = a; }
export function clearIndexLayer() { indexReq++; if (indexLayer) { viewer.imageryLayers.remove(indexLayer, true); indexLayer = null; } }
