import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().max(200),
      category: z.string(),
      tags: z.array(z.string()).default([]),
      service: z.string().optional(),
      region: z.string().optional(),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      reviewedAt: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      leadForm: z.boolean().default(true), // false = فرم لید در انتهای این مقاله نباشد
      magnet: z.union([z.boolean(), z.string()]).default(true), // true = خودکار بر اساس خدمت، false = بدون لید مگنت، متن = شناسهٔ یک لید مگنت مشخص
      generatedBy: z.enum(['human', 'agent']).default('human'),
      cover: z.object({ src: image(), alt: z.string().min(5), caption: z.string().optional() }).optional(),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
      sources: z.array(z.object({ title: z.string(), url: z.string().optional() })).default([])
    })
});

// متن بلند اختیاری برای صفحه هر منطقه (نام فایل = slug منطقه در regions.json)
const areas = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/areas' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().optional(),
      description: z.string().max(200).optional(),
      cover: z.object({ src: image(), alt: z.string().min(5), caption: z.string().optional() }).optional(),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
      updatedAt: z.coerce.date().optional()
    })
});

// راهنمای «رسته × مجوز (× شهر)»؛ نام فایل = trade-service[-region]
const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().max(200),
      trade: z.string(), // slug رسته، از src/data/trades.json
      service: z.string(), // مجوز / خدمت
      region: z.string().optional(), // شهر یا منطقه (اختیاری؛ بدون آن راهنمای ملی است)
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      reviewedAt: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      leadForm: z.boolean().default(true),
      magnet: z.union([z.boolean(), z.string()]).default(true),
      generatedBy: z.enum(['human', 'agent']).default('human'),
      cover: z.object({ src: image(), alt: z.string().min(5), caption: z.string().optional() }).optional(),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
      sources: z.array(z.object({ title: z.string(), url: z.string().optional() })).default([])
    })
});

export const collections = { articles, areas, guides };
