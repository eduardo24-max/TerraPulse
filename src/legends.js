// Leyendas oficiales de NASA GIBS (LegendURL del catálogo WMTS). Se descarga una vez y se guarda en memoria.
let catalog = null;
async function load() {
  if (catalog) return catalog;
  catalog = (async () => {
    const xml = await fetch('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml').then(r => r.text());
    const map = {};
    for (const block of xml.split('<Layer>').slice(1)) {
      const id = (block.match(/<ows:Identifier>([^<]+)<\/ows:Identifier>/) || [])[1];
      if (!id) continue;
      const title = (block.match(/<ows:Title[^>]*>([^<]+)<\/ows:Title>/) || [])[1];
      const legend = (block.match(/legend-type\/horizontal'[^>]*xlink:href='([^']+)'/) || [])[1];
      map[id] = { title, legend };
    }
    return map;
  })().catch(() => ({}));
  return catalog;
}
export async function legendFor(layerId) {
  if (!layerId) return null;
  return (await load())[layerId] || null;
}
