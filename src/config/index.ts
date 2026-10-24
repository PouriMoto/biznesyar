// تنظیمات سایت = site.config.json  ←  (روی آن) site.local.json (در گیت نیست)  ←  (روی آن) متغیرهای محیطی
// متغیرهای محیطی (در .env محلی یا Variables گیت‌هاب):
//   SITE_MODE=static|backend        حالت سایت (سوییچ اصلی)
//   PUBLIC_GFORM_ACTION=...         آدرس formResponse گوگل‌فرم
//   PUBLIC_GFORM_FIELDS={"name":"entry.1",...}   (JSON)
//   PUBLIC_LEADS_MIRROR=0|1         در حالت backend، لید به گوگل‌فرم هم برود؟
import raw from './site.config.json';

const locals = import.meta.glob('./site.local.json', { eager: true, import: 'default' }) as Record<string, any>;
const local = Object.values(locals)[0] ?? {};

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
function merge(a: any, b: any): any {
  if (!isObj(a) || !isObj(b)) return b === undefined ? a : b;
  const out: Record<string, any> = { ...a };
  for (const k of Object.keys(b)) out[k] = k in a ? merge(a[k], b[k]) : b[k];
  return out;
}

const env: Record<string, any> = { ...(typeof process !== 'undefined' ? process.env : {}), ...(import.meta.env as any) };
const cfg: any = merge(raw, local);

if (env.SITE_MODE === 'static' || env.SITE_MODE === 'backend') cfg.mode = env.SITE_MODE;
cfg.leads = cfg.leads ?? {};
cfg.leads.googleForm = cfg.leads.googleForm ?? { action: '', fields: {} };
if (env.PUBLIC_GFORM_ACTION) cfg.leads.googleForm.action = env.PUBLIC_GFORM_ACTION;
if (env.PUBLIC_GFORM_FIELDS) { try { cfg.leads.googleForm.fields = JSON.parse(env.PUBLIC_GFORM_FIELDS); } catch { /* JSON نامعتبر نادیده */ } }
// ارسال همزمان به گوگل‌فرم در حالت backend: پیش‌فرض روشن
if (env.PUBLIC_LEADS_MIRROR === '0' || env.PUBLIC_LEADS_MIRROR === '1') cfg.leads.mirrorToGoogleForm = env.PUBLIC_LEADS_MIRROR === '1';
else if (cfg.leads.mirrorToGoogleForm === undefined) cfg.leads.mirrorToGoogleForm = true;

export const site = cfg as typeof raw & { mode: 'static' | 'backend'; leads: any };
