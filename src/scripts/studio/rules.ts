// اعتبارسنجی بسته محتوا؛ پیام‌ها فارسی و ساده. شناسه‌ها همان rules در contract.json است.
import { kit, typeDef, wordsOf, hasCover, paths, toFa, parseCallouts, calloutDef, normFa, type Pkg, type Issue } from './core';

type Params = Record<string, any>;
type Fn = (pkg: Pkg, params: Params) => Omit<Issue, 'level'>[];

const val = (pkg: Pkg, key: string) => (key === 'slug' ? pkg.slug : pkg.fm[key]);
const isEmpty = (v: any) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
const allText = (pkg: Pkg) => [pkg.body, pkg.fm.title, pkg.fm.description, pkg.fm.intro, ...(pkg.fm.notes ?? []), ...((pkg.fm.faq ?? []).flatMap((f: any) => [f.q, f.a]))].filter(Boolean).join('\n');
const bodyNoCode = (pkg: Pkg) => pkg.body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
const firstPara = (body: string) => {
  const blocks = body.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const first = blocks[0] ?? '';
  return /^(#|[-*>|]|\d+\.)/.test(first) ? '' : first;
};
const grams = (t: string, n = 3) => {
  const w = wordsOf(t.replace(/[^\p{L}\p{N}\s]/gu, ' '));
  const s = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' '));
  return s;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let i = 0; for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
};

export const ownPath = (pkg: Pkg) => (pkg.type === 'article' ? `/articles/${pkg.slug}/` : pkg.type === 'guide' ? `/guides/${pkg.slug}/` : pkg.type === 'area-page' ? `/areas/${pkg.slug}/` : '');

const internalLinks = (pkg: Pkg): string[] => {
  const out: string[] = [];
  for (const m of bodyNoCode(pkg).matchAll(/\]\((\/[^)\s]*)\)/g)) {
    if (m[1].startsWith('//')) continue;
    let p = m[1].split('#')[0].split('?')[0];
    if (!p || /^\/(downloads|flows|brand|videos|help|fonts)\//.test(p)) continue;
    out.push(p.endsWith('/') ? p : p + '/');
  }
  return out;
};

const fns: Record<string, Fn> = {
  required(pkg) {
    const out: ReturnType<Fn> = [];
    const def = typeDef(pkg.type);
    for (const f of def.fields) {
      if (f.required && isEmpty(val(pkg, f.key))) out.push({ id: 'required', field: f.key, msg: `«${f.label}» را پر کنید.` });
      if (f.kind === 'date' && !isEmpty(val(pkg, f.key)) && !/^\d{4}-\d{2}-\d{2}$/.test(String(val(pkg, f.key)))) out.push({ id: 'required', field: f.key, msg: `«${f.label}» باید به شکل 2026-10-19 باشد.` });
    }
    if ((pkg.type === 'article' || pkg.type === 'guide') && isEmpty(pkg.body)) out.push({ id: 'required', field: 'body', msg: 'متن مقاله خالی است.' });
    for (const [i, f] of (pkg.fm.faq ?? []).entries()) if ((f.q && !f.a) || (!f.q && f.a)) out.push({ id: 'required', field: 'faq', msg: `پرسش‌وپاسخ شماره ${toFa(i + 1)} ناقص است.` });
    return out;
  },
  lengths(pkg) {
    const out: ReturnType<Fn> = [];
    for (const f of typeDef(pkg.type).fields) {
      const v = val(pkg, f.key);
      if (typeof v !== 'string' || !v) continue;
      if (f.max && v.length > f.max) out.push({ id: 'lengths', field: f.key, msg: `«${f.label}» ${toFa(v.length)} کاراکتر است؛ حداکثر ${toFa(f.max)}.` });
      if (f.min && v.length < f.min) out.push({ id: 'lengths', field: f.key, msg: `«${f.label}» ${toFa(v.length)} کاراکتر است؛ دست‌کم ${toFa(f.min)} لازم است.` });
    }
    return out;
  },
  'slug-valid'(pkg) {
    if (pkg.type === 'area-page') return kit.regions.some((r: any) => r.slug === pkg.slug) ? [] : [{ id: 'slug-valid', field: 'slug', msg: 'صفحه منطقه باید برای یکی از منطقه‌های موجود باشد.' }];
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pkg.slug) ? [] : [{ id: 'slug-valid', field: 'slug', msg: 'شناسه فقط حروف کوچک انگلیسی، عدد و خط تیره باشد؛ مثل business-license-minab.' }];
  },
  'slug-unique'(pkg) {
    const list = pkg.type === 'guide' ? kit.guides ?? [] : kit.articles;
    return pkg.isNew && list.some((a: any) => a.slug === pkg.slug) ? [{ id: 'slug-unique', field: 'slug', msg: 'مطلبی با این شناسه از قبل هست؛ شناسه را عوض کنید.' }] : [];
  },
  'region-unique'(pkg) {
    return pkg.isNew && kit.regions.some((r: any) => r.slug === pkg.slug) ? [{ id: 'region-unique', field: 'slug', msg: 'این شناسه برای منطقه دیگری استفاده شده است.' }] : [];
  },
  'cover-alt'(pkg) {
    const c = pkg.fm.cover ?? {};
    if (hasCover(pkg) && (c.alt ?? '').trim().length < 5) return [{ id: 'cover-alt', field: 'cover', msg: 'برای تصویر، توضیح واقعی (alt) دست‌کم ۵ کاراکتر بنویسید.' }];
    if (!hasCover(pkg) && (c.alt || c.caption)) return [{ id: 'cover-alt', field: 'cover', msg: 'توضیح تصویر هست ولی تصویری انتخاب نشده است.' }];
    return [];
  },
  'no-h1'(pkg) {
    return /^# \S/m.test(bodyNoCode(pkg)) ? [{ id: 'no-h1', field: 'body', msg: 'داخل متن عنوان سطح اول (#) نگذارید؛ عنوان جدا ثبت می‌شود. بخش‌ها را با ## بنویسید.' }] : [];
  },
  'no-markers'(pkg) {
    const m = kit.profile.marker ?? '[نیاز به بررسی]';
    const n = allText(pkg).split(m).length - 1;
    return n ? [{ id: 'no-markers', field: 'body', msg: `${toFa(n)} جا علامت ${m} مانده؛ درستی را بررسی و علامت را بردارید.` }] : [];
  },
  'banned-claims'(pkg) {
    const t = allText(pkg);
    return (kit.profile.bannedClaims ?? []).filter((b: string) => t.includes(b)).map((b: string) => ({ id: 'banned-claims', field: 'body', msg: `عبارت ممنوع «${b}» در متن هست.` }));
  },
  'internal-links'(pkg) {
    const own = ownPath(pkg);
    const allowed = new Set<string>([...kit.paths, own]);
    const out: ReturnType<Fn> = [];
    const text = bodyNoCode(pkg);
    const urls = [...text.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
    for (const u of new Set(urls)) {
      if (u.startsWith('//')) continue;
      let p = u.split('#')[0].split('?')[0];
      if (!p) continue;
      if (/^\/(downloads|flows|brand|videos|help|fonts)\//.test(p)) continue;
      if (!p.endsWith('/')) p += '/';
      if (!allowed.has(p)) out.push({ id: 'internal-links', field: 'body', msg: `پیوند داخلی «${u}» به صفحه‌ای که وجود ندارد اشاره می‌کند.` });
    }
    return out;
  },
  'callout-syntax'(pkg) {
    const def = calloutDef();
    const out: ReturnType<Fn> = [];
    for (const c of parseCallouts(pkg.body)) {
      if (!def.types[c.type]) out.push({ id: 'callout-syntax', field: 'body', msg: `نوع کادر «${c.type}» مجاز نیست؛ فقط ${Object.keys(def.types).join('، ')}.` });
      else if (!c.title) out.push({ id: 'callout-syntax', field: 'body', msg: `کادر ${c.type} عنوان ندارد؛ بعد از [!${c.type}] یک عنوان کوتاه بنویسید.` });
      if (!c.words) out.push({ id: 'callout-syntax', field: 'body', msg: `کادر «${c.title || c.type}» متن ندارد.` });
      if (c.atStart) out.push({ id: 'callout-syntax', field: 'body', msg: 'متن نباید با کادر شروع شود؛ اول پاسخ مستقیم بیاید.' });
    }
    return out;
  },
  'callout-use'(pkg) {
    const L = calloutDef().limits ?? {};
    const cs = parseCallouts(pkg.body);
    const out: ReturnType<Fn> = [];
    if (!cs.length && wordsOf(pkg.body).length >= (L.minWordsForOne ?? 500)) out.push({ id: 'callout-use', field: 'body', msg: 'هیچ کادر نکته/هشدار/بدانید ندارید؛ یک یا دو کادر فهم متن را ساده‌تر می‌کند.' });
    if (cs.length > (L.maxPerPage ?? 4)) out.push({ id: 'callout-use', field: 'body', msg: `${toFa(cs.length)} کادر دارید؛ بیشتر از ${toFa(L.maxPerPage ?? 4)} تا حواس خواننده را پرت می‌کند.` });
    for (const c of cs) {
      if (c.words > (L.maxWords ?? 70)) out.push({ id: 'callout-use', field: 'body', msg: `کادر «${c.title}» ${toFa(c.words)} کلمه است؛ کادر باید کوتاه (حداکثر ${toFa(L.maxWords ?? 70)}) باشد.` });
      if (c.title.length > (L.titleMax ?? 40)) out.push({ id: 'callout-use', field: 'body', msg: `عنوان کادر «${c.title.slice(0, 20)}…» بلند است.` });
    }
    return out;
  },
  'internal-links-count'(pkg, p) {
    const own = ownPath(pkg);
    const set = new Set(internalLinks(pkg).filter((u) => u !== own));
    const n = set.size;
    const out: ReturnType<Fn> = [];
    if (pkg.body.trim() && n < (p.min ?? 2)) out.push({ id: 'internal-links-count', field: 'body', msg: `فقط ${toFa(n)} پیوند داخلی دارید؛ دست‌کم ${toFa(p.min ?? 2)} (خدمت، مقالهٔ مرتبط یا تماس) بهتر است.` });
    if (n > (p.max ?? 6)) out.push({ id: 'internal-links-count', field: 'body', msg: `${toFa(n)} پیوند داخلی زیاد است؛ حداکثر ${toFa(p.max ?? 6)}.` });
    return out;
  },
  'link-draft'(pkg) {
    const drafts = new Map<string, string>([...kit.articles.filter((a: any) => a.draft).map((a: any) => [`/articles/${a.slug}/`, a.title]), ...(kit.guides ?? []).filter((a: any) => a.draft).map((a: any) => [`/guides/${a.slug}/`, a.title])]);
    return [...new Set(internalLinks(pkg))].filter((u) => drafts.has(u) && u !== ownPath(pkg)).map((u) => ({ id: 'link-draft', field: 'body', msg: `به صفحهٔ پیش‌نویس «${drafts.get(u)}» پیوند داده‌اید؛ پیش از انتشار آن را هم منتشر کنید.` }));
  },
  'generic-anchor'(pkg) {
    const m = bodyNoCode(pkg).match(/\[(اینجا|کلیک کنید|ادامه مطلب|بیشتر بخوانید|اینجا کلیک کنید|این صفحه|این لینک)\]\(/g);
    return m ? [{ id: 'generic-anchor', field: 'body', msg: `متن پیوند «${m[0].slice(1, -2)}» توصیفی نیست؛ موضوع صفحهٔ مقصد را در متن لینک بنویسید.` }] : [];
  },
  'primary-keyword'(pkg) {
    const kw = normFa((pkg.keywords?.[0] ?? '').trim());
    if (!kw || !pkg.body.trim()) return [];
    const has = (t: string) => normFa(t ?? '').includes(kw);
    const out: ReturnType<Fn> = [];
    if (!has(pkg.fm.title ?? '')) out.push({ id: 'primary-keyword', field: 'title', msg: `کلمهٔ کلیدی اصلی «${kw}» در عنوان نیست.` });
    if (!has(wordsOf(pkg.body).slice(0, 100).join(' '))) out.push({ id: 'primary-keyword', field: 'body', msg: `کلمهٔ کلیدی اصلی «${kw}» در صد کلمهٔ اول متن نیست.` });
    if (!(bodyNoCode(pkg).match(/^##+ .*$/gm) ?? []).some(has)) out.push({ id: 'primary-keyword', field: 'body', msg: `در هیچ عنوان بخشی از «${kw}» (یا شکل نزدیک آن) استفاده نشده است.` });
    return out;
  },
  'keyword-density'(pkg, p) {
    const kw = normFa((pkg.keywords?.[0] ?? '').trim());
    const text = normFa(pkg.body);
    const n = wordsOf(text).length;
    if (!kw || n < 100) return [];
    const count = text.split(kw).length - 1;
    const dens = (count * wordsOf(kw).length) / n;
    return dens > (p.max ?? 0.03) ? [{ id: 'keyword-density', field: 'body', msg: `کلمهٔ کلیدی «${kw}» ${toFa(count)} بار آمده (${toFa(Math.round(dens * 100))}٪ متن)؛ تکرار زیاد برای گوگل نشانهٔ بدی است.` }] : [];
  },
  'magnet-valid'(pkg) {
    const m = pkg.fm.magnet;
    if (m === undefined || m === null || typeof m === 'boolean' || m === '' || m === 'auto' || m === 'none') return [];
    return (kit.lists.magnets ?? []).some((x: any) => x.value === m) ? [] : [{ id: 'magnet-valid', field: 'magnet', msg: `لید مگنت «${m}» در تنظیمات سایت (site.config.json ← magnets) تعریف نشده است.` }];
  },
  'no-html'(pkg) {
    return /<\/?[A-Za-z][A-Za-z0-9]*(\s[^>]*)?\/?>/.test(bodyNoCode(pkg)) ? [{ id: 'no-html', field: 'body', msg: 'در بسته فقط Markdown ساده مجاز است؛ HTML یا کامپوننت ننویسید.' }] : [];
  },
  'direct-answer'(pkg, p) {
    const fp = firstPara(pkg.body);
    if (!pkg.body.trim()) return [];
    if (!fp) return [{ id: 'direct-answer', field: 'body', msg: 'متن باید با یک پاراگراف پاسخ مستقیم (۴۰ تا ۶۰ کلمه) شروع شود، نه عنوان یا لیست.' }];
    const n = wordsOf(fp).length;
    return n > (p.maxWords ?? 60) ? [{ id: 'direct-answer', field: 'body', msg: `پاراگراف اول ${toFa(n)} کلمه است؛ برای پاسخ مستقیم (AEO) حداکثر ${toFa(p.maxWords ?? 60)} کلمه بهتر است.` }] : [];
  },
  'title-length'(pkg, p) {
    const t = pkg.fm.title ?? '';
    return t.length > (p.max ?? 60) ? [{ id: 'title-length', field: 'title', msg: `عنوان ${toFa(t.length)} کاراکتر است؛ در گوگل از حدود ${toFa(p.max ?? 60)} کاراکتر بریده می‌شود.` }] : [];
  },
  'faq-min'(pkg, p) {
    const n = (pkg.fm.faq ?? []).filter((f: any) => f.q && f.a).length;
    return n < (p.min ?? 3) ? [{ id: 'faq-min', field: 'faq', msg: `فقط ${toFa(n)} پرسش متداول دارید؛ دست‌کم ${toFa(p.min ?? 3)} تا بهتر است.` }] : [];
  },
  'sources-min'(pkg, p) {
    return (pkg.fm.sources ?? []).length < (p.min ?? 1) ? [{ id: 'sources-min', field: 'sources', msg: 'منبعی ثبت نشده؛ برای مطالب قانونی و اداری دست‌کم یک منبع بگذارید.' }] : [];
  },
  'headings-min'(pkg, p) {
    const n = (bodyNoCode(pkg).match(/^## \S/gm) ?? []).length;
    return pkg.body.trim() && n < (p.min ?? 3) ? [{ id: 'headings-min', field: 'body', msg: `فقط ${toFa(n)} بخش (##) دارید؛ دست‌کم ${toFa(p.min ?? 3)} بخش بهتر است.` }] : [];
  },
  'similar-title'(pkg, p) {
    const w = (s: string) => new Set(wordsOf((s ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ')));
    const a = w(pkg.fm.title);
    if (!a.size) return [];
    for (const o of pkg.type === 'guide' ? kit.guides ?? [] : kit.articles) {
      if (o.slug === pkg.slug) continue;
      const b = w(o.title);
      if (jaccard(a, b) >= (p.threshold ?? 0.7)) return [{ id: 'similar-title', field: 'title', msg: `عنوان خیلی شبیه مقاله «${o.title}» است؛ ممکن است با هم رقابت کنند.` }];
    }
    return [];
  },
  'word-count'(pkg, p) {
    const n = wordsOf(pkg.body).length;
    return pkg.body.trim() && n < (p.min ?? 400) ? [{ id: 'word-count', field: 'body', msg: `متن ${toFa(n)} کلمه است؛ برای این نوع دست‌کم حدود ${toFa(p.min ?? 400)} کلمه بهتر است.` }] : [];
  },
  'area-unique'(pkg, p) {
    const out: ReturnType<Fn> = [];
    if (kit.areas.some((a: any) => a.slug === pkg.slug)) out.push({ id: 'area-unique', field: 'slug', msg: 'برای این منطقه صفحه‌ای هست و با انتشار جایگزین می‌شود.' });
    const g = grams(pkg.body);
    for (const a of kit.areas) {
      if (a.slug === pkg.slug) continue;
      const j = jaccard(g, grams(a.body));
      if (j >= (p.threshold ?? 0.6)) out.push({ id: 'area-unique', field: 'body', msg: `متن به صفحه منطقه «${a.slug}» ${toFa(Math.round(j * 100))}٪ شباهت دارد؛ حقایق محلی بیشتری اضافه کنید.` });
    }
    return out;
  }
};

export function validate(pkg: Pkg): Issue[] {
  const def = typeDef(pkg.type);
  const issues: Issue[] = [];
  for (const r of def.rules) {
    const fn = fns[r.id];
    if (!fn) continue;
    for (const i of fn(pkg, r.params ?? {})) issues.push({ ...i, level: r.level });
  }
  if ((pkg.type === 'article' || pkg.type === 'guide') && pkg.fm.generatedBy === 'agent' && pkg.fm.draft === false) issues.push({ level: 'warning', id: 'draft-review', field: 'draft', msg: 'متن را هوش مصنوعی نوشته و پیش‌نویس را برداشته‌اید؛ مطمئنید بازبینی کرده‌اید؟' });
  return issues;
}

export const counts = (issues: Issue[]) => ({ errors: issues.filter((i) => i.level === 'error').length, warnings: issues.filter((i) => i.level === 'warning').length });
export { paths };
