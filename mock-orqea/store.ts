export interface MockBoard {
  id: string;
  title: string;
  encrypted: boolean;
}
export interface MockList {
  id: string;
  boardId: string;
  title: string;
  position: number;
}
export interface MockCard {
  id: string;
  clientId: string;
  listId: string;
  boardId: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  boardPosition: number;
  createdAt: string;
}
export interface MockAttachment {
  id: string;
  cardId: string;
  clientId?: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface MockStore {
  boards: MockBoard[];
  lists: MockList[];
  cards: MockCard[];
  attachments: MockAttachment[];
}

/** Données initiales, en mémoire. */
export function seedStore(): MockStore {
  return {
    boards: [
      { id: 'b-perso', title: 'Personnel', encrypted: false },
      { id: 'b-travail', title: 'Travail', encrypted: false },
      { id: 'b-coffre', title: 'Coffre-fort', encrypted: true },
    ],
    lists: [
      { id: 'l-inbox', boardId: 'b-perso', title: 'Boîte de réception', position: 0 },
      { id: 'l-todo', boardId: 'b-perso', title: 'À faire', position: 1 },
      { id: 'l-doing', boardId: 'b-perso', title: 'En cours', position: 2 },
      { id: 'l-backlog', boardId: 'b-travail', title: 'Backlog', position: 0 },
      { id: 'l-sprint', boardId: 'b-travail', title: 'Sprint', position: 1 },
    ],
    cards: [],
    attachments: [],
  };
}
