import type { APIRoute } from 'astro';
import { site } from '../config';
export const GET: APIRoute = ({ site: origin }) => {
  const base = origin ?? new URL(site.brand.url);
  const body = site.seo.noindex
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nDisallow: /panel/\nDisallow: /ops/\nDisallow: /login/\nDisallow: /studio/\n\nSitemap: ${new URL('/sitemap-index.xml', base).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
