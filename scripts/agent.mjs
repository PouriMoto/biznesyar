// یک دستور برای Agent:  npm run agent   (یا  npm run agent -- once  برای یک‌بار اجرا)
// کیت را می‌سازد، وابستگی‌های پایتون را در صورت نبود نصب می‌کند، سلامت را می‌سنجد و صف را پایش می‌کند.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const root = fileURLToPath(new URL('..', import.meta.url));
const engineDir = resolve(process.env.ENGINE_DIR || join(root, '..', 'engine'));
const project = process.env.ENGINE_PROJECT || 'projects/bizyaar.yaml';
const once = process.argv.includes('once');
const py = ['python3', 'python'].find((c) => spawnSync(c, ['--version']).status === 0);

const fail = (m) => { console.error('✗ ' + m); process.exit(1); };
if (!existsSync(engineDir)) fail(`پوشهٔ Engine پیدا نشد: ${engineDir}\n  اگر جای دیگری است: ENGINE_DIR=/مسیر npm run agent`);
if (!py) fail('Python نصب نیست (python3 لازم است).');
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', cwd: opts.cwd ?? root, env: process.env });

console.log('› ساخت کیت…');
if (run('node', ['scripts/build-kit.mjs']).status !== 0) fail('ساخت کیت شکست خورد.');

if (spawnSync(py, ['-c', 'import yaml'], { cwd: engineDir }).status !== 0) {
  console.log('› نصب وابستگی‌های پایتون (یک‌بار)…');
  run(py, ['-m', 'pip', 'install', '-r', 'requirements.txt', '--break-system-packages'], { cwd: engineDir });
}

console.log('› بررسی سلامت (doctor)…');
const d = run(py, ['-m', 'engine', 'doctor', '-p', project], { cwd: engineDir });
if (d.status !== 0) fail('یکی از بررسی‌ها ناموفق است؛ خط ✗ بالا را ببینید (معمولاً لینک صف یا کلید مدل).');

console.log(once ? '› یک‌بار اجرا…' : '› پایش صف (برای توقف: Ctrl+C)…');
process.exit(run(py, ['-m', 'engine', 'run', '-p', project, ...(once ? [] : ['--watch'])], { cwd: engineDir }).status ?? 0);
