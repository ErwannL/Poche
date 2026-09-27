/**
 * Contrat unique entre Poche et Orqea. Tout appel réseau vers Orqea passe par
 * cette interface ; l'implémentation HTTP vit dans `httpClient.ts`.
 */
export interface Board {
  id: string;
  title: string;
  /** Board chiffré de bout en bout : non pris en charge par Poche. */
  encrypted: boolean;
}

export interface BoardList {
  id: string;
  title: string;
  position: number;
}

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface CreateCardInput {
  listId: string;
  title: string;
  description?: string;
  /** Date-heure ISO 8601 (UTC), ex. `2026-09-28T07:00:00.000Z`. */
  dueDate?: string;
  priority?: Priority;
  /** UUID généré côté client : Orqea ne doit jamais créer deux cartes pour le même. */
  clientId: string;
}

export interface CreatedCard {
  id: string;
  boardPosition: number;
}

export interface UploadedAttachment {
  url: string;
}

export interface UploadOptions {
  /** Clé d'idempotence de la pièce jointe (voir docs/idempotence-pieces-jointes.md). */
  clientId?: string;
}

export interface OrqeaClient {
  listBoards(): Promise<Board[]>;
  listLists(boardId: string): Promise<BoardList[]>;
  createCard(input: CreateCardInput): Promise<CreatedCard>;
  uploadAttachment(
    cardId: string,
    file: File,
    options?: UploadOptions,
  ): Promise<UploadedAttachment>;
}
