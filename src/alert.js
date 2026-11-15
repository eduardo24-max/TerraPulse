// Lista lateral de eventos en vivo (GDACS, NASA FIRMS, NASA EONET, NASA ITS_LIVE).
import { sev, typeOf, iconSvg, eventDate } from './events.js';

export function timeAgo(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} días`;
}

const SOURCES = { GDACS: 'GDACS (ONU/CE)', NASA_FIRMS: 'NASA FIRMS', NASA_EONET: 'NASA EONET', NASA_ITS_LIVE: 'NASA ITS_LIVE' };
export const sourceLabel = s => SOURCES[s] || s || '—';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderEvents(ul, features, onSelect, limit = 40) {
  ul.innerHTML = features.length ? '' : '<li class="muted">Sin eventos para este filtro.</li>';
  features.slice(0, limit).forEach(f => {
    const p = f.properties || {}, s = sev(p.severity), t = typeOf(p.disaster_type), d = eventDate(p);
    const li = document.createElement('li');
    li.className = 'ev';
    li.style.setProperty('--st', s.color);
    li.innerHTML = `
      <div class="ev-row"><span class="ev-ico">${iconSvg(t.key, s.color, 22)}</span>
        <span class="badge real">REAL</span><span class="badge st">${t.label} · ${s.label}</span></div>
      <div class="a-place">${esc(p.title || t.label)}</div>
      <div class="a-meta">${d ? d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + timeAgo(d) : 'Fecha no disponible'}</div>
      <div class="a-meta">${sourceLabel(p.source)}</div>`;
    li.onclick = () => onSelect(f);
    ul.appendChild(li);
  });
  if (features.length > limit) ul.insertAdjacentHTML('beforeend', `<li class="muted">… y ${features.length - limit} eventos más en el mapa.</li>`);
}
