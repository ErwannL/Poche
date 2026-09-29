import type { Priority } from '../orqea/types';

export type CaptureStatus = 'pending' | 'sending' | 'sent' | 'failed';

/** Raisons d'échec définitif ; chacune correspond à une clé i18n `failure.<raison>`. */
export type FailureReason =
  | 'noDestination'
  | 'featureLocked'
  | 'planLimit'
  | 'paymentRequired'
  | 'boardNotFound'
  | 'notFound'
  | 'tokenScope'
  | 'tooLarge'
  | 'unsupportedMedia'
  | 'invalid'
  | 'tooManyAttempts';

export type AttachmentKind = 'image' | 'audio' | 'file';

export interface CaptureAttachment {
  /** UUID, sert aussi de clé d'idempotence pour l'envoi. */
  id: string;
  name: string;
  type: string;
  kind: AttachmentKind;
  blob: Blob;
  uploadedUrl?: string;
}

export interface CaptureInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: Priority;
  boardId?: string;
  listId?: string;
  attachments: CaptureAttachment[];
}

export interface Capture extends CaptureInput {
  /** UUID client = `clientId` envoyé à Orqea. */
  id: string;
  status: CaptureStatus;
  failure?: FailureReason;
  attempts: number;
  nextAttemptAt: number;
  cardId?: string;
  createdAt: number;
  updatedAt: number;
  sentAt?: number;
}

/** Contenu reçu via Web Share Target, en attente d'être repris dans le formulaire. */
export interface SharedDraft {
  id: string;
  title?: string;
  text?: string;
  url?: string;
  files: { name: string; type: string; blob: Blob }[];
  createdAt: number;
}
