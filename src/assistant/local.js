// Motor local (sin clave): reconocimiento de voz del navegador + intérprete de frases en español +
// síntesis de voz. Usa exactamente las mismas herramientas autorizadas que el modo Gemini.
import { createEars, createVoice } from './audio.js';

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
const SEC = [[/agua|humedal|inundac|rio|lago/, 'agua'], [/bosque|incendio|fuego|forestal/, 'bosques'], [/agricult|cultivo|siembra|sequia/, 'agricultura'],
  [/humedad|suelo/, 'suelo'], [/hielo|nieve|glaciar/, 'hielo'], [/deformac|sismo|terremoto|volcan|hundimiento/, 'deformacion']];
const NUMS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, medio: 0.5 };

function km(t) {
  const m = t.match(/(\d+(?:[.,]\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|medio)\s*(kilometros?|km|metros?|m)\b/);
  if (!m) return null;
  const n = NUMS[m[1]] ?? parseFloat(m[1].replace(',', '.'));
  return /^m(etros?)?$/.test(m[2]) ? n / 1000 : n;
}
const zoneName = raw => (raw.match(/(?:llamada|llamado|nombre|que se llame)\s+(.+?)(?:\s+y\s+|[.,;]|$)/i) || [])[1]?.trim();
const zoneRef = t => {
  const zs = window.TerraPulse?.app?.zones.listZones() || [];
  const hit = zs.filter(z => t.includes(norm(z.name))).sort((a, b) => b.name.length - a.name.length)[0];
  if (hit) return hit.id;
  const m = t.match(/zona\s+(\d+)/); return m ? `Zona ${m[1]}` : undefined;
};

const pick = a => a[Math.floor(Math.random() * a.length)];
const STOP = /^(terra )?(para|parale|detente|alto|silencio|callate|calla|espera|esperame|un momento|basta|ya basta|suficiente)( por favor| ya| terra| tantito)*$/;
export const GREETING = 'Hola, soy Terra, tu asistente de TerraPulse. Puedo llevarte a cualquier lugar del mapa, encerrar una zona con un polígono y decirte cómo están su vegetación, su humedad, la temperatura del terreno, los suelos, las señales de incendio y lo que ve el radar NISAR. ¿Qué zona quieres revisar?';
const HELP = 'Háblame como le hablarías a una persona. Para ir a un lugar dime «llévame a Durango», «busca el lago de Chapala» o solo el nombre. Para analizarlo, primero lo encerramos: «encierra dos kilómetros alrededor de aquí» o «quiero dibujar el polígono yo», y después «¿hay anomalías?», «¿cómo está la humedad?», «¿qué temperatura tiene?», «¿hay señales de incendio?» o «¿qué ve el radar NISAR?».';
const RUDE = /\b(put[oa]s?|pendej\w*|cabr[o]n\w*|ching\w*|verga|mierda|culer\w*|estupid\w*|idiota|imbecil|maric\w*|joder|carajo|mamada\w*|huev[o]n\w*|zorra|perra)\b/;
const TEMA = [[/anomal|fuera de lo normal|algo raro|cambio inusual|\btod[oa]s?\b|completo|general|problema|analiza(r)? (la|esta|esa) zona|revisa(r)? (la|esta|esa) zona|que (pasa|esta pasando)/, 'completo'],
  [/incendi|fuego|quem|foco/, 'incendios'], [/calor|temperatura|caliente|termic|grados/, 'calor'], [/humedad|humed[oa]|\bsec[oa]s?\b|\bagua\b|estres hidrico/, 'humedad'],
  [/suelo|\btierra\b|erosion|desnudo|degrad/, 'suelo'], [/nisar|radar|sar\b/, 'radar'], [/vegetacion|ndvi|\bverdes?\b|plantas|cultivo|\bbosques?\b|indices?/, 'vegetacion']];
const LAYER = [[/ndvi/, 'NDVI'], [/evi\b/, 'EVI'], [/savi/, 'SAVI'], [/ndmi|humedad/, 'NDMI'], [/nbr|quema/, 'NBR'], [/ndwi|agua/, 'NDWI'], [/bsi|suelo/, 'BSI'], [/temperatura|calor|termic/, 'LST'], [/nisar|radar/, 'NISAR']];

// Ir a un lugar: verbos que siempre significan «llévame» y verbos que también sirven para pedir datos
const PRE = '(?:(?:por favor|oye|ahora|y|tambien|entonces|bueno|quiero que|puedes|podrias|me puedes|me podrias|necesito que|quisiera que|me gustaria que|me gustaria) )*(?:me )?';
const PREP = '(?:hasta |hacia |a la |a el |a los |a las |al |a |en |por |sobre |de |el mapa en |el mapa a )?';
const NAV = new RegExp(`^${PRE}(?:llevame|lleves|llevar|llevarme|llevanos|mandame|mandes|mandar|mandarme|enviame|envies|transportame|vamos|vayamos|vamonos|ir|irme|quiero ir|viaja|viajar|vuela|volar|dirigete|ubicate|ubicame|ubica|muevete|mueve|movernos|acercate|localiza|localizame|encuentra|encuentrame|buscame|pon|centra|centrate|donde esta|donde queda|donde se encuentra)\\s+${PREP}(.+)$`);
const NAV_SOFT = new RegExp(`^${PRE}(?:busca|buscar|busques|muestrame|muestra|muestres|ensename|ensena|quiero ver|quiero conocer|ve|ver|explora|explorar|visita|visitar|vayamos)\\s+${PREP}(.+)$`);
const NOT_PLACE = /^(?:(?:el|la|los|las|un|una|si|que|como|cuanta|cuanto|cuantos|mis|me|lo|todo|toda|todos|todas) )*(?:hay |esta |tiene |estan )?(humedad|vegetacion|temperatura|calor|incendios?|fuego|focos?|anomalias?|radar|nisar|suelos?|indices?|ndvi|evi|savi|ndmi|nbr|ndwi|bsi|zonas?|poligonos?|eventos|alertas|reporte|informe|panel|tarjeta|configuracion|ajustes|mapa|capa|imagen|comparador|comparacion|antes|animacion|riesgo|datos|algo|que|seccion|modulo|inicio|final|arriba|abajo|aqui|ahi|busqueda|buscador|tema|modo|ayuda)\b/;
function place(raw, rest) {
  const xy = raw.match(/-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?/);
  if (xy) return xy[0];
  rest = rest.replace(/ (por favor|porfa|terra|ahora|ya)$/g, '').trim();
  if (!rest || /^(bosques?|agua|agricultura|hielo|suelo|deformacion)$/.test(rest)) return null;
  // Se toma del texto original (con acentos y mayúsculas) el mismo número de palabras finales
  const words = raw.replace(/[¿?¡!]/g, '').replace(/[.,\s]+$/, '').replace(/[\s,]+(por favor|porfa|terra|ahora|ya)$/i, '').trim().split(/\s+/);
  return words.slice(-rest.split(' ').length).join(' ');
}

// Devuelve [{name, args}] o {reply}; unknown:true cuando no se entendió.
// Entiende órdenes encadenadas: «llévame a Durango y encierra cinco kilómetros y dime la humedad».
export function parse(raw) {
  const parts = raw.split(/\s*,?\s+(?:y luego|y despu[eé]s|luego|despu[eé]s|y)\s+/i);
  if (parts.length > 1) {
    const all = parts.map(parse1);
    if (all.every(Array.isArray)) return all.flat();
  }
  return parse1(raw);
}
function parse1(raw) {
  const t = norm(raw), out = [];
  const zRef = zoneRef(t), zArg = zRef ? { zona: zRef } : {};
  const tema = TEMA.find(([re]) => re.test(t))?.[1];
  const asks = /\b(dime|dame|como|que|cual|cuanta?|cuantos?|hay|tiene|esta|muestra(me)?|ensena(me)?|quiero|quisiera|necesito|revisa|analiza|detecta|busca|calcula|checa|ver|saber|sobre|de la|del)\b/.test(t);

  if (RUDE.test(t)) return { reply: 'Prefiero que mantengamos un trato amable. Dime qué zona quieres revisar y con gusto te ayudo.' };
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|oye|que tal)\b/.test(t) && t.split(' ').length <= 5) return { reply: pick(['¡Hola! Aquí estoy. ¿Qué zona quieres que revisemos?', '¡Hola! Qué gusto escucharte. ¿A dónde vamos?', 'Hola, te escucho. ¿Qué lugar te gustaría ver?']) };
  if (/como estas|como te va|como andas/.test(t)) return { reply: pick(['Muy bien, gracias por preguntar. Lista para explorar contigo. ¿Qué zona revisamos?', 'Todo bien por aquí, con los satélites al día. ¿En qué te ayudo?']) };
  if (/\b(gracias|muchas gracias|te lo agradezco)\b/.test(t) && t.split(' ').length <= 5) return { reply: pick(['Con mucho gusto. Aquí sigo si necesitas algo más.', 'No hay de qué. Dime si quieres revisar otra cosa.', 'Para eso estoy. ¿Algo más?']) };
  if (/^(adios|hasta luego|nos vemos|bye|eso es todo|hasta pronto)\b/.test(t)) return { reply: pick(['Hasta luego. Cuando quieras seguimos explorando.', 'Nos vemos. Aquí estaré cuando me necesites.']) };
  if (/^(muy bien|perfecto|excelente|genial|que bien|ok|vale|de acuerdo|esta bien)$/.test(t)) return { reply: pick(['Perfecto. ¿Qué más quieres ver?', 'Muy bien. Dime qué sigue.']) };
  if (/(como te llamas|quien eres|tu nombre)/.test(t)) return { reply: 'Me llamo Terra. Soy la asistente de TerraPulse y te ayudo a revisar zonas del planeta con datos de satélite.' };
  if (/\b(compra|comprar|paga|pagar|suscrib|tarjeta|premium)/.test(t)) return { reply: 'En TerraPulse no hay compras, pagos ni suscripciones, así que eso no lo puedo hacer. Sí puedo ayudarte con el mapa y el análisis de zonas.' };
  if (/ayuda|que puedes hacer|que sabes hacer|para que sirves|como funciona/.test(t)) return { reply: HELP };

  if (/(delimita|encierra|marca|crea|haz|traza|dibuja|selecciona|define|rodea)\b.*\b(zona|area|circulo|radio|poligono|region|alrededor|kilometros?|km|metros)/.test(t) || /^(dibuja|delimita|encierra|quiero dibujar)\b/.test(t)) {
    const modo = /mano|manual|\byo\b|dibujar|poligono yo/.test(t) ? 'manual' : /visible|pantalla|lo que (veo|se ve)|vista/.test(t) ? 'area_visible' : 'radio';
    const place = modo === 'radio' ? (raw.match(/alrededor de(?:l| la| el)?\s+(.+?)(?:\s+y\s+|\s+llamad|[.,;]|$)/i) || [])[1] : null;
    const lugar = place && !/^(aqui|aca|este punto|esta zona|mi|donde estoy|el punto|ese punto)/i.test(norm(place)) ? place.trim() : null;
    out.push({ name: 'delimitar_zona', args: { modo, ...(modo === 'radio' ? { radio_km: Math.min(Math.max(km(t) || 2, 0.1), 20) } : {}), ...(lugar ? { lugar } : {}), ...(zoneName(raw) ? { nombre: zoneName(raw) } : {}) } });
    if (tema && (asks || /\by\b/.test(t)) && /\by\b.*(dime|dame|detecta|revisa|analiza|busca|hay|como|que)/.test(t)) out.push({ name: 'analizar_zona', args: { tema } });
    return out;
  }
  const nav = t.match(NAV) || (t.match(NAV_SOFT) && !NOT_PLACE.test(t.match(NAV_SOFT)[1]) ? t.match(NAV_SOFT) : null);
  if (nav && !/\b(seccion|modulo)\b/.test(t)) { const lugar = place(raw, nav[1]); if (lugar) return [{ name: 'buscar_lugar', args: { lugar } }]; }
  const ly = LAYER.find(([re]) => re.test(t));
  if (ly && /(muestra|pinta|ver|ensena|pon|cambia)\b.*\b(mapa|imagen|capa)/.test(t)) return [{ name: 'ver_indice_en_mapa', args: { indice: ly[1], ...zArg } }];
  if (/(que|cuales) zonas|lista(r)? (de )?zonas|mis zonas/.test(t)) return [{ name: 'listar_zonas', args: {} }];
  if (/(borra|elimina|quita)\b.*\b(zonas?|poligonos?)\b/.test(t)) return [{ name: 'borrar_zona', args: { zona: /todas|todos/.test(t) ? 'todas' : zRef || window.TerraPulse?.app?.zones.activeZone()?.id || '' } }];
  let m;
  if ((m = t.match(/(renombra|cambia el nombre de)\s+(?:la\s+)?zona\s+(.+?)\s+(?:a|por|como)\s+(.+)/))) return [{ name: 'renombrar_zona', args: { zona: zRef || (/^\d+$/.test(m[2]) ? `Zona ${m[2]}` : m[2]), nombre: raw.split(/\s(?:a|por|como)\s/i).pop() } }];

  if (/(desactiva|quita|apaga|cierra|deten)\b.*\b(comparador|comparacion|antes y despues)/.test(t)) return [{ name: 'comparar_antes_despues', args: { activar: false } }];
  if (/antes y despues|compara|comparador/.test(t)) { const y = t.match(/(\d+)\s*anos?/); return [{ name: 'comparar_antes_despues', args: { activar: true, ...(y ? { anos: Math.min(+y[1], 40) } : {}) } }]; }
  if (/(cierra|deten|para|quita)\b.*\banimacion/.test(t)) return [{ name: 'animacion', args: { activar: false } }];
  if (/anima|animacion|reproduce|timelapse/.test(t)) return [{ name: 'animacion', args: { activar: true } }];

  const sec = SEC.find(([re]) => re.test(t));
  if (sec && /\b(ve|vamos|ir|cambia|abre|pasa|seccion|modulo|entra)\b/.test(t) && !/llevame|busca|zona|poligono/.test(t)) return [{ name: 'ir_a_seccion', args: { seccion: sec[1] } }];
  if (tema && (asks || zRef || t.split(' ').length <= 4)) return [{ name: 'analizar_zona', args: { tema, ...zArg } }];

  if (/(acerca|zoom in|mas cerca|amplia)/.test(t)) return [{ name: 'acercar_alejar', args: { direccion: 'acercar' } }];
  if (/(aleja|zoom out|mas lejos)/.test(t)) return [{ name: 'acercar_alejar', args: { direccion: 'alejar' } }];
  if ((m = t.match(/\b(oculta|esconde|cierra|muestra|abre|ensena)\b.*\b(eventos|alertas|panel izquierdo|analisis|panel derecho)/))) {
    return [{ name: 'mostrar_panel', args: { panel: /eventos|alertas|izquierdo/.test(m[2]) ? 'eventos' : 'analisis', visible: !/oculta|esconde|cierra/.test(m[1]) } }];
  }
  if ((m = t.match(/\b(abre|muestra|ve a)\b.*\btarjeta de (analisis|modulo|ubicacion|zonas|fuentes)/)) || (m = t.match(/\b(abre|muestra)\b (?:las |la )?(zonas|fuentes)\b/))) return [{ name: 'abrir_tarjeta', args: { tarjeta: m[2] } }];
  if (/\b(baja|sube|desplaza|scroll|bajale|subele|pasale|recorre|hacia (abajo|arriba)|ve al (inicio|final))/.test(t)) {
    const dir = /inicio|arriba|sube|subele/.test(t) ? (/inicio/.test(t) ? 'inicio' : 'arriba') : /final/.test(t) ? 'final' : 'abajo';
    return [{ name: 'desplazar', args: { zona: /evento|alerta|lista/.test(t) ? 'eventos' : /analisis|zona|panel derecho/.test(t) ? 'analisis' : 'pagina', direccion: dir } }];
  }
  if (/(abre|muestra)\b.*\b(configuracion|ajustes)/.test(t)) return [{ name: 'ajustes', args: { abrir: true } }];
  if (/(cierra)\b.*\b(configuracion|ajustes)/.test(t)) return [{ name: 'ajustes', args: { abrir: false } }];
  if (/(tema|modo) (claro|oscuro)/.test(t)) return [{ name: 'cambiar_tema', args: { tema: /claro/.test(t) ? 'claro' : 'oscuro' } }];
  if (/sincroniza/.test(t)) return [{ name: 'sincronizar_fuentes', args: {} }];
  if (/actualiza (los )?(eventos|alertas)/.test(t)) return [{ name: 'actualizar_eventos', args: {} }];
  if (/(que|cuales|cuantos) (eventos|alertas)|hay (alertas|eventos)/.test(t)) return [{ name: 'eventos_visibles', args: { cantidad: 5 } }];
  if (/reporte|informe|pdf|descarga(r|me)? (los |el )?(datos|resultados?|analisis)/.test(t)) return [{ name: 'generar_reporte', args: zArg }];
  if (/comparte|compartir|copia (el )?enlace/.test(t)) return [{ name: 'compartir_ubicacion', args: {} }];
  if (/riesgo/.test(t)) return [{ name: 'analizar_aqui', args: { pestana: 'risk' } }];
  if ((m = t.match(/(?:escribe|pon|llena)\s+(.+?)\s+en (?:la |el )?(busqueda|buscador|fecha (?:de )?antes|fecha (?:de )?despues)/))) {
    const campo = /busq|busc/.test(m[2]) ? 'busqueda' : /antes/.test(m[2]) ? 'fecha_antes' : 'fecha_despues';
    return [{ name: 'llenar_campo', args: { campo, valor: m[1] } }];
  }
  if (/envia (la )?busqueda|busca lo que escribi/.test(t)) return [{ name: 'enviar_formulario', args: { formulario: 'busqueda' } }];
  if (/(donde estoy|que (estoy viendo|seccion)|en que seccion)/.test(t)) return [{ name: 'obtener_contexto', args: {} }];
  if (/selecciona (aqui|este punto|el centro)/.test(t)) return [{ name: 'seleccionar_punto', args: km(t) ? { radio_km: km(t) } : {} }];
  if ((m = t.match(/(?:^|\b)(?:llevame|ve|vamos|viaja|vuela|muestrame|ensename|busca|ubica|ubicate|dirigete|acercate|ir|quiero ir|quiero ver|vayamos|movernos|muevete)\s+(?:a la|a el|a los|a las|al|a|hacia|en|por)?\s*(.+)/))) {
    // Se toma del texto original (con acentos y decimales) el mismo número de palabras finales
    const xy = raw.match(/-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?/);
    if (xy) return [{ name: 'buscar_lugar', args: { lugar: xy[0] } }];
    const n = m[1].split(' ').length, words = raw.replace(/[¿?¡!]/g, '').replace(/[.\s]+$/, '').trim().split(/\s+/);
    const lugar = words.slice(-n).join(' ');
    if (lugar && !/^(bosques?|agua|agricultura|hielo|suelo|deformacion)$/.test(norm(lugar))) return [{ name: 'buscar_lugar', args: { lugar } }];
  }
  return { unknown: true, reply: 'Perdona, no te entendí. ¿A dónde quieres ir o qué quieres saber de la zona?' };
}

// Respuesta hablada a partir del resultado de una herramienta: siempre dice de qué trata cada número
export function describe(name, r) {
  if (!r.ok) return r.cancelled ? 'De acuerdo, no lo hice.' : (r.error || 'No pude hacerlo.');
  if (name === 'obtener_contexto') {
    const c = r.data; return `Estás en la sección ${c.seccion.nombre}${c.ubicacion_seleccionada ? `, con ${c.ubicacion_seleccionada.nombre.split(',')[0]} seleccionado` : ''}. En la parte visible del mapa hay ${c.eventos_visibles} eventos, y tienes ${c.zonas.length} ${c.zonas.length === 1 ? 'zona encerrada' : 'zonas encerradas'}.`;
  }
  if (name === 'listar_zonas') return r.data.length ? `Tienes ${r.data.length} ${r.data.length === 1 ? 'zona encerrada' : 'zonas encerradas'}: ${r.data.map(z => `${z.name}, de ${z.area_km2} kilómetros cuadrados`).join('; ')}.` : 'Todavía no hay zonas encerradas. Dime dónde trazar el polígono o dibújalo tú en el mapa.';
  if (name === 'eventos_visibles') return r.data.length ? `En la parte visible del mapa hay ${r.data.length} eventos. El más reciente es: ${r.data[0].titulo}, reportado por ${r.data[0].fuente}.` : 'No hay eventos en la parte visible del mapa.';
  return r.say || 'Listo.';
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const localSupported = { listen: !!SR, speak: 'speechSynthesis' in window };

let greeted = false;
const r_cancelled = s => s === 'Cancelado.';
export function createLocalEngine(cb, opt = {}) {
  let natural = !!(opt.eleven && opt.base != null), natVoice = !!(opt.tts && opt.base != null), ears = null, held = false, fails = 0, lastSaid = '';
  const voice = natVoice ? createVoice(opt.base) : null;
  let viaWeb = false, holdT = null, busy = 0, gen = 0, spokenSet = new Set();
  const WAKE = /\b(terra|detente|alto|espera|silencio|callate|basta)\b/;
  let misses = 0, rec = null, on = false, speaking = false, queue = Promise.resolve(), spoken = {}, spokenStr = '', echoUntil = 0;
  // El micrófono sigue abierto mientras Terra habla. Para no confundir su propia voz con la del usuario,
  // se ignora lo que el reconocedor oiga si casi todas sus palabras son de la frase que Terra está diciendo.
  const recent = [];   // lo último que dijo Terra: el reconocedor puede devolver su eco varios segundos después
  const said = text => { spokenStr = norm(text); spokenSet = new Set(spokenStr.split(' ')); recent.push({ str: spokenStr, set: spokenSet, end: Infinity }); if (recent.length > 4) recent.shift(); };
  const ended = (back = 0) => { const r = recent.at(-1); if (r && r.end === Infinity) r.end = Date.now() - back; };
  const isEcho = txt => {
    const t = norm(txt); if (!t) return true;
    const w = t.split(' '), now = Date.now();
    return recent.some(r => {
      const age = now - r.end; if (age > 9000) return false;
      const live = age < 1500;                                   // Terra sigue hablando o acaba de callar
      if (r.str.includes(t)) return live || w.length >= 3;       // trozo literal de lo que dijo
      return w.filter(x => r.set.has(x)).length / w.length >= 0.6 && (live || w.length >= 4);   // el eco suele oírse deformado
    });
  };
  // Cuando el usuario interrumpe, el reconocedor puede traer pegado al inicio un trozo de lo que Terra decía
  const stripEcho = txt => {
    const w = txt.split(/\s+/), n = w.map(norm); let i = 0;
    while (i < w.length - 1 && spokenStr.includes(`${n[i]} ${n[i + 1]}`)) i++;
    if (i > 0) i++;
    return i >= w.length ? (w.length <= 3 ? txt : '') : w.slice(i).join(' ');
  };
  const resume = () => { clearTimeout(holdT); if (held) { held = false; if (speaking) { voice.release(); cb.state('speaking'); } } };
  function hush() {   // el usuario habló: Terra guarda silencio de inmediato
    if (!speaking) return;
    speaking = false; ended(1500); spoken = {}; held = false; clearTimeout(holdT);
    voice?.stop();
    try { speechSynthesis.cancel(); } catch {}
    cb.state(on ? 'listening' : 'idle');
  }
  // Si ElevenLabs falla (sin créditos, sin red), Terra sigue con la voz y el oído del navegador
  function degrade(why, what) {
    if (++fails < 2) return;
    if (what === 'voice') { if (!natVoice) return; natVoice = false; cb.error(`La voz natural no está disponible (${why}). Sigo con la voz del navegador.`); return; }
    if (!natural) return;
    natural = false; resume();   // el detector de voz sigue activo para las interrupciones
    if (on) startRec();   // el oído pasa al reconocimiento del navegador
  }
  function speak(text) {
    cb.reply(text, true); lastSaid = text;
    if (natVoice) {
      if (on && !rec && !natural) startRec();
      const token = (spoken = {}); said(text); speaking = true; viaWeb = true; held = false; cb.state('speaking');
      voice.say(text).then(done => { fails = 0; if (token === spoken && done) { speaking = false; ended(); cb.state(on ? 'listening' : 'idle'); } })
        .catch(e => { if (token !== spoken) return; degrade(e.message, 'voice'); speakBrowser(text); });
      return;
    }
    speakBrowser(text);
  }
  const bestVoice = () => {   // prefiere las voces neuronales («Natural», «Online», Google) en español de México
    const vs = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
    const score = v => (/natural|online|neural/i.test(v.name) ? 4 : /google|paulina|dalia|sabina|monica/i.test(v.name) ? 2 : 0) + (/^es(-|_)MX/i.test(v.lang) ? 3 : /^es(-|_)(US|419)/i.test(v.lang) ? 2 : 0);
    return vs.sort((a, b) => score(b) - score(a))[0];
  };
  function speakBrowser(text) {
    if (!localSupported.speak) { speaking = false; if (on && !natural) startRec(); return; }
    try {
      speechSynthesis.cancel();
      const parts = text.match(/[^.!?]+[.!?]*/g) || [text];   // frases cortas: los navegadores cortan la voz en textos largos
      const v = bestVoice();
      spoken = {}; said(text); speaking = true; viaWeb = false; cb.state('speaking');
      if (on && !rec && !natural) startRec();
      const token = spoken;
      parts.forEach((p, i) => {
        const u = new SpeechSynthesisUtterance(p.trim()); u.lang = v?.lang || 'es-MX'; u.rate = 1; u.pitch = 1; u.volume = 1; if (v) u.voice = v;
        if (i === parts.length - 1) u.onend = u.onerror = () => { if (token !== spoken || !speaking) return; speaking = false; ended(); cb.state(on ? 'listening' : 'idle'); };
        speechSynthesis.speak(u);
      });
    } catch { speaking = false; }
  }
  // Entrada de cualquier frase del usuario. Las confirmaciones y las órdenes de «detente» no hacen fila:
  // se atienden al momento aunque Terra esté ocupada con otra tarea.
  function route(raw, alts = []) {
    const text = raw.replace(/^\s*(oye|hey|ok|okey)?[\s,]*terra[\s,.:]+/i, '').trim() || raw;
    hush();
    if (cb.answerConfirmSync?.(text)) { cb.heard(text, true); return; }
    if (STOP.test(norm(text))) { cb.heard(text, true); cb.cancelTool?.(); cb.state(on ? 'listening' : 'idle'); return; }
    if (busy) {   // Terra está trabajando: solo una orden clara sustituye a la tarea; un ruido o una frase suelta no la cancela
      if (parse(text).unknown && !alts.some(a => !parse(a).unknown)) return;
      cb.cancelTool?.();
    }
    const my = ++gen;
    return (queue = queue.then(() => handle(text, alts, my)).catch(() => {}));
  }
  // Oído natural: el detector avisa al primer sonido de voz (Terra se pausa) y luego llega la frase completa
  async function startEars() {
    try {
      ears = await createEars({
        loud: () => speaking,
        onSpeechStart() {   // alguien empezó a hablar: Terra se pausa al instante y escucha
          if (speaking && viaWeb) { held = true; voice.hold(); clearTimeout(holdT); holdT = setTimeout(resume, 8000); cb.state('listening'); }
          else if (natural) cb.state('listening');
        },
        async onUtterance(wavBlob) {
          if (!wavBlob) return resume();
          if (!natural) {   // oído del navegador: si no llega ninguna frase válida, Terra retoma lo que decía
            if (held) { const tk = spoken; clearTimeout(holdT); holdT = setTimeout(() => { if (tk === spoken) resume(); }, 2600); }
            return;
          }
          let text = '';
          try {
            const r = await fetch(`${opt.base}/api/v1/voice/stt`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wavBlob });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `error ${r.status}`);
            text = ((await r.json()).text || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim(); fails = 0;
          } catch (e) { resume(); return degrade(e.message, 'ears'); }
          if (norm(text).length < 2 || isEcho(text)) return resume();   // ruido o eco de la propia Terra: sigue hablando
          route(text);
        },
      });
      if (!on) { ears.close(); ears = null; } else if (!speaking) cb.state('listening');
    } catch (e) {
      ears = null; if (!natural) return;   // sin detector, las interrupciones dependen solo del reconocedor
      on = false; cb.error(e.name === 'NotAllowedError' ? 'Para que Terra te escuche, permite el micrófono en el navegador.' : 'No pude abrir el micrófono.', 'mic'); if (!speaking) cb.state('idle');
    }
  }
  const capped = (run, ms) => {   // ninguna tarea puede dejar a Terra esperando para siempre
    let t; const slow = new Promise(res => (t = setTimeout(() => { cb.cancelTool?.(); res({ ok: false, error: 'Eso está tardando demasiado, así que lo detuve. ¿Lo intentamos otra vez?' }); }, ms)));
    return Promise.race([run, slow]).finally(() => clearTimeout(t));
  };
  async function handle(text, alts, my) { busy++; try { await handle2(text, alts, my); } finally { busy--; } }
  async function handle2(text, alts = [], my = gen) {
    cb.heard(text, true);
    if (await cb.answerConfirm?.(text)) return;
    if (/^(repite|repitelo|otra vez|como dijiste|que dijiste|no (te )?escuche)/.test(norm(text)) && lastSaid) return speak(lastSaid);
    // De las alternativas que propone el reconocedor, se usa la primera que tenga sentido para el sitio
    let p = parse(text);
    if (p.unknown) for (const a of alts) { const q = parse(a); if (!q.unknown) { p = q; break; } }
    if (p.unknown && norm(text).split(' ').length <= 3 && !/^(si|no|ok|bueno|este|eh|ah|mmm)\b/.test(norm(text))) {
      // Dos o tres palabras sueltas suelen ser un lugar («Durango», «Sierra de Órganos»)
      cb.state('thinking');
      const r = await cb.tool('buscar_lugar', { lugar: text.replace(/[¿?¡!.]/g, '').trim() });
      if (my !== gen) return;
      if (r.ok) return speak(r.say);
    }
    if (p.unknown) {
      misses++;
      // A la tercera vez seguida no insiste en voz alta (evita que se quede repitiendo «no te entendí»)
      // Solo lo dice una vez; si sigue sin entender, guarda silencio y muestra un aviso (así nunca entra en bucle)
      if (misses >= 2) { cb.error('No te entendí. Prueba con «llévame a Durango» o «¿cómo está la humedad?».'); if (!speaking) cb.state(on ? 'listening' : 'idle'); return; }
      return speak(p.reply);
    }
    misses = 0;
    if (p.reply) return speak(p.reply);
    let last = '';
    for (const call of p) {
      cb.state('thinking');
      const manual = call.name === 'delimitar_zona' && call.args.modo === 'manual';
      const r = await (manual ? cb.tool(call.name, call.args) : capped(cb.tool(call.name, call.args), 90000));
      if (my !== gen) return;   // el usuario ya pidió otra cosa
      last = describe(call.name, r);
      if (!r.ok) break;
    }
    if (r_cancelled(last)) return cb.state(on ? 'listening' : 'idle');
    speak(last);
  }
  let buf = '', bufAlts = [], bufT = null;
  const flush = () => { clearTimeout(bufT); if (!buf) return; const t = buf, a = bufAlts; buf = ''; bufAlts = []; route(t, a); };
  function startRec() {
    if (!SR || !on) return;
    try { rec?.abort(); } catch {}
    rec = new SR(); rec.lang = 'es-MX'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 3;
    const mine = rec;
    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i], raw = r[0].transcript.trim(); let txt = raw;
        if (!raw) continue;
        if (speaking && viaWeb && ears) {
          // La voz natural pasa por el cancelador de eco: solo cuenta lo que el detector de voz confirmó
          if (held) { txt = stripEcho(raw); if (!txt) continue; }
          else { const m = norm(raw).match(WAKE); if (!m || spokenSet.has(m[0])) continue; hush(); }   // «Terra», «detente»… siempre interrumpen
        } else if (isEcho(raw)) continue;
        else if (speaking && (r.isFinal || raw.split(/\s+/).length >= 2)) hush();   // interrumpe a Terra
        if (!r.isFinal) { cb.heard(txt, false); if (buf) { clearTimeout(bufT); bufT = setTimeout(flush, 2200); } continue; }
        if (!buf) bufAlts = [...r].slice(1).map(a => a.transcript.trim()); else bufAlts = [];
        buf = `${buf} ${txt}`.trim(); clearTimeout(bufT);
        if (buf.split(/\s+/).length <= 2 || STOP.test(norm(buf))) flush(); else bufT = setTimeout(flush, 900);   // pausa breve: quizá sigue hablando
      }
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { on = false; cb.error('Para que Terra te escuche, permite el micrófono en el navegador.', 'mic'); if (!speaking) cb.state('idle'); }
      else if (e.error === 'network') { on = false; cb.error('El reconocimiento de voz del navegador necesita conexión a internet.', 'mic'); if (!speaking) cb.state('idle'); }
    };
    rec.onend = () => { if (rec === mine) { rec = null; if (on) setTimeout(startRec, 120); } };
    try { rec.start(); if (!speaking) cb.state('listening'); } catch { rec = null; }
  }
  return {
    get mode() { return natVoice ? 'voz-natural' : 'local'; },
    start() {
      on = true;
      if (natural) startEars();
      else if (!SR) { on = false; cb.error('Este navegador no reconoce la voz. Usa Chrome o Edge para hablar con Terra.', 'mic'); }
      else { startRec(); if (natVoice) startEars(); }      // escucha desde el primer instante, también durante la presentación
      if (!greeted) { greeted = true; speak(GREETING); }   // la presentación se dice una sola vez, aunque la interrumpan
    },
    stop() { on = false; try { rec?.abort(); } catch {} rec = null; ears?.close(); ears = null; held = false; clearTimeout(holdT); spoken = {}; voice?.stop(); try { speechSynthesis.cancel(); } catch {} speaking = false; ended(); cb.state('idle'); },
    sendText: t => route(t),
    say: speak,
    interrupt: hush,
    get listening() { return on; },
  };
}
