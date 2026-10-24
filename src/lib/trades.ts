import data from '../data/trades.json';

export interface Trade { slug: string; name: string; group?: string; aliases?: string[]; notes?: string[]; verified?: boolean }
export const trades: Trade[] = data as Trade[];
export const getTrade = (slug?: string) => trades.find((t) => t.slug === slug);
