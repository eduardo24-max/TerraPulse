import { snapshot } from './map.js';

export function riskLevel(p) { return p == null ? null : p >= 70 ? 'alto' : p >= 40 ? 'medio' : 'bajo'; }

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
