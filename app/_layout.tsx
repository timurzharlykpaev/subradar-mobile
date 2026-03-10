import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';
import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n';
import { notificationsApi } from '../src/api/notifications';
import { useAuthStore } from '../src/stores/authStore';
import { usePaymentCardsStore } from '../src/stores/paymentCardsStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useSubscriptionsStore } from '../src/stores/subscriptionsStore';
import { schedulePaymentReminders } from '../src/utils/localNotifications';
import { ErrorBoundary } from '../src/utils/ErrorBoundary';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    // projectId not available in Expo Go — ignore
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
          schedulePaymentReminders(subs, reminderDays);
        }
      }).catch(() => {
        // Offline — use cached subscriptions from store
        if (subscriptions.length > 0 && notificationsEnabled) {
          schedulePaymentReminders(subscriptions, reminderDays);
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

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
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
    </ErrorBoundary>
  );
}
