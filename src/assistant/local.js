// Motor local (sin clave): reconocimiento de voz del navegador + intérprete de frases en español +
// síntesis de voz. Usa exactamente las mismas herramientas autorizadas que el modo Gemini.
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

export const GREETING = 'Hola, soy Terra, tu asistente de TerraPulse. Puedo llevarte a cualquier lugar del mapa, encerrar una zona con un polígono y decirte cómo están su vegetación, su humedad, la temperatura del terreno, los suelos, las señales de incendio y lo que ve el radar NISAR. ¿Qué zona quieres revisar?';
const HELP = 'Primero encerramos una zona y luego me dices qué quieres saber. Por ejemplo: «llévame a Durango», «encierra dos kilómetros alrededor de aquí», «quiero dibujar el polígono yo», y después «¿hay anomalías?», «¿cómo está la humedad?», «¿qué temperatura tiene?», «¿hay señales de incendio?» o «¿qué ve el radar NISAR?».';
const RUDE = /\b(put[oa]s?|pendej\w*|cabr[o]n\w*|ching\w*|verga|mierda|culer\w*|estupid\w*|idiota|imbecil|maric\w*|joder|carajo|mamada\w*|huev[o]n\w*|zorra|perra)\b/;
const TEMA = [[/anomal|fuera de lo normal|algo raro|cambio inusual|\btod[oa]s?\b|completo|general|problema|analiza(r)? (la|esta|esa) zona|revisa(r)? (la|esta|esa) zona|que (pasa|esta pasando)/, 'completo'],
  [/incendi|fuego|quem|foco/, 'incendios'], [/calor|temperatura|caliente|termic|grados/, 'calor'], [/humedad|humed[oa]|sec[oa]|agua|estres hidrico/, 'humedad'],
  [/suelo|tierra|erosion|desnudo|degrad/, 'suelo'], [/nisar|radar|sar\b/, 'radar'], [/vegetacion|ndvi|verde|plantas|cultivo|bosque|indices?/, 'vegetacion']];
const LAYER = [[/ndvi/, 'NDVI'], [/evi\b/, 'EVI'], [/savi/, 'SAVI'], [/ndmi|humedad/, 'NDMI'], [/nbr|quema/, 'NBR'], [/ndwi|agua/, 'NDWI'], [/bsi|suelo/, 'BSI'], [/temperatura|calor|termic/, 'LST'], [/nisar|radar/, 'NISAR']];

// Devuelve [{name, args}] o {reply}; unknown:true cuando no se entendió
export function parse(raw) {
  const t = norm(raw), out = [];
  const zRef = zoneRef(t), zArg = zRef ? { zona: zRef } : {};
  const tema = TEMA.find(([re]) => re.test(t))?.[1];
  const asks = /\b(dime|dame|como|que|cual|cuanta?|cuantos?|hay|tiene|esta|muestra(me)?|ensena(me)?|quiero|quisiera|necesito|revisa|analiza|detecta|busca|calcula|checa|ver|saber|sobre|de la|del)\b/.test(t);

  if (RUDE.test(t)) return { reply: 'Prefiero que mantengamos un trato amable. Dime qué zona quieres revisar y con gusto te ayudo.' };
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|oye)\b/.test(t) && t.split(' ').length <= 4) return { reply: 'Hola, aquí estoy. ¿Qué zona quieres revisar?' };
  if (/\b(gracias|muchas gracias)\b/.test(t) && t.split(' ').length <= 4) return { reply: 'Con gusto. Aquí sigo si necesitas algo más.' };
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
  if (/reporte|informe|pdf/.test(t)) return [{ name: 'generar_reporte', args: {} }];
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
  return { unknown: true, reply: 'Perdona, no te entendí bien. Puedo llevarte a un lugar, encerrar una zona con un polígono y decirte cómo están su vegetación, humedad, temperatura, suelos, incendios o el radar NISAR. ¿Qué te gustaría?' };
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
export function createLocalEngine(cb) {
  let misses = 0, rec = null, on = false, speaking = false, queue = Promise.resolve(), spoken = {}, spokenStr = '', echoUntil = 0;
  // El micrófono sigue abierto mientras Terra habla. Para no confundir su propia voz con la del usuario,
  // se ignora lo que el reconocedor oiga si casi todas sus palabras son de la frase que Terra está diciendo.
  const isEcho = txt => {
    if (!speaking && Date.now() > echoUntil) return false;
    const t = norm(txt); if (!t) return true;
    if (spokenStr.includes(t)) return true;                      // es un trozo literal de lo que Terra dice
    const w = t.split(' '); if (w.length < 3) return false;      // frase corta que Terra no dijo: es el usuario
    let hit = 0; for (let i = 0; i < w.length - 1; i++) if (spokenStr.includes(`${w[i]} ${w[i + 1]}`)) hit++;
    return hit / (w.length - 1) >= 0.6;                          // casi todos los pares de palabras seguidas coinciden
  };
  function hush() {   // el usuario habló: Terra guarda silencio de inmediato
    if (!speaking) return;
    speaking = false; echoUntil = 0;
    try { speechSynthesis.cancel(); } catch {}
    cb.state(on ? 'listening' : 'idle');
  }
  function speak(text) {
    cb.reply(text, true);
    if (!localSupported.speak) { if (on) startRec(); return; }
    try {
      speechSynthesis.cancel();
      const parts = text.match(/[^.!?]+[.!?]*/g) || [text];   // frases cortas: los navegadores cortan la voz en textos largos
      const v = speechSynthesis.getVoices().find(v => /^es(-|_)(MX|US|419)/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^es/i.test(v.lang));
      spoken = {}; spokenStr = norm(text); speaking = true; cb.state('speaking');
      if (on && !rec) startRec();
      const token = spoken;
      parts.forEach((p, i) => {
        const u = new SpeechSynthesisUtterance(p.trim()); u.lang = v?.lang || 'es-MX'; u.rate = 1; u.pitch = 1.05; if (v) u.voice = v;
        if (i === parts.length - 1) u.onend = u.onerror = () => { if (token !== spoken || !speaking) return; speaking = false; echoUntil = Date.now() + 700; cb.state(on ? 'listening' : 'idle'); };
        speechSynthesis.speak(u);
      });
    } catch { speaking = false; }
  }
  async function handle(text, alts = []) {
    cb.heard(text, true);
    if (await cb.answerConfirm?.(text)) return;
    // De las alternativas que propone el reconocedor, se usa la primera que tenga sentido para el sitio
    let p = parse(text);
    if (p.unknown) for (const a of alts) { const q = parse(a); if (!q.unknown) { p = q; break; } }
    if (p.unknown && norm(text).split(' ').length <= 3 && !/^(si|no|ok|bueno|este|eh|ah|mmm)\b/.test(norm(text))) {
      // Dos o tres palabras sueltas suelen ser un lugar («Durango», «Sierra de Órganos»)
      cb.state('thinking');
      const r = await cb.tool('buscar_lugar', { lugar: text.replace(/[¿?¡!.]/g, '').trim() });
      if (r.ok) return speak(`${r.say} Si quieres, lo encierro con un polígono para analizarlo.`);
    }
    if (p.unknown) { misses++; return speak(misses % 3 === 1 ? p.reply : 'No te entendí. ¿Me lo dices de otra forma?'); }
    misses = 0;
    if (p.reply) return speak(p.reply);
    let last = '';
    for (const call of p) {
      cb.state('thinking');
      const r = await cb.tool(call.name, call.args);
      last = describe(call.name, r);
      if (!r.ok) break;
    }
    speak(last);
  }
  function startRec() {
    if (!SR || !on) return;
    try { rec?.abort(); } catch {}
    rec = new SR(); rec.lang = 'es-MX'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 3;
    const mine = rec;
    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i], txt = r[0].transcript.trim();
        if (!txt || isEcho(txt)) continue;
        if (speaking && (r.isFinal || txt.split(/\s+/).length >= 2)) hush();   // interrumpe a Terra
        if (!r.isFinal) { cb.heard(txt, false); continue; }
        const alts = [...r].slice(1).map(a => a.transcript.trim());
        queue = queue.then(() => handle(txt, alts)).catch(() => {});
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
    mode: 'local',
    start() {
      on = true;
      if (!SR) { on = false; cb.error('Este navegador no reconoce la voz. Usa Chrome o Edge para hablar con Terra.', 'mic'); }
      else startRec();      // escucha desde el primer instante, también durante la presentación
      if (!greeted) { greeted = true; speak(GREETING); }   // la presentación se dice una sola vez, aunque la interrumpan
    },
    stop() { on = false; try { rec?.abort(); } catch {} rec = null; try { speechSynthesis.cancel(); } catch {} speaking = false; cb.state('idle'); },
    sendText: t => { hush(); return (queue = queue.then(() => handle(t)).catch(() => {})); },
    say: speak,
    interrupt: hush,
    get listening() { return on; },
  };
}
