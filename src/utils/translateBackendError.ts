/**
 * translateBackendError — map known backend error codes to i18n keys so we
 * show localized, user-friendly messages instead of raw English strings.
 *
 * The backend returns either `{ code, message }` or `{ error: { code, message } }`
 * depending on the endpoint. We try both shapes, fall back to the raw message,
 * then finally to a generic "common.error" string.
 */
import type { TFunction } from 'i18next';

// Known backend error codes → i18n keys
const MAP: Record<string, string> = {
  SUBSCRIPTION_LIMIT_REACHED: 'add.limit_msg',
  AI_QUOTA_EXCEEDED: 'add.ai_quota_exceeded',
  AI_LIMIT_REACHED: 'add.ai_quota_exceeded',
  INVALID_CREDENTIALS: 'auth.invalid_credentials',
  INVALID_CODE: 'auth.invalid_code',
  TOO_MANY_ATTEMPTS: 'auth.too_many_attempts',
  USER_NOT_FOUND: 'auth.user_not_found',
  EMAIL_ALREADY_EXISTS: 'auth.email_already_exists',
  SUBSCRIPTION_NOT_FOUND: 'errors.subscription_not_found',
  CARD_NOT_FOUND: 'errors.card_not_found',
  PAYMENT_REQUIRED: 'errors.payment_required',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.not_found',
  VALIDATION_ERROR: 'errors.validation',
  UNAUTHORIZED: 'errors.unauthorized',
};

/**
 * Translate an Axios/fetch error to a localized message.
 */
export function translateBackendError(t: TFunction, err: any): string {
  const data = err?.response?.data;
  const code = data?.code ?? data?.error?.code ?? data?.error;
  if (typeof code === 'string' && MAP[code]) {
    return t(MAP[code]);
  }
  return (
    data?.message ??
    data?.error?.message ??
    err?.message ??
    t('common.error')
  );
}
