import type { MessageKey } from '../i18n/translate';
import { isOrqeaError } from './errors';

/** Clé i18n à afficher pour une erreur Orqea — jamais le message du serveur. */
export function errorMessageKey(error: unknown): MessageKey {
  if (!isOrqeaError(error)) return 'errors.network';
  switch (error.kind) {
    case 'unauthorized':
      return 'errors.unauthorized';
    case 'payment':
      if (error.code === 'FEATURE_LOCKED') return 'errors.featureLocked';
      return error.code === 'PLAN_LIMIT' ? 'errors.planLimit' : 'errors.paymentRequired';
    case 'notFound':
      return 'errors.boardNotFound';
    case 'rateLimited':
      return 'errors.rateLimited';
    case 'server':
      return 'errors.server';
    case 'invalid':
      return 'errors.invalid';
    case 'network':
      return 'errors.network';
  }
}
