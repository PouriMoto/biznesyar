import raw from '../data/experiences.json';
import { showDrafts } from './content';

export interface ExperienceItemChecklist { id: string; text: string; hint?: string }
export interface ExperienceItemQuiz { id: string; text: string; answer: boolean; explain: string }
export interface ExperienceTier { min: number; max: number; title: string; text: string; shareText: string }
export interface Experience {
  slug: string;
  kind: 'checklist' | 'quiz';
  draft: boolean;
  updatedAt: string;
  icon: string;
  title: string;
  shortTitle: string;
  description: string;
  intro: string;
  reviewNote?: string;
  items: (ExperienceItemChecklist | ExperienceItemQuiz)[];
  tiers: ExperienceTier[];
  relatedArticles: string[];
  relatedService?: string;
  relatedTrades?: string[];
  ctaLabel: string;
  /** true یعنی نتیجه فقط برای خود کاربر است و نباید اشتراک‌گذاری عمومی پیشنهاد شود (مثلاً آمادگی یا اعتبارسنجی ایده). پیش‌فرض false (مثل کوییز سرگرمی). */
  private?: boolean;
  /** دسته‌بندی برای نمایش کنار هم در صفحهٔ اول، مثلاً چهار ابزار «اعتبارسنجی ایده». */
  group?: 'validation' | string;
  /** رنگ تمایز کارت در صفحهٔ اول (یکی از توکن‌های theme یا کد رنگ). */
  accent?: string;
}

const all = raw as Experience[];

// نمونه/پیش‌نویس (draft: true) فقط در حالت dev یا SHOW_DRAFTS دیده می‌شود؛ دقیقاً مثل مقالات.
export const getExperiences = (): Experience[] => all.filter((e) => showDrafts || !e.draft);
export const getExperience = (slug: string): Experience | undefined => getExperiences().find((e) => e.slug === slug);
