import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import remarkCallouts from './src/lib/remark-callouts.mjs';

const site = JSON.parse(readFileSync(new URL('./src/config/site.config.json', import.meta.url), 'utf-8'));

const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');

export default defineConfig({
  site: process.env.SITE_URL || env.SITE_URL || site.brand.url,
  trailingSlash: 'always',
  compressHTML: true,
  markdown: { remarkPlugins: [remarkCallouts] },
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [mdx(), sitemap({ filter: (page) => !/\/(login|panel|ops|studio)\/?$/.test(page) })],
});
