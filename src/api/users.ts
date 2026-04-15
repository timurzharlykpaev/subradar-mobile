import { apiClient } from './client';

export const usersApi = {
  updateMe: (data: {
    name?: string;
    avatarUrl?: string;
    fcmToken?: string;
    region?: string;
    displayCurrency?: string;
    timezoneDetected?: string;
  }) => apiClient.patch('/users/me', data),
};
