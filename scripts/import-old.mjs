// واردکردن داده‌های «پروژهٔ استاتیک قدیمی» (که در گیت‌هاب منتشر کرده بودید) به این پروژه، بدون از دست رفتن متن‌ها.
// اجرا:  npm run import-old -- ../مسیر-ریپوی-قدیمی            ← فقط گزارش (چیزی نوشته نمی‌شود)
//        npm run import-old -- ../مسیر-ریپوی-قدیمی --apply     ← اعمال
//        --overwrite: فایل‌های متفاوت موجود را هم با نسخهٔ قدیمی جایگزین کن (پیش‌فرض: فقط گزارش تداخل)
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const oldRoot = resolve(args.find((a) => !a.startsWith('--')) ?? '');
const APPLY = args.includes('--apply'), OVER = args.includes('--overwrite');
const root = fileURLToPath(new URL('..', import.meta.url));
if (!args.find((a) => !a.startsWith('--')) || !existsSync(join(oldRoot, 'src'))) { console.error('مسیر ریپوی قدیمی را بدهید (پوشه‌ای که src/ دارد).'); process.exit(1); }

const readJson = (f, d = null) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf-8')) : d);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (base, over) => (isObj(base) && isObj(over) ? Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(over)])].map((k) => [k, k in over ? merge(base[k], over[k]) : base[k]])) : over === undefined ? base : over);
const log = []; const say = (t, m) => log.push(`${t.padEnd(9)} ${m}`);
const write = (f, text) => { if (APPLY) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); } };
const same = (a, b) => readFileSync(a).equals(readFileSync(b));
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])) : []);

// ۱) تنظیمات سایت: مقدارهای قدیمی روی ساختار جدید می‌نشیند؛ گوگل‌فرم به site.local.json می‌رود
const oc = readJson(join(oldRoot, 'src/config/site.config.json')), nf = join(root, 'src/config/site.config.json'), nc = readJson(nf);
if (oc) {
  const merged = merge(nc, oc);
  const gf = oc.leads?.googleForm; const real = gf?.action && !/FORM_ID_HERE/.test(gf.action);
  if (real) {
    merged.leads.googleForm = nc.leads.googleForm; // در فایل اصلی، قالب بماند
    const lf = join(root, 'src/config/site.local.json');
    write(lf, JSON.stringify(merge(readJson(lf, {}), { leads: { googleForm: gf } }), null, 2) + '\n');
    say('گوگل‌فرم', 'به src/config/site.local.json رفت (در گیت نمی‌رود). برای GitHub Actions این دو Variable را بسازید:\n            PUBLIC_GFORM_ACTION=' + gf.action + '\n            PUBLIC_GFORM_FIELDS=' + JSON.stringify(gf.fields));
  } else say('گوگل‌فرم', 'در پروژهٔ قدیمی هنوز تنظیم نشده بود');
  merged.mode = nc.mode; // حالت را سوییچ SITE_MODE تعیین می‌کند
  write(nf, JSON.stringify(merged, null, 2) + '\n'); say('ادغام', 'src/config/site.config.json (برند، تماس، تم، سئو…)');
}

// ۲) متن صفحه‌ها
const oh = readJson(join(oldRoot, 'src/data/home.json')), hf = join(root, 'src/data/home.json');
if (oh) { write(hf, JSON.stringify(merge(readJson(hf, {}), oh), null, 2) + '\n'); say('ادغام', 'src/data/home.json (متن‌های شما حفظ، کلیدهای تازه اضافه)'); }

// ۳) مناطق: regions.json قدیمی ← یک فایل برای هر منطقه
const or = readJson(join(oldRoot, 'src/data/regions.json'), []);
for (const r of or) {
  const f = join(root, 'src/data/regions', r.slug + '.json');
  write(f, JSON.stringify(merge(readJson(f, {}), r), null, 2) + '\n'); say('منطقه', r.slug + (existsSync(f) ? ' (ادغام)' : ' (تازه)'));
}

// ۴) فایل‌ها: آنچه در جدید نیست کپی می‌شود؛ تفاوت‌دار فقط گزارش (مگر --overwrite)
const conflicts = [];
for (const dir of ['src/content/articles', 'src/content/areas', 'src/assets', 'public/brand', 'public/downloads', 'public/help', 'src/data/services.json', 'public/flows']) {
  const files = statSyncSafe(join(oldRoot, dir)) === 'file' ? [join(oldRoot, dir)] : walk(join(oldRoot, dir));
  for (const f of files) {
    const rel = f.slice(oldRoot.length + 1), t = join(root, rel);
    if (!existsSync(t)) { if (APPLY) { mkdirSync(dirname(t), { recursive: true }); copyFileSync(f, t); } say('کپی', rel); }
    else if (!same(f, t)) { if (OVER) { if (APPLY) copyFileSync(f, t); say('جایگزین', rel); } else conflicts.push(rel); }
  }
}
function statSyncSafe(p) { try { return statSync(p).isDirectory() ? 'dir' : 'file'; } catch { return ''; } }

console.log((APPLY ? '✓ اعمال شد\n' : 'گزارش (چیزی نوشته نشد؛ برای اعمال --apply بزنید)\n') + log.join('\n'));
if (conflicts.length) console.log('\nفایل‌هایی که در هر دو نسخه هست ولی فرق دارد (دست‌نخورده ماند؛ اگر نسخهٔ قدیمی درست است --overwrite یا دستی مقایسه کنید):\n  ' + conflicts.join('\n  '));
