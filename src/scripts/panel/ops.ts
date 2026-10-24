import { api, list, requireAuth, session, esc, fa, money, when, L, fileUrl, toast, prepareFile, setPdfHelp, initHelp, helpBtn, countdown } from './api';

const me = requireAuth(['admin', 'operator']).record;
const isAdmin = me.role === 'admin';
const app = document.getElementById('app')!;
const tabs = document.getElementById('tabs')!;
document.getElementById('who')!.textContent = `${me.name || fa(me.phone)} · ${isAdmin ? 'مدیر' : 'اپراتور'}`;
document.getElementById('logout')!.addEventListener('click', () => { session.clear(); location.href = '/login/'; });
initHelp();

const badge = (t: string, k = '') => `<span class="st st-${k}">${esc(t)}</span>`;
const fail = (e: unknown) => toast((e as Error).message, 'err');
const opts = (m: Record<string, string>, sel = '') => Object.entries(m).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
const SLOT: Record<string, string> = { missing: 'ارسال نشده', uploaded: 'برای بررسی', accepted: 'تأیید شد', rejected: 'نیاز به اصلاح' };
let sum: any = {};

async function refreshSummary() {
  try { sum = await api('/api/bz/ops/summary'); } catch { sum = {}; }
  const n = (sum.payments_submitted || 0) + (sum.slots_uploaded || 0) + (sum.awaiting_reply || 0) + (sum.leads_new || 0) + (sum.overdue || 0) + (sum.cases_new || 0);
  document.title = (n ? `(${n}) ` : '') + 'پنل مدیریت | بیزنس‌یار';
}
function renderTabs(active: string) {
  const n = (sum.payments_submitted || 0) + (sum.slots_uploaded || 0) + (sum.awaiting_reply || 0) + (sum.overdue || 0) + (sum.cases_new || 0);
  const t: [string, string, number][] = [['todo', 'نیاز به اقدام', n], ['cases', 'پرونده‌ها', 0], ...(isAdmin ? ([['leads', 'لیدها', sum.leads_new || 0], ['new', 'پرونده جدید', 0], ['users', 'کاربران', 0], ['settings', 'تنظیمات', 0]] as [string, string, number][]) : [])];
  tabs.innerHTML = t.map(([k, v, c]) => `<a class="tab ${k === active ? 'on' : ''}" href="#/${k}">${v}${c ? ` <span class="cnt">${fa(c)}</span>` : ''}</a>`).join('');
}

// ---------- نیاز به اقدام ----------
async function todoView() {
  await refreshSummary(); renderTabs('todo');
  const now = new Date().toISOString().replace('T', ' ');
  const [pays, slots, over] = await Promise.all([
    isAdmin ? list('payments', "filter=status='submitted'&expand=case") : Promise.resolve([]),
    list('case_slots', "filter=status='uploaded'&expand=case"),
    list('case_steps', `filter=status='active'&&due_at!=''&&due_at<'${now}'&expand=case`)
  ]);
  const row = (c: any, txt: string) => c ? `<li><a href="#/case/${c.id}"><bdi>${esc(c.tracking)}</bdi> · ${esc(c.customer_name)} · ${esc(c.title)}</a> <span class="meta">${esc(txt)}</span></li>` : '';
  const sec = (title: string, rows: string) => `<section class="block"><h3>${title}</h3>${rows ? `<ul class="plain">${rows}</ul>` : '<p class="meta">موردی نیست ✓</p>'}</section>`;
  app.innerHTML = `<div class="stats">${[['لید جدید', sum.leads_new], ['رسید در انتظار تأیید', sum.payments_submitted], ['مدرک برای بررسی', sum.slots_uploaded], ['پیام بی‌پاسخ', sum.awaiting_reply], ['مهلت‌گذشته', sum.overdue], ['پرونده بدون قیمت', sum.cases_new]]
      .filter(([, v]) => v !== undefined).map(([l, v]) => `<div class="stat ${v ? 'hot' : ''}"><strong>${fa(v || 0)}</strong><span>${l}</span></div>`).join('')}</div>
    ${isAdmin ? sec('رسیدهای در انتظار تأیید', pays.map((p: any) => row(p.expand?.case, `${L.kind[p.kind]} ${money(p.amount)}`)).join('')) : ''}
    ${sec('مدارک در انتظار بررسی', slots.map((s: any) => row(s.expand?.case, s.title)).join(''))}
    ${sec('پیام‌های بی‌پاسخ مشتری', (sum.reply_cases || []).map((c: any) => row(c, 'پیام مشتری')).join(''))}
    ${sec('مهلت‌های گذشته', over.map((s: any) => row(s.expand?.case, `${s.title} · ${countdown(s.due_at)}`)).join(''))}
    <p><button class="btn btn-ghost" id="bale-link" type="button">اتصال بله برای دریافت اعلان</button></p>`;
  document.getElementById('bale-link')!.addEventListener('click', async () => {
    try { const d = await api<{ url: string; connected: boolean }>('/api/bz/bale/link'); if (d.connected) toast('بله قبلاً متصل شده است'); else if (d.url) window.open(d.url, '_blank'); else toast('ربات بله هنوز تنظیم نشده', 'err'); } catch (e) { fail(e); }
  });
}

// ---------- لیدها ----------
async function leadsView() {
  await refreshSummary(); renderTabs('leads');
  const showArch = sessionStorage.getItem('bz_arch') === '1';
  const leads = await list('leads', `sort=-created&filter=archived=${showArch}`);
  app.innerHTML = `<div class="filters"><label><input type="checkbox" id="arch" ${showArch ? 'checked' : ''} /> نمایش بایگانی</label> <button class="btn btn-ghost" id="lead-csv" type="button">دانلود CSV (اکسل)</button> <small class="meta">لیدهای بی‌اقدام بعد از ۳۰ روز خودکار «از دست رفته» و بایگانی می‌شوند؛ لیدِ پرونده‌های تکمیل‌شده هم بایگانی می‌شود.</small></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>تاریخ</th><th>نام</th><th>موبایل</th><th>خدمت / منطقه</th><th>پیام</th><th>وضعیت</th><th></th></tr></thead><tbody>
    ${leads.map((l: any) => `<tr><td>${when(l.created)}</td><td>${esc(l.name)}</td><td><a dir="ltr" href="tel:${esc(l.phone)}">${esc(l.phone)}</a></td><td>${esc(l.service)} / ${esc(l.region)}<br><small>${esc(l.source)}</small></td><td>${esc(l.message)}</td>
      <td><select data-lead="${l.id}" class="lead-st">${opts(L.lead, l.status)}</select></td>
      <td>${l.case_tracking ? `<bdi>${esc(l.case_tracking)}</bdi>` : `<button class="btn btn-ghost mk-case" data-lead='${esc(JSON.stringify({ id: l.id, name: l.name, phone: l.phone, service: l.service, region: l.region }))}'>ساخت پرونده</button>`}
      <button class="btn btn-ghost lead-arch" data-id="${l.id}" data-a="${l.archived ? 0 : 1}">${l.archived ? 'بازگردانی' : 'بایگانی'}</button></td></tr>`).join('') || '<tr><td colspan="7">لیدی نیست.</td></tr>'}</tbody></table></div>`;
  document.getElementById('lead-csv')!.addEventListener('click', () => {
    const cell = (v: unknown) => { let t = String(v ?? '').replace(/\r?\n/g, ' '); if (/^[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
    const rows = [['تاریخ', 'نام', 'موبایل', 'خدمت', 'منطقه', 'پیام', 'منبع', 'وضعیت'], ...leads.map((l: any) => [l.created, l.name, l.phone, l.service, l.region, l.message, l.source, l.status])];
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  });
  document.getElementById('arch')!.addEventListener('change', (e) => { sessionStorage.setItem('bz_arch', (e.target as HTMLInputElement).checked ? '1' : '0'); leadsView(); });
  app.querySelectorAll<HTMLSelectElement>('.lead-st').forEach((s) => s.addEventListener('change', async () => { try { await api(`/api/collections/leads/records/${s.dataset.lead}`, { method: 'PATCH', json: { status: s.value, archived: s.value === 'lost' } }); toast('ذخیره شد'); } catch (e) { fail(e); } }));
  app.querySelectorAll<HTMLButtonElement>('.lead-arch').forEach((b) => b.addEventListener('click', async () => { try { await api(`/api/collections/leads/records/${b.dataset.id}`, { method: 'PATCH', json: { archived: b.dataset.a === '1' } }); leadsView(); } catch (e) { fail(e); } }));
  app.querySelectorAll<HTMLButtonElement>('.mk-case').forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem('bz_prefill', b.dataset.lead!); location.hash = '#/new'; }));
}

// ---------- پرونده جدید ----------
async function newView() {
  await refreshSummary(); renderTabs('new');
  const pre = JSON.parse(sessionStorage.getItem('bz_prefill') || '{}'); sessionStorage.removeItem('bz_prefill');
  const operators = await list('users', "filter=role='operator'");
  const flow = await fetch('/flows/business-license.json').then((r) => r.json()).catch(() => ({ modules: [] }));
  const services: Record<string, string> = { 'business-license': 'جواز کسب', 'company-registration': 'ثبت شرکت', 'trade-card': 'کارت بازرگانی', tax: 'امور مالیاتی' };
  app.innerHTML = `<form id="nc" class="lead" style="max-width:38rem">
    <div class="row pair"><label>موبایل مشتری<input name="phone" required value="${esc(pre.phone || '')}" /></label><label>نام<input name="name" value="${esc(pre.name || '')}" /></label></div>
    <div class="row pair"><label>خدمت<select name="service">${opts(services, pre.service)}</select></label><label>عنوان پرونده<input name="title" required value="${esc(services[pre.service] || 'جواز کسب')}" /></label></div>
    <div class="row pair"><label>هزینه کل (تومان)<input name="total" type="number" min="0" /></label><label>بیعانه (تومان)<input name="deposit" type="number" min="0" /></label></div>
    <label>اپراتور<select name="operator"><option value="">— بدون اپراتور —</option>${operators.map((o: any) => `<option value="${o.id}">${esc(o.name || o.phone)}</option>`).join('')}</select></label>
    <fieldset class="methods"><legend>موارد لازم برای این رسته (مراحل و مدارک را تعیین می‌کند)</legend>${(flow.modules || []).map((m: any) => `<label class="radio"><input type="checkbox" name="mod_${m.key}" ${m.default ? 'checked' : ''} /> ${esc(m.label)}</label>`).join('')}</fieldset>
    <input type="hidden" name="region" value="${esc(pre.region || '')}" /><input type="hidden" name="leadId" value="${esc(pre.id || '')}" />
    <p class="lead-note">هزینه و بیعانه را می‌توانی بعداً در خود پرونده هم ثبت کنی.</p><button class="btn btn-primary" type="submit">ساخت پرونده</button></form>`;
  document.getElementById('nc')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement); const f: any = Object.fromEntries(fd);
    const flags: Record<string, boolean> = {}; (flow.modules || []).forEach((m: any) => (flags[m.key] = fd.get('mod_' + m.key) === 'on'));
    try { const r = await api<any>('/api/bz/ops/cases', { method: 'POST', json: { phone: f.phone, name: f.name, service: f.service, title: f.title, region: f.region, leadId: f.leadId, operator: f.operator, total: Number(f.total) || 0, deposit: Number(f.deposit) || 0, flags } }); toast('پرونده ساخته شد'); location.hash = `#/case/${r.id}`; } catch (x) { fail(x); }
  });
}

// ---------- لیست پرونده‌ها ----------
async function casesView() {
  await refreshSummary(); renderTabs('cases');
  const cases = await list('cases', 'sort=-updated');
  const filter = sessionStorage.getItem('bz_f') || '';
  const shown = cases.filter((c: any) => !filter || c.status === filter);
  app.innerHTML = `<div class="filters"><select id="f"><option value="">همه وضعیت‌ها</option>${opts(L.caseStatus, filter)}</select></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>کد</th><th>مشتری</th><th>عنوان</th><th>وضعیت</th><th>اپراتور</th><th>آخرین تغییر</th></tr></thead><tbody>
    ${shown.map((c: any) => `<tr class="click" data-id="${c.id}"><td><bdi>${esc(c.tracking)}</bdi></td><td>${esc(c.customer_name)}</td><td>${esc(c.title)}</td><td>${badge(L.caseStatus[c.status], c.status)}</td><td>${esc(c.operator_name)}</td><td>${when(c.updated)}</td></tr>`).join('') || '<tr><td colspan="6">پرونده‌ای نیست.</td></tr>'}</tbody></table></div>`;
  document.getElementById('f')!.addEventListener('change', (e) => { sessionStorage.setItem('bz_f', (e.target as HTMLSelectElement).value); casesView(); });
  app.querySelectorAll<HTMLElement>('tr.click').forEach((r) => r.addEventListener('click', () => (location.hash = `#/case/${r.dataset.id}`)));
}

// ---------- جزئیات پرونده ----------
async function caseView(id: string) {
  await refreshSummary(); renderTabs('cases');
  const [c, steps, tasks, slots, fields, logs, docs, pays] = await Promise.all([
    api<any>(`/api/collections/cases/records/${id}${isAdmin ? '?expand=owner' : ''}`),
    list('case_steps', `filter=case='${id}'&sort=order`), list('case_tasks', `filter=case='${id}'&sort=order`), list('case_slots', `filter=case='${id}'&sort=order`),
    list('case_fields', `filter=case='${id}'&sort=order`), list('case_logs', `filter=case='${id}'&sort=created`), list('documents', `filter=case='${id}'&sort=created`), list('payments', `filter=case='${id}'&sort=created`)
  ]);
  const operators = isAdmin ? await list('users', "filter=role='operator'") : [];
  try { (await list('app_settings')).forEach((r: any) => r.skey === 'pdf_help' && setPdfHelp(r.value)); } catch { /* */ }
  const owner = c.expand?.owner;
  const open = new Set<string>(JSON.parse(sessionStorage.getItem('bz_open_' + id) || '[]'));
  const link = async (coll: string, rid: string, f: string, label: string) => `<a href="${await fileUrl(coll, rid, f)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  const flags = c.flags && typeof c.flags === 'object' ? Object.entries(c.flags).filter(([, v]) => v).map(([k]) => k) : [];

  const stageHtml = async (s: any, i: number) => {
    const tk = tasks.filter((t: any) => t.step === s.id), ss = slots.filter((x: any) => x.step === s.id), ff = fields.filter((x: any) => x.step === s.id), ls = logs.filter((l: any) => l.step === s.id);
    const pay = s.kind === 'payment' ? pays.find((p: any) => p.kind === s.pay) : null;
    const payH = pay ? `<div class="box-card"><div class="bc-head"><strong>${esc(L.kind[pay.kind])}: ${money(pay.amount)}</strong>${badge(L.pay[pay.status], pay.status)}</div>
      ${pay.method ? `<small>روش: ${esc(pay.method)}</small> ` : ''}${pay.ref_no ? `<small>پیگیری: ${esc(pay.ref_no)}</small> ` : ''}${pay.receipt ? await link('payments', pay.id, pay.receipt, 'مشاهده رسید') : ''}
      ${isAdmin && (pay.status === 'submitted' || pay.status === 'requested') ? `<span class="acts"><button class="btn btn-primary pay-act" data-id="${pay.id}" data-s="confirmed">تأیید</button><button class="btn btn-ghost pay-act" data-id="${pay.id}" data-s="rejected">رد</button></span>` : ''}</div>` : '';
    const taskH = tk.length ? `<h4>وظایف داخلی (مشتری نمی‌بیند)</h4><ul class="plain">${tk.map((t: any) => `<li class="task"><label><input type="checkbox" class="task-cb" data-id="${t.id}" ${t.status === 'done' ? 'checked' : ''} /> ${esc(t.title)} ${t.required ? '' : '<small class="tag">اختیاری</small>'}</label>
      ${t.note ? `<small class="meta">${esc(t.note)}</small>` : ''}${t.value_label ? `<div class="inline"><input class="task-val" data-id="${t.id}" value="${esc(t.value)}" placeholder="${esc(t.value_label)}" maxlength="300" /></div>` : ''}</li>`).join('')}</ul>` : '';
    const slotH = ss.length ? `<h4>مدارک مشتری</h4>${(await Promise.all(ss.map(async (sl: any) => {
      const files = (await Promise.all(docs.filter((d: any) => d.slot === sl.id).map((d: any) => link('documents', d.id, d.file, 'فایل')))).join(' · ');
      return `<div class="slot s-${sl.status}"><div class="slot-h"><strong>${esc(sl.title)}</strong> <small class="tag">${sl.required ? 'الزامی' : 'اختیاری'}</small> ${badge(SLOT[sl.status], sl.status)} ${files}
        ${sl.status === 'uploaded' || sl.status === 'rejected' ? `<span class="acts"><button class="btn btn-ghost slot-act" data-id="${sl.id}" data-s="accepted">تأیید</button><button class="btn btn-ghost slot-act" data-id="${sl.id}" data-s="rejected">نیاز به اصلاح</button></span>` : ''}</div>${sl.note ? `<small class="meta">${esc(sl.note)}</small>` : ''}</div>`;
    }))).join('')}` : '';
    const fieldH = ff.length ? `<h4>اطلاعات مشتری</h4><dl class="kv">${ff.map((f: any) => `<dt>${esc(f.label)}${f.sensitive ? ' 🔒' : ''}</dt><dd>${f.value ? esc(f.value) : '<span class="meta">— وارد نشده</span>'}</dd>`).join('')}</dl>` : '';
    const threadH = (await Promise.all(ls.map(async (l: any) => `<li class="${l.public ? '' : 'internal'}"><div class="meta"><strong>${esc(l.actor_name)}</strong><span>${when(l.created)}</span>${l.public ? '' : '<span class="tag">داخلی</span>'}</div><p>${esc(l.body)}</p>${l.attachment ? `<p>📎 ${await link('case_logs', l.id, l.attachment, 'فایل')}</p>` : ''}</li>`))).join('');
    const ctrl = `<div class="ctrl">${s.status === 'active' ? `<form class="inline step-done" data-id="${s.id}"><input name="public_note" placeholder="توضیح برای مشتری (اختیاری)" maxlength="500" /><button class="btn btn-primary" type="submit">انجام شد ✓</button></form>` : ''}
      ${s.status !== 'pending' ? `<button class="btn btn-ghost rollback" data-id="${s.id}" data-t="${esc(s.title)}">↩ بازگشت به این مرحله</button>` : ''}
      <details class="reqbox"><summary class="btn btn-ghost">درخواست مدرک/اطلاعات جدید</summary><form class="lead req-form" data-step="${s.id}"><div class="row pair"><label>نوع<select name="type"><option value="doc">مدرک</option><option value="field">اطلاعات / کد</option></select></label><label>عنوان<input name="title" required maxlength="150" /></label></div><label>توضیح برای مشتری<input name="message" maxlength="300" /></label><label class="radio"><input type="checkbox" name="sensitive" /> کد حساس (۱۵ دقیقه بعد پاک می‌شود)</label><button class="btn btn-primary" type="submit">ارسال درخواست</button></form></details></div>`;
    const msg = `<form class="lead msg-form" data-step="${s.id}"><textarea name="body" rows="2" required maxlength="2000" placeholder="پیام یا گزارش برای این مرحله…"></textarea><div class="row pair"><label>نمایش به<select name="public"><option value="1">مشتری</option><option value="0">فقط داخلی</option></select></label><label>پیوست (مثلاً فایل پروانه)<input type="file" name="attachment" accept="image/*,application/pdf" /></label></div><button class="btn btn-ghost" type="submit">ثبت</button></form>`;
    return `<details class="stage s-${s.status}" data-id="${s.id}" ${s.status === 'active' || open.has(s.id) ? 'open' : ''}><summary><span class="dot">${s.status === 'done' ? '✓' : fa(i + 1)}</span><span class="sg"><strong>${esc(s.title)}</strong> ${helpBtn(s.help_text, s.help_image)}<small>${esc(L.step[s.status])} · ${esc(s.kind)}${s.due_at && s.status === 'active' ? ' · ' + countdown(s.due_at) : ''}</small></span></summary>
      <div class="stage-body">${payH}${taskH}${fieldH}${slotH}${ctrl}<h4>پیام‌ها و گزارش این مرحله</h4><ul class="timeline">${threadH || '<li class="meta">—</li>'}</ul>${msg}</div></details>`;
  };
  const stagesHtml = (await Promise.all(steps.map(stageHtml))).join('');
  const general = logs.filter((l: any) => !l.step).slice(-10).reverse();

  app.innerHTML = `<p><a href="#/cases">← پرونده‌ها</a></p>
    <div class="case-head2"><div><h2 style="margin:0">${esc(c.title)}</h2><div class="meta"><span>کد: <bdi>${esc(c.tracking)}</bdi></span><span>مشتری: ${esc(c.customer_name)}</span>${owner ? `<a dir="ltr" href="tel:${esc(owner.phone)}">${esc(owner.phone)}</a>` : ''}${flags.length ? `<span>ماژول‌ها: ${esc(flags.join('، '))}</span>` : ''}</div></div>${badge(L.caseStatus[c.status], c.status)}</div>
    ${isAdmin ? `<form id="case-admin" class="lead box-card"><div class="row pair"><label>وضعیت<select name="status">${opts(L.caseStatus, c.status)}</select></label><label>اپراتور<select name="operator"><option value="">—</option>${operators.map((o: any) => `<option value="${o.id}" ${o.id === c.operator ? 'selected' : ''}>${esc(o.name || o.phone)}</option>`).join('')}</select></label></div>
      <div class="row pair"><label>هزینه کل<input name="total_amount" type="number" min="0" value="${c.total_amount || ''}" /></label><label>بیعانه<input name="deposit_amount" type="number" min="0" value="${c.deposit_amount || ''}" /></label></div>
      <button class="btn btn-ghost" type="submit">ذخیره</button>
      ${owner ? `<details><summary class="meta">اصلاح شماره یا انتقال پرونده</summary><div class="inline" style="margin-top:.6rem"><input id="fix-phone" placeholder="شماره صحیح 09…" /><button class="btn btn-ghost" type="button" id="do-fix" data-uid="${owner.id}">اصلاح شماره همین حساب</button><button class="btn btn-ghost" type="button" id="do-transfer">انتقال پرونده به این شماره</button></div><small class="meta">«اصلاح» شماره حساب فعلی را عوض می‌کند و ورود قبلی را قطع می‌کند. «انتقال» برای وقتی است که صاحب درست قبلاً حساب دارد.</small></details>` : ''}</form>` : ''}
    <div class="stages">${stagesHtml}</div>
    ${general.length ? `<section class="block"><h3>گزارش کلی پرونده</h3><ul class="timeline">${general.map((l: any) => `<li class="${l.public ? '' : 'internal'}"><div class="meta"><strong>${esc(l.actor_name)}</strong><span>${when(l.created)}</span></div><p>${esc(l.body)}</p></li>`).join('')}</ul></section>` : ''}`;
  wireCase(id);
}

function wireCase(id: string) {
  const again = () => caseView(id);
  app.querySelectorAll<HTMLDetailsElement>('details.stage').forEach((d) => d.addEventListener('toggle', () => {
    const cur = new Set<string>(JSON.parse(sessionStorage.getItem('bz_open_' + id) || '[]')); d.open ? cur.add(d.dataset.id!) : cur.delete(d.dataset.id!); sessionStorage.setItem('bz_open_' + id, JSON.stringify([...cur]));
  }));
  app.querySelectorAll<HTMLInputElement>('.task-cb').forEach((cb) => cb.addEventListener('change', async () => { try { await api(`/api/collections/case_tasks/records/${cb.dataset.id}`, { method: 'PATCH', json: { status: cb.checked ? 'done' : 'todo' } }); } catch (e) { fail(e); cb.checked = !cb.checked; } }));
  app.querySelectorAll<HTMLInputElement>('.task-val').forEach((i) => i.addEventListener('change', async () => { try { await api(`/api/collections/case_tasks/records/${i.dataset.id}`, { method: 'PATCH', json: { value: i.value } }); toast('ذخیره شد'); } catch (e) { fail(e); } }));
  app.querySelectorAll<HTMLFormElement>('.step-done').forEach((f) => f.addEventListener('submit', async (e) => { e.preventDefault(); try { await api(`/api/collections/case_steps/records/${f.dataset.id}`, { method: 'PATCH', json: { status: 'done', public_note: new FormData(f).get('public_note') } }); toast('مرحله ثبت شد'); again(); } catch (x) { fail(x); } }));
  app.querySelectorAll<HTMLButtonElement>('.rollback').forEach((b) => b.addEventListener('click', async () => {
    const note = prompt(`دلیل بازگشت به «${b.dataset.t}» (برای مشتری نمایش داده می‌شود):`); if (!note) return;
    try { await api('/api/bz/ops/rollback', { method: 'POST', json: { step: b.dataset.id, note } }); toast('مرحله دوباره باز شد'); again(); } catch (e) { fail(e); }
  }));
  app.querySelectorAll<HTMLButtonElement>('.pay-act').forEach((b) => b.addEventListener('click', async () => {
    const body: Record<string, string> = { status: b.dataset.s! };
    if (b.dataset.s === 'rejected') { const r = prompt('دلیل رد (برای مشتری نمایش داده می‌شود):'); if (r === null) return; body.note = r; }
    try { await api(`/api/collections/payments/records/${b.dataset.id}`, { method: 'PATCH', json: body }); toast('انجام شد'); again(); } catch (e) { fail(e); }
  }));
  app.querySelectorAll<HTMLButtonElement>('.slot-act').forEach((b) => b.addEventListener('click', async () => {
    const body: Record<string, string> = { status: b.dataset.s! };
    if (b.dataset.s === 'rejected') { const r = prompt('چه اصلاحی لازم است؟'); if (!r) return; body.note = r; }
    try { await api(`/api/collections/case_slots/records/${b.dataset.id}`, { method: 'PATCH', json: body }); again(); } catch (e) { fail(e); }
  }));
  app.querySelectorAll<HTMLFormElement>('.req-form').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault(); const d: any = Object.fromEntries(new FormData(f));
    try { await api('/api/bz/ops/request', { method: 'POST', json: { case: id, step: f.dataset.step, type: d.type, title: d.title, message: d.message, sensitive: d.sensitive === 'on' } }); toast('درخواست برای مشتری ارسال شد'); again(); } catch (x) { fail(x); }
  }));
  app.querySelectorAll<HTMLFormElement>('.msg-form').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(f); fd.set('case', id); fd.set('step', f.dataset.step!); fd.set('public', fd.get('public') === '1' ? 'true' : 'false');
      const af = fd.get('attachment') as File; if (af?.size) fd.set('attachment', await prepareFile(af)); else fd.delete('attachment');
      await api('/api/collections/case_logs/records', { method: 'POST', form: fd }); again();
    } catch (x) { fail(x); }
  }));
  document.getElementById('case-admin')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const f: any = Object.fromEntries(new FormData(e.target as HTMLFormElement));
    try { await api(`/api/collections/cases/records/${id}`, { method: 'PATCH', json: { status: f.status, operator: f.operator, total_amount: Number(f.total_amount) || 0, deposit_amount: Number(f.deposit_amount) || 0 } }); toast('ذخیره شد'); again(); } catch (x) { fail(x); }
  });
  document.getElementById('do-fix')?.addEventListener('click', async (e) => {
    const phone = (document.getElementById('fix-phone') as HTMLInputElement).value;
    if (!confirm('شماره این حساب عوض می‌شود و ورود قبلی قطع می‌شود. ادامه؟')) return;
    try { await api('/api/bz/ops/users/phone', { method: 'POST', json: { id: (e.target as HTMLElement).dataset.uid, phone } }); toast('شماره اصلاح شد'); again(); } catch (x) { fail(x); }
  });
  document.getElementById('do-transfer')?.addEventListener('click', async () => {
    const phone = (document.getElementById('fix-phone') as HTMLInputElement).value;
    if (!confirm('پرونده به صاحب این شماره منتقل می‌شود. ادامه؟')) return;
    try { await api('/api/bz/ops/cases/transfer', { method: 'POST', json: { case: id, phone } }); toast('پرونده منتقل شد'); again(); } catch (x) { fail(x); }
  });
}

// ---------- کاربران ----------
async function usersView() {
  await refreshSummary(); renderTabs('users');
  const users = await list('users', 'sort=-created');
  const R: Record<string, string> = { customer: 'مشتری', operator: 'اپراتور', admin: 'مدیر' };
  app.innerHTML = `<form id="add-user" class="lead box-card" style="max-width:40rem"><strong>افزودن یا تغییر نقش</strong><div class="row pair"><label>موبایل<input name="phone" required /></label><label>نام<input name="name" /></label></div>
    <label>نقش<select name="role">${opts(R, 'operator')}</select></label><button class="btn btn-primary" type="submit">ثبت</button><small class="meta">فرد با همین شماره و کد پیامکی وارد می‌شود و به پنل مربوط می‌رسد.</small></form>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>نام</th><th>موبایل</th><th>نقش</th><th>بله</th><th>وضعیت</th><th></th></tr></thead><tbody>
    ${users.map((u: any) => `<tr><td>${esc(u.name)}</td><td dir="ltr">${esc(u.phone)}</td><td>${esc(R[u.role] || u.role)}</td><td>${u.bale_chat_id ? '✓' : ''}</td><td>${u.blocked ? badge('غیرفعال', 'rejected') : badge('فعال', 'done')}</td>
      <td><button class="btn btn-ghost u-block" data-id="${u.id}" data-b="${u.blocked ? 0 : 1}">${u.blocked ? 'فعال‌سازی' : 'غیرفعال‌سازی'}</button> <button class="btn btn-ghost u-phone" data-id="${u.id}">اصلاح شماره</button></td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('add-user')!.addEventListener('submit', async (e) => { e.preventDefault(); const d: any = Object.fromEntries(new FormData(e.target as HTMLFormElement)); try { await api('/api/bz/ops/users', { method: 'POST', json: d }); toast('ثبت شد'); usersView(); } catch (x) { fail(x); } });
  app.querySelectorAll<HTMLButtonElement>('.u-block').forEach((b) => b.addEventListener('click', async () => { try { await api('/api/bz/ops/users/block', { method: 'POST', json: { id: b.dataset.id, blocked: b.dataset.b === '1' } }); usersView(); } catch (x) { fail(x); } }));
  app.querySelectorAll<HTMLButtonElement>('.u-phone').forEach((b) => b.addEventListener('click', async () => { const p = prompt('شماره صحیح (09…):'); if (!p) return; try { await api('/api/bz/ops/users/phone', { method: 'POST', json: { id: b.dataset.id, phone: p } }); toast('اصلاح شد'); usersView(); } catch (x) { fail(x); } }));
}

// ---------- تنظیمات ----------
async function settingsView() {
  await refreshSummary(); renderTabs('settings');
  const rows = await list('app_settings', 'sort=skey');
  const names: Record<string, string> = { bank_owner: 'نام صاحب حساب', bank_name: 'نام بانک', bank_card: 'شماره کارت', bank_sheba: 'شماره شبا (با IR)', pdf_help: 'راهنمای کم‌کردن حجم PDF' };
  app.innerHTML = `<form id="st" class="lead box-card" style="max-width:42rem"><strong>اطلاعات پرداخت و راهنما (برای مشتری نمایش داده می‌شود)</strong>
    ${rows.map((r: any) => `<label>${esc(names[r.skey] || r.skey)}<input name="${r.id}" value="${esc(r.value)}" maxlength="400" ${/card|sheba/.test(r.skey) ? 'dir="ltr"' : ''} /></label>`).join('')}<button class="btn btn-primary" type="submit">ذخیره</button></form>`;
  document.getElementById('st')!.addEventListener('submit', async (e) => { e.preventDefault(); const f = new FormData(e.target as HTMLFormElement); try { for (const [id, v] of f.entries()) await api(`/api/collections/app_settings/records/${id}`, { method: 'PATCH', json: { value: v } }); toast('ذخیره شد'); } catch (x) { fail(x); } });
}

async function route() {
  const h = location.hash;
  try {
    const m = h.match(/^#\/case\/(\w+)/);
    if (m) await caseView(m[1]);
    else if (h === '#/cases') await casesView();
    else if (h === '#/leads' && isAdmin) await leadsView();
    else if (h === '#/new' && isAdmin) await newView();
    else if (h === '#/users' && isAdmin) await usersView();
    else if (h === '#/settings' && isAdmin) await settingsView();
    else await todoView();
  } catch (err) { app.innerHTML = `<div class="note">${esc((err as Error).message)}</div>`; }
}
addEventListener('hashchange', route);
route();
setInterval(() => { if (!document.hidden && (location.hash === '' || location.hash === '#/todo')) todoView(); else if (!document.hidden) refreshSummary().then(() => renderTabs(location.hash.replace('#/', '').split('/')[0] || 'todo')); }, 40000);
