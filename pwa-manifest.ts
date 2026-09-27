import type { ManifestOptions } from 'vite-plugin-pwa';

export const manifest: Partial<ManifestOptions> = {
  id: '/',
  name: 'Poche',
  short_name: 'Poche',
  description: 'Capture rapide de tâches, même hors ligne.',
  lang: 'fr',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#0f172a',
  theme_color: '#4f46e5',
  categories: ['productivity'],
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
    { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
  ],
  shortcuts: [
    {
      name: 'Nouvelle tâche',
      short_name: 'Tâche',
      url: '/?action=new',
      icons: [{ src: '/icons/shortcut-new-96.png', sizes: '96x96', type: 'image/png' }],
    },
    {
      name: 'Photo',
      short_name: 'Photo',
      url: '/?action=photo',
      icons: [{ src: '/icons/shortcut-photo-96.png', sizes: '96x96', type: 'image/png' }],
    },
  ],
  share_target: {
    action: '/share-target',
    method: 'POST',
    enctype: 'multipart/form-data',
    params: {
      title: 'title',
      text: 'text',
      url: 'url',
      files: [{ name: 'files', accept: ['image/*'] }],
    },
  },
};
