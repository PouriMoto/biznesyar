import { track } from './track';
import { sendLead } from './lead-send';

const cfgEl = document.getElementById('bz-config');
const cfg = cfgEl ? JSON.parse(cfgEl.textContent || '{}') : {};

const fa = '۰۱۲۳۴۵۶۷۸۹';
const ar = '٠١٢٣٤٥٦٧٨٩';
const normalizeDigits = (s: string) => s.replace(/[۰-۹]/g, (c) => String(fa.indexOf(c))).replace(/[٠-٩]/g, (c) => String(ar.indexOf(c)));

function utm() {
  const p = new URLSearchParams(location.search);
  const o: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach((k) => { const v = p.get(k); if (v) o[k] = v; });
  return o;
}

document.querySelectorAll<HTMLFormElement>('form[data-lead-form]').forEach((form) => {
  const status = form.querySelector<HTMLElement>('.lead-status')!;
  const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const success = form.parentElement!.querySelector<HTMLElement>('.lead-success');
  const formName = form.dataset.form || 'lead';
  let started = false;

  // اگر لینک از دایرکتوری شهرها یا جای دیگری با ?trade=... آمده و فیلد رسته خالی است، همان را پیش‌پر می‌کند.
  const tradeInput = form.querySelector<HTMLInputElement>('[data-lead-trade]');
  if (tradeInput && !tradeInput.value) {
    const qTrade = new URLSearchParams(location.search).get('trade');
    if (qTrade) tradeInput.value = qTrade;
  }

  const say = (msg: string, kind: 'error' | 'info' = 'error') => {
    status.hidden = false;
    status.textContent = msg;
    status.dataset.kind = kind;
  };

  form.addEventListener('focusin', () => {
    if (started) return;
    started = true;
    track('form_start', { form: formName });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.hidden = true;
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const phone = normalizeDigits(String(fd.get('phone') || '')).replace(/\s|-/g, '');
    const trade = String(fd.get('trade') || '').trim();

    if (fd.get('website')) { // honeypot
      form.hidden = true; success && (success.hidden = false); return;
    }
    if (name.length < 2) return say('نام را وارد کنید.');
    if (!/^09\d{9}$/.test(phone)) return say('شماره موبایل را به شکل 09123456789 وارد کنید.');
    if (trade.length < 2) return say('رستهٔ شغلی یا نوع کسب‌وکارتان را بنویسید.');

    const body = {
      name,
      phone,
      trade,
      service: String(fd.get('service') || ''),
      region: String(fd.get('region') || ''),
      message: String(fd.get('message') || '').slice(0, 1000),
      page: location.pathname,
      source: new URLSearchParams(location.search).get('utm_source') || (document.referrer ? new URL(document.referrer).hostname : 'direct'),
      utm: JSON.stringify(utm())
    };

    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'در حال ارسال…';
    try {
      await sendLead(body);
      track('form_submit', { form: formName, service: body.service, region: body.region, trade: body.trade });
      form.hidden = true;
      const cont = success?.querySelector<HTMLAnchorElement>('a.continue'); if (cont) cont.href = '/login/?phone=' + phone + '&go=1';
      if (success) success.hidden = false;
      success?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (err) {
      track('form_error', { form: formName, error: String((err as Error).message) });
      say((err as Error).message === 'rate'
        ? 'درخواست‌های زیادی ارسال شده. چند دقیقه بعد دوباره تلاش کنید.'
        : 'ارسال انجام نشد. دوباره تلاش کنید یا از راه‌های ارتباطی پایین صفحه پیام بدهید.');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
});
