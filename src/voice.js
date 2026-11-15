// Terra · asistente de voz de TerraPulse. No abre ningún panel: el botón flotante se anima según escucha,
// piensa o responde. Usa Gemini Live si el backend tiene GEMINI_API_KEY; si no, la voz neuronal del backend (sin clave) y el oído del navegador; ElevenLabs es opcional.
// Ambos motores solo pueden actuar con las herramientas autorizadas de assistant/tools.js.
import { conn } from './connection.js';
import { execute } from './assistant/tools.js';
import { createLocalEngine } from './assistant/local.js';
import { createGeminiEngine, voiceConfig } from './assistant/gemini.js';

const $ = id => document.getElementById(id);
const YES = /^\s*(si|sí|confirmo|confirmar|adelante|hazlo|de acuerdo|ok|claro|acepto|aceptar)\b/i, NO = /^\s*(no|cancela|cancelar|mejor no|detente|alto)\b/i;
let engine = null, pending = null, abortFn = null, mode = null, toastT = null, eleven = false, tts = false;
const history = [];   // registro interno (no se muestra): útil para depurar y para lectores de pantalla

const LABEL = { idle: 'Hablar con Terra, asistente de voz (Alt+J)', connecting: 'Terra se está conectando', listening: 'Terra te está escuchando. Pulsa para apagarla',
  thinking: 'Terra está trabajando en tu petición', speaking: 'Terra está respondiendo. Pulsa para apagarla' };
function setState(s) {
  const fab = $('asstFab'); fab.dataset.state = s; fab.setAttribute('aria-label', LABEL[s] || LABEL.idle); fab.title = LABEL[s] || LABEL.idle;
  fab.setAttribute('aria-pressed', String(s !== 'idle'));
  $('btnPulse').classList.toggle('on', s !== 'idle'); $('btnPulse').setAttribute('aria-pressed', String(s !== 'idle'));
}
function toast(msg, withInput) {
  const t = $('asstToast'); $('asstToastMsg').textContent = msg; $('asstForm').hidden = !withInput; t.hidden = false;
  clearTimeout(toastT); if (!withInput) toastT = setTimeout(() => (t.hidden = true), 7000);
}
const cb = {
  state: setState,
  heard(text, final) { if (final && text) history.push({ who: 'usuario', text }); },
  reply(text, final) { if (final && text) { history.push({ who: 'terra', text }); $('asstAnnounce').textContent = text; } },
  error(msg, kind) {
    history.push({ who: 'error', text: msg }); $('asstAnnounce').textContent = msg;
    if (kind === 'mic') return toast(`${msg} Mientras tanto puedes escribirle:`, true);
    if (kind === true && mode === 'gemini') { useLocal(); engine.start(); return; }
    toast(msg);
  },
  tool: (name, args) => execute(name, args, ui),
  answerConfirm: async text => answerConfirm(text),
  answerConfirmSync: text => answerConfirm(text),
  cancelTool: () => abortFn?.(),
};
function answerConfirm(text) {
  if (!pending) return false;
  if (YES.test(text)) { pending(true); return true; }
  if (NO.test(text)) { pending(false); return true; }
  return false;
}
const ui = {
  confirm(msg) {
    pending?.(false);
    return new Promise(res => {
      $('asstConfirmMsg').textContent = msg; $('asstConfirm').hidden = false;
      $('asstAnnounce').textContent = `Terra necesita tu confirmación: ${msg}`;
      if (mode === 'local') engine?.say?.(`${msg} Dime sí o no.`);
      const t = setTimeout(() => done(false), 60000);
      function done(v) { clearTimeout(t); pending = null; $('asstConfirm').hidden = true; res(v); }
      pending = done;
    });
  },
  action(text, ok) { history.push({ who: ok ? 'accion' : 'error', text }); },
  note(text) { history.push({ who: 'nota', text }); $('asstAnnounce').textContent = text; if (mode === 'local') engine?.say?.(text); },
  setAbort(fn) { abortFn = fn; },
};

function useLocal() { engine?.stop(); mode = 'local'; engine = createLocalEngine(cb, { base: conn.base, eleven, tts }); }
async function pickEngine() {
  if (engine) return;
  const cfg = conn.base != null ? await voiceConfig(conn.base) : {};
  eleven = !!cfg.elevenlabs; tts = !!cfg.tts;
  if (cfg.gemini) { mode = 'gemini'; engine = createGeminiEngine(conn.base, cb); }
  else useLocal();
}
function cancelAll() { pending?.(false); abortFn?.(); engine?.interrupt?.(); try { window.TerraPulse?.app?.cancelDraw(); } catch {} $('asstAnnounce').textContent = 'Cancelado.'; }
async function toggle() {
  await pickEngine();
  if (engine.listening || $('asstFab').dataset.state !== 'idle') { pending?.(false); engine.stop(); $('asstToast').hidden = true; $('asstConfirm').hidden = true; }
  else engine.start();   // Terra se presenta y empieza a escuchar
}

$('asstFab').onclick = toggle;
$('btnPulse').onclick = toggle;
$('asstYes').onclick = () => pending?.(true);
$('asstNo').onclick = () => pending?.(false);
$('asstToastClose').onclick = () => ($('asstToast').hidden = true);
$('asstForm').onsubmit = async e => { e.preventDefault(); const v = $('asstInput').value.trim(); if (!v) return; $('asstInput').value = ''; await pickEngine(); engine.sendText(v); };
document.addEventListener('keydown', e => {
  if (e.altKey && (e.key === 'j' || e.key === 'J')) { e.preventDefault(); toggle(); }
  if (e.key === 'Escape' && $('asstFab').dataset.state !== 'idle' && (pending || abortFn || $('asstFab').dataset.state === 'speaking')) cancelAll();
});
setState('idle');

// Gancho de pruebas y accesibilidad: enviar texto a Terra y leer el registro interno
window.TerraPulse ??= {};
window.TerraPulse.terra = { ask: async t => { await pickEngine(); return engine.sendText(t); }, history, mode: () => (mode === 'local' ? engine?.mode : mode), toggle };
