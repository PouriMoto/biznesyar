import data from '../data/trades.json';

export interface Trade { slug: string; name: string; group?: string; aliases?: string[]; notes?: string[]; verified?: boolean }
export const trades: Trade[] = data as Trade[];
export const getTrade = (slug?: string) => trades.find((t) => t.slug === slug);

// برای دایرکتوری شهرها و خودکامل فرم لید: رسته‌ها را به تفکیک گروه (دسته‌بندی) برمی‌گرداند.
export function tradesByGroup(): { group: string; items: Trade[] }[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const g = t.group || 'سایر';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(t);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}
