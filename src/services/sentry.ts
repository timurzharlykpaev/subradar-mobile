import * as Sentry from '@sentry/react-native';

/**
 * Initialize Sentry crash reporting.
 *
 * - No-op in DEV to avoid noise and avoid spamming the project quota.
 * - Requires EXPO_PUBLIC_SENTRY_DSN in env (eas.json testflight/production profiles).
 * - Safe to call without DSN — Sentry.init just won't send events.
 */
export function initSentry() {
  if (__DEV__) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return; // Not configured yet — skip init, don't crash.

  try {
    Sentry.init({
      dsn,
      enableNative: true,
      environment: process.env.EXPO_PUBLIC_ENV || 'production',
      tracesSampleRate: 0.2,
      // Strip sensitive data (tokens, refresh tokens) before transmission.
      beforeSend(event) {
        try {
          const redact = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            for (const k of Object.keys(obj)) {
              const lk = k.toLowerCase();
              if (
                lk.includes('token') ||
                lk.includes('authorization') ||
                lk.includes('password') ||
                lk.includes('secret')
              ) {
                obj[k] = '[redacted]';
              } else if (typeof obj[k] === 'object') {
                redact(obj[k]);
              }
            }
          };
          redact(event.request?.headers);
          redact(event.request?.data);
          redact(event.extra);
          redact(event.contexts);
        } catch {
          // don't block send on scrubbing failure
        }
        return event;
      },
    });
  } catch {
    // Never let Sentry init crash the app.
  }
}

export { Sentry };
