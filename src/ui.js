// Interfaz: tema, paneles ocultables, tarjetas desplegables, zoom y botón de reportes.
import { getViewer } from './map.js';

const $ = id => document.getElementById(id);
const body = document.body, root = document.documentElement;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const small = matchMedia('(max-width: 960px)');

// Tema
$('btnTheme').onclick = () => {
  const t = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = t;
  store.set('fp-theme', t);
};

// Paneles: ocultar por completo
const resize = () => { const v = getViewer(); v && requestAnimationFrame(() => v.resize()); };
if ('ResizeObserver' in window) new ResizeObserver(resize).observe($('cesiumContainer'));
addEventListener('resize', resize);
function setPanel(side, hidden) {
  body.classList.toggle(`hide-${side}`, hidden);
  if (!small.matches) store.set(`fp-hide-${side}`, hidden ? '1' : '0');
  resize();
}
function toggle(side) {
  const willShow = body.classList.contains(`hide-${side}`);
  if (willShow && small.matches) setPanel(side === 'left' ? 'right' : 'left', true); // un cajón a la vez en móvil
  setPanel(side, !willShow);
}
$('tabLeft').onclick = () => toggle('left');
$('tabRight').onclick = () => toggle('right');
const initPanels = () => ['left', 'right'].forEach(s => body.classList.toggle(`hide-${s}`, small.matches || store.get(`fp-hide-${s}`) === '1'));
initPanels();
small.addEventListener('change', initPanels);

// Al elegir alerta o lugar en móvil, cerrar cajón izquierdo y abrir información
$('alertList').addEventListener('click', () => { if (small.matches) { setPanel('left', true); setPanel('right', false); } });

// Tarjetas desplegables
document.addEventListener('click', e => {
  const h = e.target.closest('.card-head');
  if (h) h.parentElement.classList.toggle('collapsed');
});

// Zoom
const zoom = f => { const v = getViewer(); if (v) v.camera[f > 0 ? 'zoomIn' : 'zoomOut'](v.camera.positionCartographic.height * 0.45); };
$('zoomIn').onclick = () => zoom(1);
$('zoomOut').onclick = () => zoom(-1);

// Reportes: PDF del análisis abierto o del lugar seleccionado
$('btnReports').onclick = async () => {
  const r = window.TerraPulse?.report();
  r?.catch?.(() => {});   // si el análisis de la zona falla, el motivo ya se muestra en su tarjeta
  if (r !== null && r !== undefined) return;
  setPanel('right', false);
  $('infoCard').closest('.glass-card').classList.remove('collapsed');
  $('infoCard').insertAdjacentHTML('afterbegin', '<p class="muted" id="needPlace">Primero selecciona un evento, busca un lugar o haz clic en el globo para generar su reporte.</p>');
  setTimeout(() => $('needPlace')?.remove(), 4000);
};

// Configuración (ventana emergente)
$('btnSettings').onclick = () => {
  const box = $('settingsPanel'), open = box.hidden;
  document.querySelectorAll('.popover').forEach(p => (p.hidden = true));
  box.hidden = !open;
  $('btnSettings').setAttribute('aria-expanded', String(open));
  if (open) $('cfgTest').click();
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.popover').forEach(p => (p.hidden = true)); });
document.addEventListener('click', e => {
  if (e.target.closest('.popover, #btnSettings')) return;
  document.querySelectorAll('.popover').forEach(p => (p.hidden = true));
});

// Texto adaptable: mide el brillo del globo detrás de cada superficie y elige texto claro u oscuro.
const toneTargets = () => [document.querySelector('.topbar'), $('panelLeft'), ...document.querySelectorAll('.glass-card, .compare-bar, .edge-tab, .zoom-ctl, .module-bar')];
let gl, px = new Uint8Array(4);
const toneOn = () => store.get('tp-tone') !== '0';
$('cfgTone').checked = toneOn();
$('cfgTone').onchange = () => { store.set('tp-tone', $('cfgTone').checked ? '1' : '0'); if (!$('cfgTone').checked) toneTargets().forEach(el => delete el.dataset.tone); };
function updateTones() {
  if (!toneOn()) return;
  const c = document.querySelector('#cesiumContainer canvas');
  if (!c || document.hidden) return;
  gl = gl || c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return;
  const sx = c.width / innerWidth, sy = c.height / innerHeight;
  for (const el of toneTargets()) {
    const r = el.getBoundingClientRect();
    if (r.right <= 0 || r.left >= innerWidth || !r.width) continue;
    let sum = 0, n = 0;
    for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) {
      const x = Math.min(c.width - 1, Math.max(0, (r.left + r.width * i / 4) * sx | 0));
      const y = Math.min(c.height - 1, Math.max(0, c.height - 1 - ((r.top + r.height * j / 4) * sy | 0)));
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      sum += 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]; n++;
    }
    const lum = sum / n / 255, prev = el.dataset.tone;
    // histéresis para evitar parpadeo
    el.dataset.tone = prev === 'light' ? (lum < 0.48 ? 'dark' : 'light') : (lum > 0.56 ? 'light' : 'dark');
  }
}
setInterval(updateTones, 700);
// Al acercar, alejar o mover el mapa se vuelve a medir el fondo enseguida, para que las tarjetas no queden ilegibles
let toneT; const soon = () => { clearTimeout(toneT); toneT = setTimeout(updateTones, 180); };
['wheel', 'pointerup', 'touchend', 'keyup'].forEach(ev => document.addEventListener(ev, soon, { passive: true }));
