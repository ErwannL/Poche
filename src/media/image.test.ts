import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImage, fitWithin, MAX_IMAGE_SIZE } from './image';

describe('fitWithin', () => {
  it('keeps small images and scales large ones on the longest side', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_IMAGE_SIZE, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: MAX_IMAGE_SIZE });
  });
});

describe('compressImage', () => {
  const drawImage = vi.fn();
  const close = vi.fn();
  let encoded: Record<string, Blob | null>;

  beforeEach(() => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 4000, height: 2000, close })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
    ) {
      callback(encoded[type!] ?? null);
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resizes to ≤ 1600 px and prefers WebP', async () => {
    encoded = { 'image/webp': new Blob(['w'], { type: 'image/webp' }) };
    const result = await compressImage(new File(['x'], 'IMG_1.HEIC'));
    expect(result).toMatchObject({ name: 'IMG_1.webp', type: 'image/webp' });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800);
    expect(close).toHaveBeenCalled();
  });

  it('falls back to JPEG when WebP is not supported', async () => {
    encoded = {
      'image/webp': new Blob(['p'], { type: 'image/png' }),
      'image/jpeg': new Blob(['j'], { type: 'image/jpeg' }),
    };
    expect(await compressImage(new File(['x'], '.jpg'))).toMatchObject({
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
    encoded = { 'image/jpeg': new Blob(['j'], { type: 'image/jpeg' }) };
    expect((await compressImage(new Blob(['x']))).name).toBe('photo.jpg');
  });

  it('fails when encoding or canvas is unavailable', async () => {
    encoded = {};
    await expect(compressImage(new File(['x'], 'a.png'))).rejects.toThrow('encode-failed');
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(compressImage(new File(['x'], 'a.png'))).rejects.toThrow('canvas-unavailable');
  });
});
