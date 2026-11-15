import { snapshot } from './map.js';

export function riskLevel(p) { return p == null ? null : p >= 70 ? 'alto' : p >= 40 ? 'medio' : 'bajo'; }

// Reporte de una zona encerrada: todos los temas analizados, con sus explicaciones, y la vista actual del mapa
export function downloadZoneReport(d) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const now = new Date().toLocaleString('es-MX');
  let y = 18;
  pdf.setFillColor(7, 11, 9); pdf.rect(0, 0, 210, 28, 'F');
  pdf.setTextColor(0, 207, 255); pdf.setFontSize(18); pdf.text('TerraPulse — Reporte de zona', 14, y);
  pdf.setFontSize(9); pdf.setTextColor(180); pdf.text('NASA Space Apps Challenge 2026 · Dancing with the SARs', 14, y + 6);
  y = 38;
  const room = h => { if (y + h > 280) { pdf.addPage(); y = 18; } };
  const row = (k, v) => {
    pdf.setFontSize(11); pdf.setTextColor(20); pdf.setFont(undefined, 'bold'); pdf.text(k + ':', 14, y);
    pdf.setFont(undefined, 'normal'); const l = pdf.splitTextToSize(String(v), 130); pdf.text(l, 60, y); y += 6 * l.length + 1;
  };
  row('Zona', d.nombre); row('Tipo', d.tipo); row('Superficie', d.area);
  row('Centro', `${d.lat.toFixed(5)}, ${d.lon.toFixed(5)}`); row('Generado', now);
  if (d.nivel) row('Resultado general', d.nivel);
  const img = snapshot();
  if (img) { pdf.addImage(img, 'JPEG', 14, y + 2, 182, 100); y += 110; }
  if (d.claves?.length) {
    room(20); pdf.setFontSize(12); pdf.setFont(undefined, 'bold'); pdf.setTextColor(0, 110, 140); pdf.text('Datos clave', 14, y); y += 6;
    pdf.setFontSize(9); pdf.setTextColor(255); pdf.setFillColor(0, 110, 140); pdf.rect(14, y - 4, 182, 6, 'F');
    pdf.text('Indicador', 16, y); pdf.text('Valor', 86, y); pdf.text('Qué significa', 122, y); y += 6;
    pdf.setFont(undefined, 'normal'); pdf.setTextColor(30);
    d.claves.forEach(([k, v, m], i) => {
      const a = pdf.splitTextToSize(k, 66), b = pdf.splitTextToSize(String(v).replace(/−/g, '-'), 34), c = pdf.splitTextToSize(String(m), 72), h = Math.max(a.length, b.length, c.length) * 4.4 + 2;
      room(h); if (i % 2 === 0) { pdf.setFillColor(238, 246, 248); pdf.rect(14, y - 4, 182, h, 'F'); }
      pdf.text(a, 16, y); pdf.setFont(undefined, 'bold'); pdf.text(b, 86, y); pdf.setFont(undefined, 'normal'); pdf.text(c, 122, y); y += h;
    });
    y += 6;
  }
  if (!d.sections.length) { room(12); pdf.setFontSize(11); pdf.setTextColor(170, 40, 40); const l = pdf.splitTextToSize('No se pudieron obtener datos satelitales de esta zona en este momento. Revisa la conexión a internet e inténtalo de nuevo.', 182); pdf.text(l, 14, y); y += 6 * l.length; }
  for (const [title, text] of d.sections) {
    const lines = pdf.splitTextToSize(text.replace(/−/g, '-'), 182);
    room(12 + Math.min(lines.length, 4) * 5);
    pdf.setFontSize(12); pdf.setFont(undefined, 'bold'); pdf.setTextColor(0, 110, 140); pdf.text(title, 14, y); y += 6;
    pdf.setFontSize(10); pdf.setFont(undefined, 'normal'); pdf.setTextColor(30);
    for (const ln of lines) { room(5); pdf.text(ln, 14, y); y += 5; }
    y += 4;
  }
  if (d.avisos.length) { room(12); pdf.setFontSize(9); pdf.setTextColor(150, 90, 0); const l = pdf.splitTextToSize('Avisos: ' + d.avisos.join(' '), 182); pdf.text(l, 14, y); y += 5 * l.length + 3; }
  room(16); pdf.setFontSize(9); pdf.setTextColor(60);
  const f = pdf.splitTextToSize('Fuentes: ' + d.fuentes.join('; ') + '.', 182); pdf.text(f, 14, y); y += 5 * f.length + 3;
  room(12); pdf.setFontSize(8); pdf.setTextColor(90);
  pdf.text(pdf.splitTextToSize('Reporte informativo; no constituye una denuncia oficial. Los valores son estimaciones a partir de imágenes satelitales públicas; el cambio de radar NISAR se calcula con vistas previas sin calibrar.', 182), 14, y);
  pdf.save(`TerraPulse_${d.nombre.replace(/\W+/g, '_')}_${new Date().toLocaleString('sv-SE').slice(0, 16).replace(/[: ]/g, '-')}.pdf`);
}

export function downloadReport(d) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const nd = 'No disponible';
  let y = 18;
  pdf.setFillColor(7, 11, 9); pdf.rect(0, 0, 210, 28, 'F');
  pdf.setTextColor(0, 207, 255); pdf.setFontSize(18); pdf.text('TerraPulse — Reporte', 14, y);
  pdf.setFontSize(9); pdf.setTextColor(180); pdf.text('NASA Space Apps Challenge 2026 · Dancing with the SARs', 14, y + 6);
  y = 38; pdf.setTextColor(20);
  if (d.demo) {
    pdf.setFillColor(255, 236, 179); pdf.rect(14, y - 5, 182, 9, 'F');
    pdf.setFontSize(10); pdf.text('DATOS DE DEMOSTRACIÓN — no corresponden a una detección satelital real.', 16, y + 1);
    y += 12;
  }
  const rows = [
    ['Lugar', d.lugar], ['País', d.pais || nd],
    ['Coordenadas', `${d.lat.toFixed(5)}, ${d.lon.toFixed(5)}`],
    ['Fechas analizadas', d.fecha_inicio && d.fecha_fin ? `${d.fecha_inicio} a ${d.fecha_fin}` : nd],
    ['Hectáreas en riesgo (+30 días)', d.hectareas != null ? `${d.hectareas} ha (proyección)` : nd],
    ['Posible causa', d.causa || 'Sin determinar'],
    ['Puntaje de riesgo', d.prob != null ? `${d.prob}/100 (estimación, no certeza)` : nd],
    ['Nivel de riesgo', riskLevel(d.prob) || nd],
    ['Fuentes satelitales', (d.fuentes || []).join(', ') || nd],
  ];
  pdf.setFontSize(11);
  rows.forEach(([k, v]) => {
    pdf.setFont(undefined, 'bold'); pdf.text(k + ':', 14, y);
    pdf.setFont(undefined, 'normal');
    const lines = pdf.splitTextToSize(String(v), 125); pdf.text(lines, 66, y);
    y += 6 * lines.length + 1;
  });
  const img = snapshot();
  if (img) { pdf.addImage(img, 'JPEG', 14, y + 2, 182, 100); y += 108; }
  else { pdf.text('Imagen del mapa no disponible.', 14, y + 4); y += 10; }
  pdf.setFontSize(8); pdf.setTextColor(90);
  pdf.text(pdf.splitTextToSize('Este reporte es informativo y no constituye una denuncia oficial. Una detección térmica no confirma por sí sola un incendio; la pérdida de vegetación puede tener otras causas.', 182), 14, 282);
  pdf.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 292);
  pdf.save(`TerraPulse_${d.lugar.split(',')[0].replace(/\W+/g, '_')}.pdf`);
}
