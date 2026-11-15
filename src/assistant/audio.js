// Oído y voz naturales de Terra (cuando el backend tiene ELEVENLABS_API_KEY).
// Oído: micrófono con cancelación de eco + compresor + ganancia para captar voces lejanas, y un detector
// de voz propio que avisa en cuanto alguien habla (así Terra se calla al instante) y entrega la frase en WAV.
// Voz: audio de ElevenLabs reproducido con Web Audio, amplificado y comprimido para oírse fuerte y claro.
const WORKLET = `class Vad extends AudioWorkletProcessor{constructor(){super();this.b=[];this.p=0}
process(i){const c=i[0]&&i[0][0];if(c){const r=sampleRate/16000;for(;this.p<c.length;this.p+=r){const s=Math.max(-1,Math.min(1,c[Math.floor(this.p)]));this.b.push(s<0?s*32768:s*32767)}this.p-=c.length;
while(this.b.length>=320){const a=Int16Array.from(this.b.splice(0,320));this.port.postMessage(a.buffer,[a.buffer])}}return true}}registerProcessor('terra-vad',Vad);`;

function wav(frames) {
  const n = frames.reduce((a, f) => a + f.length, 0), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44; for (const f of frames) for (const s of f) { v.setInt16(o, s, true); o += 2; }
  return new Blob([buf], { type: 'audio/wav' });
}

// Cadena de micrófono de largo alcance: quita graves de fondo, comprime (sube lo débil) y amplifica
export function farFieldChain(ctx, stream, gain = 3) {
  const src = ctx.createMediaStreamSource(stream);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -45; comp.knee.value = 30; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.25;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(hp).connect(lp).connect(comp).connect(g);
  return g;
}
export const MIC = { audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } };

// loud(): true mientras Terra habla (se exige una voz más clara para interrumpirla y no dispararse con su eco)
export async function createEars({ onSpeechStart, onUtterance, loud }) {
  const stream = await navigator.mediaDevices.getUserMedia(MIC);
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
  const node = new AudioWorkletNode(ctx, 'terra-vad');
  const mute = ctx.createGain(); mute.gain.value = 0;
  farFieldChain(ctx, stream).connect(node); node.connect(mute).connect(ctx.destination);   // el nodo debe llegar a la salida para procesarse
  let floor = 0.01, hot = 0, cold = 0, voiced = 0, talking = false, frames = [], pre = [];
  node.port.onmessage = e => {
    const pcm = new Int16Array(e.data); let s = 0; for (let i = 0; i < pcm.length; i++) s += pcm[i] * pcm[i];
    const rms = Math.sqrt(s / pcm.length) / 32768, thr = Math.max(0.014, floor * 3) * (loud?.() ? 3 : 1), isHot = rms > thr;
    if (!talking) {
      floor = Math.min(0.08, isHot ? floor * 0.995 + rms * 0.005 : floor * 0.97 + rms * 0.03);   // ruido de fondo adaptable
      pre.push(pcm); if (pre.length > 20) pre.shift();                                        // 0.4 s previos para no cortar el inicio
      hot = isHot ? hot + 1 : Math.max(0, hot - 2);
      if (hot >= (loud?.() ? 12 : 7)) { talking = true; frames = pre.splice(0); voiced = hot; cold = 0; onSpeechStart?.(); }
    } else {
      frames.push(pcm); if (isHot) { voiced++; cold = 0; } else cold++;
      if (cold >= 38 || frames.length >= 750) {            // 0.75 s de silencio o 15 s de frase
        talking = false; hot = 0; const f = frames; frames = [];
        onUtterance?.(voiced >= 12 ? wav(f) : null);       // menos de un cuarto de segundo de voz: fue un ruido
      }
    }
  };
  return { close() { try { node.port.onmessage = null; node.disconnect(); stream.getTracks().forEach(t => t.stop()); ctx.close(); } catch {} } };
}

const chunks = text => {   // primera frase sola (empieza a sonar antes); el resto en bloques de hasta ~260 caracteres
  const parts = (text.match(/[^.!?]+[.!?]*/g) || [text]).map(s => s.trim()).filter(Boolean), out = [];
  for (const p of parts) { if (out.length > 1 && (out[out.length - 1] + ' ' + p).length <= 260) out[out.length - 1] += ' ' + p; else out.push(p); }
  return out;
};

export function createVoice(base) {
  let ctx = null, out = null, token = 0, sources = [], abort = null;
  function chain() {
    ctx ??= new AudioContext();
    if (!out) {
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
      out = ctx.createGain(); out.gain.value = 1.5; out.connect(comp).connect(ctx.destination);   // más volumen sin distorsión
    }
  }
  async function part(text, signal) {
    const r = await fetch(`${base}/api/v1/voice/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `Error ${r.status} de la voz`);
    return ctx.decodeAudioData(await r.arrayBuffer());
  }
  function stop() { token++; abort?.abort(); abort = null; sources.forEach(s => { try { s.onended = null; s.stop(); } catch {} }); sources = []; ctx?.resume().catch(() => {}); }
  // Resuelve true si terminó de hablar, false si la interrumpieron; lanza error si ElevenLabs no respondió
  async function say(text) {
    stop(); const my = token; chain(); await ctx.resume();
    const ac = (abort = new AbortController()), bufs = chunks(text).map(p => part(p, ac.signal));
    bufs.forEach(p => p.catch(() => {}));
    let t = 0, last = null, played = 0;
    for (const p of bufs) {
      let b; try { b = await p; } catch (e) { if (my !== token) return false; if (!played) throw e; break; }
      if (my !== token) return false;
      const s = ctx.createBufferSource(); s.buffer = b; s.connect(out);
      t = Math.max(t, ctx.currentTime + 0.02); s.start(t); t += b.duration; sources.push(s); last = s; played++;
    }
    if (!last) return true;
    return new Promise(res => { last.onended = () => res(my === token); });
  }
  return { say, stop, hold: () => ctx?.suspend().catch(() => {}), release: () => ctx?.resume().catch(() => {}) };
}
