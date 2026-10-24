// تبدیل تصویر به webp با اندازه ۱۲۰۰×۶۳۰ (برش وسط) داخل مرورگر
export async function toCoverWebp(file: Blob, w = 1200, h = 630): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const scale = Math.max(w / bmp.width, h / bmp.height);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, w, h);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.82));
  if (!blob) throw new Error('تبدیل تصویر ممکن نشد.');
  if (blob.type !== 'image/webp') throw new Error('مرورگر شما webp نمی‌سازد؛ با Chrome یا Edge امتحان کنید.');
  return blob;
}

export async function fetchImage(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    return await res.blob();
  } catch { return null; }
}
