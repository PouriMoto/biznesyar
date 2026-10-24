// هر شهر یک فایل: src/data/regions/<slug>.json (بدون نیاز به ویرایش فایل مشترک)
export interface Region {
  slug: string;
  name: string;
  kind: string;
  intro: string;
  featured: boolean;
  notes: string[];
  faq: { q: string; a: string }[];
  order: number;
}
const files = import.meta.glob<Region>('../data/regions/*.json', { eager: true, import: 'default' });
export const regions: Region[] = Object.values(files)
  .map((r) => ({ ...r, notes: r.notes ?? [], faq: r.faq ?? [], featured: r.featured ?? false, order: r.order ?? 1000 }))
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fa'));
