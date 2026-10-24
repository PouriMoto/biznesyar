// ساخت «بسته کیت» برای Studio و Engine: public/studio/kit.json + preview.css
// اجرا: npm run kit   (خودکار قبل از dev و build)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (...a) => join(root, ...a);
const readJson = (f, d = null) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf-8')) : d);
const list = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)).sort() : []);

function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  let data = {};
  try { data = YAML.parse(m[1]) ?? {}; } catch (e) { data = { _error: String(e) }; }
  return { data, body: m[2] };
}

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row); }
  const [head, ...rest] = rows;
  return head ? rest.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()]))) : [];
}

const kitDir = p('content-kit');
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => (isObj(a) && isObj(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : (b === undefined ? a : b));
// فایل‌های *.local.json (در گیت نیستند) روی فایل اصلی ادغام می‌شوند؛ مقدارهای شخصی مثل لینک صف Agent اینجا می‌مانند
const kit = merge(readJson(join(kitDir, 'kit.json'), {}), readJson(join(kitDir, 'kit.local.json'), {}));
const contract = readJson(join(kitDir, 'contract.json'), { types: {} });
const profile = readJson(join(kitDir, 'profile.json'), {});
const site = merge(readJson(p('src/config/site.config.json'), {}), readJson(p('src/config/site.local.json'), {}));

const styles = list(join(kitDir, 'styles'), /\.md$/).map((f) => {
  const { data, body } = frontMatter(readFileSync(join(kitDir, 'styles', f), 'utf-8'));
  return { ...data, id: data.id ?? basename(f, '.md'), instructions: body.trim() };
});

const examples = {};
for (const f of list(join(kitDir, 'examples'), /\.md$/)) if (f !== 'README.md') examples[basename(f, '.md')] = readFileSync(join(kitDir, 'examples', f), 'utf-8');

const keywords = parseCsv(existsSync(join(kitDir, 'knowledge/keywords.csv')) ? readFileSync(join(kitDir, 'knowledge/keywords.csv'), 'utf-8') : '');
const places = parseCsv(existsSync(join(kitDir, 'knowledge/places.csv')) ? readFileSync(join(kitDir, 'knowledge/places.csv'), 'utf-8') : '');
const rules = list(join(kitDir, 'knowledge/rules'), /\.md$/).filter((f) => f !== 'README.md').map((f) => {
  const { data, body } = frontMatter(readFileSync(join(kitDir, 'knowledge/rules', f), 'utf-8'));
  return { id: data.id ?? basename(f, '.md'), title: data.title ?? '', source: data.source ?? '', date: data.date ? String(data.date) : '', services: data.services ?? [], trades: data.trades ?? [], regions: data.regions ?? [], text: body.trim() };
});

const services = (readJson(p('src/data/services.json'), [])).map((s) => ({ ...s, enabled: !!(site.services ?? []).find((x) => x.slug === s.slug && x.enabled) }));
const trades = readJson(p('src/data/trades.json'), []);
const flows = {};
for (const f of list(p('public/flows'), /\.json$/)) { const j = readJson(p('public/flows', f)); if (j?.service) flows[j.service] = j; }

const regions = list(p('src/data/regions'), /\.json$/).map((f) => readJson(p('src/data/regions', f))).sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000));

const articles = list(p('src/content/articles'), /\.mdx?$/).map((f) => {
  const { data, body } = frontMatter(readFileSync(p('src/content/articles', f), 'utf-8'));
  return { slug: f.replace(/\.mdx?$/, ''), ext: f.endsWith('.mdx') ? 'mdx' : 'md', title: data.title ?? '', description: data.description ?? '', category: data.category ?? '', tags: data.tags ?? [], service: data.service ?? '', region: data.region ?? '', draft: !!data.draft, words: body.split(/\s+/).filter(Boolean).length };
});
const guides = list(p('src/content/guides'), /\.mdx?$/).map((f) => {
  const { data, body } = frontMatter(readFileSync(p('src/content/guides', f), 'utf-8'));
  return { slug: f.replace(/\.mdx?$/, ''), ext: f.endsWith('.mdx') ? 'mdx' : 'md', title: data.title ?? '', description: data.description ?? '', trade: data.trade ?? '', service: data.service ?? '', region: data.region ?? '', draft: !!data.draft, words: body.split(/\s+/).filter(Boolean).length };
});
const areas = list(p('src/content/areas'), /\.mdx?$/).map((f) => {
  const { body } = frontMatter(readFileSync(p('src/content/areas', f), 'utf-8'));
  return { slug: f.replace(/\.mdx?$/, ''), body: body.slice(0, 4000) };
});

const paths = ['/', '/about/', '/contact/', '/articles/', '/areas/', '/guides/',
  ...guides.map((g) => `/guides/${g.slug}/`),
  ...articles.map((a) => `/articles/${a.slug}/`),
  ...regions.map((r) => `/areas/${r.slug}/`),
  ...services.map((s) => `/services/${s.slug}/`)];

const out = {
  generatedAt: new Date().toISOString(),
  kit: { name: kit.name, version: kit.version, lang: kit.lang ?? 'fa', dir: kit.dir ?? 'rtl', studio: kit.studio ?? {} },
  site: { name: site.brand?.name_fa, nameEn: site.brand?.name_en, tagline: site.brand?.tagline, url: site.brand?.url, disclaimer: site.legal?.disclaimer ?? '', city: 'بندرعباس', theme: site.theme ?? {} },
  contract, profile, styles, examples, components: readJson(p('content-kit/components.json'), {}),
  knowledge: { keywords, places, rules, flows },
  lists: {
    services: services.map((s) => ({ value: s.slug, label: s.title, enabled: s.enabled })),
    regions: regions.map((r) => ({ value: r.slug, label: r.name })),
    styles: styles.map((s) => ({ value: s.id, label: s.label })),
    magnets: [{ value: 'auto', label: 'خودکار (بر اساس خدمت و برچسب)' }, { value: 'none', label: 'بدون لید مگنت' }, ...(site.magnets ?? []).map((m) => ({ value: m.id, label: m.title }))],
    trades: trades.map((t) => ({ value: t.slug, label: t.name })),
    categories: [...new Set(articles.map((a) => a.category).filter(Boolean))]
  },
  services: services.map((s) => ({ slug: s.slug, title: s.title, short: s.short, forWho: s.forWho, steps: s.steps, documents: s.documents, documentsNote: s.documentsNote, faq: s.faq, enabled: s.enabled })),
  regions, trades, articles, guides, areas, paths,
  pages: { home: readJson(p('src/data/home.json'), {}) }
};

// متن خام مطالب موجود برای «ویرایش مطلب موجود» در Studio (بارگذاری تنبل)
// حالت --public (بیلد نهایی/دیپلوی): متن پیش‌نویس‌ها در content.json نمی‌آید تا روی سایت عمومی خوانده نشود.
// ویرایش پیش‌نویس فقط با «npm run dev» (یا npm run kit) ممکن است.
const PUBLIC = process.argv.includes('--public');
const isDraft = (text) => /^---\r?\n[\s\S]*?^draft:\s*true\s*$/m.test(text.split(/\r?\n---\r?\n/)[0] + '\n');
let omitted = 0;
const raw = (dir) => Object.fromEntries(list(p(dir), /\.md$/).flatMap((f) => {
  const text = readFileSync(p(dir, f), 'utf-8');
  if (PUBLIC && isDraft(text)) { omitted++; return []; }
  return [[f.replace(/\.md$/, ''), text]];
}));
mkdirSync(p('public/studio'), { recursive: true });
writeFileSync(p('public/studio/content.json'), JSON.stringify((() => { const articles = raw('src/content/articles'), areas = raw('src/content/areas'), guides = raw('src/content/guides'); return { public: PUBLIC, omittedDrafts: omitted, articles, areas, guides }; })()));
writeFileSync(p('public/studio/kit.json'), JSON.stringify(out));
copyFileSync(p('src/styles/global.css'), p('public/studio/preview.css'));
console.log(`[kit] ${styles.length} سبک، ${regions.length} منطقه، ${articles.length} مقاله، ${keywords.length} کلمه کلیدی ← public/studio/kit.json`);
