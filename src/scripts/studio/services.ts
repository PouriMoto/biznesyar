// ویرایش خدمات: src/data/services.json (محتوای صفحهٔ هر خدمت) + فعال/غیرفعال‌کردن از src/config/site.config.json.
// مثل experiences.json این‌ها بخشی از content-kit نیستند؛ مستقیم از روی پوشهٔ پروژه خوانده و نوشته می‌شوند.
import { esc, toFa } from './core';

export interface Service { slug: string; title: string; short: string; icon: string; description: string; forWho?: string[]; steps?: any[]; documents?: any[]; documentsNote?: string; faq?: any[]; simple?: boolean; [k: string]: any }
interface SrvState {
  services: Service[] | null;
  config: any | null; // کل site.config.json (فقط services[].enabled را تغییر می‌دهیم)
  dirHandle: any;
  openIdx: number | null;
}
const SRV_KEY = 'studio.services';
export const SRV: SrvState = { services: null, config: null, dirHandle: null, openIdx: null };

function persist() {
  try { localStorage.setItem(SRV_KEY, JSON.stringify({ services: SRV.services, config: SRV.config })); } catch { /* ignore */ }
}
export function srvRestore() {
  try {
    const raw = localStorage.getItem(SRV_KEY);
    if (!raw) return;
    const j = JSON.parse(raw);
    if (Array.isArray(j.services)) SRV.services = j.services;
    if (j.config) SRV.config = j.config;
  } catch { /* ignore */ }
}

export async function srvOpenFolder(): Promise<string | null> {
  try {
    const dir: any = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    const src = await dir.getDirectoryHandle('src');
    const dataDir = await src.getDirectoryHandle('data');
    const srvFh = await dataDir.getFileHandle('services.json');
    const services = JSON.parse(await (await srvFh.getFile()).text());
    if (!Array.isArray(services)) return 'services.json باید یک آرایه باشد.';
    const cfgDir = await src.getDirectoryHandle('config');
    const cfgFh = await cfgDir.getFileHandle('site.config.json');
    const config = JSON.parse(await (await cfgFh.getFile()).text());
    SRV.services = services; SRV.config = config; SRV.dirHandle = dir;
    persist();
    return null;
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
    return 'باز نشد: ' + (err?.message ?? String(err));
  }
}
export async function srvSaveFolder(): Promise<string | null> {
  if (!SRV.dirHandle) return 'ابتدا «باز کردن پوشهٔ پروژه» را بزنید.';
  try {
    const src = await SRV.dirHandle.getDirectoryHandle('src');
    const dataDir = await src.getDirectoryHandle('data');
    const srvFh = await dataDir.getFileHandle('services.json', { create: true });
    let w = await srvFh.createWritable(); await w.write(JSON.stringify(SRV.services, null, 2) + '\n'); await w.close();
    const cfgDir = await src.getDirectoryHandle('config');
    const cfgFh = await cfgDir.getFileHandle('site.config.json', { create: true });
    w = await cfgFh.createWritable(); await w.write(JSON.stringify(SRV.config, null, 2) + '\n'); await w.close();
    return null;
  } catch (err: any) { return 'ذخیره نشد: ' + (err?.message ?? String(err)); }
}
export function srvServicesBlob(): Blob { return new Blob([JSON.stringify(SRV.services ?? [], null, 2) + '\n'], { type: 'application/json' }); }
export function srvConfigBlob(): Blob { return new Blob([JSON.stringify(SRV.config ?? {}, null, 2) + '\n'], { type: 'application/json' }); }

function cfgEntry(slug: string): { enabled: boolean } | null {
  const arr = SRV.config?.services;
  if (!Array.isArray(arr)) return null;
  return arr.find((s: any) => s.slug === slug) ?? null;
}
export function srvEnabled(slug: string): boolean { return !!cfgEntry(slug)?.enabled; }
export function srvToggleEnabled(slug: string) {
  if (!SRV.config) return;
  if (!Array.isArray(SRV.config.services)) SRV.config.services = [];
  let e = SRV.config.services.find((s: any) => s.slug === slug);
  if (!e) { e = { slug, enabled: false }; SRV.config.services.push(e); }
  e.enabled = !e.enabled;
  persist();
}
export function srvAdd() {
  if (!SRV.services) SRV.services = [];
  const slug = 'service-' + (SRV.services.length + 1);
  SRV.services.push({ slug, title: '', short: '', icon: 'file-text', description: '', forWho: [], steps: [], documents: [], documentsNote: '', faq: [], simple: true });
  if (SRV.config && Array.isArray(SRV.config.services)) SRV.config.services.push({ slug, enabled: false });
  SRV.openIdx = SRV.services.length - 1;
  persist();
}
export function srvDelete(i: number) {
  if (!SRV.services) return;
  const slug = SRV.services[i]?.slug;
  SRV.services.splice(i, 1);
  if (SRV.config && Array.isArray(SRV.config.services) && slug) SRV.config.services = SRV.config.services.filter((s: any) => s.slug !== slug);
  if (SRV.openIdx === i) SRV.openIdx = null;
  persist();
}
export function srvToggleOpen(i: number) { SRV.openIdx = SRV.openIdx === i ? null : i; }
export function srvSetField(i: number, key: string, raw: string, kind?: string) {
  if (!SRV.services?.[i]) return;
  let v: any = raw;
  if (kind === 'bool') v = raw === '1';
  else if (kind === 'lines') v = raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  else if (kind === 'json') { try { v = JSON.parse(raw); } catch { return; } }
  if (key === 'slug') {
    const oldSlug = SRV.services[i].slug;
    if (SRV.config && Array.isArray(SRV.config.services)) { const e = SRV.config.services.find((s: any) => s.slug === oldSlug); if (e) e.slug = v; }
  }
  (SRV.services[i] as any)[key] = v;
  persist();
}

// ───────── رندر ─────────
function field(i: number, k: string, label: string, v: any, kind: 'text' | 'longtext' | 'bool' | 'lines' | 'json' = 'text', rows = 2): string {
  if (kind === 'bool') return `<label class="st-check"><input type="checkbox" data-srv="${i}" data-k="${k}" data-kind="bool" ${v ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  if (kind === 'lines') return `<div class="st-field"><label class="st-label">${esc(label)}</label><textarea class="st-in" rows="${rows}" data-srv="${i}" data-k="${k}" data-kind="lines" placeholder="هر مورد در یک خط">${esc((v ?? []).join('\n'))}</textarea></div>`;
  if (kind === 'json') return `<div class="st-field"><label class="st-label">${esc(label)}</label><textarea class="st-in ltr-text" rows="${rows}" data-srv="${i}" data-k="${k}" data-kind="json">${esc(JSON.stringify(v ?? [], null, 2))}</textarea></div>`;
  if (kind === 'longtext') return `<div class="st-field"><label class="st-label">${esc(label)}</label><textarea class="st-in" rows="${rows}" data-srv="${i}" data-k="${k}">${esc(v ?? '')}</textarea></div>`;
  return `<div class="st-field"><label class="st-label">${esc(label)}</label><input class="st-in" data-srv="${i}" data-k="${k}" value="${esc(v ?? '')}"></div>`;
}
function srvFields(s: Service, i: number): string {
  return `<div style="margin-top:.8rem;display:grid;gap:.6rem">
  <div class="st-row">${field(i, 'slug', 'شناسه (انگلیسی، همان مسیر /services/…)', s.slug)}${field(i, 'icon', 'آیکون', s.icon)}</div>
  ${field(i, 'title', 'عنوان', s.title)}
  ${field(i, 'short', 'توضیح کوتاه (کارت خدمات)', s.short, 'longtext')}
  ${field(i, 'description', 'توضیح کامل (بالای صفحهٔ خدمت)', s.description, 'longtext', 3)}
  ${field(i, 'forWho', 'برای چه کسانی (هر مورد یک خط)', s.forWho, 'lines', 4)}
  ${field(i, 'simple', 'صفحهٔ ساده (بدون بخش «مراحل کار» و «مدارک»)', s.simple, 'bool')}
  ${s.simple ? '' : `
  ${field(i, 'steps', 'مراحل کار — JSON (هر مورد: {"title":"…","text":"…"})', s.steps, 'json', 6)}
  ${field(i, 'documents', 'مدارک لازم — JSON (هر مورد: {"title":"…","note":"…"})', s.documents, 'json', 6)}
  ${field(i, 'documentsNote', 'یادداشت زیر فهرست مدارک', s.documentsNote, 'longtext')}`}
  ${field(i, 'faq', 'پرسش‌های متداول این خدمت — JSON (هر مورد: {"q":"…","a":"…"})', s.faq, 'json', 6)}
</div>`;
}
function srvCard(s: Service, i: number): string {
  const open = SRV.openIdx === i;
  const enabled = srvEnabled(s.slug);
  return `<div class="st-city" style="display:block">
  <div style="display:flex;justify-content:space-between;gap:.6rem;align-items:center;flex-wrap:wrap">
    <div><b>${esc(s.title || '(بی‌عنوان)')}</b><small>${enabled ? 'فعال روی سایت' : 'غیرفعال'} · <span dir="ltr">/services/${esc(s.slug)}/</span></small></div>
    <div><label class="st-check" style="margin-inline-end:.6rem"><input type="checkbox" data-act="srv-toggle-enabled" data-v="${esc(s.slug)}" ${enabled ? 'checked' : ''}><span>فعال</span></label><button class="btn btn-ghost" data-act="srv-toggle" data-i="${i}">${open ? 'بستن' : 'ویرایش'}</button><button class="st-x" data-act="srv-del" data-i="${i}" title="حذف">✕</button></div>
  </div>
  ${open ? srvFields(s, i) : ''}
</div>`;
}
export function srvPanel(): string {
  if (!SRV.services || !SRV.config) {
    return `<div class="st-intro"><h2>خدمات</h2><p>محتوای هر خدمت (عنوان، مراحل، مدارک، پرسش‌ها) در <code dir="ltr">src/data/services.json</code> و فعال/غیرفعال‌بودنش در <code dir="ltr">site.config.json</code> است. برای ویرایش، یک‌بار پوشهٔ پروژه را باز کنید.</p></div>
<div class="st-actions"><button class="btn btn-primary" data-act="srv-open">باز کردن پوشهٔ پروژه</button></div>
<div id="srv-msg" class="st-msg"></div>`;
  }
  return `<div class="st-intro"><h2>خدمات</h2><p>${toFa(SRV.services.length)} خدمت. کلید «فعال» همان چیزی است که روی سایت نشان داده می‌شود یا نه؛ خدمتی که غیرفعال است صفحه‌اش هم روی سایت در دسترس نیست.</p></div>
<div class="st-actions"><button class="btn btn-ghost" data-act="srv-add">+ خدمت جدید</button></div>
<div class="st-cities">${SRV.services.map((s, i) => srvCard(s, i)).join('')}</div>
<div class="st-actions"><button class="btn btn-primary" data-act="srv-save">ذخیره در همان پوشه</button><button class="btn btn-ghost" data-act="srv-download">دانلود services.json</button><button class="btn btn-ghost" data-act="srv-download-config">دانلود site.config.json</button></div>
<div id="srv-msg" class="st-msg"></div>`;
}
