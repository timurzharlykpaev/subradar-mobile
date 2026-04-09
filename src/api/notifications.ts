import { apiClient } from './client';

export const notificationsApi = {
  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    apiClient.post('/notifications/push-token', { token, platform }),
  getSettings: () => apiClient.get('/notifications/settings'),
  updateSettings: (data: {
    enabled?: boolean;
    daysBefore?: number;
    emailNotifications?: boolean;
    weeklyDigestEnabled?: boolean;
  }) => apiClient.put('/notifications/settings', data),
};
