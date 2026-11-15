import { initMap, flyTo, onPick, compare, compareUrls, levelFromUrl, clearCompare, setEvents, showEvents,
  drawSarFootprint, overlaySarImage, drawRiskZones, clearAnalysis, clearSar, clearRisk, flyToBounds,
  setSatLayer, clearSatLayer, setSatAlpha, getViewCenter, getViewRect, onViewChange, drawRadius, drawPolygon,
  clearSelection, cameraHeight, flyToLonLat, startDraw, stopDraw, undoDrawPoint, setCompareAlpha } from './map.js';
import { legendFor } from './legends.js';
import { openPlayer, closePlayer, playerOpen } from './player.js';
import { STORY_FOR_MODULE, STORY_FOR_TYPE } from './animations.js';
import * as Z from './zones.js';
import { findClearScenes, bestScene, sceneUrl, damageUrl, fillUrl } from './scenes.js';
import { detectConnection, conn, viaApi } from './connection.js';
import { search, reverse } from './globalSearch.js';
import { renderEvents, sourceLabel, timeAgo } from './alert.js';
import { downloadReport } from './report.js';
import { GIBS_LAYERS, MODULES, SAT_CATALOG, LAYER_INFO, gibsUrl, resolveLayer, loadWayback } from './satelliteSources.js';
import { getDisasters, getSarAnalysis, getTimeMachine, getRisk, getHealth, syncNow, API_LABEL } from './api.js';
import { typeOf, sev, iconUri, eventDate, coordsOf, sortEvents, TYPE_LIST } from './events.js';
import { renderSar, renderTimeMachine, renderRisk, loading, errorBox } from './analysis.js';

const $ = id => document.getElementById(id);
const iso = d => d.toISOString().slice(0, 10);
const shiftDays = n => iso(new Date(Date.now() - n * 864e5));
const recent = new Date(Date.now() - 2 * 864e5);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

let viewRect = null, allEvents = [], current = null, analysis = null, cmpOn = false, activeModule = MODULES[0], refreshTimer = null;


// Cada módulo se relaciona con un tipo de evento, de modo de la máquina del tiempo y de riesgo
const MODULE_LINK = {
  agua:        { types: ['flood', 'storm'], mode: 'inundaciones_sismos', risk: 'Inundación' },
  bosques:     { types: ['fire'], mode: 'incendios', risk: 'Fuego' },
  agricultura: { types: ['drought'], mode: 'agricultura_sequia', risk: 'Sequía' },
  suelo:       { types: ['drought'], mode: 'agricultura_sequia', risk: 'Sequía' },
  hielo:       { types: ['ice'], mode: 'historico_50_anos', risk: 'Desplazamiento Hielo' },
  deformacion: { types: ['quake', 'volcano'], mode: 'inundaciones_sismos', risk: 'Sismo' },
};

// ---------- Tarjeta de ubicación (búsqueda o clic en el globo) ----------
const mapsUrl = (lat, lon) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
// Utilidades geográficas
const R_KM = 6371;
const rad = d => d * Math.PI / 180;
function distKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}
function polyAreaKm2(pts) {   // área esférica de un polígono [lon, lat]
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [l1, p1] = pts[i], [l2, p2] = pts[(i + 1) % pts.length];
    s += rad(l2 - l1) * (2 + Math.sin(rad(p1)) + Math.sin(rad(p2)));
  }
  return Math.abs(s) * R_KM * R_KM / 2;
}
function inPolygon([x, y], pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const fmtKm2 = a => a >= 100 ? `${Math.round(a).toLocaleString('es-MX')} km²` : `${a.toFixed(1)} km² (${Math.round(a * 100).toLocaleString('es-MX')} ha)`;
// Radio automático según qué tan cerca está la cámara (≈ 12 % del ancho visible)
function autoRadiusKm(height) {
  const km = height / 1000 * 0.12;
  const steps = [0.5, 1, 2, 5, 10, 25, 50, 100, 150];
  return steps.reduce((b, v) => (Math.abs(v - km) < Math.abs(b - km) ? v : b), steps[0]);
}
function eventsListHtml(evs) {
  if (!evs.length) return '<p class="muted">No hay eventos activos dentro de esta zona.</p>';
  return `<ul class="mini-ev">${evs.slice(0, 6).map((f, i) => `<li data-i="${i}"><i style="background:${sev(f.properties.severity).color}"></i>${esc(f.properties.title || typeOf(f.properties.disaster_type).label)}<span>${esc(sourceLabel(f.properties.source))}</span></li>`).join('')}</ul>${evs.length > 6 ? `<p class="muted">… y ${evs.length - 6} más.</p>` : ''}`;
}
function bindMiniEvents(container, evs) { container.querySelectorAll('.mini-ev li').forEach(li => li.onclick = () => analyzeEvent(evs[+li.dataset.i])); }

function showInfo(ctx) {
  current = ctx;
  const z = 8, n = 2 ** z, la = ctx.lat * Math.PI / 180;
  const tx = Math.floor((ctx.lon + 180) / 360 * n), ty = Math.floor((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n);
  const pv = gibsUrl('modis_tc', iso(recent)).replace('{z}', z).replace('{y}', ty).replace('{x}', tx);
  ctx.radius ??= autoRadiusKm(ctx.height || cameraHeight());
  drawRadius(ctx.lat, ctx.lon, ctx.radius);
  const inside = allEvents.filter(f => { const c = coordsOf(f); return c && distKm(ctx, c) <= ctx.radius; });
  const area = Math.PI * ctx.radius ** 2;
  openCard('infoCard');
  $('infoCard').innerHTML = `
    <span class="badge real">ZONA SELECCIONADA</span>
    <h3>${esc(ctx.lugar)}</h3>
    <figure class="preview"><img src="${pv}" alt="Vista previa satelital" loading="lazy" onerror="this.parentElement.remove()"><figcaption>MODIS Terra · ${iso(recent)} · NASA GIBS</figcaption></figure>
    <dl class="kv"><dt>País</dt><dd>${esc(ctx.pais || '—')}</dd><dt>Centro</dt><dd>${ctx.lat.toFixed(4)}, ${ctx.lon.toFixed(4)}</dd>
      <dt>Radio</dt><dd><select id="selRadius">${[0.5, 1, 2, 5, 10, 25, 50, 100, 150].map(v => `<option value="${v}"${v === ctx.radius ? ' selected' : ''}>${v} km</option>`).join('')}</select> <span class="muted">(automático según el acercamiento)</span></dd>
      <dt>Área</dt><dd>${fmtKm2(area)}</dd><dt>Eventos</dt><dd>${inside.length} dentro del radio</dd></dl>
    <div id="selEvents">${eventsListHtml(inside)}</div>
    <div class="actions">
      <button id="btnAnalyzeHere" class="primary">Analizar zona (${esc(activeModule.name)})</button>
      <button id="btnCompareHere" class="ghost">Antes / después aquí</button>
      <button id="btnVegHere" class="ghost">Índices de vegetación</button>
      <a class="btn-link ghost" href="${mapsUrl(ctx.lat, ctx.lon)}" target="_blank" rel="noopener">Cómo llegar</a>
      <button id="btnClearSel" class="ghost">Quitar selección</button>
    </div>
    <p class="muted">Haz clic en otro punto para mover la zona, o usa la herramienta de polígono para dibujar una zona exacta.</p>`;
  bindMiniEvents($('selEvents'), inside);
  $('selRadius').onchange = () => { ctx.radius = +$('selRadius').value; showInfo(ctx); };
  $('btnAnalyzeHere').onclick = () => analyzePoint({
    lat: ctx.lat, lon: ctx.lon, title: ctx.lugar, country: ctx.pais,
    riskType: MODULE_LINK[activeModule.id].risk, mode: MODULE_LINK[activeModule.id].mode, source: `Zona de ${ctx.radius} km`,
  });
  $('btnCompareHere').onclick = () => {
    const d = ctx.radius / 111.32, dl = d / Math.max(Math.cos(rad(ctx.lat)), 0.1);
    flyToLonLat([[ctx.lon - dl, ctx.lat - d], [ctx.lon + dl, ctx.lat + d]], 0.05);
    if (cmpOn) stopCompare(); startModuleCompare();
  };
  $('btnClearSel').onclick = clearZone;
  $('btnVegHere').onclick = () => { try { const z = Z.zoneFromCircle(ctx.lat, ctx.lon, ctx.radius, ctx.lugar?.split(',')[0]); clearSelection(); Z.computeIndices(z.id).catch(() => {}); } catch (e) { alert(e.message); } };
}
function clearZone() {
  clearSelection(); current = null;
  $('infoCard').innerHTML = '<p class="muted">Haz clic en el mapa, busca un lugar o dibuja una zona.</p>';
}
async function goLocation(lat, lon, name, country, height) {
  if (height) flyTo(lat, lon, height);
  showInfo({ lugar: name, pais: country, lat, lon, height: height || cameraHeight() });
}

// ---------- Zona dibujada (polígono) ----------
function showZone(pts) {
  drawPolygon(pts);
  const area = polyAreaKm2(pts);
  let per = 0; for (let i = 0; i < pts.length; i++) per += distKm({ lon: pts[i][0], lat: pts[i][1] }, { lon: pts[(i + 1) % pts.length][0], lat: pts[(i + 1) % pts.length][1] });
  const cen = { lon: pts.reduce((a, p) => a + p[0], 0) / pts.length, lat: pts.reduce((a, p) => a + p[1], 0) / pts.length };
  const inside = allEvents.filter(f => { const c = coordsOf(f); return c && inPolygon([c.lon, c.lat], pts); });
  current = { lugar: 'Zona dibujada', lat: cen.lat, lon: cen.lon, polygon: pts };
  openCard('infoCard');
  $('infoCard').innerHTML = `
    <span class="badge real" style="--st:#A855F7">POLÍGONO</span>
    <h3>Zona dibujada</h3>
    <dl class="kv"><dt>Vértices</dt><dd>${pts.length}</dd><dt>Área</dt><dd>${fmtKm2(area)}</dd>
      <dt>Perímetro</dt><dd>${per.toFixed(1)} km</dd><dt>Centro</dt><dd>${cen.lat.toFixed(4)}, ${cen.lon.toFixed(4)}</dd>
      <dt>Eventos</dt><dd>${inside.length} dentro de la zona</dd></dl>
    <div id="zoneEvents">${eventsListHtml(inside)}</div>
    <div class="actions">
      <button id="zoneAnalyze" class="primary">Analizar zona (${esc(activeModule.name)})</button>
      <button id="zoneCompare" class="ghost">Antes / después aquí</button>
      <button id="zoneRedraw" class="ghost">Dibujar otra</button>
      <button id="zoneClear" class="ghost">Borrar zona</button>
    </div>`;
  bindMiniEvents($('zoneEvents'), inside);
  $('zoneAnalyze').onclick = () => analyzePoint({ lat: cen.lat, lon: cen.lon, title: `Zona dibujada (${fmtKm2(area)})`,
    riskType: MODULE_LINK[activeModule.id].risk, mode: MODULE_LINK[activeModule.id].mode, source: 'Polígono del usuario' });
  $('zoneCompare').onclick = () => { flyToLonLat(pts, 0.1); if (cmpOn) stopCompare(); startModuleCompare(); };
  $('zoneRedraw').onclick = beginDraw;
  $('zoneClear').onclick = clearZone;
  flyToLonLat(pts, 0.25);
}
function beginDraw() {
  clearSelection();
  $('drawBar').hidden = false; $('drawBtn').classList.add('on');
  $('drawMsg').textContent = 'Haz clic en el mapa para marcar los vértices de la zona (mínimo 3). Doble clic o «Terminar zona» para cerrar.';
  startDraw((n, finish) => {
    $('drawMsg').textContent = n < 3 ? `${n} punto(s). Marca al menos 3.` : `${n} puntos. Doble clic o «Terminar zona» para cerrar.`;
    if (finish) endDraw(true);
  });
}
function endDraw(keep) {
  const pts = stopDraw();
  $('drawBar').hidden = true; $('drawBtn').classList.remove('on');
  if (keep && pts && pts.length >= 3) {
    showZone(pts);
    try { Z.addZone(pts, { name: drawName, kind: 'dibujada a mano' }); clearSelection(); } catch (e) { $('drawMsg').textContent = e.message; }
  }
  drawName = null; drawResolve?.(pts && pts.length >= 3 && keep); drawResolve = null;
}
let drawName = null, drawResolve = null;
$('drawBtn').onclick = () => (isDrawingNow() ? endDraw(false) : beginDraw());
const isDrawingNow = () => !$('drawBar').hidden;
$('drawDone').onclick = () => endDraw(true);
$('drawCancel').onclick = () => endDraw(false);
$('drawUndo').onclick = undoDrawPoint;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && isDrawingNow()) endDraw(false); });

function openCard(id) {
  document.body.classList.remove('hide-right');
  $(id).closest('.glass-card').classList.remove('collapsed');
}

// ---------- Búsqueda ----------
$('searchForm').onsubmit = async e => {
  e.preventDefault();
  const q = $('searchInput').value.trim(), ul = $('searchResults');
  if (!q) return;
  ul.hidden = false; ul.innerHTML = '<li class="muted">Buscando…</li>';
  try {
    const rs = await search(q);
    ul.innerHTML = rs.length ? '' : '<li class="muted">Sin resultados.</li>';
    rs.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r.name;
      li.onclick = () => { ul.hidden = true; goLocation(r.lat, r.lon, r.name, r.country, /^Coordenadas/.test(r.name) ? 30000 : 120000); };
      ul.appendChild(li);
    });
  } catch (err) { ul.innerHTML = `<li class="muted">${err.message}</li>`; }
};
document.addEventListener('click', e => { if (!$('searchForm').contains(e.target)) $('searchResults').hidden = true; });
// ---------- Comparador (capas del módulo o máquina del tiempo del evento) ----------
$('dateB').value = iso(recent);
$('dateA').value = iso(new Date(recent.getTime() - 365 * 864e5));
function setCmpButton(on) { cmpOn = on; $('btnCompare').textContent = on ? 'Desactivar' : 'Activar'; $('compareLabels').hidden = !on; }
function stopCompare() { clearCompare(); $('splitter').hidden = true; $('cmpInfo').hidden = true; setCmpButton(false); }
async function sideHtml(title, i) {
  const lg = await legendFor(i.legendId);
  return `<h4>${title} · ${esc(i.realDate)}</h4>
    <dl class="kv"><dt>Producto</dt><dd>${esc(i.name)}</dd><dt>Fuente</dt><dd>${esc(i.source)}</dd><dt>Resolución</dt><dd>${esc(i.res)}</dd></dl>
    <p class="muted">${esc(i.what)}</p>${lg?.legend ? `<img class="legend-img" src="${lg.legend}" alt="Leyenda de colores">` : ''}`;
}
async function fillCmpInfo(L, R) {
  $('cmpInfo').hidden = false;
  $('cmpSummary').textContent = `¿Qué estás viendo? · ${L.realDate} → ${R.realDate} · ${L.res === R.res ? L.res : L.res + ' / ' + R.res} por píxel`;
  $('cmpInfoL').innerHTML = await sideHtml('Antes', L);
  $('cmpInfoR').innerHTML = await sideHtml('Después', R);
  const coarse = [L, R].some(i => i.level <= 9);
  $('cmpTip').textContent = coarse
    ? `La resolución nativa de esta capa es de ${[L.res, R.res].filter((v, k, a) => a.indexOf(v) === k).join(' / ')} por píxel: al acercar mucho se verá pixelada. Para ver detalle elige «Alta resolución · Esri Wayback» o «Sentinel-2 anual», o baja la opacidad para ver el mapa debajo.`
    : 'Imágenes de alta resolución: puedes acercar hasta nivel de calle. Arrastra la barra central para comparar.';
}
$('cmpAlpha').oninput = () => setCompareAlpha($('cmpAlpha').value / 100);

// Comparación con pasadas reales sin nubes (Landsat 8/9 + Sentinel-2, 30 m) sobre la zona
let sceneReq = 0;
async function startSceneCompare() {
  const req = ++sceneReq;
  const c = current || getViewCenter();
  if (!c) { $('cmpInfo').hidden = false; $('cmpSummary').textContent = 'Acerca el mapa a una zona para buscar imágenes.'; return; }
  if (cameraHeight() > 400000) flyTo(c.lat, c.lon, 60000);
  setCmpButton(true);
  $('cmpInfo').hidden = false; $('cmpSummary').textContent = 'Buscando pasadas de Landsat y Sentinel-2 sin nubes sobre esta zona…';
  const a = new Date($('dateA').value), b = new Date($('dateB').value);
  const scenes = await findClearScenes(c.lat, c.lon, new Date(a.getTime() - 150 * 864e5), b, 30);
  if (req !== sceneReq || !cmpOn) return;
  const sa = bestScene(scenes, a), sb = bestScene(scenes, b);
  if (!sa || !sb || sa.date === sb.date) {
    $('cmpSummary').textContent = 'No hay pasadas sin nubes en esas fechas para esta zona. Usando el mosaico anual de Sentinel-2.';
    $('cmpLayer').value = 's2annual'; setCmpButton(false); return startModuleCompare();
  }
  const side = s => ({ url: sceneUrl(s), level: 12, credit: 'NASA HLS', under: { url: fillUrl(+s.date.slice(0, 4)), level: 15, credit: 'EOX' } });
  const L = side(sa), R = side(sb);
  if ($('cmpDamage').checked) R.over = { url: damageUrl(sb.date), level: 12, credit: 'NASA OPERA DIST' };
  compareUrls(L, R, $('splitter'));
  setCompareAlpha($('cmpAlpha').value / 100);
  const place = current?.lugar?.split(',')[0] || 'Vista actual';
  $('lblLeft').innerHTML = `<b>Antes · ${sa.date}</b><br>${sa.sat} · ${sa.cloud}% nubes<br>${esc(place)}`;
  $('lblRight').innerHTML = `<b>Después · ${sb.date}</b><br>${sb.sat} · ${sb.cloud}% nubes<br>${esc(place)}`;
  const info = s => ({ name: `${s.sat} (NASA HLS)`, source: `Pasada del ${s.date} · ${s.cloud}% de nubes`, realDate: s.date, res: '30 m',
    what: LAYER_INFO.hls_clear.what, legendId: null, level: 12 });
  await fillCmpInfo(info(sa), info(sb));
  $('cmpSummary').textContent = `¿Qué estás viendo? · ${sa.sat} ${sa.date} → ${sb.sat} ${sb.date} · 30 m · ${scenes.length} pasadas despejadas disponibles`;
  $('cmpTip').textContent = $('cmpDamage').checked
    ? 'Resaltado OPERA DIST (derecha): los colores marcan vegetación dañada o perdida detectada por NASA en esa pasada.'
    : 'Imágenes reales de 30 m del día en que pasó el satélite. Activa «Resaltar daño» para ver la pérdida de vegetación detectada por NASA OPERA.';
}
$('cmpDamage').onchange = () => { if (cmpOn) { stopCompare(); startModuleCompare(); } };
$('cmpInfoHead').onclick = () => $('cmpInfo').classList.toggle('collapsed');
function startModuleCompare() {
  if (resolveLayer($('cmpLayer').value, $('dateB').value) === 'hls_clear') return startSceneCompare();
  const k = $('cmpLayer').value, place = current?.lugar?.split(',')[0] || 'Vista actual';
  const used = compare(k, $('dateA').value, $('dateB').value, $('splitter'), $('cmpAlpha').value / 100);
  $('lblLeft').innerHTML = `<b>Antes · ${esc(used.left.realDate)}</b><br>${esc(used.left.name)}<br>${esc(place)}`;
  $('lblRight').innerHTML = `<b>Después · ${esc(used.right.realDate)}</b><br>${esc(used.right.name)}<br>${esc(place)}`;
  fillCmpInfo(used.left, used.right);
  setCmpButton(true);
}
$('btnCompare').onclick = () => {
  if (cmpOn) return stopCompare();
  if (analysis) return selectTab('tm', true);   // con evento abierto: máquina del tiempo del backend
  startModuleCompare();
};
['dateA', 'dateB'].forEach(id => $(id).onchange = () => {
  if (!cmpOn) return;
  if (analysis && analysis.tab === 'tm') return runTimeMachine();
  stopCompare(); startModuleCompare();
});

$('cmpPreset').onchange = () => {
  const v = $('cmpPreset').value; if (!v) return;
  const b = new Date($('dateB').value);
  $('dateA').value = v.length === 10 ? v : iso(new Date(b.getFullYear() - +v, b.getMonth(), b.getDate()));
  $('cmpPreset').value = '';
  if (cmpOn) $('dateA').onchange(); else $('btnCompare').click();
};

// ---------- Módulos de monitoreo ----------
function setLayerDates() {
  const b = shiftDays(GIBS_LAYERS[$('cmpLayer').value].lag);
  $('dateB').value = b; $('dateB').max = $('dateA').max = b;
  $('dateA').value = iso(new Date(new Date(b).getTime() - 365 * 864e5));
}
function selectModule(id) {
  if (playerOpen()) closePlayer();
  const m = activeModule = MODULES.find(x => x.id === id) || MODULES[0];
  closeAnalysis();
  document.querySelectorAll('#moduleBar button').forEach(b => b.classList.toggle('active', b.dataset.mod === m.id));
  document.body.dataset.module = m.id;
  const sel = $('cmpLayer'); sel.innerHTML = ''; sel.disabled = false;
  m.layers.forEach(k => sel.add(new Option(GIBS_LAYERS[k].name, k)));
  setLayerDates();
  $('moduleCard').innerHTML = `
    <h3 style="color:${m.color}">${m.name}</h3>
    <p>${m.desc}</p>
    <p class="muted"><b>Cómo leerlo:</b> ${m.read}</p>
    <ul class="src-status">${m.layers.map(k => `<li><i class="dot-st on"></i><b>${GIBS_LAYERS[k].name.split(' · ')[0]}</b><span>${GIBS_LAYERS[k].source}</span></li>`).join('')}
    ${m.pending ? `<li><i class="dot-st"></i><b>Pendiente</b><span>${m.pending}</span></li>` : ''}</ul>
    <p class="note">Elige dos fechas y pulsa <b>Activar</b> para comparar antes/después.</p>`;
  document.querySelector('.compare-bar .legend').innerHTML = `<span><i style="background:${m.color}"></i>${m.name}</span><span>Izquierda: fecha inicial · Derecha: fecha final</span>`;
  $('evFilter').value = 'mod';
  $('evFilter').options[1].textContent = `Del módulo: ${m.name}`;
  paintEvents();
}
$('cmpLayer').addEventListener('change', () => { setLayerDates(); if (cmpOn) { stopCompare(); startModuleCompare(); } });
document.querySelectorAll('#moduleBar button').forEach(b => b.onclick = () => selectModule(b.dataset.mod));

// ---------- 1. Monitoreo global en vivo ----------
function filteredEvents() {
  const f = $('evFilter').value, s = $('evSeverity').value;
  const okType = e => { const k = typeOf(e.properties.disaster_type).key; if (f.startsWith('src:')) return e.properties.source === f.slice(4); return f === 'all' || (f === 'mod' ? MODULE_LINK[activeModule.id].types.includes(k) : k === f); };
  return sortEvents(allEvents.filter(e => okType(e) && (!s || e.properties.severity === s)));
}
function inView(f) {
  if (!viewRect || !$('evInView').checked) return true;
  const c = coordsOf(f); if (!c) return false;
  const r = viewRect, inLon = r.east >= r.west ? c.lon >= r.west && c.lon <= r.east : c.lon >= r.west || c.lon <= r.east;
  return inLon && c.lat >= r.south && c.lat <= r.north;
}
function paintList() {
  const all = filteredEvents(), list = all.filter(inView);
  renderEvents($('alertList'), list, analyzeEvent);
  $('alertCount').textContent = list.length;
  $('evViewInfo').textContent = !$('evInView').checked ? '' : viewRect ? `(${list.length} de ${all.length})` : '(vista global)';
  if (!list.length && all.length) $('alertList').insertAdjacentHTML('beforeend', viewRect && $('evInView').checked
    ? '<li class="muted">No hay eventos en la zona visible. Aleja el mapa o desmarca «Solo la zona visible».</li>'
    : '<li class="muted">Prueba con «Todos los tipos» para ver los demás eventos.</li>');
}
function paintEvents() {
  const list = filteredEvents();
  setEvents(list.map(f => { const c = coordsOf(f); return c && { ...c, icon: iconUri(typeOf(f.properties.disaster_type).key, f.properties.severity), size: f.properties.severity === 'alta' ? 26 : 22, onClick: () => analyzeEvent(f) }; }).filter(Boolean));
  paintList();
}
$('evInView').onchange = paintList;
function setApiStatus(ok, msg) {
  ['apiStatus', 'cfgApiDot'].forEach(id => { const el = $(id); if (el) { el.className = ok ? 'dot-st on' : 'dot-st'; el.title = msg; } });
  if ($('cfgApiText')) $('cfgApiText').textContent = msg;
}
async function refreshEvents() {
  $('alertsUpdated').textContent = 'actualizando…';
  try {
    const fc = await getDisasters();
    allEvents = (fc.features || []).filter(f => coordsOf(f));
    paintEvents();
    $('alertsUpdated').textContent = 'act. ' + new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    setApiStatus(true, `Conectada · ${allEvents.length} eventos${conn.mode === 'direct' ? ' · sin caché de teselas (reinicia con npm run dev)' : ''}`);
  } catch (err) {
    $('alertList').innerHTML = `<li class="muted">${esc(err.message)}</li>`;
    $('alertsUpdated').textContent = 'sin conexión';
    setApiStatus(false, err.message);
  }
}
$('evFilter').add(new Option('Del módulo', 'mod'), 1);
TYPE_LIST.forEach(t => $('evFilter').add(new Option(t.label, t.key)));
$('evFilter').add(new Option('Solo NASA FIRMS (focos térmicos)', 'src:NASA_FIRMS'));
$('evFilter').onchange = $('evSeverity').onchange = paintEvents;
$('evRefresh').onclick = refreshEvents;

// ---------- Análisis del evento: pestañas exclusivas (cada una pinta solo sus capas) ----------
function analyzeEvent(f) {
  const c = coordsOf(f), p = f.properties || {}, t = typeOf(p.disaster_type);
  analyzePoint({ lat: c.lat, lon: c.lon, title: p.title || t.label, riskType: p.disaster_type || t.risk, mode: t.mode,
    source: sourceLabel(p.source), severity: p.severity, date: eventDate(p), typeLabel: t.label, typeKey: t.key });
}

function analyzePoint(ev) {
  if (playerOpen()) closePlayer();
  analysis = ev; ev.tab = null;
  clearAnalysis(); stopCompare();
  openCard('analysisCard');
  const s = ev.severity ? sev(ev.severity) : null;
  $('analysisCard').innerHTML = `
    <div class="an-head">
      ${s ? `<span class="badge st" style="--st:${s.color}">${esc(ev.typeLabel)} · ${s.label}</span>` : ''}
      <h3>${esc(ev.title)}</h3>
      <div class="a-meta">${ev.lat.toFixed(4)}, ${ev.lon.toFixed(4)} · ${esc(ev.source)}${ev.date ? ' · ' + ev.date.toLocaleDateString('es-MX') + ' (' + timeAgo(ev.date) + ')' : ''}</div>
    </div>
    <div class="an-tabs" role="tablist">
      <button role="tab" data-tab="sar">Radar SAR</button>
      <button role="tab" data-tab="tm">Antes / Después</button>
      <button role="tab" data-tab="risk">Riesgo</button>
    </div>
    <div id="anBody"><p class="muted">Elige una sección. Solo se mostrarán en el mapa las capas de la sección que abras.</p></div>
    <button id="anAnim" class="anim-btn wide"><svg class="ic" aria-hidden="true"><use href="#i-play"/></svg> Ver animación: antes, durante, después y pronóstico</button>
    <div class="actions"><button id="anPdf" class="primary">Reporte PDF</button>
      <a class="btn-link ghost" href="${mapsUrl(ev.lat, ev.lon)}" target="_blank" rel="noopener">Cómo llegar</a>
      <button id="anClose" class="ghost">Cerrar análisis</button></div>`;
  $('analysisCard').querySelectorAll('.an-tabs button').forEach(b => b.onclick = () => selectTab(b.dataset.tab));
  $('anPdf').onclick = () => reportAnalysis();
  $('anAnim').onclick = () => startAnimation();
  $('anClose').onclick = () => closeAnalysis(true);
  // Fechas del comparador: después = fecha del evento (o la más reciente con datos); antes = 60 días previos
  const after = ev.date && ev.date < recent ? ev.date : recent;
  $('dateB').value = iso(after);
  $('dateA').value = iso(new Date(after.getTime() - 60 * 864e5));
  $('cmpLayer').innerHTML = '<option>Máquina del tiempo · evento</option>'; $('cmpLayer').disabled = true;
  flyTo(ev.lat, ev.lon, 80000);
}

function closeAnalysis(restoreModule = false) {
  if (!analysis) return;
  analysis = null; clearAnalysis(); stopCompare();
  $('analysisCard').innerHTML = '<p class="muted">Haz clic en un evento del mapa o de la lista para analizarlo.</p>';
  if (restoreModule) selectModule(activeModule.id);
}

function selectTab(tab, fromCompareBar = false) {
  const ev = analysis; if (!ev) return;
  ev.tab = tab;
  $('analysisCard').querySelectorAll('.an-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  // Apaga las capas de las otras secciones para que no se encimen
  clearSar(); clearRisk(); stopCompare();
  const body = $('anBody');
  if (tab === 'sar') {
    body.innerHTML = loading('Buscando escenas NISAR / Sentinel-1 / ALOS en ASF…');
    const draw = fc => { if (analysis !== ev || ev.tab !== 'sar') return; renderSar(body, fc, { onSelect: f => drawSarFootprint(f), onOverlay: f => overlaySarImage(f) }); };
    (ev.sarP ||= getSarAnalysis(ev.lat, ev.lon).then(fc => (ev.sar = fc)).catch(e => { ev.sarP = null; throw e; }))
      .then(draw).catch(e => { if (ev.tab === 'sar') body.innerHTML = errorBox(e.message); });
  } else if (tab === 'tm') {
    body.innerHTML = `
      <div class="tm-ctl"><select id="tmMode">
        <option value="incendios">Incendios</option><option value="inundaciones_sismos">Inundaciones y sismos</option>
        <option value="agricultura_sequia">Agricultura y sequía</option><option value="atmosfera_volcanes">Atmósfera y volcanes</option>
        <option value="historico_50_anos">Histórico 50 años</option></select>
        <button id="tmRun" class="ghost sm">Actualizar</button></div>
      <p class="note">Las fechas se eligen en la barra «Comparar imágenes».</p>
      <div id="anTm"></div>`;
    $('tmMode').value = ev.tmMode || ev.mode;
    $('tmMode').onchange = $('tmRun').onclick = () => { ev.tmMode = $('tmMode').value; runTimeMachine(); };
    runTimeMachine(true);
  } else if (tab === 'risk') {
    body.innerHTML = loading('Calculando proyección de riesgo…');
    (ev.riskP ||= getRisk(ev.lat, ev.lon, ev.riskType, 30).then(r => (ev.risk = r)).catch(e => { ev.riskP = null; throw e; }))
      .then(r => { if (analysis !== ev || ev.tab !== 'risk') return; drawRiskZones(r.projected_zones_geojson); renderRisk(body, r); })
      .catch(e => { if (ev.tab === 'risk') body.innerHTML = errorBox(e.message); });
  }
}

async function runTimeMachine(fly = false) {
  const ev = analysis; if (!ev) return;
  const box = $('anTm'); if (box) box.innerHTML = loading('Preparando capas antes/después…');
  try {
    const tm = await getTimeMachine(ev.lat, ev.lon, $('dateA').value, $('dateB').value, ev.tmMode || ev.mode);
    if (analysis !== ev || ev.tab !== 'tm') return;
    ev.tm = tm;
    const place = ev.title.split(',')[0];
    compareUrls({ url: viaApi(tm.before_tile_url), level: levelFromUrl(tm.before_tile_url), credit: 'NASA GIBS' },
                { url: viaApi(tm.after_tile_url), level: levelFromUrl(tm.after_tile_url), credit: 'NASA GIBS' }, $('splitter'));
    $('lblLeft').innerHTML = `<b>${esc(tm.dates.before_date)}</b><br>${esc(tm.tiles?.before?.layer_id || '')}<br>${esc(place)}`;
    $('lblRight').innerHTML = `<b>${esc(tm.dates.after_date)}</b><br>${esc(tm.tiles?.after?.layer_id || '')}<br>${esc(place)}`;
    setCmpButton(true);
    setCompareAlpha($('cmpAlpha').value / 100);
    const tmSide = (side, date) => {
      const id = tm.tiles?.[side]?.layer_id, key = Object.keys(GIBS_LAYERS).find(k => GIBS_LAYERS[k].id === id), info = LAYER_INFO[key] || {};
      return { name: key ? GIBS_LAYERS[key].name : id, source: 'NASA GIBS', realDate: date, res: info.res || (id?.startsWith('VIIRS') ? '375 m' : id?.startsWith('Landsat') ? '30 m' : '250–500 m'),
        what: info.what || tm.mode_title, legendId: id, level: levelFromUrl(tm[side + '_tile_url']) };
    };
    fillCmpInfo(tmSide('before', tm.dates.before_date), tmSide('after', tm.dates.after_date));
    renderTimeMachine($('anTm'), tm);
    if (fly) flyToBounds(tm.bounding_box);
  } catch (e) { if ($('anTm')) $('anTm').innerHTML = errorBox(e.message); }
}

// ---------- Animación (línea de tiempo tipo Windy) ----------
function startAnimation() {
  stopCompare(); clearSar(); clearRisk();
  const link = MODULE_LINK[activeModule.id];
  let ctx;
  if (analysis) {
    ctx = { lat: analysis.lat, lon: analysis.lon, date: analysis.date || null, riskType: analysis.riskType, title: analysis.title,
      storyKey: STORY_FOR_TYPE[analysis.typeKey] || STORY_FOR_MODULE[activeModule.id] };
  } else {
    const c = current || getViewCenter();
    ctx = { lat: c?.lat ?? null, lon: c?.lon ?? null, date: null, riskType: link.risk, title: current?.lugar || 'Vista actual del mapa',
      storyKey: STORY_FOR_MODULE[activeModule.id] };
  }
  openPlayer(ctx);
}
$('btnAnimate').onclick = startAnimation;

// ---------- Reportes (con datos reales del análisis) ----------
async function reportAnalysis() {
  const ev = analysis; if (!ev) return;
  const btn = $('anPdf'); btn.disabled = true; btn.textContent = 'Generando…';
  try {
    // Completa lo que falte (riesgo, máquina del tiempo, SAR) antes de generar el PDF
    const [risk, tm, sar] = await Promise.all([
      ev.risk || getRisk(ev.lat, ev.lon, ev.riskType, 30).then(r => (ev.risk = r)).catch(() => null),
      ev.tm || getTimeMachine(ev.lat, ev.lon, $('dateA').value, $('dateB').value, ev.tmMode || ev.mode).then(t => (ev.tm = t)).catch(() => null),
      ev.sar || getSarAnalysis(ev.lat, ev.lon).then(s => (ev.sar = s)).catch(() => null),
    ]);
    const tl = risk?.timeline_projection?.find(d => d.days === 30);
    const fuentes = [ev.source, 'NASA GIBS'];
    (sar?.features || []).forEach(f => { const k = `${f.properties.platform} ${f.properties.processingLevel} (ASF)`; if (!fuentes.includes(k)) fuentes.push(k); });
    downloadReport({
      lugar: ev.title, pais: ev.country || '', lat: ev.lat, lon: ev.lon,
      fecha_inicio: tm?.dates?.before_date, fecha_fin: tm?.dates?.after_date,
      hectareas: tl?.hectareas_en_riesgo, prob: risk?.risk_score, causa: ev.typeLabel || ev.riskType, fuentes,
    });
  } finally { btn.disabled = false; btn.textContent = 'Reporte PDF'; }
}

// ---------- Configuración ----------
function applyRefresh(min) {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshEvents, min * 60 * 1000);
  store.set('tp-refresh', String(min));
}
$('cfgRefresh').value = store.get('tp-refresh', '10');
$('cfgRefresh').onchange = () => applyRefresh(+$('cfgRefresh').value);
$('cfgShowEvents').checked = store.get('tp-show-events', '1') === '1';
$('cfgShowEvents').onchange = () => { showEvents($('cfgShowEvents').checked); store.set('tp-show-events', $('cfgShowEvents').checked ? '1' : '0'); };
$('cfgTest').onclick = async () => {
  $('cfgApiText').textContent = 'Probando…';
  await detectConnection();
  try { await getHealth(); setApiStatus(true, CONN_TXT[conn.mode]); } catch (e) { setApiStatus(false, CONN_TXT.offline); }
};
$('cfgSync').onclick = async () => {
  const b = $('cfgSync'); b.disabled = true; $('cfgSyncMsg').textContent = 'Descargando GDACS, EONET, FIRMS e ITS_LIVE… (puede tardar)';
  try {
    const r = await syncNow();
    $('cfgSyncMsg').textContent = `Listo: ${r.total_descargados} eventos descargados.`;
    await refreshEvents();
  } catch (e) { $('cfgSyncMsg').textContent = e.message; } finally { b.disabled = false; }
};
const CONN_TXT = {
  proxy: 'API local conectada (npm run dev) · teselas con caché',
  direct: 'API en 127.0.0.1:8000 (sin reenvío de Vite). Reinicia con npm run dev para usar la caché de teselas.',
  offline: 'API local apagada. Ejecuta npm run dev en la carpeta del proyecto.',
};
$('cfgApiLabel').textContent = API_LABEL;

// ---------- Acciones para PULSE (voz) y la barra superior ----------
async function firstPlace(q) { const rs = await search(q); if (!rs.length) throw new Error(`No encontré «${q}».`); return rs[0]; }
const linkFor = () => MODULE_LINK[activeModule.id];
window.TerraPulse = {
  viewRect: () => getViewRect(),
  arenal: () => $('btnArenal').click(),
  showEvents: () => { document.body.classList.remove('hide-left'); },
  eventsToday: () => {
    const today = new Date().toDateString();
    return allEvents.filter(f => eventDate(f.properties)?.toDateString() === today);
  },
  totalEvents: () => allEvents.length,
  analyzePlace: async (q, tab) => {
    const r = await firstPlace(q);
    analyzePoint({ lat: r.lat, lon: r.lon, title: r.name, country: r.country, riskType: linkFor().risk, mode: linkFor().mode, source: 'Asistente Terra' });
    if (tab) selectTab(tab);
    return r;
  },
  riskAt: async q => {
    await window.TerraPulse.analyzePlace(q, 'risk');
    const r = await analysis.riskP;
    return r.risk_score;
  },
  route: async q => { const r = await firstPlace(q); window.open(mapsUrl(r.lat, r.lon), '_blank', 'noopener'); return r; },
  report: () => {
    if (analysis) return reportAnalysis();
    if (current) { downloadReport({ lugar: current.lugar, pais: current.pais, lat: current.lat, lon: current.lon, causa: 'Sin análisis', fuentes: ['NASA GIBS'] }); return true; }
    return null;
  },
};

// ---------- Satélites conectados (cada uno a su API) ----------
let activeSat = null;
function renderSatCatalog() {
  $('satCatalog').innerHTML = SAT_CATALOG.map(sat => `
    <button class="sat-item${activeSat?.id === sat.id ? ' on' : ''}" data-sat="${sat.id}">
      <i class="dot-st on"></i><b>${sat.name}</b><span>${sat.api}</span></button>`).join('');
  $('satCatalog').querySelectorAll('.sat-item').forEach(b => b.onclick = () => toggleSat(b.dataset.sat));
}
function satDefaultDate(key) { const l = GIBS_LAYERS[key]; return shiftDays(l.lag ?? 2); }
function showSatLayer() {
  const sat = activeSat; if (!sat || sat.kind !== 'gibs') return;
  const key = $('satLayerSel').value, l = GIBS_LAYERS[key];
  if (l.live) { $('satDate').disabled = true; $('satDate').value = iso(new Date()); }
  else $('satDate').disabled = false;
  const k = resolveLayer(key, $('satDate').value), used = GIBS_LAYERS[k];
  setSatLayer(gibsUrl(key, $('satDate').value), used.level, used.source, $('satAlpha').value / 100);
  $('satMsg').textContent = `${used.name} · ${l.live ? 'último disponible' : $('satDate').value} · ${sat.note}`;
}
async function toggleSat(id) {
  const sat = SAT_CATALOG.find(s => s.id === id);
  clearSatLayer();
  if (activeSat?.id === id) { activeSat = null; $('satCtl').hidden = true; renderSatCatalog(); return; }
  activeSat = sat; renderSatCatalog(); $('satCtl').hidden = false;
  const sel = $('satLayerSel');
  if (sat.kind === 'gibs') {
    sel.hidden = false; $('satDate').hidden = false; $('satAlpha').parentElement.hidden = false;
    sel.innerHTML = ''; sat.layers.forEach(k => sel.add(new Option(GIBS_LAYERS[k].name, k)));
    $('satDate').value = satDefaultDate(sat.layers[0]);
    showSatLayer();
  } else {
    sel.hidden = true; $('satDate').hidden = true; $('satAlpha').parentElement.hidden = sat.kind !== 'nisar';
    if (sat.kind === 'firms') {
      $('evFilter').value = 'src:NASA_FIRMS'; $('evSeverity').value = ''; paintEvents();
      document.body.classList.remove('hide-left');
      const n = allEvents.filter(e => e.properties.source === 'NASA_FIRMS').length;
      $('satMsg').textContent = n ? `${n} focos térmicos FIRMS en el globo y en la lista de eventos. ${sat.note}` : 'La API local no tiene focos FIRMS en este momento (revisa la clave NASA_FIRMS_KEY en backend/.env).';
    } else if (sat.kind === 'nisar') {
      const c = getViewCenter();
      if (!c) { $('satMsg').textContent = 'Acerca el globo a una zona para buscar escenas NISAR.'; return; }
      $('satMsg').textContent = `Buscando escenas NISAR cerca de ${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}…`;
      try {
        const fc = await getSarAnalysis(c.lat, c.lon);
        if (activeSat !== sat) return;
        const nisar = (fc.features || []).filter(f => f.properties.platform === 'NISAR');
        const f = nisar[0] || fc.features?.[0];
        if (!f) { $('satMsg').textContent = 'ASF no tiene escenas radar con vista previa en este punto en los últimos 60 días. Mueve el globo a otra zona y vuelve a tocar NISAR.'; return; }
        drawSarFootprint(f); overlaySarImage(f);
        $('satMsg').textContent = `${f.properties.platform} ${f.properties.processingLevel} · ${new Date(f.properties.startTime).toLocaleDateString('es-MX')} · ${fc.features.length} escena(s) en 60 días. Para verlas todas abre un análisis (pestaña Radar SAR).`;
      } catch (e) { $('satMsg').textContent = e.message; }
    }
  }
}
$('satLayerSel').onchange = () => { $('satDate').value = satDefaultDate($('satLayerSel').value); showSatLayer(); };
$('satDate').onchange = showSatLayer;
$('satAlpha').oninput = () => setSatAlpha($('satAlpha').value / 100);

// ---------- Inicio ----------
$('btnArenal').onclick = () => analyzePoint({ lat: 24.02, lon: -104.67, title: 'El Arenal, Durango', country: 'México', riskType: 'Fuego', mode: 'incendios', source: 'Punto de demostración (datos en vivo)' });
(async () => {
  await Promise.all([detectConnection(), loadWayback()]);   // conexión a la API e historial de alta resolución
  initMap('cesiumContainer');
  onViewChange(() => { viewRect = getViewRect(); paintList(); });
  onPick(async (lat, lon) => { const r = await reverse(lat, lon); goLocation(lat, lon, r.name, r.country); });
  setApiStatus(conn.mode !== 'offline', conn.oldBackend ? 'Conectada a un backend anterior: cierra el uvicorn viejo y vuelve a ejecutar npm run dev.' : CONN_TXT[conn.mode]);
  renderSatCatalog();
  selectModule('agua');
  await refreshEvents();
  showEvents($('cfgShowEvents').checked);
  applyRefresh(+$('cfgRefresh').value);
})();

// ---------- API interna para el asistente de voz (solo acciones permitidas) ----------
const CARD_IDS = { analisis: 'analysisCard', modulo: 'moduleCard', ubicacion: 'infoCard', zonas: 'zonesCard', fuentes: 'satCatalog' };
const panelOpen = side => !document.body.classList.contains(`hide-${side}`);
window.TerraPulse.app = {
  modules: () => MODULES.map(m => ({ id: m.id, nombre: m.name })),
  context() {
    const r = getViewRect(), z = Z.activeZone();
    return {
      seccion: { id: activeModule.id, nombre: activeModule.name },
      paneles: { eventos: panelOpen('left'), analisis_y_zonas: panelOpen('right') },
      tarjetas_abiertas: Object.entries(CARD_IDS).filter(([, id]) => !$(id)?.closest('.glass-card')?.classList.contains('collapsed')).map(([k]) => k),
      comparador_activo: cmpOn, animacion_abierta: playerOpen(), dibujando_zona: isDrawingNow(),
      ajustes_abiertos: !$('settingsPanel').hidden, tema: document.documentElement.dataset.theme === 'light' ? 'claro' : 'oscuro',
      ubicacion_seleccionada: current ? { nombre: current.lugar, lat: +current.lat.toFixed(4), lon: +current.lon.toFixed(4), radio_km: current.radius ?? null } : null,
      vista: r ? { oeste: +r.west.toFixed(3), sur: +r.south.toFixed(3), este: +r.east.toFixed(3), norte: +r.north.toFixed(3), altura_km: Math.round(cameraHeight() / 1000) } : null,
      zonas: Z.listZones(), zona_activa: z?.name ?? null,
      eventos_visibles: allEvents.filter(f => filteredEvents().includes(f) && inView(f)).length,
      analisis_abierto: analysis ? analysis.ev?.title ?? true : false,
      fechas_comparador: { antes: $('dateA').value, despues: $('dateB').value, capa: $('cmpLayer').selectedOptions[0]?.text },
    };
  },
  selectModule(id) { const m = MODULES.find(x => x.id === id); if (!m) throw new Error('Sección desconocida'); selectModule(id); return m.name; },
  panel(side, open) { document.body.classList.toggle(`hide-${side}`, !open); window.dispatchEvent(new Event('resize')); },
  openCard(key) { const id = CARD_IDS[key]; if (!id) throw new Error('Tarjeta desconocida'); openCard(id); $(id).closest('.glass-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  scroll(target, dir) {
    const scrollable = e => { for (; e; e = e.parentElement) if (e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return e; return null; };
    if (target === 'eventos') this.panel('left', true); if (target === 'analisis') this.panel('right', true);
    const el = target === 'eventos' ? scrollable($('alertList')) || $('panelLeft') : target === 'analisis' ? scrollable($('zonesCard')) || $('panelRight') : document.scrollingElement;
    if (!el) throw new Error('No hay nada que desplazar ahí');
    el.scrollBy({ top: dir === 'arriba' ? -320 : dir === 'inicio' ? -1e6 : dir === 'final' ? 1e6 : 320, behavior: 'smooth' });
  },
  async goPlace(q) { const r = await firstPlace(q); await goLocation(r.lat, r.lon, r.name, r.country, /^Coordenadas/.test(r.name) ? 30000 : 120000); return r.name; },
  zoom(dir) { $(dir === 'acercar' ? 'zoomIn' : 'zoomOut').click(); },
  selectPoint(radiusKm) {
    const c = current || getViewCenter(); if (!c) throw new Error('Acerca el mapa a una zona primero.');
    showInfo({ lugar: c.lugar || 'Centro de la vista', pais: c.pais, lat: c.lat, lon: c.lon, radius: radiusKm || c.radius });
    return current;
  },
  drawZone(name) {
    beginDraw(); drawName = name || null;
    return new Promise(res => { drawResolve = res; });
  },
  cancelDraw() { if (isDrawingNow()) endDraw(false); },
  compare(on, layer, years) {
    if (!on) { stopCompare(); return 'off'; }
    if (layer && [...$('cmpLayer').options].some(o => o.value === layer)) $('cmpLayer').value = layer;
    if (years) { $('dateB').value = iso(recent); $('dateA').value = iso(new Date(recent.getTime() - years * 365 * 864e5)); }
    if (cmpOn) stopCompare(); startModuleCompare(); return $('cmpLayer').selectedOptions[0]?.text;
  },
  compareLayers: () => [...$('cmpLayer').options].map(o => ({ id: o.value, nombre: o.text })),
  animate() { startAnimation(); },
  stopAnimation() { closePlayer(); },
  analyzeHere(tab) {
    const c = current || getViewCenter(); if (!c) throw new Error('Selecciona un punto o acerca el mapa.');
    analyzePoint({ lat: c.lat, lon: c.lon, title: c.lugar || 'Zona del mapa', country: c.pais, riskType: linkFor().risk, mode: linkFor().mode, source: 'Asistente de voz' });
    if (tab) selectTab(tab);
  },
  eventsInView(n = 5) {
    return allEvents.filter(f => filteredEvents().includes(f) && inView(f)).slice(0, n)
      .map(f => ({ titulo: String(f.properties.title || '').slice(0, 90), tipo: typeOf(f.properties), fuente: sourceLabel(f.properties.source), fecha: eventDate(f.properties)?.toISOString().slice(0, 10) }));
  },
  refreshEvents: () => refreshEvents(),
  sync: () => $('cfgSync').click(),
  settings(open) { if (open === !$('settingsPanel').hidden) return; $('btnSettings').click(); },
  theme(t) { const dark = (document.documentElement.dataset.theme || 'dark') !== 'light'; if ((t === 'claro') === dark) $('btnTheme').click(); },
  report: () => window.TerraPulse.report(),
  zones: Z,
};
Z.initZones({ beginDraw: () => window.TerraPulse.app.drawZone(), current: () => current,
  firesIn: ring => allEvents.filter(f => { const c = coordsOf(f); return c && (f.properties.source === 'NASA_FIRMS' || typeOf(f.properties) === 'fire') && Z.inPolygon([c.lon, c.lat], ring); }).length });
