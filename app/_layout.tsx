// Init Sentry as early as possible — before any module that might throw.
// No-op in __DEV__ and when DSN is not configured, so this is safe always.
import { initSentry } from '../src/services/sentry';
initSentry();

// Fully uninstall LogBox when running under Maestro E2E (set via
// EXPO_PUBLIC_E2E_MODE=1 at build time). LogBox.ignoreAllLogs() still
// leaves a minimized "Open debugger to view warnings" banner that
// overlaps the bottom of the screen — covering btn-next at its viewport
// position and stealing Maestro taps. uninstall() removes the native
// bridge entirely. Metro console still shows all warnings.
if (__DEV__ && process.env.EXPO_PUBLIC_E2E_MODE === '1') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LogBox } = require('react-native');
  LogBox.uninstall();
  LogBox.ignoreAllLogs(true);
  const noop = () => {};
  console.error = noop;
  console.warn = noop;
}

import { useEffect, useRef, useState } from 'react';
import { AppState, Appearance, BackHandler, Platform, View, Text, Image, Animated } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { EventSubscription } from 'expo-modules-core';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n';
import { ThemeProvider, useTheme } from '../src/theme';
import { notificationsApi } from '../src/api/notifications';
import { useAuthStore } from '../src/stores/authStore';
import { usePaymentCardsStore } from '../src/stores/paymentCardsStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useSubscriptionsStore } from '../src/stores/subscriptionsStore';
import { schedulePaymentReminders } from '../src/utils/localNotifications';
import { ErrorBoundary } from '../src/utils/ErrorBoundary';
import { installConsoleInterceptors } from '../src/utils/errorReporter';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { detectCountryFromTimezone, COUNTRY_DEFAULT_CURRENCY } from '../src/constants/timezones';
import { initFxCache, invalidateFxCache } from '../src/services/fxCache';
import { invalidateCatalogCache } from '../src/services/catalogCache';

// Install global console interceptors as early as possible
installConsoleInterceptors();

// Set Inter as global default font for all Text components
// @ts-ignore — RN defaultProps pattern
Text.defaultProps = Text.defaultProps || {};
// @ts-ignore
Text.defaultProps.style = { fontFamily: 'Inter-Medium' };
import { analytics } from '../src/services/analytics';
import { useReviewPromptStore } from '../src/stores/reviewPromptStore';
analytics.init();
import { loginRevenueCat, logoutRevenueCat } from '../src/hooks/useRevenueCat';
import * as SecureStore from 'expo-secure-store';
import * as Sentry from '@sentry/react-native';
import { billingApi } from '../src/api/billing';
import { reconcileBillingDrift } from '../src/utils/reconcileBillingDrift';

const PENDING_RECEIPT_KEY = 'pending_receipt';
// Tracks consecutive 5xx/network failures across cold starts so we can
// give up after 3 attempts instead of looping forever.
const PENDING_RECEIPT_RETRY_KEY = 'pending_receipt_retry';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// RevenueCat configured lazily inside DataLoader after native modules are ready

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;
  // Guard the entire flow with try/catch so a Keychain-locked iOS state
  // (errSecInteractionNotAllowed, "Пользовательское взаимодействие не
  // разрешено") doesn't surface as an unhandled rejection. This happens
  // when the OS launches the app while still locked after first boot —
  // expo-notifications reads the device-token from keychain, which uses
  // kSecAttrAccessibleAfterFirstUnlock, and the read fails until the
  // user unlocks once.
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    // Use Expo Push Token — works on iOS and Android,
    // backend sends via Expo Push API (no Firebase Admin complexity)
    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: 'b6fbf0f2-a22b-4eb7-8fb7-d03856c94551',
    });
    return expoPushToken.data; // "ExponentPushToken[xxx]"
  } catch {
    // Expo Go, simulator, OR keychain-locked first-boot state — let the
    // caller retry on the next AppState=active transition. PushSetup has
    // an AppState listener for exactly this.
    return null;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: (failureCount, error: any) => {
        // Don't retry client errors (4xx) — server said request is bad, retry won't help
        const status = error?.response?.status;
        if (typeof status === 'number' && status >= 400 && status < 500) return false;
        // Retry network errors and 5xx once
        return failureCount < 1;
      },
    },
  },
});

function LanguageLoader() {
  const language = useSettingsStore((s) => s.language);
  useEffect(() => {
    // Re-detect device language on every cold start as long as the user
    // hasn't explicitly chosen one. Lets users who change their system
    // language between launches see the app follow along, instead of
    // being stuck on whatever language was primary at first install.
    useSettingsStore.getState().redetectLanguageIfNotExplicit();
  }, []);
  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);
  return null;
}

// Lazy-require so Expo Go / simulator builds without the native module
// don't crash at import time. Same pattern reconcileBillingDrift uses.
let Purchases: any = null;
try {
  const rc = require('react-native-purchases');
  Purchases = rc.default || rc;
} catch {}

function DataLoader() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setCards } = usePaymentCardsStore();
  const { setSubscriptions, subscriptions } = useSubscriptionsStore();
  const { reminderDays, notificationsEnabled } = useSettingsStore();
  const displayCurrency = useSettingsStore((s) => s.displayCurrency);
  const settingsRegion = useSettingsStore((s) => s.region);

  // Drop every cached query response when the user logs out. Without
  // this, account-A's `/billing/me` (banner, plan, limits) stays in the
  // TanStack Query cache and is the FIRST thing account-B sees on the
  // next launch — they get account-A's "Pro expiring" banner / plan
  // badge for up to `staleTime` ms (60s for billing) until the refetch
  // returns the new user's data. Same risk for subscriptions, cards,
  // analytics, workspace, AI — anything keyed on the user implicitly.
  const prevAuthRef = useRef(isAuthenticated);
  useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      queryClient.clear();
      // Also wipe the local in-memory mirrors so the UI doesn't show
      // the previous user's subscriptions for a frame before the new
      // /subscriptions fetch returns.
      useSubscriptionsStore.getState().setSubscriptions([]);
      usePaymentCardsStore.getState().setCards([]);
      // Drop user-scoped settings so account-A's currency / region
      // doesn't get pushed onto account-B by CurrencySync on the next
      // login (the local "explicit" flag would otherwise convince the
      // sync that RUB/RU was account-B's choice).
      useSettingsStore.getState().resetUserScoped();
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // On login, mirror the just-arrived /users/me fields into the local
  // settings store so the new account's saved currency / region /
  // language take effect immediately — without waiting for the user to
  // tap something or for CurrencySync to run a few seconds later.
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    if (isAuthenticated && user) {
      useSettingsStore.getState().hydrateFromUser({
        displayCurrency: user.displayCurrency ?? null,
        region: (user as any).region ?? null,
        country: user.country ?? null,
        locale: user.locale ?? null,
      });
    }
  }, [isAuthenticated, user?.id]);

  // Mirror the device timezone to the backend once per login. The
  // reminder cron (`reminders.service.ts:89`) reads
  // `user.timezoneDetected` to schedule push notifications in the
  // user's local clock — without this PATCH it defaulted to UTC and
  // payment reminders for a Kazakhstan user landed at 3am their
  // time. Fire-and-forget; settings UI only displays the value so
  // we can do this transparently from the layout effect.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const persistedTz = (user as any).timezoneDetected as string | undefined;
      if (persistedTz === tz) return;
      import('../src/api/users').then(({ usersApi }) =>
        usersApi.updateMe({ timezoneDetected: tz }).catch(() => undefined),
      );
    } catch {
      /* Intl is missing on some old Android devices — skip silently. */
    }
  }, [isAuthenticated, user?.id]);

  // Auto-detect region & display currency on first launch
  useEffect(() => {
    const settings = useSettingsStore.getState();
    // Only auto-detect if still at defaults (user hasn't chosen yet)
    if (settings.region === 'US' && settings.displayCurrency === 'USD') {
      const detected = detectCountryFromTimezone();
      if (detected !== 'US') {
        settings.setRegion(detected);
        const suggestedCurrency = COUNTRY_DEFAULT_CURRENCY[detected];
        if (suggestedCurrency) {
          // Use the auto-detected setter: stores locally but does NOT
          // push to the server and does NOT flip `currencyExplicitlySet`.
          // CurrencySync (after login) is then free to pull the user's
          // saved preference from the server without losing it.
          settings.setDisplayCurrencyAutoDetected(suggestedCurrency);
        }
      }
    }
  }, []);

  // Prefetch FX rates for client-side conversion (popular services, etc.)
  useEffect(() => {
    if (isAuthenticated) {
      initFxCache();
    }
  }, [isAuthenticated]);

  // Refetch FX rates and invalidate catalog when display currency or region changes
  useEffect(() => {
    if (isAuthenticated && displayCurrency) {
      invalidateFxCache();
      invalidateCatalogCache();
    }
  }, [displayCurrency, settingsRegion]);

  useEffect(() => {
    let cancelled = false;

    // Async RC init + pending receipt recovery.
    // configure-before-login is handled inside loginRevenueCat (singleton promise).
    (async () => {
      try {
        if (!isAuthenticated) {
          await logoutRevenueCat();
          return;
        }

        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        await loginRevenueCat(userId);
        if (cancelled) return;

        const user = useAuthStore.getState().user;
        analytics.identify(userId, { plan: (user as any)?.plan });

        // Pending receipt recovery — if a previous purchase couldn't reach
        // the backend, retry the sync now that we're authenticated and RC
        // is configured.
        const pending = await SecureStore.getItemAsync(PENDING_RECEIPT_KEY);
        if (pending && !cancelled) {
          // Before retrying the productId from disk, check whether RC
          // still has it among the active entitlements. In sandbox a
          // user can tap "Buy Pro", get the Team transaction replayed,
          // and end up with a stale `pending = pro.yearly` that
          // backend will keep rejecting (403 — receipt doesn't match
          // any RC sub) on every cold start. Retrying it forever
          // produced the loop the user reported. If RC no longer has
          // it, swap to whatever entitlement IS active so backend can
          // converge on the right plan; if RC has nothing, drop the
          // marker entirely.
          let productToSync = pending;
          try {
            if (typeof Purchases?.getCustomerInfo === 'function') {
              const info = await Purchases.getCustomerInfo();
              const activeMap = info?.entitlements?.active ?? {};
              const activeProducts = new Set(
                Object.values(activeMap)
                  .map((e: any) => e?.productIdentifier)
                  .filter(Boolean) as string[],
              );
              if (!activeProducts.has(pending)) {
                // Pick the first active product (renewing preferred) as
                // a substitute. If none, mark as not retryable.
                const subsByProduct =
                  (info as any)?.subscriptionsByProductIdentifier ?? {};
                const renewingActive = [...activeProducts].find(
                  (p) => subsByProduct[p]?.willRenew !== false,
                );
                const replacement = renewingActive ?? [...activeProducts][0];
                if (replacement) {
                  console.log(
                    '[PendingReceipt] stale productId',
                    pending,
                    'no longer active in RC; substituting',
                    replacement,
                  );
                  productToSync = replacement;
                } else {
                  console.log(
                    '[PendingReceipt] stale productId',
                    pending,
                    'and RC has no active entitlements — clearing marker',
                  );
                  await SecureStore.deleteItemAsync(PENDING_RECEIPT_KEY);
                  productToSync = '';
                }
              }
            }
          } catch (e: any) {
            if (__DEV__) {
              console.warn(
                '[PendingReceipt] RC lookup failed, retrying as-is:',
                e?.message,
              );
            }
          }

          if (productToSync && !cancelled) {
            try {
              await billingApi.syncRevenueCat(productToSync);
              await SecureStore.deleteItemAsync(PENDING_RECEIPT_KEY);
              await SecureStore.deleteItemAsync(PENDING_RECEIPT_RETRY_KEY).catch(() => {});
              queryClient.invalidateQueries({ queryKey: ['billing'] });
              analytics.pendingReceiptRecovered(productToSync);
            } catch (e: any) {
              analytics.pendingReceiptRecoveryFailed(productToSync, e?.message);
              const status = e?.response?.status;
              const isTerminal4xx =
                typeof status === 'number' && status >= 400 && status < 500;
              if (isTerminal4xx) {
                // 4xx are terminal — receipt is structurally bad / doesn't
                // match any RC sub on this user. Retrying never helps.
                console.log(
                  '[PendingReceipt] terminal',
                  status,
                  '— clearing marker to stop retry loop',
                );
                try {
                  await SecureStore.deleteItemAsync(PENDING_RECEIPT_KEY);
                  await SecureStore.deleteItemAsync(PENDING_RECEIPT_RETRY_KEY);
                } catch {}
              } else {
                // 5xx / network — bump retry counter, give up after 3
                // attempts to avoid burning battery + analytics noise on
                // a permanently-failing call. Industry practice (Stripe,
                // Adyen) caps client-side IAP retry at 3 because anything
                // worse is a backend outage that the user can't fix.
                let attempts = 0;
                try {
                  const raw = await SecureStore.getItemAsync(PENDING_RECEIPT_RETRY_KEY);
                  attempts = raw ? Number(raw) || 0 : 0;
                } catch {}
                attempts += 1;
                if (attempts >= 3) {
                  console.log(
                    '[PendingReceipt] gave up after',
                    attempts,
                    'attempts — clearing marker',
                  );
                  try {
                    await SecureStore.deleteItemAsync(PENDING_RECEIPT_KEY);
                    await SecureStore.deleteItemAsync(PENDING_RECEIPT_RETRY_KEY);
                  } catch {}
                } else {
                  try {
                    await SecureStore.setItemAsync(
                      PENDING_RECEIPT_RETRY_KEY,
                      String(attempts),
                    );
                  } catch {}
                }
              }
            }
          }
        }

        // Drift recovery — if RC has no active entitlements but the backend
        // still reports a paid plan (lost EXPIRATION webhook, legacy manual
        // grants), ask the backend to verify against RC and downgrade.
        if (!cancelled) {
          const drift = await reconcileBillingDrift();
          if (drift.ran && !cancelled) {
            queryClient.invalidateQueries({ queryKey: ['billing'] });
          }
        }

        // Currency reconcile — pre-existing accounts that picked KZT/RUB/etc
        // before the auto-PATCH was wired up (commit bac95b1) end up with
        // their LOCAL store on the right currency but the BACKEND user row
        // still on the default (USD). Workspace analytics + team reports
        // run server-side conversion against the BACKEND value, so they
        // come back in dollars even though everything else in the app is
        // in tenge.
        //
        // Conflict resolution depends on `currencyExplicitlySet`:
        //   - true  → the local value is the user's real choice (set via
        //             setDisplayCurrency or hydrated from a previous
        //             server response). Push local → server.
        //   - false → the local value is an auto-detected guess from the
        //             device locale. The server's value (if any) wins,
        //             because it represents the user's saved preference
        //             from another device. Pull server → local.
        //
        // This prevents the regression where logging into an existing
        // account on a new phone silently overwrites the saved currency
        // with the detected device locale.
        if (!cancelled) {
          try {
            const { usersApi } = await import('../src/api/users');
            const me = await usersApi.getMe();
            const serverCurrency = (me?.data?.displayCurrency || me?.data?.currency || '')
              .toString()
              .toUpperCase();
            const settingsState = useSettingsStore.getState();
            const localCurrency = (settingsState.displayCurrency || 'USD').toUpperCase();
            const localExplicit = settingsState.currencyExplicitlySet;

            if (serverCurrency && localCurrency && serverCurrency !== localCurrency) {
              if (!localExplicit) {
                // Server wins — adopt the saved preference without pushing back.
                if (__DEV__) {
                  console.log(
                    '[CurrencySync] mismatch — local:',
                    localCurrency,
                    '(auto-detected) server:',
                    serverCurrency,
                    '— pulling server',
                  );
                }
                settingsState.hydrateDisplayCurrencyFromServer(serverCurrency);
                queryClient.invalidateQueries({ queryKey: ['workspace-analytics'] });
                queryClient.invalidateQueries({ queryKey: ['analytics'] });
                queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
              } else {
                // Local is the explicit user choice — push to server.
                if (__DEV__) {
                  console.log(
                    '[CurrencySync] mismatch — local:',
                    localCurrency,
                    '(explicit) server:',
                    serverCurrency,
                    '— pushing local',
                  );
                }
                await usersApi.updateMe({ displayCurrency: localCurrency } as any);
                queryClient.invalidateQueries({ queryKey: ['workspace-analytics'] });
                queryClient.invalidateQueries({ queryKey: ['analytics'] });
                queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
              }
            } else if (serverCurrency && !localExplicit) {
              // No conflict but the local value was never confirmed —
              // mark it explicit now so future syncs know not to overwrite.
              settingsState.hydrateDisplayCurrencyFromServer(serverCurrency);
            } else if (!serverCurrency && localCurrency) {
              // New account: server has no currency yet (empty user row).
              // Push the current local value (auto-detected or default)
              // so this becomes the account's saved preference and another
              // device logging in later picks it up via the pull branch.
              // Without this, `currencyExplicitlySet` stays `false` forever
              // and CurrencySync re-runs the same no-op every launch.
              try {
                await usersApi.updateMe({ displayCurrency: localCurrency } as any);
                settingsState.hydrateDisplayCurrencyFromServer(localCurrency);
              } catch {
                // Network/permission failure is fine — we'll retry next launch.
              }
            }
          } catch (e: any) {
            if (__DEV__) console.warn('[CurrencySync] failed:', e?.message);
          }
        }
      } catch (e) {
        Sentry.captureException(e, { tags: { source: 'rc_init' } });
      }
    })();

    if (!isAuthenticated) {
      return () => { cancelled = true; };
    }

    // Load cards
    import('../src/api/cards').then(({ cardsApi }) => {
      cardsApi.getAll().then((res: any) => {
        if (cancelled) return;
        setCards(res.data || []);
      }).catch(() => {});
    });

    // Load subscriptions and schedule local reminders
    const currency = useSettingsStore.getState().displayCurrency;
    import('../src/api/subscriptions').then(({ subscriptionsApi }) => {
      subscriptionsApi.getAll({ displayCurrency: currency }).then((res: any) => {
        if (cancelled) return;
        const subs = res.data || [];
        setSubscriptions(subs);
        if (notificationsEnabled) {
          schedulePaymentReminders(subs);
        }
      }).catch(() => {
        if (cancelled) return;
        // Offline — use cached subscriptions from store
        if (subscriptions.length > 0 && notificationsEnabled) {
          schedulePaymentReminders(subscriptions);
        }
      });
    });

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  return null;
}

function PushSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);
  const tokenRegisteredRef = useRef(false);
  const appStateSubRef = useRef<{ remove: () => void } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;

    // iOS Keychain accessibility (kSecAttrAccessibleAfterFirstUnlock) means
    // the device-token read inside expo-notifications fails with
    // errSecInteractionNotAllowed if the app is woken while the device is
    // still locked after a reboot. Defer registration to AppState=active
    // so the keychain is reachable. On a normal warm start the state is
    // already active and we register immediately.
    const tryRegister = async () => {
      if (tokenRegisteredRef.current) return;
      if (AppState.currentState !== 'active') return;
      const token = await registerForPushNotificationsAsync();
      if (token) {
        tokenRegisteredRef.current = true;
        const platform = Platform.OS as 'ios' | 'android';
        // Send the active language alongside the token so the server can pick
        // the correct copy for cron-driven push (reminder/digest/win-back) on
        // first install, before the user touches Settings.
        const locale = i18n.language;
        notificationsApi.registerPushToken(token, platform, locale).catch(() => {});
        appStateSubRef.current?.remove();
        appStateSubRef.current = null;
      }
    };

    void tryRegister();

    if (!tokenRegisteredRef.current) {
      appStateSubRef.current = AppState.addEventListener('change', (state) => {
        if (state === 'active') void tryRegister();
      });
    }

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;

      // Backend sends one of: `type`, `screen`, or `subscriptionId`. We
      // resolve in that order so legacy payloads keep working while new
      // categories (paywall, billing_issue, team_invite) route to their
      // own screens. Anything unrecognised is a no-op so an unknown push
      // can't crash the app or land the user on a wrong screen.
      const type = typeof data.type === 'string' ? data.type : null;
      const screen = typeof data.screen === 'string' ? data.screen : null;
      const subId = typeof data.subscriptionId === 'string' ? data.subscriptionId : null;

      const SCREEN_BY_TYPE: Record<string, string> = {
        paywall: '/paywall',
        billing_issue: '/subscription-plan',
        pro_expiration: '/subscription-plan',
        trial_expiry: '/paywall',
        team_invite: '/(tabs)/workspace',
        weekly_digest: '/(tabs)',
        win_back: '/(tabs)',
        payment_reminders_digest: '/(tabs)/subscriptions',
        test: '/(tabs)/settings',
      };

      // Gmail background-scan completion needs special routing: we
      // pass through the `jobId` so the gmail-import screen can
      // resume polling that specific job and skip the "start a new
      // scan" path (no extra daily-quota burn, no extra wait).
      if (type === 'gmail_scan_complete') {
        const jobId = typeof data.jobId === 'string' ? data.jobId : null;
        if (jobId) {
          router.push(`/gmail-import?jobId=${encodeURIComponent(jobId)}` as any);
          return;
        }
      }

      if (type && SCREEN_BY_TYPE[type]) {
        router.push(SCREEN_BY_TYPE[type] as any);
        return;
      }
      if (subId && /^[a-f0-9-]{36}$/.test(subId)) {
        router.push(`/subscription/${subId}` as any);
        return;
      }
      if (screen && screen.startsWith('/')) {
        router.push(screen as any);
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
      appStateSubRef.current?.remove();
      appStateSubRef.current = null;
    };
  }, [isAuthenticated, router]);

  return null;
}

function AdaptiveStatusBar() {
  const { isDark } = useTheme();
  return (
    <StatusBar
      style={isDark ? 'light' : 'dark'}
      translucent={Platform.OS === 'android'}
    />
  );
}

function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  // Read system theme synchronously — Appearance.getColorScheme() is sync and
  // available before our ThemeProvider mounts. Prevents a white flash on
  // cold-start for users in dark mode.
  const isDark = Appearance.getColorScheme() === 'dark';
  const bg = isDark ? '#1A1A2E' : '#FFFFFF';
  const titleColor = isDark ? '#FFFFFF' : '#1A1A2E';
  const subtitleColor = isDark ? '#9CA3AF' : '#6B7280';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ alignItems: 'center', opacity, transform: [{ scale }] }}>
        {/* Wrap in View with overflow:hidden — `borderRadius` on <Image> with a
            non-transparent PNG doesn't reliably clip on Android, so the icon
            showed as a sharp square. Clipping the wrapping View works on both
            platforms. */}
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 22,
            overflow: 'hidden',
            marginBottom: 20,
            backgroundColor: '#5826C0',
          }}
        >
          <Image
            source={require('../assets/images/icon.png')}
            style={{ width: 96, height: 96 }}
            resizeMode="cover"
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: titleColor, letterSpacing: -0.5 }}>SubRadar</Text>
          <View style={{ backgroundColor: '#8B5CF6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 }}>AI</Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, color: subtitleColor, textAlign: 'center', letterSpacing: 0.2 }}>
          Smart subscription tracker
        </Text>
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter_400Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter_500Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter_600SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter_700Bold.ttf'),
    'Inter-ExtraBold': require('../assets/fonts/Inter_800ExtraBold.ttf'),
  });

  useEffect(() => {
    // 1800ms was the original "give the brand a moment" timer, but the splash
    // already covers cold-start font + asset decode (~300–600ms on most
    // devices), so anything above ~700ms felt like the app was hung. Cut to
    // 600ms — splash still feels intentional but the first interactive frame
    // arrives ~1.2s sooner. Fonts gating below still blocks render until
    // they're ready, so the splash never disappears prematurely.
    const timer = setTimeout(() => setShowSplash(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // false = let system handle (default back behavior)
      return false;
    });

    return () => backHandler.remove();
  }, []);

  // Session tracking — fire session_start on app resume (background → active)
  useEffect(() => {
    const fireStreakReviewIfDue = () => {
      // shouldPrompt internally checks the streak threshold and all other
      // gates (install age, cooldown, blackout). If it returns true we
      // surface the native dialog — but only after a beat so the prompt
      // doesn't collide with the splash transition.
      const store = useReviewPromptStore.getState();
      if (!store.shouldPrompt('streak_5_days')) return;
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { requestInAppReview } = require('../src/utils/requestInAppReview');
        requestInAppReview()
          .then((shown: boolean) => {
            if (shown) useReviewPromptStore.getState().markPrompted();
          })
          .catch(() => {});
      }, 1500);
    };

    let previousState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (previousState.match(/inactive|background/) && next === 'active') {
        analytics.newSession();
        analytics.track('session_start');
        // Update install-date + consecutive-day streak for the review prompt
        // gate. Idempotent — running once per active transition is enough.
        useReviewPromptStore.getState().recordAppOpen();
        fireStreakReviewIfDue();
      }
      previousState = next;
    });
    // Also tick the open recorder on cold start (no inactive→active edge fires
    // until the user backgrounds the app, which would miss day-1).
    useReviewPromptStore.getState().recordAppOpen();
    fireStreakReviewIfDue();
    return () => sub.remove();
  }, []);

  if (showSplash || !fontsLoaded) return <SplashScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ErrorBoundary>
      <ThemeProvider>
      <View style={{ flex: 1 }}>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <AdaptiveStatusBar />
            <OfflineBanner />
            <LanguageLoader />
            <DataLoader />
            <PushSetup />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="subscription/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="reports/index" />
            </Stack>
          </QueryClientProvider>
        </I18nextProvider>
      </View>
      </ThemeProvider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
