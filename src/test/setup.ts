import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

// Les Blob de jsdom ne survivent pas au structuredClone de fake-indexeddb : on utilise ceux de Node.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;
// Idem pour FormData : on récupère celui de Node (undici) via une Response.
const nodeFormData = await new Response(new URLSearchParams('a=b')).formData();
globalThis.FormData = nodeFormData.constructor as typeof FormData;

afterEach(() => {
  cleanup();
});
