// لایه رویداد: همه تعامل‌ها از اینجا رد می‌شوند. بعداً می‌شود خروجی‌های بیشتری اضافه کرد.
type Payload = Record<string, unknown>;
const w = window as any;

const cfgEl = document.getElementById('bz-config');
const cfg = cfgEl ? JSON.parse(cfgEl.textContent || '{}') : {};

const sid = (() => {
  try {
    let s = sessionStorage.getItem('bz_sid');
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('bz_sid', s);
    }
    return s;
  } catch {
    return 'na';
  }
})();

export function track(name: string, payload: Payload = {}) {
  const ev = { name, sid, ts: Date.now(), path: location.pathname, ...payload };
  (w.bzEvents ||= []).push(ev);
  window.dispatchEvent(new CustomEvent('bz:event', { detail: ev }));
  if (cfg.analytics?.metrica && typeof w.ym === 'function') w.ym(cfg.analytics.metrica, 'reachGoal', name, payload);
  // page_view را خودِ gtag با config اولیه می‌فرستد؛ اینجا فقط بقیهٔ رویدادها (کلیک، فرم، تست‌ها...) را به GA4 می‌فرستیم تا دوبار شمارش نشود.
  if (cfg.analytics?.ga4 && name !== 'page_view' && typeof w.gtag === 'function') w.gtag('event', name, payload);
  if (cfg.analytics?.sink === 'pocketbase' && cfg.api?.events) {
    try {
      const body = new Blob([JSON.stringify({ name, sid, path: location.pathname, payload: JSON.stringify(payload) })], { type: 'application/json' });
      navigator.sendBeacon((cfg.api.base || '') + cfg.api.events, body);
    } catch { /* ignore */ }
  }
}

w.bzTrack = track;

track('page_view', { ref: document.referrer ? new URL(document.referrer).hostname : '', title: document.title });

document.addEventListener('click', (e) => {
  const el = (e.target as Element).closest<HTMLElement>('[data-track]');
  if (!el) return;
  track(el.dataset.track!, { label: el.dataset.label, href: el.getAttribute('href') });
}, { passive: true });

if (document.querySelector('[data-article]')) {
  const fired = new Set<number>();
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (max <= 0) return;
      const pct = (scrollY / max) * 100;
      [50, 90].forEach((m) => {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          track('article_read', { depth: m });
        }
      });
    });
  }, { passive: true });
}
