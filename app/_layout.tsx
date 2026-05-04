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
import { AppState, BackHandler, Platform, View, Text, Image, Animated } from 'react-native';
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
analytics.init();
import { loginRevenueCat, logoutRevenueCat } from '../src/hooks/useRevenueCat';
import * as SecureStore from 'expo-secure-store';
import * as Sentry from '@sentry/react-native';
import { billingApi } from '../src/api/billing';
import { reconcileBillingDrift } from '../src/utils/reconcileBillingDrift';

const PENDING_RECEIPT_KEY = 'pending_receipt';

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
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  try {
    // Use Expo Push Token — works on iOS and Android,
    // backend sends via Expo Push API (no Firebase Admin complexity)
    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: 'b6fbf0f2-a22b-4eb7-8fb7-d03856c94551',
    });
    return expoPushToken.data; // "ExponentPushToken[xxx]"
  } catch {
    // Expo Go or simulator — ignore
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
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);
  return null;
}

function DataLoader() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setCards } = usePaymentCardsStore();
  const { setSubscriptions, subscriptions } = useSubscriptionsStore();
  const { reminderDays, notificationsEnabled } = useSettingsStore();
  const displayCurrency = useSettingsStore((s) => s.displayCurrency);
  const settingsRegion = useSettingsStore((s) => s.region);

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
          settings.setDisplayCurrency(suggestedCurrency);
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
        // is configured. Keep the receipt on failure so next launch retries.
        const pending = await SecureStore.getItemAsync(PENDING_RECEIPT_KEY);
        if (pending && !cancelled) {
          try {
            await billingApi.syncRevenueCat(pending);
            await SecureStore.deleteItemAsync(PENDING_RECEIPT_KEY);
            queryClient.invalidateQueries({ queryKey: ['billing'] });
            analytics.pendingReceiptRecovered(pending);
          } catch (e: any) {
            analytics.pendingReceiptRecoveryFailed(pending, e?.message);
            // Intentionally do NOT delete — retry on next launch.
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
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        const platform = Platform.OS as 'ios' | 'android';
        // Send the active language alongside the token so the server can pick
        // the correct copy for cron-driven push (reminder/digest/win-back) on
        // first install, before the user touches Settings.
        const locale = i18n.language;
        notificationsApi.registerPushToken(token, platform, locale).catch(() => {});
      }
    });

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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ alignItems: 'center', opacity, transform: [{ scale }] }}>
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: 96, height: 96, borderRadius: 22, marginBottom: 20 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: '#1A1A2E', letterSpacing: -0.5 }}>SubRadar</Text>
          <View style={{ backgroundColor: '#8B5CF6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 }}>AI</Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', letterSpacing: 0.2 }}>
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
    const timer = setTimeout(() => setShowSplash(false), 1800);
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
    let previousState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (previousState.match(/inactive|background/) && next === 'active') {
        analytics.newSession();
        analytics.track('session_start');
      }
      previousState = next;
    });
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
