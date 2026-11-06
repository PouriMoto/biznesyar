// قفل «پنهان‌سازی» Studio — فقط ورودی را مخفی می‌کند، قفل امنیتی واقعی نیست
// (برای قفل واقعی روی VPS: Caddy basic auth برای /studio/*). رمز در کد نیست؛ فقط اثر انگشت آن.
const SALT = 'bizyaar-studio-v1';
const HASH = '7bbc271ad0798c758965ec0a21d0de5efde4135ed868b05c992df25b063aed73';
const KEY = 'studio.auth';
const TTL = 7 * 24 * 3600 * 1000;

async function digest(pw: string): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(SALT), iterations: 100000, hash: 'SHA-256' }, base, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function isAuthed(): boolean {
  try { const j = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return !!j && j.h === HASH && Date.now() - j.t < TTL; } catch { return false; }
}
export async function tryLogin(pw: string): Promise<boolean> {
  try {
    if ((await digest(pw)) !== HASH) return false;
    localStorage.setItem(KEY, JSON.stringify({ h: HASH, t: Date.now() }));
    return true;
  } catch { return false; }
}
export function logout() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
