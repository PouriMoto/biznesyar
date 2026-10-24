// فوتر: ۱۰ بار پشت‌سرهم زدن روی لوگو ← پنجرهٔ رمز ← ورود به Studio
import { tryLogin, isAuthed } from './studio/gate';
const el = document.querySelector<HTMLElement>('[data-secret-logo]');
if (el) {
  let n = 0, t = 0;
  el.addEventListener('click', async () => {
    const now = Date.now();
    n = now - t > 2500 ? 1 : n + 1; t = now;
    if (n < 10) return;
    n = 0;
    if (isAuthed()) { location.href = '/studio/'; return; }
    const pw = window.prompt('رمز:');
    if (pw && (await tryLogin(pw))) location.href = '/studio/';
  });
}
