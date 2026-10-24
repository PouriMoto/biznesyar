// ارسال لید: حالت static ← گوگل‌فرم | حالت backend ← PocketBase
const cfg = JSON.parse(document.getElementById('bz-config')?.textContent || '{}');
export interface Lead { name: string; phone: string; service: string; region: string; message: string; page: string; source: string; utm: string }

const PENDING = 'bz_pending_leads';
const configured = (a?: string) => !!a && !/FORM_ID_HERE/.test(a);

async function postForm(lead: Lead): Promise<void> {
  const g = cfg.leads?.googleForm;
  if (!configured(g?.action)) { console.error('[bizyaar] آدرس گوگل‌فرم تنظیم نشده (site.local.json یا PUBLIC_GFORM_ACTION)'); throw new Error('not configured'); }
  const body = new URLSearchParams();
  (Object.keys(g.fields) as (keyof Lead)[]).forEach((k) => { if (g.fields[k] && lead[k] !== undefined) body.set(g.fields[k], String(lead[k])); });
  // no-cors: پاسخ قابل‌خواندن نیست، ولی خطای شبکه/فیلتر با throw مشخص می‌شود
  await fetch(g.action, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, keepalive: true });
}

async function postBackend(lead: Lead): Promise<void> {
  const res = await fetch((cfg.api?.base || '') + (cfg.api?.leads || '/api/collections/leads/records'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
  if (res.status === 429) throw new Error('rate');
  if (!res.ok) throw new Error('http ' + res.status);
}

// static ← فقط گوگل‌فرم | backend ← PocketBase و (اگر leads.mirrorToGoogleForm روشن و فرم تنظیم است) همزمان گوگل‌فرم.
// در حالت backend اگر یکی از دو مقصد موفق شد، لید از دست نرفته است.
async function post(lead: Lead): Promise<void> {
  if (cfg.mode === 'static') return postForm(lead);
  const mirror = cfg.leads?.mirror && configured(cfg.leads?.googleForm?.action);
  const [pb, gf] = await Promise.allSettled([postBackend(lead), mirror ? postForm(lead) : Promise.reject(new Error('mirror off'))]);
  if (pb.status === 'fulfilled') return;
  if ((pb.reason as Error).message === 'rate') throw pb.reason;
  if (gf.status === 'fulfilled') return;
  throw pb.reason;
}

export async function sendLead(lead: Lead): Promise<void> {
  try { await post(lead); }
  catch (e) {
    if ((e as Error).message === 'rate') throw e;
    try { const q = JSON.parse(localStorage.getItem(PENDING) || '[]'); q.push(lead); localStorage.setItem(PENDING, JSON.stringify(q.slice(-10))); } catch { /* ignore */ }
    throw e;
  }
}

// لید ناموفق (اینترنت ضعیف/فیلتر) در دفعه بعد که کاربر سایت را باز کرد دوباره ارسال می‌شود
export async function retryPending() {
  let q: Lead[] = [];
  try { q = JSON.parse(localStorage.getItem(PENDING) || '[]'); } catch { return; }
  if (!q.length) return;
  localStorage.removeItem(PENDING);
  for (const l of q) { try { await post(l); } catch { try { const n = JSON.parse(localStorage.getItem(PENDING) || '[]'); n.push(l); localStorage.setItem(PENDING, JSON.stringify(n)); } catch { /* ignore */ } } }
}
retryPending();
addEventListener('online', retryPending);
