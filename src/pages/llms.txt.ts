import type { APIRoute } from 'astro';
import { site } from '../config';
import { getArticles, getGuides, enabledServices, getRegions } from '../lib/content';
import { abs } from '../lib/seo';
import { channels } from '../lib/links';

export const GET: APIRoute = async () => {
  const arts = await getArticles();
  const guides = await getGuides();
  const L: string[] = [];
  L.push(`# ${site.brand.name_fa} (${site.brand.name_en})`, '');
  L.push(`> ${site.seo.defaultDescription}`, '');
  L.push('بیزنس‌یار خدمات مشاوره و پیگیری امور اداری کسب‌وکار در بندرعباس، مناطق آزاد قشم و کیش و سراسر هرمزگان ارائه می‌دهد. ابتدا جواز کسب، سپس ثبت شرکت، کارت بازرگانی و امور مالیاتی.', '');
  L.push('## خدمات');
  enabledServices().forEach((s) => L.push(`- [${s.title}](${abs(`/services/${s.slug}/`)}): ${s.short}`));
  L.push('', '## مناطق');
  getRegions().forEach((r) => L.push(`- [${r.name}](${abs(`/areas/${r.slug}/`)}): ${r.kind}`));
  if (arts.length) {
    L.push('', '## مقالات');
    arts.forEach((a) => L.push(`- [${a.data.title}](${abs(`/articles/${a.id}/`)}): ${a.data.description}`));
  }
  if (guides.length) {
    L.push('', '## راهنمای مجوز هر رسته');
    guides.forEach((g) => L.push(`- [${g.data.title}](${abs(`/guides/${g.id}/`)}): ${g.data.description}`));
  }
  L.push('', '## تماس');
  L.push(`- [فرم مشاوره رایگان](${abs('/contact/')})`);
  channels().forEach((c) => L.push(`- ${c.label}: ${c.href}`));
  L.push('', '## یادداشت', '- مدارک و مراحل رسمی بسته به رسته شغلی، شهر و مرجع مربوطه متفاوت است؛ برای حالت دقیق مشاوره بگیرید.', `- نسخه کامل‌تر: ${abs('/llms-full.txt')}`);
  return new Response(L.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
