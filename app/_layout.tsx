import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, View, Text, Image, Animated } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';
import { Stack, useRouter } from 'expo-router';
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
import { configureRevenueCat, loginRevenueCat, logoutRevenueCat } from '../src/hooks/useRevenueCat';

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
    queries: { retry: 1, staleTime: 30000 },
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

  useEffect(() => {
    if (!isAuthenticated) return;

    // Configure RevenueCat lazily (safe after native modules loaded)
    try { configureRevenueCat(); } catch {}

    // Identify user in RevenueCat
    const userId = useAuthStore.getState().user?.id;
    if (userId) loginRevenueCat(userId);

    // Load cards
    import('../src/api/cards').then(({ cardsApi }) => {
      cardsApi.getAll().then((res: any) => setCards(res.data || [])).catch(() => {});
    });

    // Load subscriptions and schedule local reminders
    import('../src/api/subscriptions').then(({ subscriptionsApi }) => {
      subscriptionsApi.getAll().then((res: any) => {
        const subs = res.data || [];
        setSubscriptions(subs);
        if (notificationsEnabled) {
          schedulePaymentReminders(subs);
        }
      }).catch(() => {
        // Offline — use cached subscriptions from store
        if (subscriptions.length > 0 && notificationsEnabled) {
          schedulePaymentReminders(subscriptions);
        }
      });
    });
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
        notificationsApi.registerPushToken(token, platform).catch(() => {});
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const subId = response.notification.request.content.data?.subscriptionId as string | undefined;
      if (subId) {
        router.push(`/subscription/${subId}` as any);
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [isAuthenticated]);

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

  if (showSplash) return <SplashScreen />;

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <View style={{ flex: 1 }}>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <AdaptiveStatusBar />
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
  );
}
