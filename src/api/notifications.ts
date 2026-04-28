import { apiClient } from './client';

export const notificationsApi = {
  /**
   * Register Expo/FCM push token. Optional `locale` lets the backend pick the
   * right language for cron-driven push messages immediately on first install
   * (without waiting for the user to also call PATCH /users/me).
   */
  registerPushToken: (
    token: string,
    platform: 'ios' | 'android',
    locale?: string,
  ) =>
    apiClient.post('/notifications/push-token', {
      token,
      platform,
      ...(locale ? { locale } : {}),
    }),
  getSettings: () => apiClient.get('/notifications/settings'),
  updateSettings: (data: {
    enabled?: boolean;
    daysBefore?: number;
    emailNotifications?: boolean;
    weeklyDigestEnabled?: boolean;
  }) => apiClient.put('/notifications/settings', data),
  /**
   * Fire a localized test push to the caller's stored FCM token. Used by the
   * Send Test Notification button in Settings so users can verify push
   * permissions and tap-to-open behaviour without waiting for a real cron.
   */
  sendTest: () =>
    apiClient.post<{ message: string; token: string }>('/notifications/test'),
};
