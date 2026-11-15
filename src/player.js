// Reproductor tipo Windy: anima imágenes satelitales reales por fecha y añade el pronóstico del modelo de riesgo.
import { setFrames, showFrame, clearFrames, drawForecast, clearForecast, frameLoaded } from './map.js';
import { STORIES, buildFrames, buildSceneFrames, phaseOf, PHASE_LABEL } from './animations.js';
import { LAYER_INFO, GIBS_LAYERS } from './satelliteSources.js';
import { getRisk } from './api.js';
import { legendFor } from './legends.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let st = null;            // estado: { ctx, story, product, frames, i, timer, lastReal }
let onCloseCb = null;

export function onPlayerClose(cb) { onCloseCb = cb; }
export const playerOpen = () => !!st;

// ctx: { storyKey, lat, lon, date (Date|null), riskType, title }
export async function openPlayer(ctx) {
  stop();
  st = { ctx, storyKey: ctx.storyKey, i: 0 };
  $('player').hidden = false;
  document.querySelector('.compare-bar').hidden = true;
  $('plStory').innerHTML = Object.entries(STORIES).map(([k, s]) => `<option value="${k}">${s.title}</option>`).join('');
  $('plStory').value = ctx.storyKey;
  $('plTitle').textContent = ctx.title || 'Vista actual';
  fillProducts();
  await loadStory();
}

function fillProducts() {
  const story = STORIES[st.storyKey];
  $('plProduct').innerHTML = story.products.map((p, k) => `<option value="${k}">${p.label}</option>`).join('');
}

async function loadStory() {
  const story = STORIES[st.storyKey], product = story.products[+$('plProduct').value || 0];
  stop(false);
  const center = st.ctx.date || new Date();
  let frames, underlay = null;
  $('plDamageWrap').hidden = !product.damage;
  if (product.kind === 'scenes') {
    if (st.ctx.lat == null) { $('plCaption').textContent = 'Acerca el mapa a una zona para buscar pasadas del satélite.'; return; }
    $('plCaption').textContent = 'Buscando en el catálogo de NASA las pasadas sin nubes sobre esta zona…';
    ({ frames, underlay } = await buildSceneFrames(product, st.ctx));
    if (!st) return;
    if (!frames.length) { $('plCaption').textContent = 'No hay pasadas sin nubes en este periodo; elige otro producto (por ejemplo, Sentinel-2 anual).'; $('plTrack').innerHTML = ''; return; }
  } else frames = buildFrames(product, center);
  st.product = product; st.lastReal = frames.length - 1;
  // Pronóstico del modelo de riesgo (+7, +15, +30, +90 días) al final de la línea de tiempo
  if (st.ctx.lat != null && product.kind !== 'live' && st.storyKey !== 'envivo') {
    try {
      st.risk ||= await getRisk(st.ctx.lat, st.ctx.lon, st.ctx.riskType || 'Fuego', 90);
      (st.risk.timeline_projection || []).forEach(t => frames.push({ forecast: true, label: t.horizon_label, t }));
    } catch { /* sin API: solo imágenes reales */ }
  }
  st.frames = frames;
  setFrames(frames, underlay);
  renderTrack();
  st.i = 0;
  await render(true);
  // información del producto y leyenda
  const info = LAYER_INFO[frames[0]?.key] || LAYER_INFO[product.key] || {};
  const lid = GIBS_LAYERS[frames[0]?.key]?.id;
  const lg = GIBS_LAYERS[frames[0]?.key]?.kind ? null : await legendFor(lid);
  $('plLegend').hidden = !lg?.legend; if (lg?.legend) $('plLegend').src = lg.legend;
  $('plSource').textContent = product.kind === 'scenes'
    ? `NASA HLS · Landsat 8/9 + Sentinel-2 · 30 m · ${frames.length} pasadas despejadas${product.damage ? ' · daño: NASA OPERA DIST' : ''}`
    : `${GIBS_LAYERS[frames[0]?.key]?.source || ''} · ${info.res ? 'resolución ' + info.res : ''}`;
  // espera breve a que carguen las teselas antes de reproducir
  $('plCaption').textContent = 'Cargando imágenes satelitales…';
  const t0 = Date.now();
  while (Date.now() - t0 < 6000 && !frameLoaded()) await new Promise(r => setTimeout(r, 300));
  if (!st) return;
  await render();
  play();
}

function renderTrack() {
  const ev = st.ctx.date;
  let evIdx = -1;
  if (ev) { let best = Infinity; st.frames.forEach((f, k) => { if (!f.forecast) { const d = Math.abs(f.date - ev); if (d < best) { best = d; evIdx = k; } } }); }
  $('plTrack').innerHTML = st.frames.map((f, k) => `<button class="pl-tick${f.forecast ? ' fc' : ''}${k === evIdx ? ' ev' : ''}" data-k="${k}" title="${esc(f.label)}"><span>${esc(f.label)}</span></button>`).join('');
  $('plTrack').querySelectorAll('.pl-tick').forEach(b => b.onclick = () => { pause(); st.i = +b.dataset.k; render(); });
}

async function render(silent = false) {
  if (!st) return;
  const f = st.frames[st.i], story = STORIES[st.storyKey];
  $('plTrack').querySelectorAll('.pl-tick').forEach((b, k) => { b.classList.toggle('on', k === st.i); b.classList.toggle('past', k < st.i); });
  if (f.forecast) {
    showFrame(st.lastReal);
    const t = f.t, c = t.projected_risk_score >= 70 ? '#FF4D5A' : t.projected_risk_score >= 40 ? '#FF9F43' : '#FFD23F';
    drawForecast(st.ctx.lat, st.ctx.lon, t.radio_afectacion_km, c, `${t.horizon_label} · ${t.radio_afectacion_km} km`);
    $('plDate').textContent = f.label;
    setPhase('forecast');
    if (!silent) $('plCaption').innerHTML = `<b>Pronóstico del modelo:</b> en ${esc(t.horizon_label)} la zona de afectación podría alcanzar <b>${t.radio_afectacion_km} km</b> de radio (~${Math.round(t.hectareas_en_riesgo).toLocaleString('es-MX')} ha) con un puntaje de riesgo de <b>${t.projected_risk_score}/100</b>. Es una estimación, no una certeza.`;
    return;
  }
  clearForecast();
  showFrame(st.i, 1, $('plDamage').checked);
  const phase = phaseOf(f.date, st.ctx.date);
  const k = st.product.kind;
  $('plDate').textContent =
    k === 'live' ? `${f.label} · ${f.date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}` :
    k === 'annual' ? f.label + (f.key === 'wayback' && f.realDate ? ` (imagen del ${f.realDate})` : '') :
    k === 'monthly' ? f.date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) :
    f.date.toLocaleDateString('es-MX', { dateStyle: 'medium' }) + (f.sat ? ` · ${f.sat} · ${f.cloud}% nubes` : '');
  setPhase(phase);
  if (!silent) $('plCaption').textContent = story.captions[phase] || story.captions.general || '';
}
function setPhase(p) {
  const el = $('plPhase');
  el.textContent = PHASE_LABEL[p] || '';
  el.className = `badge pl-phase ${p}`;
  el.hidden = !PHASE_LABEL[p];
}

function play() {
  if (!st) return;
  pause();
  const speed = +$('plSpeed').value || 1;
  st.timer = setInterval(() => { st.i = (st.i + 1) % st.frames.length; render(); }, 1400 / speed);
  $('plPlay').classList.add('playing');
  $('plPlay').innerHTML = '<svg class="ic"><use href="#i-pause"/></svg>';
}
function pause() {
  if (st?.timer) { clearInterval(st.timer); st.timer = null; }
  $('plPlay').classList.remove('playing');
  $('plPlay').innerHTML = '<svg class="ic"><use href="#i-play"/></svg>';
}
function stop(clear = true) { pause(); if (clear) { clearFrames(); } }

export function closePlayer() {
  stop(); st = null;
  $('player').hidden = true;
  document.querySelector('.compare-bar').hidden = false;
  onCloseCb?.();
}

// Controles
$('plPlay').onclick = () => (st?.timer ? pause() : play());
$('plSpeed').onchange = () => { if (st?.timer) play(); };
$('plStory').onchange = () => { st.storyKey = $('plStory').value; fillProducts(); loadStory(); };
$('plProduct').onchange = () => loadStory();
$('plPrev').onclick = () => { if (!st) return; pause(); st.i = (st.i - 1 + st.frames.length) % st.frames.length; render(); };
$('plNext').onclick = () => { if (!st) return; pause(); st.i = (st.i + 1) % st.frames.length; render(); };
$('plClose').onclick = closePlayer;
$('plDamage').onchange = () => st && render();
document.addEventListener('keydown', e => {
  if (!st || e.target.closest('input,select,textarea')) return;
  if (e.key === ' ') { e.preventDefault(); st.timer ? pause() : play(); }
  if (e.key === 'ArrowRight') $('plNext').click();
  if (e.key === 'ArrowLeft') $('plPrev').click();
});
