import { describe, expect, it } from 'vitest';
import { OrqeaError } from './errors';
import { errorMessageKey } from './errorMessages';

describe('errorMessageKey', () => {
  it.each([
    [new OrqeaError('unauthorized'), 'errors.unauthorized'],
    [new OrqeaError('payment', { code: 'FEATURE_LOCKED' }), 'errors.featureLocked'],
    [new OrqeaError('payment', { code: 'PLAN_LIMIT' }), 'errors.planLimit'],
    [new OrqeaError('payment', { code: 'UNKNOWN' }), 'errors.paymentRequired'],
    [new OrqeaError('notFound', { status: 403 }), 'errors.boardNotFound'],
    [new OrqeaError('notFound', { status: 404 }), 'errors.notFound'],
    [new OrqeaError('notFound', { status: 403, apiCode: 'TOKEN_SCOPE' }), 'errors.tokenScope'],
    [new OrqeaError('invalid', { status: 413 }), 'errors.tooLarge'],
    [
      new OrqeaError('invalid', { status: 400, apiCode: 'UNSUPPORTED_MEDIA' }),
      'errors.unsupportedMedia',
    ],
    [new OrqeaError('rateLimited'), 'errors.rateLimited'],
    [new OrqeaError('server'), 'errors.server'],
    [new OrqeaError('invalid'), 'errors.invalid'],
    [new OrqeaError('network'), 'errors.network'],
    [new Error('other'), 'errors.network'],
  ])('maps %o to %s', (error, key) => {
    expect(errorMessageKey(error)).toBe(key);
  });
});
