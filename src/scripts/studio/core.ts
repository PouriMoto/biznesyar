// هسته Studio: نوع‌ها، بارگذاری کیت، ساخت و خواندن «بسته محتوا»
import YAML from 'yaml';

export type PkgType = 'article' | 'area-page' | 'region-entry' | 'guide';
export interface Pkg {
  type: PkgType;
  slug: string;
  isNew: boolean;
  fm: Record<string, any>;
  body: string;
  cover?: { blob?: Blob; url?: string };
  keywords?: string[];
  extra?: Record<string, any>; // کلیدهای front matter که قرارداد نمی‌شناسد (updatedAt و…) و باید حفظ شوند
}
export interface Issue { level: 'error' | 'warning'; id: string; msg: string; field?: string }
export interface OutFile { path: string; text?: string; blob?: Blob }

export let kit: any = null;
export async function loadKit(): Promise<any> {
  const res = await fetch('/studio/kit.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('kit.json پیدا نشد؛ یک بار «npm run kit» را اجرا کنید.');
  kit = await res.json();
  return kit;
}

export const faDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
export const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean);
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const typeDef = (t: PkgType) => kit.contract.types[t];
export const slugOk = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

export function slugify(s: string): string {
  return faDigits(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// پیشنهاد slug انگلیسی از خدمت/منطقه/سبک؛ در صورت تکراری‌بودن شماره می‌خورد
export function suggestSlug(type: PkgType, parts: { service?: string; region?: string; style?: string; trade?: string }, extra = ''): string {
  const base = (type === 'guide' ? [parts.trade, parts.service, parts.region, slugify(extra)] : [parts.service, parts.region, parts.style, slugify(extra)]).filter(Boolean).join('-') || (type === 'article' ? 'article' : 'page');
  const used = new Set<string>(type === 'guide' ? (kit.guides ?? []).map((a: any) => a.slug) : type === 'article' ? kit.articles.map((a: any) => a.slug) : type === 'area-page' ? kit.areas.map((a: any) => a.slug) : kit.regions.map((r: any) => r.slug));
  let s = base, i = 2;
  while (used.has(s)) s = `${base}-${i++}`;
  return s;
}

export function newPkg(type: PkgType, init: Record<string, any> = {}): Pkg {
  const def = typeDef(type);
  const fm: Record<string, any> = {};
  for (const f of def.fields) {
    if (f.default === undefined) continue;
    fm[f.key] = f.default === 'today' ? today() : structuredClone(f.default);
  }
  Object.assign(fm, init);
  return { type, slug: '', isNew: true, fm, body: '' };
}

const clean = (v: any): any => {
  if (Array.isArray(v)) return v.map(clean).filter((x) => x !== undefined);
  if (v && typeof v === 'object') {
    const o: Record<string, any> = {};
    for (const [k, x] of Object.entries(v)) { const c = clean(x); if (c !== undefined) o[k] = c; }
    return Object.keys(o).length ? o : undefined;
  }
  if (v === '' || v === null || v === undefined) return undefined;
  return v;
};

export function paths(pkg: Pkg) {
  const def = typeDef(pkg.type);
  const sub = (s: string) => s.replaceAll('{slug}', pkg.slug);
  return { output: sub(def.output), assetsDir: def.assetsDir ? sub(def.assetsDir) : '', coverFile: def.coverFile ? sub(def.coverFile) : '', coverRef: def.coverRef ? sub(def.coverRef) : '' };
}

export const hasCover = (pkg: Pkg) => !!(pkg.cover?.blob || pkg.cover?.url || pkg.fm.cover?.src);

// فیلدهای front matter به ترتیب قرارداد
export function frontMatterObject(pkg: Pkg): Record<string, any> {
  const def = typeDef(pkg.type);
  const p = paths(pkg);
  const o: Record<string, any> = {};
  for (const f of def.fields) {
    let v = pkg.fm[f.key];
    if (f.kind === 'cover') {
      const c = pkg.fm.cover ?? {};
      if (hasCover(pkg) || c.alt) v = { src: hasCover(pkg) ? (c.src && !pkg.cover?.blob && !pkg.cover?.url ? c.src : p.coverRef) : undefined, alt: c.alt, caption: c.caption };
      else v = undefined;
    }
    if (f.kind === 'faq') v = (v ?? []).filter((x: any) => x?.q || x?.a);
    if (f.kind === 'sources') v = (v ?? []).filter((x: any) => x?.title);
    if (f.key === 'magnet') { const m = pkg.fm.magnet; o.magnet = m === 'none' || m === false ? false : m === 'auto' || m === true || m == null || m === '' ? true : m; continue; }
    if (f.kind === 'bool') { o[f.key] = !!v; continue; }
    const c = clean(v);
    if (c !== undefined) o[f.key] = c;
  }
  for (const [k, x] of Object.entries(pkg.extra ?? {})) if (!(k in o)) o[k] = x;
  return o;
}

export function fileText(pkg: Pkg): string {
  if (pkg.type === 'region-entry') {
    const o = frontMatterObject(pkg);
    const out = { slug: pkg.slug, name: o.name, kind: o.kind, intro: o.intro, featured: !!o.featured, notes: o.notes ?? [], faq: o.faq ?? [], order: Number(o.order ?? 500) };
    return JSON.stringify(out, null, 2) + '\n';
  }
  const fm = frontMatterObject(pkg);
  if (pkg.type === 'area-page' && !fm.updatedAt) fm.updatedAt = today();
  if (!pkg.isNew) fm.updatedAt = today(); // ویرایش مطلب موجود
  const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${pkg.body.trim()}\n`;
}

export function outputFiles(pkg: Pkg): OutFile[] {
  const p = paths(pkg);
  const files: OutFile[] = [{ path: p.output, text: fileText(pkg) }];
  if (pkg.cover?.blob && p.assetsDir) files.push({ path: p.assetsDir + p.coverFile, blob: pkg.cover.blob });
  return files;
}

// خواندن متن .md با front matter (یا متن خام بدون آن)
export function parseMd(text: string): { fm: Record<string, any>; body: string; hadFm: boolean } {
  const t = text.replace(/^﻿/, '').trim();
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: t, hadFm: false };
  let fm: Record<string, any> = {};
  try { fm = YAML.parse(m[1]) ?? {}; } catch {
    // خطای رایج مدل‌ها: «:» یا «#» داخل مقدار بدون گیومه (مثلاً title: هزینه: راهنما) ← یک بار با گیومه‌گذاری خودکار امتحان کن
    try { fm = YAML.parse(quoteLoose(m[1])) ?? {}; } catch (e2) { throw new Error('بخش بالای بسته (بین دو خط ---) خوانده نشد؛ معمولاً یک مقدار شامل «:» است و گیومه ندارد. جزئیات: ' + (e2 as Error).message.split('\n')[0]); }
  }
  for (const k of ['publishedAt', 'updatedAt', 'reviewedAt']) if (fm[k] instanceof Date) fm[k] = fm[k].toISOString().slice(0, 10);
  return { fm, body: m[2].trim(), hadFm: true };
}

// بسته خروجی چت AI: <<<PACKAGE ... >>>
export function parsePackageBlock(reply: string): { fm: Record<string, any>; body: string } {
  let t = reply.replace(/\r/g, '');
  const start = t.indexOf('<<<PACKAGE');
  if (start >= 0) t = t.slice(start + '<<<PACKAGE'.length);
  const end = t.lastIndexOf('>>>');
  if (end >= 0) t = t.slice(0, end);
  t = t.replace(/^\s*```[a-z]*\s*\n/i, '').replace(/\n```\s*$/i, '').trim();
  const { fm, body, hadFm } = parseMd(t);
  if (!hadFm) throw new Error('بلوک front matter (بین دو خط ---) در پاسخ پیدا نشد.');
  return { fm, body };
}

export function pkgFromReply(type: PkgType, reply: string, inputs: Record<string, any>): Pkg {
  const { fm, body } = parsePackageBlock(reply);
  const pkg = newPkg(type);
  const def = typeDef(type);
  const keys = new Set(def.fields.map((f: any) => f.key));
  for (const [k, v] of Object.entries(fm)) if (keys.has(k) && k !== 'cover') pkg.fm[k] = v;
  if (type === 'guide') {
    pkg.fm.trade = pkg.fm.trade || inputs.trade || '';
    pkg.fm.service = pkg.fm.service || inputs.service || '';
    pkg.fm.region = pkg.fm.region || inputs.region || '';
    pkg.fm.generatedBy = 'agent';
    pkg.fm.draft = true;
    if (inputs.coverAlt) pkg.fm.cover = { alt: inputs.coverAlt };
    if (inputs.coverUrl) pkg.cover = { url: inputs.coverUrl };
    const gp = { trade: pkg.fm.trade, service: pkg.fm.service, region: pkg.fm.region };
    const s = typeof fm.slug === 'string' ? slugify(fm.slug) : '';
    pkg.slug = s && slugOk(s) ? s : suggestSlug('guide', gp);
    if ((kit.guides ?? []).some((a: any) => a.slug === pkg.slug)) pkg.slug = suggestSlug('guide', gp, pkg.slug);
  } else if (type === 'article') {
    pkg.fm.service = pkg.fm.service || inputs.service || '';
    pkg.fm.region = pkg.fm.region || inputs.region || '';
    pkg.fm.generatedBy = 'agent';
    pkg.fm.draft = true;
    if (inputs.coverAlt) pkg.fm.cover = { alt: inputs.coverAlt };
    if (inputs.coverUrl) pkg.cover = { url: inputs.coverUrl };
  } else if (type === 'area-page') {
    if (inputs.coverAlt) pkg.fm.cover = { alt: inputs.coverAlt };
    if (inputs.coverUrl) pkg.cover = { url: inputs.coverUrl };
    pkg.slug = inputs.region || '';
  }
  if (type === 'article') {
    const s = typeof fm.slug === 'string' ? slugify(fm.slug) : '';
    pkg.slug = s && slugOk(s) ? s : suggestSlug('article', { service: inputs.service, region: inputs.region, style: inputs.style });
    if (kit.articles.some((a: any) => a.slug === pkg.slug)) pkg.slug = suggestSlug('article', { service: inputs.service, region: inputs.region, style: inputs.style }, pkg.slug);
  }
  pkg.body = body;
  if (Array.isArray(fm.tags) === false && typeof fm.tags === 'string') pkg.fm.tags = fm.tags.split(/[،,]/).map((x: string) => x.trim()).filter(Boolean);
  return pkg;
}

export const readingMinutes = (body: string) => Math.max(1, Math.ceil(wordsOf(body).length / 180));

// ───── کادرهای توضیحی در Markdown: > [!tip] عنوان ─────
export interface Callout { type: string; title: string; words: number; atStart: boolean }
export function parseCallouts(body: string): Callout[] {
  const lines = body.replace(/\r/g, '').split('\n');
  const out: Callout[] = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { fence = !fence; continue; }
    if (fence) continue;
    const m = lines[i].match(/^>\s*\[!(\w+)\][ \t]*(.*)$/);
    if (!m) continue;
    const text: string[] = [];
    let j = i + 1;
    while (j < lines.length && /^>/.test(lines[j])) { text.push(lines[j].replace(/^>\s?/, '')); j++; }
    out.push({ type: m[1].toLowerCase(), title: m[2].trim(), words: wordsOf(text.join(' ')).length, atStart: lines.slice(0, i).every((l) => !l.trim()) });
    i = j - 1;
  }
  return out;
}
export const calloutDef = () => kit.components?.callouts ?? { types: {}, limits: {} };
export const normFa = (t: string) => t.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ').replace(/\s+/g, ' ');

// مقدارهای بدون گیومه که «: » یا « #» دارند را در گیومه می‌گذارد (فقط برای تلاش دوم)
export function quoteLoose(y: string): string {
  return y.split('\n').map((l) => {
    const m = l.match(/^(\s*(?:-\s+)?[A-Za-z]\w*):[ \t]+(.+?)\s*$/);
    if (!m) return l;
    const v = m[2];
    if (/^["'\[{|>&*!]/.test(v)) return l;
    if (!(v.includes(': ') || v.includes(' #') || /^[#@%`?]/.test(v))) return l;
    return `${m[1]}: "${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }).join('\n');
}

// ───── باز کردن مطلب موجود برای ویرایش ─────
export function loadExisting(type: PkgType, slug: string, text: string): Pkg {
  const { fm, body } = parseMd(text);
  const pkg = newPkg(type);
  const keys = new Set(typeDef(type).fields.map((f: any) => f.key));
  pkg.extra = {};
  for (const [k, v] of Object.entries(fm)) {
    if (k === 'cover' && v && typeof v === 'object') pkg.fm.cover = { ...(v as any) }; // src قبلی حفظ می‌شود
    else if (keys.has(k)) pkg.fm[k] = v;
    else pkg.extra[k] = v;
  }
  if (typeof fm.magnet === 'boolean') pkg.fm.magnet = fm.magnet ? 'auto' : 'none';
  pkg.slug = slug;
  pkg.isNew = false;
  pkg.body = body;
  return pkg;
}
