// پیش‌نمایش سطح ۱: همان CSS سایت + ساختار صفحه؛ تقریبی است، نه خروجی Astro
import { marked } from 'marked';
import { kit, esc, toFa, readingMinutes, type Pkg } from './core';

const faDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' });
const fmtDate = (s?: string) => { try { return s ? faDate.format(new Date(s)) : ''; } catch { return s ?? ''; } };

function renderBody(md: string): { html: string; toc: { id: string; text: string; depth: number }[] } {
  const raw = marked.parse(md || '', { gfm: true, async: false }) as string;
  const box = document.createElement('div');
  box.innerHTML = raw;
  // کادرها: blockquote که با [!tip|warning|info|key] شروع می‌شود (مثل remark-callouts سایت)
  box.querySelectorAll('blockquote').forEach((bq) => {
    const p = bq.querySelector('p');
    const m = p?.innerHTML.match(/^\[!(tip|warning|info|key)\][ \t]*([^\n<]*)(?:<br>|\n)?([\s\S]*)$/i);
    if (!p || !m) return;
    const aside = document.createElement('aside');
    aside.className = `callout callout-${m[1].toLowerCase()}`;
    aside.setAttribute('role', 'note');
    const title = m[2].trim();
    const div = document.createElement('div');
    p.innerHTML = m[3].trim();
    if (!p.innerHTML) p.remove();
    div.append(...Array.from(bq.childNodes));
    if (title) { const st = document.createElement('strong'); st.textContent = title; aside.append(st); }
    aside.append(div);
    bq.replaceWith(aside);
  });
  const toc: { id: string; text: string; depth: number }[] = [];
  box.querySelectorAll('h2, h3').forEach((h, i) => {
    h.id = `h-${i + 1}`;
    toc.push({ id: h.id, text: h.textContent ?? '', depth: h.tagName === 'H2' ? 2 : 3 });
  });
  box.querySelectorAll('input[type=checkbox]').forEach((c) => c.setAttribute('disabled', ''));
  return { html: box.innerHTML, toc };
}

const faqHtml = (faq: { q: string; a: string }[]) => {
  const items = (faq ?? []).filter((f) => f.q && f.a);
  return items.length
    ? `<section class="faq" aria-label="پرسش‌های متداول"><h2>پرسش‌های متداول</h2>${items.map((f) => `<details><summary>${esc(f.q)}<span>▾</span></summary><div>${esc(f.a)}</div></details>`).join('')}</section>`
    : '';
};

const coverHtml = (src: string | undefined, c: any) =>
  src ? `<figure class="cover"><img src="${esc(src)}" alt="${esc(c?.alt ?? '')}" style="width:100%;height:auto;border-radius:12px" />${c?.caption ? `<figcaption class="meta" style="justify-content:center;margin-top:.5rem">${esc(c.caption)}</figcaption>` : ''}</figure>` : '';

export function previewHtml(pkg: Pkg, coverSrc?: string): string {
  const t = kit.site.theme ?? {};
  const vars = `--primary:${t.primary ?? '#0E6B78'};--accent:${t.accent ?? '#E0A100'};--bg:${t.bg ?? '#fff'};--text:${t.text ?? '#0F1F2E'};--radius:${t.radius ?? '10px'}`;
  const fm = pkg.fm;
  let main = '';

  if (pkg.type === 'article' || pkg.type === 'guide') {
    const { html, toc } = renderBody(pkg.body);
    const tocHtml = toc.length > 1 ? `<details class="toc-mobile" open><summary>فهرست مطالب</summary><ol>${toc.map((h) => `<li class="l${h.depth}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol></details>` : '';
    const src = (fm.sources ?? []).filter((s: any) => s.title);
    main = `
<div class="page-head article-head"><div class="container narrow-head">
  <div class="meta"><span class="badge">${esc(pkg.type === 'guide' ? (kit.trades ?? []).find((t: any) => t.slug === fm.trade)?.name || 'رسته؟' : fm.category || 'بدون دسته')}</span>${fm.draft ? '<span class="badge draft">پیش‌نویس؛ منتشر نمی‌شود</span>' : ''}<span>${fmtDate(fm.publishedAt)}</span><span>${toFa(readingMinutes(pkg.body))} دقیقه مطالعه</span></div>
  <h1>${esc(fm.title || 'عنوان مقاله')}</h1><p>${esc(fm.description || '')}</p>
</div></div>
<div class="container article-layout"><article>
  ${tocHtml}
  ${coverHtml(coverSrc, fm.cover)}
  <div class="prose">${html || '<p style="color:var(--muted)">متن مقاله هنوز خالی است.</p>'}</div>
  ${faqHtml(fm.faq)}
  ${src.length ? `<section class="sources" style="margin-top:2rem"><h2 style="font-size:1.1rem">منابع</h2><ul>${src.map((s: any) => `<li>${s.url ? `<a href="${esc(s.url)}">${esc(s.title)}</a>` : esc(s.title)}</li>`).join('')}</ul></section>` : ''}
  <div class="pv-box">اینجا فرم لید و مقالات مرتبط نمایش داده می‌شود.</div>
</article></div>`;
  } else if (pkg.type === 'area-page') {
    const r = kit.regions.find((x: any) => x.slug === pkg.slug);
    const name = r?.name ?? pkg.slug;
    const { html } = renderBody(pkg.body);
    main = `
<div class="page-head"><div class="container">
  <h1>${esc(fm.title || `خدمات کسب‌وکار و جواز کسب در ${name}`)}</h1><p>${esc(fm.description || r?.intro || '')}</p>
</div></div>
<div class="container"><div style="max-width:46rem">
  ${coverHtml(coverSrc, fm.cover)}
  <div class="prose block">${html || '<p style="color:var(--muted)">متن صفحه خالی است.</p>'}</div>
  ${faqHtml(fm.faq)}
  <div class="pv-box">اینجا فهرست خدمات و فرم مشاوره نمایش داده می‌شود.</div>
</div></div>`;
  } else {
    const notes: string[] = (fm.notes ?? []).filter(Boolean);
    main = `
<div class="page-head"><div class="container">
  <div class="meta"><span class="badge">${esc(fm.kind || '')}</span></div>
  <h1>خدمات کسب‌وکار و جواز کسب در ${esc(fm.name || '…')}</h1><p>${esc(fm.intro || '')}</p>
</div></div>
<div class="container"><div style="max-width:46rem">
  ${notes.length ? `<section class="block"><h2>نکات محلی</h2><ul class="check">${notes.map((n) => `<li><span>✓ ${esc(n)}</span></li>`).join('')}</ul></section>` : ''}
  ${faqHtml(fm.faq)}
  <div class="pv-box">اینجا فهرست خدمات و فرم مشاوره نمایش داده می‌شود.</div>
</div></div>`;
  }

  return `<!doctype html><html lang="fa" dir="rtl" style="${vars}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/studio/preview.css"><style>
body{background:#fff}.pv-note{background:#fff8e1;color:#6b4e00;font-size:.82rem;padding:.35rem 1rem;text-align:center;border-bottom:1px solid #f0e0a0}
.pv-box{margin:2rem 0;padding:1rem;border:1px dashed var(--line);border-radius:10px;color:var(--muted);text-align:center;font-size:.9rem}
.toc-mobile{display:block!important}
</style></head><body><div class="pv-note">پیش‌نمایش تقریبی؛ ظاهر نهایی بعد از انتشار ممکن است کمی فرق کند.</div>${main}</body></html>`;
}

export function serp(pkg: Pkg): string {
  const title = (pkg.fm.title || pkg.fm.name || '').toString();
  const desc = (pkg.fm.description || pkg.fm.intro || '').toString();
  const path = pkg.type === 'article' ? `/articles/${pkg.slug || '…'}/` : pkg.type === 'guide' ? `/guides/${pkg.slug || '…'}/` : `/areas/${pkg.slug || '…'}/`;
  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  return `<div class="st-serp"><div class="st-serp-url">${esc(new URL(kit.site.url ?? 'https://example.com').host + path)}</div><div class="st-serp-title">${esc(cut(title + ' | ' + (kit.site.name ?? ''), 62))}</div><div class="st-serp-desc">${esc(cut(desc, 160))}</div></div>`;
}
