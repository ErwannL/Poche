import { vi } from 'vitest';
import type { CreateCardInput, OrqeaClient } from '../orqea/types';

/** Client Orqea en mémoire, idempotent par clientId, pour les tests unitaires. */
export function createFakeClient() {
  const cards = new Map<string, { id: string; input: CreateCardInput }>();
  const uploads: { cardId: string; name: string; clientId: string | undefined }[] = [];
  const client = {
    listBoards: vi.fn<OrqeaClient['listBoards']>(async () => [
      { id: 'b1', title: 'Perso', encrypted: false },
      { id: 'b2', title: 'Coffre', encrypted: true },
    ]),
    listLists: vi.fn<OrqeaClient['listLists']>(async () => [
      { id: 'l2', title: 'Deux', position: 2 },
      { id: 'l1', title: 'Un', position: 1 },
    ]),
    createCard: vi.fn<OrqeaClient['createCard']>(async (input) => {
      const existing = cards.get(input.clientId);
      if (existing) return { id: existing.id, boardPosition: 0 };
      const id = `card-${String(cards.size + 1)}`;
      cards.set(input.clientId, { id, input });
      return { id, boardPosition: cards.size - 1 };
    }),
    uploadAttachment: vi.fn<OrqeaClient['uploadAttachment']>(async (cardId, file, options) => {
      uploads.push({ cardId, name: file.name, clientId: options?.clientId });
      return { url: `https://files/${cardId}/${file.name}` };
    }),
  } satisfies OrqeaClient;
  return { client, cards, uploads };
}
