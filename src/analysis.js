// Panel de análisis profundo: evidencia SAR, máquina del tiempo y proyección de riesgo.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 1 });
export const loading = txt => `<div class="an-loading"><span class="spin"></span>${txt}</div>`;
export const errorBox = msg => `<p class="an-error">${esc(msg)}</p>`;

// ---------- 2. Evidencia SAR ----------
// NISAR no siempre llena "polarization": se deduce de las vistas previas por canal (…_A_HH.png, …_B_HV.png).
function polarizations(p) {
  if (p.polarization) return [{ label: p.polarization }];
  const out = [];
  (p.browse || []).forEach(u => {
    const m = String(u).match(/_([AB])_(HH|HV|VH|VV)\.png$/i);
    if (m) out.push({ label: `${m[2].toUpperCase()} (frec. ${m[1].toUpperCase()})`, url: u });
  });
  return out;
}
export function renderSar(el, fc, { onSelect, onOverlay }) {
  const feats = fc?.features || [];
  if (!feats.length) {
    el.innerHTML = '<p class="muted">ASF no devolvió escenas SAR con imagen previa para este punto en los últimos 60 días.</p>';
    return;
  }
  el.innerHTML = `<p class="muted">${feats.length} escena(s) del catálogo ASF. Elige una para ver su huella en el globo.</p>
    <ul class="sar-list">${feats.map((f, i) => {
      const p = f.properties || {};
      const t = p.startTime ? new Date(p.startTime).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
      return `<li data-i="${i}" tabindex="0">
        <img src="${esc(p.browse_url)}" alt="Vista previa radar" loading="lazy" onerror="this.remove()">
        <div class="sar-meta">
          <b>${esc(p.platform || 'SAR')}</b> <span class="badge real">${esc(p.processingLevel || '—')}</span>
          <div class="a-meta">${t}</div>
          <div class="a-meta">Polarización: ${polarizations(p).map(x => x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>` : esc(x.label)).join(', ') || '—'}${p.beamModeType ? ' · Modo: ' + esc(p.beamModeType) : ''}</div>
          <div class="a-meta sar-name" title="${esc(p.sceneName)}">${esc(p.sceneName || '')}</div>
          <button class="ghost sm" data-ov="${i}">Superponer imagen</button>
        </div></li>`;
    }).join('')}</ul>`;
  const items = [...el.querySelectorAll('.sar-list li')], btns = [...el.querySelectorAll('button[data-ov]')];
  const select = i => { items.forEach((li, k) => li.classList.toggle('sel', k === i)); onSelect(feats[i]); };
  items.forEach((li, i) => li.onclick = e => { if (!e.target.closest('a,button')) select(i); });
  btns.forEach((b, i) => b.onclick = () => {
    const on = !b.classList.contains('on');
    btns.forEach(x => { x.classList.remove('on'); x.textContent = 'Superponer imagen'; });
    if (on) { b.classList.add('on'); b.textContent = 'Quitar imagen'; select(i); }
    onOverlay(on ? feats[i] : null);
  });
  select(0);
}

// ---------- 3. Máquina del tiempo ----------
export function renderTimeMachine(el, tm) {
  const sats = tm?.satellites_metadata || [];
  el.innerHTML = `
    <p><b>${esc(tm.mode_title || tm.mode)}</b></p>
    <dl class="kv">
      <dt>Antes</dt><dd>${esc(tm.dates?.before_date)} · ${esc(tm.tiles?.before?.layer_id || '')}</dd>
      <dt>Después</dt><dd>${esc(tm.dates?.after_date)} · ${esc(tm.tiles?.after?.layer_id || '')}</dd>
    </dl>
    <p class="note">Desliza el control del globo para comparar. Capas NASA GIBS.</p>
    <div class="sat-cards">${sats.map(s => `
      <details class="sat-card"><summary><b>${esc(s.mision)}</b><span>${esc(s.agencia)}</span></summary>
        <dl class="kv">
          <dt>Sensor</dt><dd>${esc(s.sensor)}</dd>
          <dt>Resolución</dt><dd>${esc(s.resolucion_espacial)}</dd>
          <dt>Revisita</dt><dd>${esc(s.tiempo_revisita)}</dd>
          <dt>Bandas</dt><dd>${esc(s.bandas)}</dd>
        </dl>
        <p class="muted">${esc(s.medicion_cientifica)}</p>
      </details>`).join('')}</div>`;
}

// ---------- 4. Predicción de riesgo ----------
function chartSvg(tl) {
  if (!tl?.length) return '';
  const W = 290, H = 130, P = { l: 34, r: 30, t: 12, b: 24 };
  const maxHa = Math.max(...tl.map(d => d.hectareas_en_riesgo)) || 1;
  const bw = (W - P.l - P.r) / tl.length;
  const y = v => P.t + (H - P.t - P.b) * (1 - v);
  const bars = tl.map((d, i) => {
    const h = (H - P.t - P.b) * d.hectareas_en_riesgo / maxHa;
    return `<rect x="${P.l + i * bw + bw * 0.2}" y="${H - P.b - h}" width="${bw * 0.6}" height="${h}" rx="3" fill="#FF9F43" opacity=".8"><title>${fmt(d.hectareas_en_riesgo)} ha en riesgo</title></rect>
      <text x="${P.l + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(d.horizon_label)}</text>`;
  }).join('');
  const pts = tl.map((d, i) => `${P.l + i * bw + bw / 2},${y(d.projected_risk_score / 100)}`).join(' ');
  const dots = tl.map((d, i) => `<circle cx="${P.l + i * bw + bw / 2}" cy="${y(d.projected_risk_score / 100)}" r="3.5" fill="#00CFFF"><title>Riesgo ${d.projected_risk_score}</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyección de riesgo">
    <line x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" stroke="currentColor" opacity=".3"/>
    <text x="4" y="${P.t + 8}">${fmt(maxHa)}</text><text x="4" y="${H - P.b}">0 ha</text>
    <text x="${W - 2}" y="${P.t + 8}" text-anchor="end" fill="#00CFFF">100</text>
    ${bars}<polyline points="${pts}" fill="none" stroke="#00CFFF" stroke-width="2"/>${dots}</svg>
    <div class="legend"><span><i style="background:#FF9F43"></i>Hectáreas en riesgo</span><span><i style="background:#00CFFF"></i>Puntaje de riesgo</span></div>`;
}

export function renderRisk(el, r) {
  const score = r.risk_score, lvl = score >= 70 ? 'alto' : score >= 40 ? 'medio' : 'bajo';
  const a = r.recommended_sar_action || {};
  el.innerHTML = `
    <div class="risk ${lvl}"><span class="val">${score}</span>
      <div style="flex:1"><div class="muted">Puntaje de riesgo (0–100) · ${lvl} · confianza ${esc(r.confidence_level)}</div>
      <div class="bar"><div style="width:${score}%;background:${lvl === 'alto' ? '#FF4D5A' : lvl === 'medio' ? '#FF9F43' : '#00E6A0'}"></div></div></div></div>
    <p class="note">Estimación del modelo de TerraPulse con ${r.nearby_active_events_considered ?? 0} evento(s) activos cercanos. No es una certeza.</p>
    ${chartSvg(r.timeline_projection)}
    <table class="tl"><tr><th>Horizonte</th><th>Hectáreas</th><th>Radio</th></tr>
      ${(r.timeline_projection || []).map(d => `<tr><td>${esc(d.horizon_label)}</td><td>${fmt(d.hectareas_en_riesgo)}</td><td>${fmt(d.radio_afectacion_km)} km</td></tr>`).join('')}</table>
    <div class="rx">
      <div class="rx-head"><span class="badge real">Prescripción SAR</span><b>NISAR ${esc(a.nisar_product)}</b></div>
      <div class="a-meta">${esc(a.product_full_name || '')}</div>
      <dl class="kv"><dt>Banda</dt><dd>${esc(a.radar_band)}</dd>${a.target_variable ? `<dt>Variable</dt><dd>${esc(a.target_variable)}</dd>` : ''}</dl>
      <p>${esc(a.action_summary)}</p>
    </div>
    <p class="muted">Anillos en el mapa: ${(r.projected_zones_geojson?.features || []).map(f => `<span class="zone-dot" style="background:${f.properties.fill_color}"></span>${esc(f.properties.name)}`).join(' · ')}</p>`;
}
