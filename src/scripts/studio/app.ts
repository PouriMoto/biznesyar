// رابط Studio: تب‌ها، میزکار (ویرایش + بررسی + پیش‌نمایش + خروجی)
import { kit, loadKit, loadExisting, typeDef, newPkg, fileText, outputFiles, parseMd, pkgFromReply, suggestSlug, slugify, slugOk, esc, toFa, today, hasCover, paths, type Pkg, type PkgType, type Issue } from './core';
import { validate, counts } from './rules';
import { previewHtml, serp } from './preview';
import { localFactCount, guideFactCount, getBriefForm, buildPrompt, buildStaged, repairPrompt, buildJob, sendJob, collectEvidence } from './prompt';
import { makeZip } from './zip';
import { pagesPanel, applyInput as pgInput, addItem as pgAdd, delItem as pgDel, pagesJson } from './pages';
import { toCoverWebp, fetchImage } from './image';

type Tab = 'agent' | 'copy' | 'manual' | 'cities' | 'pages';
interface State {
  tab: Tab;
  ctype: 'article' | 'area-page' | 'guide';
  inputs: Record<string, Record<string, any>>;
  pkg: Pkg | null;
  reply: string;
  stage: { r1: string; r2: string };
  mode: 'full' | 'compact' | 'staged';
  prompt: string;
  batch: string[];
  batchTrades: string[];
  ui: Record<string, boolean>;
  pages: any;
}
const KEY = 'studio.v1';
const S: State = { tab: 'agent', ctype: 'article', inputs: { article: { length: 'medium' }, 'area-page': { style: 'local' }, guide: { length: 'medium', style: 'license-guide' } }, pkg: null, reply: '', stage: { r1: '', r2: '' }, mode: 'full', prompt: '', batch: [], batchTrades: [], ui: {}, pages: null };
let issues: Issue[] = [];
let coverObj = '';
let validateTimer: number | undefined;
const $ = (s: string, r: ParentNode = document) => r.querySelector(s) as HTMLElement | null;
const app = () => $('#app')!;

// ───────── ذخیره و بازیابی ─────────
const blobToData = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
let saveTimer: number | undefined;
function save() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    try {
      const pkg = S.pkg ? { ...S.pkg, cover: S.pkg.cover ? { url: S.pkg.cover.url, data: S.pkg.cover.blob ? await blobToData(S.pkg.cover.blob) : undefined } : undefined } : null;
      localStorage.setItem(KEY, JSON.stringify({ tab: S.tab, ctype: S.ctype, inputs: S.inputs, pkg, reply: S.reply, stage: S.stage, mode: S.mode }));
    } catch { /* پر بودن حافظه یا حالت خصوصی */ }
  }, 400);
}
async function restore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const j = JSON.parse(raw);
    Object.assign(S, { tab: j.tab ?? 'agent', ctype: j.ctype ?? 'article', inputs: { ...S.inputs, ...(j.inputs ?? {}) }, reply: j.reply ?? '', stage: j.stage ?? S.stage, mode: j.mode ?? 'full' });
    if (j.pkg && kit.contract.types[j.pkg.type]) {
      const c = j.pkg.cover;
      S.pkg = { ...j.pkg, cover: c ? { url: c.url, blob: c.data ? await (await fetch(c.data)).blob() : undefined } : undefined };
    }
  } catch { /* نادیده */ }
}

// ───────── ابزارهای کوچک ─────────
let toastTimer: number | undefined;
function toast(msg: string, kind: 'ok' | 'err' = 'ok') {
  const t = $('#st-toast')!;
  t.textContent = msg; t.className = `st-toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.className = 'st-toast'), 3500);
}
async function copy(text: string, ok = 'کپی شد') {
  try { await navigator.clipboard.writeText(text); toast(ok); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(ok); } catch { toast('کپی نشد؛ متن را دستی انتخاب کنید.', 'err'); }
    ta.remove();
  }
}
function download(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const setPath = (o: any, path: string, v: any) => { const ks = path.split('.'); let c = o; for (const k of ks.slice(0, -1)) c = c[k] ??= {}; c[ks.at(-1)!] = v; };
const getPath = (o: any, path: string) => path.split('.').reduce((c, k) => (c == null ? c : c[k]), o);

// ───────── ساخت فیلدها ─────────
const listOptions = (f: any): [string, string][] => f.options ?? (kit.lists[f.list] ?? []).map((o: any) => [o.value, o.label]);

function fieldHtml(f: any, value: any, scope: string): string {
  const k = f.key;
  const req = f.required ? '<b class="st-req" title="الزامی">*</b>' : '';
  const help = f.help ? `<small class="st-help">${esc(f.help)}</small>` : '';
  const ph = f.example ? ` placeholder="${esc(f.example)}"` : '';
  const attrs = `data-s="${scope}" data-k="${k}" data-kind="${f.kind}"`;
  const wrap = (inner: string, cls = '') => `<div class="st-field ${cls}"><label class="st-label">${esc(f.label)}${req}</label>${inner}${help}</div>`;
  const v = f.key === 'magnet' ? (value === false ? 'none' : value === true || value == null ? 'auto' : value) : value ?? '';
  switch (f.kind) {
    case 'longtext': return wrap(`<textarea class="st-in" rows="4" ${attrs}${ph}>${esc(v)}</textarea>`);
    case 'lines': return wrap(`<textarea class="st-in" rows="3" ${attrs}${ph}>${esc(Array.isArray(v) ? v.join('\n') : v)}</textarea>`);
    case 'tags': return wrap(`<input class="st-in" ${attrs}${ph} value="${esc(Array.isArray(v) ? v.join('، ') : v)}" placeholder="با ویرگول جدا کنید">`);
    case 'url': return wrap(`<input class="st-in ltr" type="url" ${attrs}${ph} value="${esc(v)}">`);
    case 'date': return wrap(`<input class="st-in ltr" type="date" ${attrs} value="${esc(v)}">`);
    case 'number': return wrap(`<input class="st-in ltr" type="number" ${attrs} value="${esc(v)}">`);
    case 'bool': return `<label class="st-check"><input type="checkbox" ${attrs} ${v ? 'checked' : ''}><span>${esc(f.label)}</span>${f.help ? `<small class="st-help">${esc(f.help)}</small>` : ''}</label>`;
    case 'select': {
      const o = listOptions(f);
      return wrap(`<select class="st-in" ${attrs}>${f.required && f.default !== undefined ? '' : '<option value="">— انتخاب کنید —</option>'}${o.map(([val, lab]) => `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`);
    }
    default: return wrap(`<input class="st-in" ${attrs}${ph} value="${esc(v)}" ${f.suggest ? `list="dl-${f.suggest}"` : ''}>`);
  }
}

function inputForm(type: 'article' | 'area-page' | 'guide'): string {
  const def = typeDef(type);
  const st = S.inputs[type];
  const main = def.inputs.filter((f: any) => f.group !== 'extra');
  const extra = def.inputs.filter((f: any) => f.group === 'extra');
  const f = (x: any) => fieldHtml(x, st[x.key] ?? x.default ?? '', `in:${type}`);
  return `<div class="st-card">${main.map(f).join('')}</div>
<details class="st-card st-more" ${extra.some((x: any) => st[x.key]) ? 'open' : ''}><summary>اضافه‌ها (اختیاری) — هرچه بیشتر بدهید، خروجی دقیق‌تر است</summary>${extra.map(f).join('')}</details>`;
}

const typeSwitch = () => `<div class="st-seg" role="tablist">${(['article', 'guide', 'area-page'] as const).map((t) => `<button class="${S.ctype === t ? 'on' : ''}" data-act="ctype" data-v="${t}">${esc(typeDef(t).label)}</button>`).join('')}</div>`;

// ───────── پنل‌های تب ─────────
function panelAgent(): string {
  const f = getBriefForm();
  const ok = !!(f.action && f.fields?.job);
  const showBatch = (S.ctype === 'article' && (S.inputs.article.style === 'local' || S.batch.length > 0)) || S.ctype === 'area-page' || S.ctype === 'guide';
  const nJobs = S.ctype === 'guide' ? Math.max(1, S.batchTrades.length) * Math.max(1, S.batch.length) : S.batch.length;
  return `
<div class="st-split">
<div class="st-col">
<div class="st-intro">
  <h2>ساخت با Agent</h2>
  <p>بریف را بنویسید و بفرستید؛ Agent مطلب را به‌صورت <b>پیش‌نویس</b> می‌سازد و شما بازبینی و منتشر می‌کنید.</p>
  ${ok ? '<div class="st-conn-ok">✓ صف Agent متصل است؛ ارسال مستقیم فعال است.</div>' : '<div class="st-conn-need">هنوز صف Agent وصل نشده. از ستون/بخش «اتصال Agent» یک‌بار وصلش کنید؛ تا آن موقع «کپی کار» یا Copy-for-AI را بزنید.</div>'}
</div>
${typeSwitch()}
${inputForm(S.ctype)}
${showBatch ? `<details class="st-card st-more" ${S.batch.length || S.batchTrades.length ? 'open' : ''}><summary>ساخت دسته‌ای ${S.ctype === 'guide' ? '(ماتریس رسته × شهر)' : 'برای چند شهر'}</summary>
  <p class="st-help">${S.ctype === 'guide' ? 'چند رسته و/یا چند شهر انتخاب کنید؛ برای هر ترکیب یک راهنمای جدا ساخته می‌شود. بدون انتخاب شهر، راهنمای کشوری ساخته می‌شود. ترکیبی که داده کافی ندارد رد می‌شود.' : 'برای هر شهر، یک نوشته جدا با داده همان شهر ساخته می‌شود. شهری که داده محلی کافی ندارد رد می‌شود.'}</p>
  ${S.ctype === 'guide' ? `<h4>رسته‌ها</h4><div class="st-checks">${kit.lists.trades.map((r: any) => `<label class="st-chip"><input type="checkbox" data-act="batch-trade" value="${r.value}" ${S.batchTrades.includes(r.value) ? 'checked' : ''}><span>${esc(r.label)}</span></label>`).join('')}</div><h4>شهرها</h4>` : ''}
  <div class="st-checks">${kit.lists.regions.map((r: any) => `<label class="st-chip"><input type="checkbox" data-act="batch" value="${r.value}" ${S.batch.includes(r.value) ? 'checked' : ''}><span>${esc(r.label)}</span></label>`).join('')}</div>
  ${S.ctype === 'guide' ? `<p class="st-help" id="st-njobs">${toFa(nJobs)} کار ساخته می‌شود.</p>` : ''}</details>` : ''}
<div class="st-actions">
  <button class="btn btn-primary" data-act="send-job">ارسال به Agent</button>
  <button class="btn btn-ghost" data-act="copy-job">کپی کار (JSON)</button>
  <button class="btn btn-ghost" data-act="to-copy">Agent خاموش است ← Copy-for-AI</button>
</div>
</div>
<aside class="st-col">${connectHtml(ok)}</aside>
</div>`;
}

const APPS_SCRIPT = String.raw`function setupAgentQueue() {
  var form = FormApp.create('Agent Queue');
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(false);
  var titles = ['key', 'type', 'title', 'job'];
  var items = [
    form.addTextItem().setTitle('key'),
    form.addTextItem().setTitle('type'),
    form.addTextItem().setTitle('title'),
    form.addParagraphTextItem().setTitle('job')
  ];
  var ss = SpreadsheetApp.create('Agent Queue - responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  DriveApp.getFileById(ss.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var r = form.createResponse();
  items.forEach(function (it, i) { r = r.withItemResponse(it.createResponse('XQ' + i + 'QX')); });
  var url = r.toPrefilledUrl();
  var ids = {};
  titles.forEach(function (t, i) {
    var m = url.match(new RegExp('entry\\.(\\d+)=XQ' + i + 'QX'));
    ids[t] = m ? 'entry.' + m[1] : '';
  });
  var sheets = ss.getSheets();
  var sh = sheets.filter(function (s) { return /Form Responses/i.test(s.getName()); })[0] || sheets[sheets.length - 1];
  var cfg = {
    action: form.getPublishedUrl().replace('/viewform', '/formResponse'),
    key: Utilities.getUuid().slice(0, 8),
    fields: ids,
    csv: 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=csv&gid=' + sh.getSheetId()
  };
  Logger.log(JSON.stringify(cfg));
}
`;

function connectHtml(ok: boolean): string {
  const f = getBriefForm();
  let csv = ''; try { csv = localStorage.getItem('studio.briefCsv') ?? ''; } catch { /* ignore */ }
  const kitSnippet = JSON.stringify({ briefForm: { action: f.action ?? '', key: f.key ?? '', fields: f.fields ?? {}, csv } }, null, 2);
  return `<details class="st-card st-more st-conn" data-ui="conn" ${S.ui.conn || !ok ? 'open' : ''}><summary>اتصال Agent ${ok ? '✓ (انجام شده)' : '(یک‌بار، ~۵ دقیقه)'}</summary>
  <div class="st-help"><b>این چیست؟</b> Studio و Agent مستقیم به هم وصل نمی‌شوند؛ وسط‌شان یک «صف» است (یک فرم گوگل). Studio کار را در صف می‌گذارد و Agent هر چند دقیقه آن را برمی‌دارد. پس Agent می‌تواند روی کامپیوتر شما باشد و Studio از گوشی هم کار کند. این صف را فقط <b>یک بار</b> می‌سازید.</div>
  <ol class="st-steps">
    <li>در <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> پروژهٔ جدید بسازید، محتوایش را پاک کنید و این کد را بچسبانید: <button class="btn btn-ghost" data-act="copy-script">کپی کد</button></li>
    <li>تابع <code>setupAgentQueue</code> را انتخاب و «Run» بزنید و مجوز بدهید («Advanced ← Go to… (unsafe)» عادی است؛ کد مال خودتان است).</li>
    <li>خط JSON پایین صفحه (Execution log) را اینجا بچسبانید:
      <textarea class="st-in ltr-text" rows="3" id="st-conn-in" placeholder='{"action":"https://docs.google.com/forms/...","key":"...","fields":{...},"csv":"..."}'></textarea>
      <div class="st-actions"><button class="btn btn-primary" data-act="conn-save">ذخیره اتصال</button><button class="btn btn-ghost" data-act="conn-test">کار آزمایشی</button><button class="btn btn-ghost" data-act="conn-clear">پاک‌کردن</button></div>
      <div id="st-conn-msg" class="st-msg"></div></li>
    <li>فقط وقتی می‌خواهید روی همهٔ دستگاه‌ها و برای خود Agent کار کند: این بلوک را در <code>content-kit/kit.json</code> زیر <code>"studio"</code> بگذارید (بعد از آن <b>Agent خودش لینک صف را از همین‌جا می‌خواند</b>؛ دیگر yaml را دست نزنید):
      <textarea class="st-in ltr-text" rows="9" readonly>${esc(kitSnippet)}</textarea></li>
  </ol>
  <div class="st-help"><b>اجرای Agent:</b> در پوشهٔ سایت فقط <code>npm run agent</code> را بزنید؛ خودش اتصال را بررسی می‌کند و صف را مرتب پایش می‌کند. دیگر لازم نیست چیزی را دستی چک کنید.</div>
  <p class="st-help">نکته: «key» قفل امنیتی نیست و شیت پاسخ‌ها با داشتن لینک خواندنی است؛ چیز محرمانه در بریف ننویسید.</p>
</details>`;
}

function panelCopy(): string {
  const staged = S.mode === 'staged';
  return `
<div class="st-intro">
  <h2>Copy-for-AI</h2>
  <p>فرم را پر کنید، پرامپت آماده را در هر چت هوش مصنوعی بچسبانید و پاسخ را برگردانید. نیازی به Agent یا API نیست.</p>
</div>
${typeSwitch()}
${inputForm(S.ctype)}
<div class="st-card">
  <div class="st-field"><label class="st-label">حالت پرامپت</label>
  <select class="st-in" data-act="mode"><option value="full" ${S.mode === 'full' ? 'selected' : ''}>کامل (چت‌های قوی)</option><option value="compact" ${S.mode === 'compact' ? 'selected' : ''}>فشرده (پنجره کوچک)</option><option value="staged" ${staged ? 'selected' : ''}>مرحله‌ای (مدل ضعیف‌تر: ۳ پیام)</option></select></div>
  <button class="btn btn-primary" data-act="make-prompt">ساخت پرامپت</button>
</div>
<div id="st-prompt">${S.prompt ? promptHtml() : ''}</div>
<div class="st-card">
  <h3>۲. پاسخ هوش مصنوعی را اینجا بچسبانید</h3>
  <textarea class="st-in ltr-text" rows="8" data-act="reply" placeholder="&lt;&lt;&lt;PACKAGE ... &gt;&gt;&gt;">${esc(S.reply)}</textarea>
  <div class="st-actions"><button class="btn btn-primary" data-act="load-reply">ساخت بسته از پاسخ</button></div>
  <div id="st-reply-msg" class="st-msg"></div>
</div>`;
}

function promptHtml(): string {
  if (S.mode === 'staged') {
    const ps = buildStaged(S.ctype, S.inputs[S.ctype], S.stage.r1, S.stage.r2);
    return ps.map((p, i) => `<div class="st-card"><h3>پیام ${toFa(i + 1)}${i === 0 ? ' — طرح' : i === 1 ? ' — متن' : ' — بسته نهایی'}</h3>
      <textarea class="st-in ltr-text" rows="6" readonly>${esc(p)}</textarea>
      <div class="st-actions"><button class="btn btn-ghost" data-act="copy-text" data-i="${i}">کپی پیام ${toFa(i + 1)}</button></div>
      ${i < 2 ? `<label class="st-label">خروجی پیام ${toFa(i + 1)} را اینجا بچسبانید</label><textarea class="st-in" rows="3" data-act="stage" data-i="${i}">${esc(i === 0 ? S.stage.r1 : S.stage.r2)}</textarea>` : ''}</div>`).join('');
  }
  return `<div class="st-card"><h3>۱. این پرامپت را کپی کنید</h3>
    <textarea class="st-in ltr-text" id="st-prompt-ta" rows="10" readonly>${esc(S.prompt)}</textarea>
    <div class="st-actions"><button class="btn btn-primary" data-act="copy-prompt">کپی پرامپت</button><span class="st-help">${toFa(S.prompt.length)} کاراکتر</span></div></div>`;
}

function existingItems() {
  const regName = (slug: string) => kit.regions.find((r: any) => r.slug === slug)?.name ?? slug;
  return [
    ...kit.articles.map((a: any) => ({ t: 'article', slug: a.slug, title: a.title, ext: a.ext, draft: a.draft, label: 'مقاله' })),
    ...(kit.guides ?? []).map((a: any) => ({ t: 'guide', slug: a.slug, title: a.title, ext: a.ext, draft: a.draft, label: 'راهنما' })),
    ...kit.areas.map((a: any) => ({ t: 'area-page', slug: a.slug, title: `متن بلند ${regName(a.slug)}`, ext: 'md', draft: false, label: 'شهر' }))
  ];
}

function panelManual(): string {
  const items = existingItems();
  return `
<div class="st-intro"><h2>نوشتن یا وارد کردن دستی</h2><p>بدون هوش مصنوعی: مطلب بنویسید، متن آماده‌تان را بچسبانید یا مطلب موجود را باز کنید و ویرایش کنید.</p></div>
<div class="st-actions">
  <button class="btn btn-primary" data-act="new" data-v="article">مقاله جدید</button>
  <button class="btn btn-ghost" data-act="new" data-v="guide">راهنمای رسته × مجوز</button>
  <button class="btn btn-ghost" data-act="new" data-v="area-page">متن بلند صفحه منطقه</button>
</div>
<details class="st-card st-more" data-ui="existing" ${S.ui.existing ? 'open' : ''}><summary>ویرایش مطلب موجود (${toFa(items.length)} مورد)</summary>
  <p class="st-help">مطلب را باز کنید، تغییر دهید و zip بگیرید؛ فقط فایل تغییرکرده در zip است و جایگزین فایل قبلی می‌شود. شناسهٔ آدرس عوض نمی‌شود. فایل‌های .mdx اینجا ویرایش نمی‌شوند.</p>
  <input class="st-in" data-act="ex-search" placeholder="جست‌وجو در عنوان‌ها…">
  <div class="st-cities" id="st-ex-list">${items.map((i) => `<div class="st-city st-ex-item" data-q="${esc(i.title + ' ' + i.slug)}"><div><b>${esc(i.title)}</b><small>${i.label}${i.draft ? ' · پیش‌نویس' : ''} · <span dir="ltr">${esc(i.slug)}</span></small></div>
    <div><button class="btn btn-ghost" data-act="edit-existing" data-t="${i.t}" data-v="${esc(i.slug)}" ${i.ext === 'mdx' ? 'disabled title="فایل mdx"' : ''}>باز کردن</button></div></div>`).join('') || '<p class="st-help">هنوز مطلبی نیست.</p>'}</div>
  <div id="st-ex-msg" class="st-msg"></div></details>
<details class="st-card st-more"><summary>متن آماده دارم (با یا بدون front matter)</summary>
  <textarea class="st-in ltr-text" id="st-import" rows="8" placeholder="---\ntitle: ...\n---\nمتن..."></textarea>
  <div class="st-actions"><button class="btn btn-primary" data-act="import">وارد کن</button></div>
  <div id="st-import-msg" class="st-msg"></div></details>`;
}

function panelCities(): string {
  const areaSet = new Set(kit.areas.map((a: any) => a.slug));
  return `
<div class="st-intro"><h2>شهرها و مناطق</h2><p>هر شهر یک فایل جدا دارد. ویرایش یا شهر جدید اضافه کنید و برای صفحه‌اش متن بلند بسازید.</p></div>
<div class="st-actions"><button class="btn btn-primary" data-act="new" data-v="region-entry">شهر جدید</button>
<button class="btn btn-ghost" data-act="batch-area">متن بلند برای چند شهر (Agent)</button></div>
<div class="st-cities">${kit.regions.map((r: any) => {
    const n = kit.articles.filter((a: any) => a.region === r.slug).length;
    return `<div class="st-city"><div><b>${esc(r.name)}</b><small>${esc(r.kind)}${areaSet.has(r.slug) ? ' · متن بلند دارد' : ''}${n ? ` · ${toFa(n)} مقاله` : ''}</small></div>
      <div><button class="btn btn-ghost" data-act="edit-region" data-v="${r.slug}">ویرایش</button><button class="btn btn-ghost" data-act="area-for" data-v="${r.slug}">متن بلند</button></div></div>`;
  }).join('')}</div>`;
}

// ───────── میزکار ─────────
function benchHtml(): string {
  const pkg = S.pkg;
  if (!pkg) return '';
  const def = typeDef(pkg.type);
  const editing = !!pkg.extra;
  const mainKeys = pkg.type === 'article' ? ['title', 'description', 'category', 'service', 'region', 'publishedAt'] : pkg.type === 'guide' ? ['title', 'description', 'trade', 'service', 'region', 'publishedAt'] : pkg.type === 'area-page' ? ['title', 'description'] : ['name', 'kind', 'intro', 'featured', 'order', 'notes'];
  const byKey = (k: string) => def.fields.find((f: any) => f.key === k);
  const fv = (k: string) => pkg.fm[k];
  const slugField = pkg.type === 'area-page'
    ? `<div class="st-field"><label class="st-label">منطقه</label><select class="st-in" data-s="slug" ${editing ? 'disabled' : ''}>${kit.lists.regions.map((r: any) => `<option value="${r.value}" ${pkg.slug === r.value ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select></div>`
    : `<div class="st-field"><label class="st-label">${pkg.type === 'region-entry' ? 'شناسه (انگلیسی)' : 'شناسه آدرس (انگلیسی)'}<b class="st-req">*</b></label><div class="st-row"><input class="st-in ltr" data-s="slug" value="${esc(pkg.slug)}" placeholder="مثلاً business-license-minab" ${(pkg.type === 'region-entry' && !pkg.isNew) || editing ? 'readonly' : ''}>${(pkg.type === 'article' || pkg.type === 'guide') && !editing ? '<button class="btn btn-ghost" data-act="suggest-slug">پیشنهاد</button>' : ''}</div></div>`;
  const main = mainKeys.map((k) => byKey(k)).filter(Boolean).map((f: any) => fieldHtml(f, fv(f.key), 'fm')).join('');
  const body = pkg.type === 'region-entry' ? '' : `
<div class="st-field"><label class="st-label">متن (Markdown)<b class="st-req">*</b></label>
  <div class="st-tools">${[['## ', 'H2', 'h2'], ['### ', 'H3', 'h3'], ['**', 'B', 'bold'], ['- ', 'لیست', 'ul'], ['1. ', '۱.', 'ol'], ['> ', '❝', 'quote'], ['', '💡 نکته', 'c-tip'], ['', '⚠️ هشدار', 'c-warning'], ['', 'ℹ️ بدانید', 'c-info'], ['', '⚡ خلاصهٔ سریع', 'c-key'], ['', '🧩 نمودار Mermaid', 'mermaid']].map(([a, l, id]) => `<button type="button" data-act="md" data-v="${id}">${l}</button>`).join('')}
  <select data-act="md-link"><option value="">+ پیوند به صفحه سایت</option>${[...kit.lists.services.map((s: any) => [`/services/${s.value}/`, s.label]), ...kit.lists.regions.map((r: any) => [`/areas/${r.value}/`, r.label]), ...kit.articles.filter((a: any) => !a.draft).map((a: any) => [`/articles/${a.slug}/`, a.title]), ...(kit.guides ?? []).filter((a: any) => !a.draft).map((a: any) => [`/guides/${a.slug}/`, a.title]), ['/contact/', 'تماس']].map(([p, l]) => `<option value="${esc(p)}|${esc(l)}">${esc(l)}</option>`).join('')}</select></div>
  ${helpHtml()}
  <textarea class="st-in st-body" rows="16" data-s="body">${esc(pkg.body)}</textarea></div>`;
  const faq = byKey('faq') ? repeatHtml('faq', fv('faq') ?? [], ['q', 'a'], ['پرسش', 'پاسخ'], 'پرسش متداول') : '';
  const sources = byKey('sources') ? repeatHtml('sources', fv('sources') ?? [], ['title', 'url'], ['عنوان منبع', 'لینک (اختیاری)'], 'منبع') : '';
  const extra = ['tags', 'draft', 'leadForm', 'magnet', 'generatedBy'].filter((k) => byKey(k)).map((k) => fieldHtml(byKey(k), fv(k), 'fm')).join('');
  return `
<div class="st-bench-head"><h2>${esc(def.label)}${pkg.isNew ? '' : ' (ویرایش)'}</h2><div id="st-badges"></div>${pkg.type !== 'region-entry' && byKey('draft') ? (pkg.fm.draft ? '<button class="btn btn-ghost" data-act="publish">انتشار (برداشتن پیش‌نویس)</button>' : '<span class="st-badge good">منتشرشده</span> <button class="btn btn-ghost" data-act="unpublish">برگرداندن به پیش‌نویس</button>') : ''}</div>
<div class="st-card">${slugField}${main}</div>
${body ? `<div class="st-card">${body}</div>` : ''}
${byKey('cover') ? coverHtml() : ''}
${faq ? `<div class="st-card">${faq}</div>` : ''}
${sources ? `<div class="st-card">${sources}</div>` : ''}
${extra ? `<details class="st-card st-more"><summary>تنظیمات بیشتر</summary>${extra}</details>` : ''}
<div class="st-card" id="st-checks-card"><h3>بررسی‌ها</h3><div id="st-checks"></div></div>
<div class="st-bar"><div class="st-bar-in">
  <button class="btn btn-ghost" data-act="preview">پیش‌نمایش</button>
  <button class="btn btn-primary" data-act="zip" id="st-zip">دانلود فایل‌ها (zip)</button>
  <button class="btn btn-ghost" data-act="folder" id="st-folder">ذخیره در پوشه</button>
  <button class="btn btn-ghost" data-act="copy-file">کپی متن فایل</button>
  <button class="btn btn-ghost" data-act="repair" id="st-repair" hidden>پرامپت اصلاح</button>
  <button class="btn btn-ghost" data-act="discard">حذف</button>
</div></div>
<div class="st-card st-howto" id="st-howto" hidden></div>`;
}

function repeatHtml(list: string, items: any[], keys: string[], labels: string[], title: string): string {
  return `<h3>${esc(title)}‌ها</h3>${items.map((it, i) => `<div class="st-rep"><div>${keys.map((k, j) => (j === 1 && list === 'faq')
      ? `<textarea class="st-in" rows="2" placeholder="${labels[j]}" data-s="rep" data-list="${list}" data-i="${i}" data-f="${k}">${esc(it?.[k] ?? '')}</textarea>`
      : `<input class="st-in ${k === 'url' ? 'ltr' : ''}" placeholder="${labels[j]}" data-s="rep" data-list="${list}" data-i="${i}" data-f="${k}" value="${esc(it?.[k] ?? '')}">`).join('')}</div>
    <button class="st-x" data-act="rep-del" data-list="${list}" data-i="${i}" title="حذف">✕</button></div>`).join('')}
    <button class="btn btn-ghost" data-act="rep-add" data-list="${list}">+ افزودن ${esc(title)}</button>`;
}

function coverHtml(): string {
  const pkg = S.pkg!;
  const c = pkg.fm.cover ?? {};
  const src = coverObj || pkg.cover?.url || '';
  return `<div class="st-card"><h3>تصویر شاخص</h3>
  ${src ? `<img class="st-thumb" src="${esc(src)}" alt="">` : ''}
  ${pkg.fm.cover?.src && !pkg.cover ? `<small class="st-help">تصویر فعلی (<code dir="ltr">${esc(pkg.fm.cover.src)}</code>) حفظ می‌شود؛ برای تعویض، تصویر تازه انتخاب کنید.</small>` : ''}
  <div class="st-row"><label class="btn btn-ghost st-file">انتخاب تصویر<input type="file" accept="image/*" data-act="cover-file" hidden></label>
  ${pkg.cover?.url && !pkg.cover.blob ? '<button class="btn btn-ghost" data-act="cover-fetch">دانلود از لینک و تبدیل</button>' : ''}
  ${hasCover(pkg) ? '<button class="btn btn-ghost" data-act="cover-del">حذف تصویر</button>' : ''}</div>
  <small class="st-help">تصویر در مرورگر به webp با اندازه ۱۲۰۰×۶۳۰ تبدیل می‌شود.</small>
  <div class="st-field"><label class="st-label">توضیح تصویر (alt) — الزامی اگر تصویر دارید</label><input class="st-in" data-s="fm" data-k="cover.alt" data-kind="text" value="${esc(c.alt ?? '')}"></div>
  <div class="st-field"><label class="st-label">زیرنویس (اختیاری)</label><input class="st-in" data-s="fm" data-k="cover.caption" data-kind="text" value="${esc(c.caption ?? '')}"></div></div>`;
}

// ───────── بررسی‌ها ─────────
function allIssues(): Issue[] {
  const pkg = S.pkg!;
  pkg.keywords = String(S.inputs[S.ctype]?.keywords ?? '').split(/[،,\n]/).map((x) => x.trim()).filter(Boolean);
  const out = validate(pkg);
  if (pkg.cover?.url && !pkg.cover.blob && pkg.type !== 'region-entry') out.push({ level: 'error', id: 'cover-file', field: 'cover', msg: 'تصویر فقط یک لینک است و فایلش در بسته نیست؛ «دانلود از لینک و تبدیل» را بزنید یا تصویر را انتخاب کنید.' });
  return out;
}
function revalidate() {
  if (!S.pkg) return;
  issues = allIssues();
  const c = counts(issues);
  const box = $('#st-checks');
  if (box) box.innerHTML = issues.length
    ? issues.map((i) => `<div class="st-issue ${i.level}"><span>${i.level === 'error' ? '✕' : '!'}</span><div>${esc(i.msg)}</div></div>`).join('')
    : '<div class="st-issue ok"><span>✓</span><div>همه بررسی‌ها درست است.</div></div>';
  const b = $('#st-badges');
  if (b) b.innerHTML = `<span class="st-badge ${c.errors ? 'bad' : 'good'}">${c.errors ? `${toFa(c.errors)} خطا` : 'بدون خطا'}</span>${c.warnings ? `<span class="st-badge warn">${toFa(c.warnings)} هشدار</span>` : ''}`;
  const zip = $('#st-zip') as HTMLButtonElement | null, folder = $('#st-folder') as HTMLButtonElement | null;
  if (zip) { zip.disabled = c.errors > 0; zip.title = c.errors ? 'ابتدا خطاها را رفع کنید' : ''; }
  if (folder) { folder.disabled = c.errors > 0; folder.hidden = !('showDirectoryPicker' in window); }
  const rep = $('#st-repair');
  if (rep) rep.hidden = !(c.errors || c.warnings) || S.pkg.type === 'region-entry' || S.pkg.fm.generatedBy !== 'agent';
}
function scheduleValidate() { clearTimeout(validateTimer); validateTimer = window.setTimeout(revalidate, 250); }

// ───────── رندر ─────────
const TABS: [Tab, string][] = [['agent', 'Agent'], ['copy', 'Copy-for-AI'], ['manual', 'دستی'], ['cities', 'شهرها'], ['pages', 'صفحه‌ها']];
const PG_KEY = 'studio.pages';
const pgBase = () => JSON.stringify(kit.pages?.home ?? {});
function pgLoad() {
  if (S.pages) return;
  try { const r = localStorage.getItem(PG_KEY); S.pages = r ? JSON.parse(r) : JSON.parse(pgBase()); } catch { S.pages = JSON.parse(pgBase()); }
}
function pgSave() { try { localStorage.setItem(PG_KEY, JSON.stringify(S.pages)); } catch { /* ignore */ } }
function panelPages(): string { pgLoad(); return pagesPanel(S.pages, S.ui, JSON.stringify(S.pages) !== pgBase()); }
function render() {
  const panel = { agent: panelAgent, copy: panelCopy, manual: panelManual, cities: panelCities, pages: panelPages }[S.tab]();
  app().innerHTML = `
<nav class="st-tabs" role="tablist">${TABS.map(([t, l]) => `<button role="tab" class="${S.tab === t ? 'on' : ''}" data-act="tab" data-v="${t}">${l}</button>`).join('')}</nav>
<datalist id="dl-categories">${(kit.lists.categories ?? []).map((c: string) => `<option value="${esc(c)}">`).join('')}</datalist>
<section class="st-panel">${panel}</section>
<section class="st-bench" id="st-bench">${benchHtml()}</section>`;
  if (S.pkg) revalidate();
}
function renderBench() { const b = $('#st-bench'); if (b) { b.innerHTML = benchHtml(); revalidate(); } }

// ───────── رویدادها ─────────
function readField(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): any {
  const kind = el.dataset.kind;
  const raw = (el as HTMLInputElement).type === 'checkbox' ? (el as HTMLInputElement).checked : el.value;
  return { raw, kind };
}
function onInput(e: Event) {
  const el = e.target as HTMLInputElement;
  const s = el.dataset.s;
  if (el.dataset.act === 'ex-search') { const q = el.value.trim().toLowerCase(); document.querySelectorAll<HTMLElement>('.st-ex-item').forEach((n) => (n.hidden = !!q && !(n.dataset.q ?? '').toLowerCase().includes(q))); return; }
  if (el.dataset.act === 'reply') { S.reply = el.value; save(); return; }
  if (el.dataset.act === 'stage') { const i = Number(el.dataset.i); if (i === 0) S.stage.r1 = el.value; else S.stage.r2 = el.value; save(); return; }
  if (s === 'pg') { pgLoad(); pgInput(S.pages, el); pgSave(); return; }
  if (!s) return;
  if (s.startsWith('in:')) {
    const type = s.slice(3);
    S.inputs[type][el.dataset.k!] = (el as any).type === 'checkbox' ? el.checked : el.value;
    save();
    return;
  }
  const pkg = S.pkg;
  if (!pkg) return;
  if (s === 'slug') { pkg.slug = pkg.type === 'area-page' ? el.value : slugify(el.value) === el.value ? el.value : el.value.toLowerCase(); }
  else if (s === 'body') pkg.body = el.value;
  else if (s === 'rep') { const list = (pkg.fm[el.dataset.list!] ??= []); (list[Number(el.dataset.i)] ??= {})[el.dataset.f!] = el.value; }
  else if (s === 'fm') {
    const { raw, kind } = readField(el);
    let v = raw;
    if (kind === 'tags') v = String(raw).split(/[،,]/).map((x) => x.trim()).filter(Boolean);
    else if (kind === 'lines') v = String(raw).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    else if (kind === 'number') v = raw === '' ? '' : Number(raw);
    setPath(pkg.fm, el.dataset.k!, v);
  }
  save(); scheduleValidate();
}

async function loadPkgFromText(text: string, type: PkgType): Promise<Pkg> {
  const { fm, body } = parseMd(text);
  const p = newPkg(type);
  const keys = new Set(typeDef(type).fields.map((f: any) => f.key));
  for (const [k, v] of Object.entries(fm)) if (keys.has(k) && k !== 'cover') p.fm[k] = v;
  if (fm.cover && typeof fm.cover === 'object') p.fm.cover = { alt: fm.cover.alt, caption: fm.cover.caption };
  p.body = body;
  if (fm.slug) p.slug = slugify(String(fm.slug));
  if (!fm.title) { const m = body.match(/^#\s+(.+)$/m); if (m) { p.fm.title = m[1].trim(); p.body = body.replace(/^#\s+.+\n?/m, '').trim(); } }
  return p;
}

async function onClick(e: Event) {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!el) return;
  const act = el.dataset.act!;
  const v = el.dataset.v ?? '';
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLInputElement).type === 'file') return;
  switch (act) {
    case 'pg-add': pgLoad(); pgAdd(S.pages, el.dataset.k!); pgSave(); render(); break;
    case 'pg-del': pgLoad(); if (confirm('حذف شود؟')) { pgDel(S.pages, el.dataset.k!, Number(el.dataset.i)); pgSave(); render(); } break;
    case 'pg-download': pgLoad(); download(new Blob([pagesJson(S.pages)], { type: 'application/json' }), 'home.json'); toast('home.json دانلود شد؛ جایگزین src/data/home.json کنید.'); break;
    case 'pg-copy': pgLoad(); await copy(pagesJson(S.pages), 'JSON کپی شد'); break;
    case 'pg-reset': if (confirm('همهٔ تغییرات این صفحه پاک و به نسخهٔ سایت برگردانده شود؟')) { try { localStorage.removeItem(PG_KEY); } catch { /* ignore */ } S.pages = null; render(); } break;
    case 'tab': S.tab = v as Tab; save(); render(); window.scrollTo({ top: 0 }); break;
    case 'ctype': S.ctype = v as any; save(); render(); break;
    case 'to-copy': S.tab = 'copy'; save(); render(); break;
    case 'batch': {
      const cb = el as HTMLInputElement;
      S.batch = cb.checked ? [...new Set([...S.batch, cb.value])] : S.batch.filter((x) => x !== cb.value);
      break;
    }
    case 'copy-job': { const job = buildJob(S.ctype, S.inputs[S.ctype], S.batch, S.batchTrades); await copy(JSON.stringify(job, null, 2), 'کار کپی شد'); break; }
    case 'send-job': {
      const inp = S.inputs[S.ctype];
      if (!inp.topic && S.ctype === 'article') { toast('موضوع مقاله را بنویسید.', 'err'); break; }
      if (!inp.style) { toast('سبک را انتخاب کنید.', 'err'); break; }
      if (S.ctype === 'guide' && ((!inp.trade && !S.batchTrades.length) || !inp.service)) { toast('رسته و مجوز را انتخاب کنید.', 'err'); break; }
      const job = buildJob(S.ctype, S.ctype === 'guide' && S.batchTrades.length === 1 ? { ...inp, trade: S.batchTrades[0] } : inp, S.batch, S.batchTrades);
      try {
        const r = await sendJob(job);
        if (r === 'sent') toast('کار برای Agent ارسال شد. چند دقیقه بعد پیش‌نویس آماده می‌شود.');
        else { await copy(JSON.stringify(job, null, 2), ''); toast('ارسال تنظیم نشده؛ JSON کار کپی شد.', 'err'); }
      } catch { toast('ارسال نشد (اینترنت یا فیلتر). «کپی کار» یا Copy-for-AI را بزنید.', 'err'); }
      break;
    }
    case 'make-prompt': {
      const inp = S.inputs[S.ctype];
      if (S.ctype === 'article' && !inp.topic) { toast('موضوع مقاله را بنویسید.', 'err'); break; }
      if (S.ctype === 'article' && (!inp.style || !inp.service)) { toast('سبک و خدمت را انتخاب کنید.', 'err'); break; }
      if (S.ctype === 'area-page' && !inp.region) { toast('منطقه را انتخاب کنید.', 'err'); break; }
      if (S.ctype === 'guide' && (!inp.trade || !inp.service)) { toast('رسته و مجوز را انتخاب کنید.', 'err'); break; }
      S.prompt = S.mode === 'staged' ? 'staged' : buildPrompt(S.ctype, inp, S.mode === 'compact').text;
      save();
      const box = $('#st-prompt'); if (box) box.innerHTML = promptHtml();
      const ev = collectEvidence(inp).length;
      if (S.ctype === 'area-page' && localFactCount(inp) < 2) { toast(`فقط ${toFa(localFactCount(inp))} حقیقت محلی دارید؛ دست‌کم ۲ مورد (در «اضافه‌ها ← حقایق محلی») بنویسید وگرنه صفحه شبیه شهرهای دیگر می‌شود.`, 'err'); box?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
      if (S.ctype === 'guide') { const gf = guideFactCount(inp); if (gf.trade < 2 || gf.local < 1) { toast(`داده کم است (${toFa(gf.trade)} حقیقت رسته${inp.region ? `، ${toFa(gf.local)} حقیقت محلی` : ''}). نکته‌های اجباری یا منبع بنویسید، وگرنه راهنما شبیه بقیه و کم‌ارزش می‌شود.`, 'err'); box?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; } }
      toast(ev ? `پرامپت ساخته شد (${toFa(ev)} شاهد از دانش سایت)` : 'پرامپت ساخته شد؛ شاهدی از دانش سایت پیدا نشد، پس متن را خودتان دقیق بررسی کنید.');
      box?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    }
    case 'copy-prompt': await copy(S.prompt, 'پرامپت کپی شد؛ حالا در چت AI بچسبانید'); break;
    case 'copy-text': { const ps = buildStaged(S.ctype, S.inputs[S.ctype], S.stage.r1, S.stage.r2); await copy(ps[Number(el.dataset.i)], 'کپی شد'); break; }
    case 'load-reply': {
      const msg = $('#st-reply-msg')!;
      try {
        if (!S.reply.trim()) throw new Error('پاسخ را بچسبانید.');
        const inp = S.inputs[S.ctype];
        S.pkg = pkgFromReply(S.ctype, S.reply, inp);
        S.pkg.isNew = S.ctype === 'article' || S.ctype === 'guide' ? true : !kit.areas.some((a: any) => a.slug === S.pkg!.slug);
        coverObj = '';
        msg.textContent = ''; save(); renderBench();
        toast('بسته ساخته شد؛ پایین صفحه بررسی و ویرایش کنید.');
        $('#st-bench')?.scrollIntoView({ behavior: 'smooth' });
      } catch (err) { msg.textContent = (err as Error).message; msg.className = 'st-msg err'; }
      break;
    }
    case 'new': {
      const t = v as PkgType;
      coverObj = '';
      S.pkg = newPkg(t);
      if (t === 'area-page') { S.pkg.slug = kit.regions[0]?.slug ?? ''; S.pkg.isNew = false; }
      save(); renderBench();
      $('#st-bench')?.scrollIntoView({ behavior: 'smooth' });
      break;
    }
    case 'import': {
      const msg = $('#st-import-msg')!;
      try {
        const text = ($('#st-import') as HTMLTextAreaElement).value;
        if (!text.trim()) throw new Error('متن را بچسبانید.');
        const p = await loadPkgFromText(text, 'article');
        if (!p.slug) p.slug = suggestSlug('article', { service: p.fm.service, region: p.fm.region });
        // متن خام (مثلاً از Word): اگر با «# عنوان» شروع شده، همان را عنوان کن و از متن بردار
        const h1 = !p.fm.title ? p.body.match(/^\s*# (.+)\n?/) : null;
        if (h1) { p.fm.title = h1[1].trim(); p.body = p.body.replace(h1[0], '').trim(); }
        S.pkg = p; coverObj = ''; save(); renderBench(); msg.textContent = '';
        toast(counts(validate(p)).errors ? 'متن وارد شد؛ موردهای قرمز را کامل کنید.' : 'متن وارد شد.');
        $('#st-bench')?.scrollIntoView({ behavior: 'smooth' });
      } catch (err) { msg.textContent = (err as Error).message; msg.className = 'st-msg err'; }
      break;
    }
    case 'edit-region': {
      const r = kit.regions.find((x: any) => x.slug === v);
      S.pkg = { type: 'region-entry', slug: r.slug, isNew: false, fm: structuredClone(r), body: '' };
      save(); renderBench(); $('#st-bench')?.scrollIntoView({ behavior: 'smooth' });
      break;
    }
    case 'area-for': S.ctype = 'area-page'; S.inputs['area-page'].region = v; S.tab = 'copy'; save(); render(); toast('منطقه انتخاب شد؛ حقایق محلی را بنویسید.'); break;
    case 'batch-area': S.ctype = 'area-page'; S.tab = 'agent'; save(); render(); break;
    case 'suggest-slug': {
      const p = S.pkg!; p.slug = suggestSlug(p.type, { service: p.fm.service, region: p.fm.region, trade: p.fm.trade });
      renderBench(); break;
    }
    case 'batch-trade': {
      const cb = el as HTMLInputElement;
      S.batchTrades = cb.checked ? [...new Set([...S.batchTrades, cb.value])] : S.batchTrades.filter((x) => x !== cb.value);
      const n = $('#st-njobs'); if (n) n.textContent = `${toFa(Math.max(1, S.batchTrades.length) * Math.max(1, S.batch.length))} کار ساخته می‌شود.`;
      break;
    }
    case 'edit-existing': {
      const t = el.dataset.t as PkgType;
      const msg = $('#st-ex-msg')!;
      try {
        const c = await loadContent();
        const text = c[t === 'article' ? 'articles' : t === 'guide' ? 'guides' : 'areas']?.[v];
        if (!text) throw new Error(c.public ? 'متن پیش‌نویس‌ها برای امنیت روی سایت منتشرشده نیست. برای ویرایش پیش‌نویس، Studio را روی کامپیوتر خودتان با «npm run dev» باز کنید.' : 'متن این مطلب پیدا نشد؛ یک بار «npm run kit» بزنید (فقط فایل‌های .md).');
        S.pkg = loadExisting(t, v, text); coverObj = ''; msg.textContent = '';
        save(); renderBench(); toast('مطلب باز شد؛ پایین صفحه ویرایش کنید.');
        $('#st-bench')?.scrollIntoView({ behavior: 'smooth' });
      } catch (err) { msg.textContent = (err as Error).message; msg.className = 'st-msg err'; }
      break;
    }
    case 'publish': if (confirm('با برداشتن پیش‌نویس، مطلب بعد از آپلود روی سایت دیده می‌شود. متن را کامل خوانده‌اید؟')) { S.pkg!.fm.draft = false; save(); renderBench(); } break;
    case 'unpublish': S.pkg!.fm.draft = true; save(); renderBench(); break;
    case 'copy-script': await copy(APPS_SCRIPT, 'کد کپی شد؛ در script.google.com بچسبانید'); break;
    case 'conn-save': connSave(); break;
    case 'conn-clear': try { localStorage.removeItem('studio.briefForm'); localStorage.removeItem('studio.briefCsv'); } catch { /* ignore */ } render(); toast('اتصال ذخیره‌شده پاک شد'); break;
    case 'conn-test': {
      try { const r = await sendJob({ id: `ping-${Date.now()}`, type: 'ping', contentType: 'ping', title: 'test' }); toast(r === 'sent' ? 'کار آزمایشی فرستاده شد؛ در شیت پاسخ‌ها باید یک ردیف تازه ببینید (Agent آن را رد می‌کند).' : 'ابتدا اتصال را ذخیره کنید.', r === 'sent' ? 'ok' : 'err'); } catch { toast('ارسال نشد (اینترنت یا فیلتر).', 'err'); }
      break;
    }
    case 'ins': insertAtCursor(SNIPS[Number(el.dataset.i)].replace(/\\n/g, '\n')); break;
    case 'md': mdInsert(v); break;
    case 'rep-add': { const p = S.pkg!; (p.fm[el.dataset.list!] ??= []).push({}); save(); renderBench(); break; }
    case 'rep-del': { const p = S.pkg!; p.fm[el.dataset.list!].splice(Number(el.dataset.i), 1); save(); renderBench(); break; }
    case 'cover-del': { const p = S.pkg!; p.cover = undefined; if (p.fm.cover?.src) p.fm.cover = undefined; coverObj = ''; save(); renderBench(); break; }
    case 'cover-fetch': {
      const p = S.pkg!; toast('در حال دانلود…');
      const b = p.cover?.url ? await fetchImage(p.cover.url) : null;
      if (!b) { toast('مرورگر اجازه دانلود از این لینک را نداد؛ تصویر را ذخیره و «انتخاب تصویر» را بزنید.', 'err'); break; }
      try { p.cover = { blob: await toCoverWebp(b) }; coverObj = URL.createObjectURL(p.cover.blob!); save(); renderBench(); } catch (err) { toast((err as Error).message, 'err'); }
      break;
    }
    case 'preview': openPreview(); break;
    case 'zip': doZip(); break;
    case 'folder': doFolder(); break;
    case 'copy-file': await copy(fileText(S.pkg!), 'متن فایل کپی شد'); break;
    case 'repair': await copy(repairPrompt(S.pkg!, issues), 'پرامپت اصلاح کپی شد؛ در همان چت بچسبانید و پاسخ را دوباره وارد کنید'); break;
    case 'discard': if (confirm('این پیش‌نویس حذف شود؟')) { S.pkg = null; coverObj = ''; save(); renderBench(); } break;
    case 'close-preview': $('#st-preview')!.hidden = true; document.body.classList.remove('st-lock'); break;
    case 'pv-mobile': $('#st-pv-frame')!.className = 'st-frame mobile'; break;
    case 'pv-desktop': $('#st-pv-frame')!.className = 'st-frame'; break;
  }
}

async function onChange(e: Event) {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  const act = el.dataset.act;
  if (act === 'mode') { S.mode = el.value as any; S.prompt = ''; save(); const b = $('#st-prompt'); if (b) b.innerHTML = ''; }
  else if (act === 'md-link') {
    if (!el.value) return;
    const [p, l] = el.value.split('|'); insertAtCursor(`[${l}](${p})`); (el as HTMLSelectElement).value = '';
  } else if (act === 'cover-file') {
    const f = (el as HTMLInputElement).files?.[0]; if (!f || !S.pkg) return;
    try { const blob = await toCoverWebp(f); S.pkg.cover = { blob }; coverObj = URL.createObjectURL(blob); save(); renderBench(); toast('تصویر آماده شد'); }
    catch (err) { toast((err as Error).message, 'err'); }
  } else if (el.dataset.s === 'slug' && S.pkg?.type === 'area-page') { S.pkg.slug = el.value; save(); revalidate(); }
}

// ───────── محتوای موجود، اتصال، راهنما ─────────
let contentCache: any = null;
async function loadContent() {
  if (contentCache) return contentCache;
  const res = await fetch('/studio/content.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('content.json پیدا نشد؛ یک بار «npm run kit» را اجرا کنید.');
  return (contentCache = await res.json());
}

function connSave() {
  const msg = $('#st-conn-msg')!;
  const fail = (t: string) => { msg.textContent = t; msg.className = 'st-msg err'; };
  const raw = ($('#st-conn-in') as HTMLTextAreaElement).value;
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b < a) return fail('JSON پیدا نشد؛ خط کامل Execution log را بچسبانید.');
  let o: any;
  try { o = JSON.parse(raw.slice(a, b + 1)); } catch { return fail('JSON ناقص است؛ از « { » تا « } » کامل کپی کنید.'); }
  if (!/^https:\/\/docs\.google\.com\/forms\/.+\/formResponse$/.test(o.action ?? '')) return fail('آدرس action درست نیست؛ باید به /formResponse ختم شود.');
  for (const k of ['key', 'type', 'title', 'job']) if (!/^entry\.\d+$/.test(o.fields?.[k] ?? '')) return fail(`شناسهٔ فیلد «${k}» پیدا نشد؛ اسکریپت را دوباره اجرا کنید.`);
  try {
    localStorage.setItem('studio.briefForm', JSON.stringify({ action: o.action, key: o.key ?? '', fields: o.fields }));
    if (o.csv) localStorage.setItem('studio.briefCsv', o.csv);
  } catch { return fail('ذخیره در مرورگر ممکن نشد (حالت خصوصی؟).'); }
  S.ui.conn = true; render(); toast('اتصال ذخیره شد. «ارسال کار آزمایشی» را بزنید.');
}

const SNIPS = [
  '\\n\\n## عنوان بخش\\n\\nمتن بخش…\\n\\n',
  '\\n\\n### زیربخش\\n\\nمتن…\\n\\n',
  '[متن توصیفی](/services/business-license/)',
  '[عنوان منبع](https://example.com)',
  '\\n\\n1. مرحلهٔ اول\\n2. مرحلهٔ دوم\\n\\n'
];

function helpHtml(): string {
  const types = kit.components?.callouts?.types ?? {};
  const L = kit.components?.callouts?.limits ?? {};
  const row = (code: string, what: string, btn = '') => `<tr><td><code dir="ltr">${esc(code)}</code></td><td>${what}</td><td>${btn}</td></tr>`;
  return `<details class="st-help-d" data-ui="help" ${S.ui.help ? 'open' : ''}><summary>راهنمای نوشتن: سینتکس‌ها، اضافه و کم کردن</summary>
  <p class="st-help">متن با «Markdown» نوشته می‌شود: نوشتهٔ ساده با چند نشانه. هر بلوک را با <b>یک خط خالی</b> از بلوک بعدی جدا کنید.</p>
  <table class="st-ref"><thead><tr><th>بنویسید</th><th>نتیجه</th><th></th></tr></thead><tbody>
  ${row('## عنوان بخش', 'تیتر بخش (در فهرست مطالب می‌آید). عنوان اصلی را جدا در بالا بنویسید؛ «#» تکی ممنوع است.', `<button type="button" class="btn btn-ghost" data-act="ins" data-i="0">+ بخش</button>`)}
  ${row('### زیربخش', 'تیتر کوچک‌تر زیر یک بخش.', `<button type="button" class="btn btn-ghost" data-act="ins" data-i="1">+ زیربخش</button>`)}
  ${row('**متن**', 'پررنگ؛ برای دو سه عبارت کلیدی، نه کل جمله.', `<button type="button" class="btn btn-ghost" data-act="md" data-v="bold">B</button>`)}
  ${row('- مورد', 'لیست نقطه‌ای؛ هر مورد یک خط.', `<button type="button" class="btn btn-ghost" data-act="md" data-v="ul">لیست</button>`)}
  ${row('1. مرحله', 'لیست شماره‌دار برای مراحل پشت‌سرهم.', `<button type="button" class="btn btn-ghost" data-act="ins" data-i="4">+ مراحل</button>`)}
  ${row('[متن](/مسیر/)', 'پیوند به صفحهٔ خود سایت؛ مسیر باید وجود داشته باشد (از منوی «+ پیوند به صفحه سایت» انتخاب کنید). متن پیوند موضوع مقصد را بگوید، نه «اینجا».', `<button type="button" class="btn btn-ghost" data-act="ins" data-i="2">+ نمونه</button>`)}
  ${row('[عنوان](https://…)', 'پیوند به بیرون؛ فقط به منبع رسمی.', `<button type="button" class="btn btn-ghost" data-act="ins" data-i="3">+ نمونه</button>`)}
  </tbody></table>
  <h4>کادرها (نکته، هشدار، بدانید)</h4>
  <pre dir="ltr">&gt; [!tip] عنوان کوتاه\n&gt; متن کادر در یک یا دو جمله</pre>
  <p class="st-help">نوع‌ها: ${Object.entries(types).map(([k, v]: any) => `<b>${esc(k)}</b> (${esc(v.label)}): ${esc(v.use)}`).join(' — ')}. حداکثر ${toFa(L.maxPerPage ?? 4)} کادر، هر کدام تا ${toFa(L.maxWords ?? 70)} کلمه؛ متن با کادر شروع نشود.</p>
  <div class="st-tools">${Object.entries(types).map(([k, v]: any) => `<button type="button" data-act="md" data-v="c-${k}">+ ${esc(v.label)}</button>`).join('')}</div>
  <h4>اضافه و کم کردن</h4>
  <ul class="st-help-list">
    <li><b>افزودن بخش:</b> جای دلخواه کلیک کنید ← «+ بخش» ← عنوان و متن را بنویسید.</li>
    <li><b>حذف بخش یا کادر:</b> همهٔ خط‌های آن را انتخاب و پاک کنید (کادر = همهٔ خط‌هایی که با «&gt;» شروع می‌شوند). بعد از حذف، خط خالی اضافه را بردارید.</li>
    <li><b>پرسش متداول:</b> پایین متن «+ افزودن پرسش متداول»؛ حذف با ✕ کنار هر مورد. ۳ تا ۸ مورد خوب است.</li>
    <li><b>منبع:</b> همان‌جا «+ افزودن منبع»؛ لینک اختیاری است.</li>
    <li><b>تصویر:</b> در کادر «تصویر شاخص»؛ توضیح (alt) را حتماً بنویسید. حذف: «حذف تصویر».</li>
    <li><b>پیش‌نویس:</b> تا بازبینی کامل نشده روشن بماند؛ برای انتشار دکمهٔ «انتشار» بالای میزکار.</li>
    <li><b>علامت [نیاز به بررسی]:</b> جایی است که درستی مطلب تأیید نشده؛ تا برداشته نشود خروجی گرفته نمی‌شود.</li>
  </ul></details>`;
}

// ───────── ویرایشگر Markdown ─────────
function bodyEl() { return $('.st-body') as HTMLTextAreaElement | null; }
function insertAtCursor(text: string) {
  const ta = bodyEl(); if (!ta || !S.pkg) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + text.length; ta.focus();
  S.pkg.body = ta.value; save(); scheduleValidate();
}
function mdInsert(id: string) {
  const ta = bodyEl(); if (!ta || !S.pkg) return;
  const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
  const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
  const prefix: Record<string, string> = { h2: '## ', h3: '### ', ul: '- ', ol: '1. ', quote: '> ' };
  if (id === 'c-key') { insertAtCursor(`\n\n> [!key] خلاصهٔ سریع\n> - نکتهٔ کلیدی ۱\n> - نکتهٔ کلیدی ۲\n> - نکتهٔ کلیدی ۳\n\n`); return; }
  if (id === 'mermaid') { insertAtCursor('\n\n```mermaid\nflowchart TD\n  A[شروع] --> B[پایان]\n```\n\n'); return; }
  if (id.startsWith('c-')) { const t = id.slice(2); const lbl: Record<string, string> = { tip: 'نکته', warning: 'هشدار', info: 'بدانید' }; insertAtCursor(`\n\n> [!${t}] ${lbl[t]}\n> ${sel || 'متن کوتاه کادر'}\n\n`); return; }
  if (id === 'bold') { insertAtCursor(`**${sel || 'متن'}**`); return; }
  ta.value = ta.value.slice(0, lineStart) + prefix[id] + ta.value.slice(lineStart);
  ta.selectionStart = ta.selectionEnd = e + prefix[id].length; ta.focus();
  S.pkg.body = ta.value; save(); scheduleValidate();
}

// ───────── پیش‌نمایش و خروجی ─────────
function openPreview() {
  const pkg = S.pkg!;
  const modal = $('#st-preview')!;
  const src = coverObj || pkg.cover?.url || '';
  $('#st-pv-serp')!.innerHTML = pkg.type === 'region-entry' ? '' : serp(pkg);
  ($('#st-pv-frame') as HTMLIFrameElement).srcdoc = previewHtml(pkg, src);
  modal.hidden = false; document.body.classList.add('st-lock');
}

const README = (files: string[]) => `راهنمای انتشار
================
۱. این zip را باز کنید.
۲. وارد ریپوی سایت در GitHub شوید ← Add file ← Upload files.
۳. پوشه src (و در صورت وجود بقیه پوشه‌ها) را از zip بکشید و رها کنید؛ مسیرها باید همین‌ها باشد:
${files.map((f) => '   - ' + f).join('\n')}
۴. Commit changes. بعد از ساخته‌شدن سایت (تب Actions)، نتیجه روی سایت می‌آید.
${S.pkg?.fm.draft ? `
توجه: این مورد «پیش‌نویس» است و روی سایت دیده نمی‌شود تا منتشر شود. دو راه انتشار:
  الف) در GitHub فایل .md را باز کنید ← آیکن مداد ← خط «draft: true» را به «draft: false» تغییر دهید ← Commit.
  ب) در Studio متن را از تب «دستی» دوباره وارد کنید، در «تنظیمات بیشتر» تیک پیش‌نویس را بردارید و دوباره zip بگیرید.
پیش از انتشار، متن را یک بار کامل بخوانید و درستی عددها و شرط‌ها را با منبع رسمی تطبیق دهید.
` : ''}
اگر روی کامپیوتر خودتان کار می‌کنید: بعد از افزودن فایل‌ها یک بار «npm run kit» بزنید تا Studio مقاله‌های تازه را برای لینک‌دهی بشناسد.
`;

async function doZip() {
  const pkg = S.pkg!; revalidate();
  if (counts(issues).errors) { toast('ابتدا خطاها را رفع کنید.', 'err'); return; }
  const enc = new TextEncoder();
  const files = outputFiles(pkg);
  const items = await Promise.all(files.map(async (f) => ({ path: f.path, data: f.text !== undefined ? enc.encode(f.text) : new Uint8Array(await f.blob!.arrayBuffer()) })));
  items.push({ path: 'راهنمای-انتشار.txt', data: enc.encode(README(files.map((f) => f.path))) });
  download(makeZip(items), `studio-${pkg.slug || 'item'}-${today()}.zip`);
  showHowto(files.map((f) => f.path));
}
function showHowto(list: string[]) {
  const h = $('#st-howto')!; h.hidden = false;
  h.innerHTML = `<h3>بعد از دانلود</h3><ol><li>zip را باز کنید.</li><li>در GitHub: ریپوی سایت ← <b>Add file ← Upload files</b>.</li><li>پوشه <code>src</code> را از zip بکشید و رها کنید و <b>Commit changes</b> بزنید.</li></ol><p class="st-help">مسیر فایل‌ها: ${list.map((p) => `<code>${esc(p)}</code>`).join('، ')}</p>`;
  h.scrollIntoView({ behavior: 'smooth' });
}
async function doFolder() {
  const pkg = S.pkg!; revalidate();
  if (counts(issues).errors) { toast('ابتدا خطاها را رفع کنید.', 'err'); return; }
  try {
    const dir: any = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    for (const f of outputFiles(pkg)) {
      const parts = f.path.split('/');
      let d = dir;
      for (const part of parts.slice(0, -1)) d = await d.getDirectoryHandle(part, { create: true });
      const fh = await d.getFileHandle(parts.at(-1)!, { create: true });
      const w = await fh.createWritable();
      await w.write(f.text !== undefined ? f.text : f.blob!);
      await w.close();
    }
    toast('فایل‌ها در پوشه نوشته شد؛ حالا commit و push کنید.');
  } catch (err) { if ((err as Error).name !== 'AbortError') toast('ذخیره در پوشه ممکن نشد: ' + (err as Error).message, 'err'); }
}

// ───────── شروع ─────────
async function main() {
  const root = app();
  try { await loadKit(); } catch (err) { root.innerHTML = `<div class="st-card st-err">${esc((err as Error).message)}</div>`; return; }
  await restore();
  $('#st-site')!.textContent = kit.site.name ?? '';
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('toggle', (e) => { const d = e.target as HTMLElement; if (d.dataset?.ui) S.ui[d.dataset.ui] = (d as HTMLDetailsElement).open; }, true);
  $('#st-preview')!.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-act]')) onClick(e); });
  render();
}
main();
