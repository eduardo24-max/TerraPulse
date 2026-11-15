// Búsqueda mundial gratuita: OpenStreetMap Nominatim + coordenadas directas.
const COORD = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

export async function search(q) {
  const m = q.match(COORD);
  if (m) {
    const lat = +m[1], lon = +m[2];
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
      return [{ name: `Coordenadas ${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon, country: '' }];
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=es&q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Búsqueda no disponible');
  return (await res.json()).map(r => ({
    name: r.display_name, lat: +r.lat, lon: +r.lon,
    country: r.address?.country || '', type: r.addresstype || r.type,
  }));
}

export async function reverse(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=es&lat=${lat}&lon=${lon}`).then(r => r.json());
    return { name: r.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`, country: r.address?.country || '' };
  } catch { return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, country: '' }; }
}
