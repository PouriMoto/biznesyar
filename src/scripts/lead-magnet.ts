import { track } from './track';
import { sendLead } from './lead-send';
const cfg = JSON.parse(document.getElementById('bz-config')?.textContent || '{}');
const norm = (s: string) => s.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/\D/g, '');
document.querySelectorAll<HTMLElement>('section.magnet').forEach((box) => {
  const form = box.querySelector<HTMLFormElement>('.magnet-form')!;
  const status = box.querySelector<HTMLElement>('.lead-status')!;
  const done = box.querySelector<HTMLElement>('.magnet-done')!;
  track('magnet_view', { id: box.dataset.magnet });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); status.hidden = true;
    const phone = norm(String(new FormData(form).get('phone') || ''));
    if (!/^09\d{9}$/.test(phone)) { status.hidden = false; status.textContent = 'شماره موبایل را به شکل 09123456789 وارد کنید.'; return; }
    const btn = form.querySelector('button')!; btn.disabled = true;
    try {
      await sendLead({ name: 'دانلود PDF', phone, trade: '', service: box.dataset.service || '', region: '', message: 'دانلود: ' + box.querySelector('h3')!.textContent, page: location.pathname, source: 'magnet:' + box.dataset.magnet, utm: '{}' });
      track('magnet_submit', { id: box.dataset.magnet });
      form.hidden = true; done.hidden = false;
    } catch { status.hidden = false; status.textContent = 'ارسال انجام نشد. دوباره تلاش کنید.'; btn.disabled = false; }
  });
  done.querySelector('a')!.addEventListener('click', () => track('magnet_download', { id: box.dataset.magnet }));
});
