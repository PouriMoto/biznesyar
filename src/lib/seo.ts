import { site } from '../config';
import { channels, sameAs, phones } from './links';
import { regions } from './regions';

export const abs = (p: string) => new URL(p, import.meta.env.SITE).href;
const ctx = 'https://schema.org';

export function orgSchema() {
  const c = site.contact;
  return {
    '@context': ctx,
    '@type': 'ProfessionalService',
    '@id': abs('/#org'),
    name: site.brand.name_fa,
    alternateName: site.brand.name_en,
    url: abs('/'),
    logo: abs(site.assets.logo),
    image: abs(site.assets.og_image),
    description: site.seo.defaultDescription,
    ...((c as any).hours ? { openingHours: (c as any).hours } : {}),
    ...(phones().length ? { telephone: phones().map((x) => x.number) } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(c.address ? { streetAddress: c.address } : {}),
      addressLocality: 'بندرعباس',
      addressRegion: 'هرمزگان',
      addressCountry: 'IR'
    },
    areaServed: regions.map((r) => ({ '@type': 'AdministrativeArea', name: r.name })),
    ...(sameAs().length ? { sameAs: sameAs() } : {})
  };
}

export const websiteSchema = () => ({
  '@context': ctx, '@type': 'WebSite', '@id': abs('/#website'), url: abs('/'), name: site.brand.name_fa, inLanguage: 'fa-IR', publisher: { '@id': abs('/#org') }
});

export const breadcrumbSchema = (items: { name: string; path: string }[]) => ({
  '@context': ctx,
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) }))
});

export const faqSchema = (faq: { q: string; a: string }[]) =>
  faq.length ? { '@context': ctx, '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) } : null;

export const serviceSchema = (s: { title: string; description?: string; slug: string }, areas: string[]) => ({
  '@context': ctx, '@type': 'Service', name: s.title, description: s.description, url: abs(`/services/${s.slug}/`),
  provider: { '@id': abs('/#org') }, areaServed: areas.map((a) => ({ '@type': 'AdministrativeArea', name: a }))
});

export const articleSchema = (a: { title: string; description: string; path: string; published: Date; updated?: Date; image?: string }) => ({
  '@context': ctx, '@type': 'Article', headline: a.title, description: a.description, inLanguage: 'fa-IR', mainEntityOfPage: abs(a.path),
  datePublished: a.published.toISOString(), dateModified: (a.updated ?? a.published).toISOString(),
  author: { '@id': abs('/#org') }, publisher: { '@id': abs('/#org') }, image: abs(a.image ?? site.assets.og_image)
});

export const _channels = channels;
