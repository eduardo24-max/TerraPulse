// Arranca la API local (FastAPI en 127.0.0.1:8000) y la web (Vite) con un solo comando: npm run dev
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const legacy = join(root, '..', 'backend-observatorio'); // carpeta original del backend
const win = process.platform === 'win32';

// 1) Migración automática: trae .env y la caché de eventos de la carpeta original si faltan
for (const f of ['.env', '.events_cache.json']) {
  if (!existsSync(join(backend, f)) && existsSync(join(legacy, f))) {
    copyFileSync(join(legacy, f), join(backend, f));
    console.log(`[setup] Copiado ${f} desde backend-observatorio`);
  }
}

// 2) Python con las dependencias: venv propio → venv original → Python del sistema
const candidates = [
  join(backend, '.venv', win ? 'Scripts/python.exe' : 'bin/python'),
  join(legacy, '.venv', win ? 'Scripts/python.exe' : 'bin/python'),
  win ? 'python' : 'python3',
];
const python = candidates.find(p => {
  if (p.includes('.venv') && !existsSync(p)) return false;
  return spawnSync(p, ['-c', 'import fastapi, uvicorn, apscheduler, httpx, asf_search'], { stdio: 'ignore' }).status === 0;
});

const procs = [];
const run = (name, cmd, args, cwd) => {
  const p = spawn(cmd, args, { cwd, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  const tag = (d, out) => String(d).split(/\r?\n/).filter(Boolean).forEach(l => out.write(`[${name}] ${l}\n`));
  p.stdout.on('data', d => tag(d, process.stdout));
  p.stderr.on('data', d => tag(d, process.stderr));
  p.on('exit', code => console.log(`[${name}] terminó (código ${code})`));
  procs.push(p);
};

if (python) {
  console.log(`[api] Usando ${python}`);
  run('api', python, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], backend);
} else {
  console.warn('[api] No encontré Python con las dependencias del backend. Ejecuta: npm run setup');
}
run('web', process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js')], root);

const stop = () => { procs.forEach(p => p.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
