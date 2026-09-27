export const MAX_IMAGE_SIZE = 1600;
export const IMAGE_QUALITY = 0.82;

export interface CompressedImage {
  blob: Blob;
  name: string;
  type: string;
}

/** Dimensions ajustées pour que le plus grand côté fasse au plus `max` px. */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIZE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, IMAGE_QUALITY);
  });

const renamed = (name: string, type: string) =>
  `${name.replace(/\.[^.]*$/, '') || 'photo'}.${type === 'image/webp' ? 'webp' : 'jpg'}`;

/**
 * Redimensionne (≤ 1600 px) et recompresse une photo côté client, en WebP si le
 * navigateur sait l'encoder, sinon en JPEG.
 */
export async function compressImage(file: Blob & { name?: string }): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas-unavailable');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let blob = await toBlob(canvas, 'image/webp');
  // Safari renvoie du PNG quand il ne sait pas encoder le WebP.
  if (blob?.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg');
  if (!blob) throw new Error('encode-failed');
  return { blob, type: blob.type, name: renamed(file.name ?? 'photo', blob.type) };
}
