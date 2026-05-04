import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { gmailTokenStore } from '../services/gmail/gmailTokenStore';
import { GmailClient } from '../services/gmail/gmailClient';
import { emailImportApi } from '../api/emailImport';
import { reportError } from '../utils/errorReporter';

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/**
 * Module-level access token cache. Lives across re-renders and across all
 * consumers of `useGmailAuth` — so two screens calling `getAccessToken()`
 * concurrently won't trigger two refresh round-trips. Cleared on disconnect
 * or on a 401-from-refresh ("token revoked").
 *
 * NOT persisted: access tokens are short-lived, only the refresh token in
 * SecureStore survives app restarts.
 */
let accessTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * In-flight refresh promise dedupe. If `getAccessToken` is called from two
 * places at once and the cache is empty, only one HTTP refresh runs; the
 * other awaits the same promise.
 */
let pendingRefresh: Promise<string> | null = null;

function clientIdForPlatform(): string {
  const raw =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_IOS
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_ANDROID
        : process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_WEB;
  const id = typeof raw === 'string' ? raw : '';
  if (!id) {
    throw new Error(
      'gmail_oauth_not_configured: EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_* env var missing',
    );
  }
  return id;
}

export type GmailAuthError =
  | 'cancelled'
  | 'no_refresh_token'
  | 'token_revoked'
  | 'state_mismatch'
  | 'oauth_failed'
  | 'not_connected'
  | 'config_missing';

/**
 * Gmail OAuth + token management.
 *
 * Trust model: refresh token never leaves the device. Backend gets snippets
 * for AI parsing and `disconnect` notifications, nothing else.
 *
 * Account-switch detection: after every successful `connect()` we read the
 * authenticated account's email via `gmail.users.me/profile` (works with the
 * `gmail.readonly` scope, no extra scope needed) and compare to the saved
 * email. If different, we wipe the prior local cache so SQLite-cached
 * scanned-ids from the old account don't leak into the new account's view.
 */
/** True when at least one platform's OAuth client ID is configured. */
export const isGmailOAuthConfigured = (): boolean => {
  return Boolean(
    process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_IOS ||
      process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_ANDROID ||
      process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_WEB,
  );
};

// Placeholder strings used while Phase-0 OAuth setup is incomplete. Google's
// hook crashes synchronously on `undefined` — empty strings prevent that.
// `connect()` returns 'config_missing' before any network call when these
// are still in effect, so no real OAuth attempt is made.
const PLACEHOLDER_CLIENT_ID = 'placeholder.apps.googleusercontent.com';

export function useGmailAuth() {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Always call the hook unconditionally (rules of hooks). When env vars
  // are missing we feed placeholders and gate the actual `connect()` flow
  // on `isGmailOAuthConfigured()` so we never make a network call with
  // bogus IDs.
  const [request, , promptAsync] = Google.useAuthRequest({
    iosClientId:
      process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_IOS || PLACEHOLDER_CLIENT_ID,
    androidClientId:
      process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_ANDROID || PLACEHOLDER_CLIENT_ID,
    webClientId:
      process.env.EXPO_PUBLIC_GMAIL_OAUTH_CLIENT_ID_WEB || PLACEHOLDER_CLIENT_ID,
    scopes: GMAIL_SCOPES,
    responseType: 'code',
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  useEffect(() => {
    let cancelled = false;
    gmailTokenStore.getRefreshToken().then((t) => {
      if (!cancelled) setIsConnected(!!t);
    });
    return () => { cancelled = true; };
  }, []);

  const exchangeCodeForTokens = useCallback(
    async (code: string): Promise<{ refreshToken: string; accessToken: string; expiresIn: number }> => {
      if (!request?.codeVerifier) {
        throw new Error('oauth_failed');
      }
      const tokenRes = await AuthSession.exchangeCodeAsync(
        {
          clientId: clientIdForPlatform(),
          code,
          redirectUri: AuthSession.makeRedirectUri(),
          extraParams: { code_verifier: request.codeVerifier },
        },
        { tokenEndpoint: GOOGLE_TOKEN_URL },
      );

      // Google may not return a refresh token if the user has previously
      // authorized this client and this is just a re-consent (review C2).
      // Treat that as a hard failure rather than leaving the user in a
      // half-connected state.
      if (!tokenRes.refreshToken) {
        throw new Error('no_refresh_token');
      }
      if (!tokenRes.accessToken) {
        throw new Error('oauth_failed');
      }
      return {
        refreshToken: tokenRes.refreshToken,
        accessToken: tokenRes.accessToken,
        expiresIn: tokenRes.expiresIn ?? 3600,
      };
    },
    [request],
  );

  const connect = useCallback(async () => {
    if (!isGmailOAuthConfigured()) {
      throw new Error('config_missing');
    }
    if (!request) {
      throw new Error('oauth_failed');
    }
    setIsAuthenticating(true);
    try {
      const result = await promptAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('cancelled');
      }
      if (result.type !== 'success' || !result.params.code) {
        throw new Error('oauth_failed');
      }

      // PKCE state validation: expo-auth-session validates by default but
      // we double-check (review C3) since silently accepting a missing/
      // mismatched state would let a deep-link attacker inject foreign codes.
      if (request.state && result.params.state && request.state !== result.params.state) {
        throw new Error('state_mismatch');
      }

      const { refreshToken, accessToken, expiresIn } = await exchangeCodeForTokens(
        result.params.code,
      );

      // Detect account switch BEFORE persisting refresh token, so a switch
      // wipes prior cache atomically.
      accessTokenCache = { token: accessToken, expiresAt: Date.now() + (expiresIn - 60) * 1000 };
      const client = new GmailClient(async () => accessTokenCache!.token);
      const newEmail = await client.getProfileEmail().catch(() => null);

      const prevEmail = await gmailTokenStore.getConnectedEmail();
      if (prevEmail && newEmail && prevEmail !== newEmail) {
        // Lazily import to avoid circular deps on hook init.
        const { scannedMessageStore } = await import('../services/scannedMessageStore');
        await scannedMessageStore.dropAll();
      }

      await gmailTokenStore.saveRefreshToken(refreshToken);
      if (newEmail) await gmailTokenStore.saveConnectedEmail(newEmail);

      setIsConnected(true);
    } catch (e: any) {
      reportError(e?.message ?? String(e), e?.stack);
      throw e;
    } finally {
      setIsAuthenticating(false);
    }
  }, [request, promptAsync, exchangeCodeForTokens]);

  const disconnect = useCallback(async () => {
    try {
      const rt = await gmailTokenStore.getRefreshToken();
      if (rt) {
        await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(rt)}`, {
          method: 'POST',
        }).catch(() => { /* best-effort */ });
      }
    } catch { /* swallow */ }

    accessTokenCache = null;
    pendingRefresh = null;

    await gmailTokenStore.clear();
    try {
      const { scannedMessageStore } = await import('../services/scannedMessageStore');
      await scannedMessageStore.dropAll();
    } catch (e: any) { reportError(e?.message ?? String(e), e?.stack); }

    try {
      await emailImportApi.disconnect();
    } catch (e: any) { reportError(e?.message ?? String(e), e?.stack); }

    setIsConnected(false);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string> => {
    const refreshToken = await gmailTokenStore.getRefreshToken();
    if (!refreshToken) throw new Error('not_connected');

    const body = new URLSearchParams({
      client_id: clientIdForPlatform(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString();

    const r = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!r.ok) {
      // Google returns 400/401 when refresh token is revoked or invalid.
      if (r.status === 400 || r.status === 401) {
        accessTokenCache = null;
        await gmailTokenStore.clear();
        setIsConnected(false);
        throw new Error('token_revoked');
      }
      throw new Error(`refresh_failed_${r.status}`);
    }

    const data = await r.json();
    if (typeof data?.access_token !== 'string') {
      throw new Error('refresh_failed_malformed');
    }

    // Google sometimes rotates refresh tokens. Persist the new one.
    if (typeof data?.refresh_token === 'string' && data.refresh_token !== refreshToken) {
      await gmailTokenStore.saveRefreshToken(data.refresh_token);
    }

    const expiresAt = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
    accessTokenCache = { token: data.access_token, expiresAt };
    return data.access_token;
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
      return accessTokenCache.token;
    }
    if (pendingRefresh) return pendingRefresh;

    pendingRefresh = refreshAccessToken().finally(() => {
      pendingRefresh = null;
    });
    return pendingRefresh;
  }, [refreshAccessToken]);

  return { isConnected, isAuthenticating, connect, disconnect, getAccessToken };
}

// ── Test-only helpers (do not import from app code) ─────────────────────

/** @internal — for tests only */
export const __resetGmailAuthState = () => {
  accessTokenCache = null;
  pendingRefresh = null;
};
