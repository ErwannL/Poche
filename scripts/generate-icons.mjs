// Génère les icônes PNG (manifest, iOS, raccourcis) à partir de public/logo.svg.
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';

const logo = await readFile('public/logo.svg');
await mkdir('public/icons', { recursive: true });

const png = (input, size, out) => sharp(input).resize(size, size).png().toFile(out);

await png(logo, 192, 'public/icons/icon-192.png');
await png(logo, 512, 'public/icons/icon-512.png');
await png(logo, 180, 'public/icons/apple-touch-icon.png');
await png(logo, 64, 'public/favicon.png');

// Maskable : logo réduit à la zone de sécurité (80 %) sur fond plein.
const inner = await sharp(logo).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#4f46e5' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile('public/icons/icon-maskable-512.png');

const glyph = (path) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="#4f46e5"/>${path}</svg>`,
  );
await png(
  glyph('<path d="M48 26v44M26 48h44" stroke="#fff" stroke-width="9" stroke-linecap="round"/>'),
  96,
  'public/icons/shortcut-new-96.png',
);
await png(
  glyph(
    '<rect x="20" y="32" width="56" height="40" rx="8" fill="none" stroke="#fff" stroke-width="7"/><circle cx="48" cy="52" r="10" fill="none" stroke="#fff" stroke-width="7"/><path d="M38 32l5-8h10l5 8" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>',
  ),
  96,
  'public/icons/shortcut-photo-96.png',
);
console.log('Icônes générées.');
