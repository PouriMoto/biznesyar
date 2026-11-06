// ویرایش src/data/experiences.json از داخل Studio: ابزارهای کوتاه (چک‌لیست/تست) مثل «چک‌لیست آمادگی جواز کسب».
// این فایل بخشی از content-kit نیست (کالکشن محتوا نیست)، برای همین مستقیم از روی پوشهٔ پروژه خوانده و نوشته می‌شود.
import { esc, toFa } from './core';

export interface ExpTool { slug: string; kind: 'checklist' | 'quiz'; [k: string]: any }
interface ExpState {
  tools: ExpTool[] | null;
  dirHandle: any;
  mode: 'simple' | 'advanced';
  openIdx: number | null;
}
const EXP_KEY = 'studio.exp';
export const E: ExpState = { tools: null, dirHandle: null, mode: 'simple', openIdx: null };

function persist() {
  try { localStorage.setItem(EXP_KEY, JSON.stringify({ tools: E.tools, mode: E.mode })); } catch { /* ignore */ }
}
export function expRestore() {
  try {
    const raw = localStorage.getItem(EXP_KEY);
    if (!raw) return;
    const j = JSON.parse(raw);
    if (Array.isArray(j.tools)) E.tools = j.tools;
    if (j.mode === 'simple' || j.mode === 'advanced') E.mode = j.mode;
  } catch { /* ignore */ }
}

const TEMPLATES: Record<'checklist' | 'quiz', ExpTool> = {
  checklist: { slug: '', kind: 'checklist', draft: true, icon: 'percent', title: '', shortTitle: '', description: '', intro: 'موردهای زیر را تیک بزنید.', items: [{ id: 'i1', text: '' }], tiers: [{ min: 0, max: 39, title: '', text: '' }, { min: 40, max: 79, title: '', text: '' }, { min: 80, max: 100, title: '', text: '' }], relatedService: 'business-license' },
  quiz: { slug: '', kind: 'quiz', draft: true, icon: 'shield-check', title: '', shortTitle: '', description: '', intro: 'به هر سؤال پاسخ بدهید.', items: [{ id: 'q1', text: '', answer: true, explain: '' }], tiers: [{ min: 0, max: 3, title: '', text: '' }], relatedService: 'business-license' }
};

export async function expOpenFolder(): Promise<string | null> {
  try {
    const dir: any = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    const src = await dir.getDirectoryHandle('src');
    const data = await src.getDirectoryHandle('data');
    const fh = await data.getFileHandle('experiences.json');
    const text = await (await fh.getFile()).text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return 'experiences.json باید یک آرایه باشد؛ فایل فعلی این شکل نیست.';
    E.tools = parsed;
    E.dirHandle = dir;
    persist();
    return null;
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
    return 'باز نشد: ' + (err?.message ?? String(err));
  }
}

export async function expSaveFolder(): Promise<string | null> {
  if (!E.dirHandle) return 'ابتدا «باز کردن پوشهٔ پروژه» را بزنید.';
  try {
    const src = await E.dirHandle.getDirectoryHandle('src');
    const data = await src.getDirectoryHandle('data');
    const fh = await data.getFileHandle('experiences.json', { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(E.tools, null, 2) + '\n');
    await w.close();
    return null;
  } catch (err: any) { return 'ذخیره نشد: ' + (err?.message ?? String(err)); }
}

export function expDownloadBlob(): Blob {
  return new Blob([JSON.stringify(E.tools ?? [], null, 2) + '\n'], { type: 'application/json' });
}

export function expAdd(kind: 'checklist' | 'quiz') {
  if (!E.tools) E.tools = [];
  E.tools.push(structuredClone(TEMPLATES[kind]));
  E.openIdx = E.tools.length - 1;
  persist();
}
export function expDelete(i: number) {
  if (!E.tools) return;
  E.tools.splice(i, 1);
  if (E.openIdx === i) E.openIdx = null;
  persist();
}
export function expToggle(i: number) { E.openIdx = E.openIdx === i ? null : i; }
export function expSetMode(m: 'simple' | 'advanced') { E.mode = m; persist(); }
export function expSetField(i: number, key: string, raw: string, kind?: string) {
  if (!E.tools?.[i]) return;
  let v: any = raw;
  if (kind === 'bool') v = raw === '1';
  else if (kind === 'json') { try { v = JSON.parse(raw); } catch { return; } }
  (E.tools[i] as any)[key] = v;
  persist();
}
export function expApplyRaw(text: string): string | null {
  try {
    const j = JSON.parse(text);
    if (!Array.isArray(j)) return 'باید یک آرایهٔ JSON باشد (با [ شروع و با ] تمام شود).';
    E.tools = j;
    persist();
    return null;
  } catch (err) { return 'JSON نامعتبر: ' + (err as Error).message.split('\n')[0]; }
}
export function expLoadFromPaste(text: string): string | null { return expApplyRaw(text); }

const AI_PROMPT_HEAD = `متن زیر محتوای فعلی فایل src/data/experiences.json سایت «بیزنس‌یار» است. هر آیتم یک ابزار کوتاه «چک‌لیست» یا «تست» برای کاربران سایت است (آمادگی برای جواز کسب، باورهای رایج و مانند آن)، به فارسی.
بر اساس درخواست من، یک ابزار تازه اضافه کن یا یکی از ابزارهای موجود را ویرایش کن، و در پاسخ فقط و فقط «کل آرایهٔ JSON به‌روزشده» را برگردان (نه فقط آیتم تازه، نه توضیح اضافه)، دقیقاً با همان کلیدها: slug, kind ("checklist" یا "quiz"), draft, icon, title, shortTitle, description, intro, items[], tiers[], relatedService, و در صورت نیاز relatedArticles/ctaLabel.
items برای kind=checklist: {"id","text","hint?"} — برای kind=quiz: {"id","text","answer":true/false,"explain"}.
tiers: {"min","max","title","text","shareText?"} که min/max بازهٔ درصد (چک‌لیست) یا امتیاز خام (تست) است و بازه‌ها باید کل محدوده را بدون هم‌پوشانی بپوشانند.

درخواست من: `;

export function expPrompt(request: string): string {
  return AI_PROMPT_HEAD + (request.trim() || '(یک ابزار تازهٔ مرتبط با یکی از خدمات سایت پیشنهاد بده)') + '\n\nمحتوای فعلی:\n' + JSON.stringify(E.tools ?? [], null, 2);
}

// ───────── رندر ─────────
function seg(): string {
  return `<div class="st-seg" role="tablist"><button class="${E.mode === 'simple' ? 'on' : ''}" data-act="exp-mode" data-v="simple">ساده</button><button class="${E.mode === 'advanced' ? 'on' : ''}" data-act="exp-mode" data-v="advanced">پیشرفته</button></div>`;
}
function saveRow(): string {
  return `<div class="st-actions">${E.dirHandle ? '<button class="btn btn-primary" data-act="exp-save">ذخیره در همان فایل</button>' : ''}<button class="btn btn-ghost" data-act="exp-download">دانلود experiences.json</button></div>`;
}
function field(i: number, k: string, label: string, v: any, kind: 'text' | 'longtext' | 'bool' = 'text'): string {
  if (kind === 'bool') return `<label class="st-check"><input type="checkbox" data-exp="${i}" data-k="${k}" data-kind="bool" ${v ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  if (kind === 'longtext') return `<div class="st-field"><label class="st-label">${esc(label)}</label><textarea class="st-in" rows="2" data-exp="${i}" data-k="${k}">${esc(v ?? '')}</textarea></div>`;
  return `<div class="st-field"><label class="st-label">${esc(label)}</label><input class="st-in" data-exp="${i}" data-k="${k}" value="${esc(v ?? '')}"></div>`;
}
function expFields(t: ExpTool, i: number): string {
  return `<div style="margin-top:.8rem;display:grid;gap:.6rem">
  <div class="st-row">${field(i, 'slug', 'شناسه (انگلیسی)', t.slug)}${field(i, 'icon', 'آیکون', t.icon)}</div>
  ${field(i, 'title', 'عنوان کامل', t.title)}
  ${field(i, 'shortTitle', 'عنوان کوتاه', t.shortTitle)}
  ${field(i, 'description', 'توضیح کوتاه', t.description, 'longtext')}
  ${field(i, 'intro', 'متن راهنمای شروع', t.intro, 'longtext')}
  ${field(i, 'draft', 'پیش‌نویس (روی سایت دیده نشود)', t.draft, 'bool')}
  <div class="st-field"><label class="st-label">آیتم‌ها (JSON)</label>
    <textarea class="st-in ltr-text" rows="5" data-exp="${i}" data-k="items" data-kind="json">${esc(JSON.stringify(t.items ?? [], null, 2))}</textarea>
    <small class="st-help">${t.kind === 'quiz' ? 'هر مورد: {"id":"q1","text":"…","answer":true,"explain":"…"}' : 'هر مورد: {"id":"i1","text":"…","hint":"(اختیاری)"}'}</small></div>
  <div class="st-field"><label class="st-label">سطح‌های نتیجه — tiers (JSON)</label>
    <textarea class="st-in ltr-text" rows="5" data-exp="${i}" data-k="tiers" data-kind="json">${esc(JSON.stringify(t.tiers ?? [], null, 2))}</textarea>
    <small class="st-help">هر سطح: {"min":0,"max":39,"title":"…","text":"…","shareText":"(اختیاری)"}</small></div>
</div>`;
}
function expCard(t: ExpTool, i: number): string {
  const open = E.openIdx === i;
  return `<div class="st-city" style="display:block">
  <div style="display:flex;justify-content:space-between;gap:.6rem;align-items:center;flex-wrap:wrap">
    <div><b>${esc(t.shortTitle || t.title || '(بی‌عنوان)')}</b><small>${t.kind === 'quiz' ? 'تست' : 'چک‌لیست'}${t.draft ? ' · پیش‌نویس' : ' · منتشرشده'} · <span dir="ltr">${esc(t.slug || '—')}</span></small></div>
    <div><button class="btn btn-ghost" data-act="exp-toggle" data-i="${i}">${open ? 'بستن' : 'ویرایش'}</button><button class="st-x" data-act="exp-del" data-i="${i}" title="حذف">✕</button></div>
  </div>
  ${open ? expFields(t, i) : ''}
</div>`;
}
export function expPanel(): string {
  if (!E.tools) {
    return `<div class="st-intro"><h2>تجربه‌ها (چک‌لیست‌ها و تست‌ها)</h2><p>فایل <code dir="ltr">src/data/experiences.json</code> همین ابزارهای کوتاه (مثل «چک‌لیست آمادگی جواز کسب») را می‌سازد. برای ویرایش، یک‌بار پوشهٔ پروژه را باز کنید؛ از آن پس تغییرات مستقیم در همان فایل ذخیره می‌شود.</p></div>
<div class="st-actions"><button class="btn btn-primary" data-act="exp-open">باز کردن پوشهٔ پروژه</button><button class="btn btn-ghost" data-act="exp-paste">مرورگرم این را پشتیبانی نمی‌کند؛ متن JSON فعلی را بچسبانم</button></div>
<div id="exp-paste-box" hidden><div class="st-card"><textarea class="st-in ltr-text" rows="8" id="exp-paste-ta" placeholder="محتوای experiences.json را اینجا بچسبانید"></textarea><div class="st-actions"><button class="btn btn-primary" data-act="exp-paste-apply">اعمال</button></div></div></div>
<div id="exp-msg" class="st-msg"></div>`;
  }
  if (E.mode === 'advanced') {
    return `<div class="st-intro"><h2>تجربه‌ها — پیشرفته</h2><p>کل آرایهٔ JSON اینجاست. برای افزودن/ویرایش با هوش مصنوعی: درخواستتان را بنویسید، «کپی پرامپت کامل» را بزنید، در یک چت هوش مصنوعی بچسبانید، و JSON برگشتی را در کادر پایین جایگزین و «اعمال» کنید.</p></div>
${seg()}
<div class="st-card">
  <label class="st-label">درخواست برای هوش مصنوعی</label>
  <input class="st-in" id="exp-ai-req" placeholder="مثلاً: یک تست ۵ سؤالی دربارهٔ مدارک ثبت شرکت اضافه کن">
  <div class="st-actions"><button class="btn btn-ghost" data-act="exp-copy-prompt">کپی پرامپت کامل</button></div>
</div>
<div class="st-card">
  <label class="st-label">JSON کامل (ویرایش مستقیم یا جای‌گذاری پاسخ هوش مصنوعی)</label>
  <textarea class="st-in ltr-text" rows="16" id="exp-raw">${esc(JSON.stringify(E.tools, null, 2))}</textarea>
  <div class="st-actions"><button class="btn btn-primary" data-act="exp-apply-raw">اعمال این JSON</button></div>
  <div id="exp-msg" class="st-msg"></div>
</div>
${saveRow()}`;
  }
  return `<div class="st-intro"><h2>تجربه‌ها — ساده</h2><p>${toFa(E.tools.length)} ابزار. روی «ویرایش» بزنید تا فیلدهایش باز شود.</p></div>
${seg()}
<div class="st-actions"><button class="btn btn-ghost" data-act="exp-add" data-v="checklist">+ چک‌لیست جدید</button><button class="btn btn-ghost" data-act="exp-add" data-v="quiz">+ تست جدید</button></div>
<div class="st-cities">${E.tools.map((t, i) => expCard(t, i)).join('')}</div>
${saveRow()}
<div id="exp-msg" class="st-msg"></div>`;
}
