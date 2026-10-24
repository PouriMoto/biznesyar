// ویرایش متن صفحه‌های اصلی (خانه، درباره، تماس) — داده در src/data/home.json
import { esc } from './core';

type Kind = 'text' | 'long' | 'lines' | 'paras';
interface Field { p: string; label: string; kind: Kind; help?: string }
interface ListDef { key: string; label: string; item: Record<string, any>; fields: Field[]; icon?: boolean }
interface Group { id: string; title: string; help?: string; fields?: Field[]; list?: ListDef }

export const ICONS = ['clock', 'shield-check', 'map-pin', 'check', 'building', 'globe', 'percent', 'file-text', 'phone', 'message'];

const GROUPS: Group[] = [
  { id: 'hero', title: 'صفحهٔ اصلی — بالای صفحه', help: 'اولین چیزی که بازدیدکننده می‌بیند. تیتر کوتاه و نتیجه‌محور؛ ۳ مزیت کلیدی.', fields: [
    { p: 'hero.title', label: 'تیتر اصلی (H1)', kind: 'text' },
    { p: 'hero.subtitle', label: 'توضیح زیر تیتر', kind: 'long' },
    { p: 'hero.points', label: 'مزیت‌ها (هر خط یکی)', kind: 'lines' },
    { p: 'sections.leadForm.heading', label: 'عنوان فرم مشاوره', kind: 'text' },
    { p: 'sections.leadForm.sub', label: 'توضیح فرم مشاوره', kind: 'text' },
  ] },
  { id: 'sections', title: 'صفحهٔ اصلی — عنوان بخش‌ها', fields: [
    { p: 'sections.services.title', label: 'بخش خدمات — عنوان', kind: 'text' },
    { p: 'sections.services.lead', label: 'بخش خدمات — توضیح', kind: 'long' },
    { p: 'process.title', label: 'بخش مسیر کار — عنوان', kind: 'text' },
    { p: 'process.text', label: 'بخش مسیر کار — توضیح', kind: 'long' },
    { p: 'sections.areas.title', label: 'بخش مناطق — عنوان', kind: 'text' },
    { p: 'sections.areas.lead', label: 'بخش مناطق — توضیح', kind: 'long' },
    { p: 'sections.articles.title', label: 'بخش مقالات — عنوان', kind: 'text' },
    { p: 'sections.office.title', label: 'بخش دفتر — عنوان', kind: 'text' },
  ] },
  { id: 'why', title: 'صفحهٔ اصلی — چرا ما', list: { key: 'why', label: 'مورد', icon: true, item: { icon: 'check', title: '', text: '' }, fields: [
    { p: 'title', label: 'عنوان', kind: 'text' }, { p: 'text', label: 'متن', kind: 'long' } ] } },
  { id: 'faq', title: 'پرسش‌های متداول (خانه؛ در سئو هم می‌رود)', help: 'پاسخ کوتاه و مستقیم بنویسید (۲۰ تا ۶۰ کلمه)؛ برای نتایج گوگل و پاسخ‌دهنده‌های هوشمند مفید است.', list: { key: 'faq', label: 'پرسش', item: { q: '', a: '' }, fields: [
    { p: 'q', label: 'پرسش', kind: 'text' }, { p: 'a', label: 'پاسخ', kind: 'long' } ] } },
  { id: 'cta', title: 'صفحهٔ اصلی — دعوت نهایی به اقدام', fields: [
    { p: 'cta.title', label: 'عنوان', kind: 'text' }, { p: 'cta.text', label: 'متن', kind: 'long' }, { p: 'cta.button', label: 'متن دکمه', kind: 'text' } ] },
  { id: 'about', title: 'صفحهٔ «درباره ما»', help: 'متن واقعی و قابل‌اعتماد؛ سابقه، تخصص و نشانی. هر پاراگراف را با یک خط خالی جدا کنید.', fields: [
    { p: 'about.title', label: 'عنوان', kind: 'text' },
    { p: 'about.paragraphs', label: 'متن (پاراگراف‌ها با خط خالی جدا شوند)', kind: 'paras' },
    { p: 'meta.about.description', label: 'توضیح برای گوگل (حدود ۱۲۰–۱۶۰ حرف)', kind: 'long' },
  ] },
  { id: 'contact', title: 'صفحهٔ «تماس با ما»', help: 'تلفن، نشانی و ساعت کاری از تنظیمات سایت (site.config.json) خوانده می‌شود، نه از اینجا.', fields: [
    { p: 'contact.title', label: 'عنوان', kind: 'text' }, { p: 'contact.subtitle', label: 'متن زیر عنوان', kind: 'text' },
    { p: 'meta.contact.description', label: 'توضیح برای گوگل', kind: 'long' } ] },
];

export const getP = (o: any, path: string) => path.split('.').reduce((c, k) => (c == null ? c : c[k]), o);
export function setP(o: any, path: string, v: any) { const ks = path.split('.'); let c = o; for (const k of ks.slice(0, -1)) c = c[k] ??= {}; c[ks.at(-1)!] = v; }

const toText = (v: any, kind: Kind) => (kind === 'lines' ? (v ?? []).join('\n') : kind === 'paras' ? (v ?? []).join('\n\n') : v ?? '');
const fromText = (t: string, kind: Kind) => (kind === 'lines' ? t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : kind === 'paras' ? t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) : t);

function fieldHtml(f: Field, v: any, base = ''): string {
  const attrs = `data-s="pg" data-p="${base}${f.p}" data-kind="${f.kind}"`;
  const val = esc(toText(v, f.kind));
  const input = f.kind === 'text' ? `<input class="st-in" ${attrs} value="${val}">` : `<textarea class="st-in" rows="${f.kind === 'long' ? 3 : f.kind === 'paras' ? 8 : 4}" ${attrs}>${val}</textarea>`;
  return `<div class="st-field"><label class="st-label">${esc(f.label)}</label>${input}</div>`;
}

export function pagesPanel(data: any, ui: Record<string, boolean>, dirty: boolean): string {
  const groups = GROUPS.map((g) => {
    let inner = g.help ? `<p class="st-help">${esc(g.help)}</p>` : '';
    if (g.fields) inner += g.fields.map((f) => fieldHtml(f, getP(data, f.p))).join('');
    if (g.list) {
      const L = g.list; const arr: any[] = data[L.key] ?? [];
      inner += arr.map((it, i) => `<div class="st-rep"><div>
        ${L.icon ? `<div class="st-field"><label class="st-label">آیکن</label><select class="st-in" data-s="pg" data-p="${L.key}.${i}.icon" data-kind="text">${ICONS.map((n) => `<option ${it.icon === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>` : ''}
        ${L.fields.map((f) => fieldHtml(f, it[f.p], `${L.key}.${i}.`)).join('')}</div>
        <button class="st-x" data-act="pg-del" data-k="${L.key}" data-i="${i}" title="حذف">✕</button></div>`).join('');
      inner += `<div class="st-actions"><button class="btn btn-ghost" data-act="pg-add" data-k="${L.key}">+ افزودن ${esc(L.label)}</button></div>`;
    }
    return `<details class="st-card st-more" data-ui="pg-${g.id}" ${ui[`pg-${g.id}`] ? 'open' : ''}><summary>${esc(g.title)}</summary>${inner}</details>`;
  }).join('');
  return `<div class="st-intro"><h2>صفحه‌های اصلی</h2>
  <p>متن خانه، درباره ما و تماس را اینجا ویرایش کنید. تغییرات در مرورگر ذخیره می‌شود؛ برای انتشار فایل را دانلود و در گیت‌هاب جایگزین کنید.</p>
  ${dirty ? '<div class="st-conn-need">تغییر ذخیره‌نشده در سایت دارید؛ «دانلود home.json» را بزنید.</div>' : '<div class="st-conn-ok">همین نسخه روی سایت است.</div>'}</div>
  ${groups}
  <div class="st-actions"><button class="btn btn-primary" data-act="pg-download">دانلود home.json</button><button class="btn btn-ghost" data-act="pg-copy">کپی JSON</button><button class="btn btn-ghost" data-act="pg-reset">برگرداندن به نسخهٔ سایت</button></div>
  <details class="st-card st-more" data-ui="pg-how" ${ui['pg-how'] ? 'open' : ''}><summary>چطور منتشر کنم؟</summary><ol class="st-steps">
    <li>«دانلود home.json» را بزنید.</li>
    <li>در GitHub به <code>src/data/home.json</code> بروید ← مداد (Edit) ← همهٔ متن را با محتوای فایل دانلودی جایگزین کنید ← Commit. (یا روی کامپیوتر فایل را جایگزین و push کنید.)</li>
    <li>چند دقیقه بعد سایت خودکار ساخته می‌شود. اگر JSON خراب باشد build شکست می‌خورد و سایت قبلی سر جایش می‌ماند.</li>
  </ol></details>`;
}

export function applyInput(data: any, el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const kind = (el.dataset.kind as Kind) ?? 'text';
  setP(data, el.dataset.p!, fromText(el.value, kind));
}
export function addItem(data: any, key: string) {
  const g = GROUPS.find((x) => x.list?.key === key)!.list!;
  (data[key] ??= []).push(JSON.parse(JSON.stringify(g.item)));
}
export const delItem = (data: any, key: string, i: number) => { data[key]?.splice(i, 1); };
export const pagesJson = (data: any) => JSON.stringify(data, null, 2) + '\n';
