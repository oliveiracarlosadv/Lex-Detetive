'use client';

/** Reduz a imagem escolhida (foto ou logomarca) para caber no banco do navegador sem pesar. */
export async function shrinkImage(file: File, max = 600, square = false): Promise<string> {
  const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const c = document.createElement('canvas');
  if (square) {
    // Foto de perfil: recorte quadrado no centro.
    const side = Math.min(img.width, img.height);
    c.width = c.height = Math.min(max, side);
    c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
}

/** "Carlos Alexandre Albuquerque Oliveira" → "Carlos Oliveira". */
export function firstLast(name?: string | null) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function initials(name?: string | null) {
  const fl = firstLast(name).split(' ');
  return fl.map((p) => p[0] || '').join('').toUpperCase().slice(0, 2);
}
