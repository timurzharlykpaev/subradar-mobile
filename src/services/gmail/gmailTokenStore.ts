import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'gmail_refresh_token';
const EMAIL_KEY = 'gmail_connected_email';

/**
 * Persistent OAuth state for the Gmail integration.
 *
 * Refresh token lives in hardware-backed secure storage (iOS Keychain,
 * Android Keystore). The connected email address is stored alongside so
 * we can detect "user switched to a different Google account" — see
 * `useGmailAuth.connect` for the auto-disconnect-then-reconnect flow.
 *
 * Access token is NEVER persisted; it lives only in module-scoped RAM
 * inside `useGmailAuth`.
 */
export const gmailTokenStore = {
  saveRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_KEY, token),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY),
  saveConnectedEmail: (email: string) => SecureStore.setItemAsync(EMAIL_KEY, email),
  getConnectedEmail: () => SecureStore.getItemAsync(EMAIL_KEY),
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(EMAIL_KEY),
    ]);
  },
};
