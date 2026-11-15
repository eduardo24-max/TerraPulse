// Crea backend/.venv e instala las dependencias de la API local: npm run setup
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..', 'backend');
const win = process.platform === 'win32';
const base = win ? 'python' : 'python3';
const venvPy = join(backend, '.venv', win ? 'Scripts/python.exe' : 'bin/python');
const step = (cmd, args) => {
  console.log('>', cmd, args.join(' '));
  const r = spawnSync(cmd, args, { cwd: backend, stdio: 'inherit' });
  if (r.status !== 0) { console.error('Falló el paso anterior.'); process.exit(1); }
};
step(base, ['-m', 'venv', '.venv']);
step(venvPy, ['-m', 'pip', 'install', '--upgrade', 'pip']);
step(venvPy, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
console.log('Listo. Ahora ejecuta: npm run dev');
