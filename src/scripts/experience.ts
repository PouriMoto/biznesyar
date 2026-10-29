// موتور تجربه‌های تعاملی (چک‌لیست/آزمون درست-غلط). داده از src/data/experiences.json می‌آید.
// اگر experience.private=true باشد (مثل چک‌لیست آمادگی یا ابزارهای اعتبارسنجی ایده)، دکمه‌های اشتراک‌گذاری عمومی اصلاً در Astro رندر نمی‌شوند؛
// نتیجه فقط در localStorage کاربر و (در صورت ثبت درخواست مشاوره) در پیام فرم لید برای ما دیده می‌شود.
import { track } from './track';

interface Tier { min: number; max: number; title: string; text: string; shareText: string }

const toFaDigits = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

document.querySelectorAll<HTMLElement>('[data-experience]').forEach((root) => {
  const kind = root.dataset.kind as 'checklist' | 'quiz';
  const slug = root.dataset.slug || '';
  const service = root.dataset.service || '';
  const storageKey = `bz_exp_${slug}`;

  let tiers: Tier[] = [];
  try { tiers = JSON.parse(root.querySelector('[data-exp-tiers]')?.textContent || '[]'); } catch { tiers = []; }
  const findTier = (value: number) => tiers.find((t) => value >= t.min && value <= t.max) ?? tiers[tiers.length - 1];

  const resultBox = root.querySelector<HTMLElement>('[data-exp-result]');
  const resultTitle = resultBox?.querySelector<HTMLElement>('[data-exp-result-title]');
  const resultText = resultBox?.querySelector<HTMLElement>('[data-exp-result-text]');
  const waLink = root.querySelector<HTMLAnchorElement>('[data-exp-share="whatsapp"]');
  const nativeBtn = root.querySelector<HTMLButtonElement>('[data-exp-share="native"]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-exp-share="copy"]');
  const copiedNote = root.querySelector<HTMLElement>('[data-exp-share-copied]');
  if (nativeBtn && (navigator as any).share) nativeBtn.hidden = false;

  let started = false;
  let completed = false;
  let lastShareText = '';
  const shareUrl = () => location.origin + location.pathname;
  const shareFull = () => (lastShareText ? `${lastShareText} ${shareUrl()}` : shareUrl());

  function markStart() {
    if (started) return;
    started = true;
    track('experience_start', { slug, kind });
  }

  function fillTemplate(s: string, vars: Record<string, number | string>) {
    return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  }

  function prefillLead() {
    const form = document.querySelector<HTMLFormElement>(`form[data-lead-form][data-form="experience_${slug}"]`);
    if (!form) return;
    const msg = form.querySelector<HTMLTextAreaElement>('[name=message]');
    if (msg && !msg.value) msg.value = lastShareText;
    const svcSelect = form.querySelector<HTMLSelectElement>('[name=service]');
    if (svcSelect && service) svcSelect.value = service;
  }

  function showResult(tier: Tier | undefined, value: number, vars: Record<string, number | string>) {
    if (!tier || !resultBox || !resultTitle || !resultText) return;
    resultTitle.textContent = tier.title;
    resultText.textContent = tier.text;
    lastShareText = fillTemplate(tier.shareText, vars);
    if (waLink) waLink.href = `https://wa.me/?text=${encodeURIComponent(shareFull())}`;
    resultBox.hidden = false;
    prefillLead();
    if (!completed) {
      completed = true;
      resultBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      track('experience_complete', { slug, kind, value });
    }
  }

  if (kind === 'checklist') {
    const boxes = Array.from(root.querySelectorAll<HTMLInputElement>('[data-exp-item]'));
    const bar = root.querySelector<SVGCircleElement>('[data-exp-progress-bar]');
    const label = root.querySelector<HTMLElement>('[data-exp-progress-label]');
    const progressWrap = root.querySelector<HTMLElement>('[data-exp-progress]');
    const percentEl = root.querySelector<HTMLElement>('[data-exp-progress-percent]');
    const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 در SVG گِیج دونات‌شکل
    if (bar) bar.style.strokeDasharray = `${GAUGE_CIRCUMFERENCE}`;

    try {
      const saved: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (saved.length) boxes.forEach((b) => { if (saved.includes(b.value)) b.checked = true; });
    } catch { /* ignore */ }

    function update(trackChange: boolean) {
      const checked = boxes.filter((b) => b.checked);
      const percent = boxes.length ? Math.round((checked.length / boxes.length) * 100) : 0;
      if (bar) bar.style.strokeDashoffset = `${GAUGE_CIRCUMFERENCE * (1 - percent / 100)}`;
      if (percentEl) percentEl.textContent = toFaDigits(percent) + '٪';
      progressWrap?.setAttribute('aria-valuenow', String(percent));
      if (label) label.textContent = `${toFaDigits(checked.length)} از ${toFaDigits(boxes.length)} مورد`;
      try { localStorage.setItem(storageKey, JSON.stringify(checked.map((b) => b.value))); } catch { /* ignore */ }
      showResult(findTier(percent), percent, { percent, checked: checked.length, missing: boxes.length - checked.length, total: boxes.length });
      if (trackChange) track('experience_item', { slug, percent });
    }

    if (boxes.some((b) => b.checked)) update(false); // بازیابی از مرورگر، بدون رویداد شروع
    boxes.forEach((b) => b.addEventListener('change', () => { markStart(); update(true); }));
  }

  if (kind === 'quiz') {
    const qs = Array.from(root.querySelectorAll<HTMLElement>('[data-exp-q]'));
    const scoreLabel = root.querySelector<HTMLElement>('[data-exp-score]');
    let score = 0;
    let answered = 0;

    qs.forEach((q) => {
      const correct = q.dataset.answer === 'true';
      const explain = q.querySelector<HTMLElement>('.exp-q-explain');
      const buttons = Array.from(q.querySelectorAll<HTMLButtonElement>('[data-exp-answer]'));
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (q.dataset.answered) return;
          markStart();
          q.dataset.answered = '1';
          const chose = btn.dataset.expAnswer === 'true';
          const ok = chose === correct;
          if (ok) score++;
          answered++;
          btn.classList.add(ok ? 'is-correct' : 'is-wrong');
          buttons.forEach((b) => (b.disabled = true));
          if (explain) { explain.hidden = false; explain.classList.add(ok ? 'is-correct' : 'is-wrong'); }
          if (scoreLabel) scoreLabel.textContent = `امتیاز: ${toFaDigits(score)} از ${toFaDigits(qs.length)}`;
          track('experience_item', { slug, id: q.dataset.id, correct: ok });
          if (answered === qs.length) showResult(findTier(score), score, { score, total: qs.length });
        });
      });
    });
  }

  nativeBtn?.addEventListener('click', async () => {
    try {
      await (navigator as any).share({ title: document.title, text: lastShareText, url: shareUrl() });
      track('experience_share', { slug, method: 'native' });
    } catch { /* کاربر انصراف داد؛ خطا نیست */ }
  });

  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareFull());
      if (copiedNote) { copiedNote.hidden = false; setTimeout(() => { copiedNote.hidden = true; }, 4000); }
      track('experience_share', { slug, method: 'copy' });
    } catch { /* ignore */ }
  });

  waLink?.addEventListener('click', () => track('experience_share', { slug, method: 'whatsapp' }));
});
