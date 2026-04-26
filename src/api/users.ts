import { apiClient } from './client';

export const usersApi = {
  updateMe: (data: {
    name?: string;
    avatarUrl?: string;
    fcmToken?: string;
    region?: string;
    displayCurrency?: string;
    timezoneDetected?: string;
    /** BCP-47-ish locale (e.g. "en", "ru", "ru-RU"). Backend normalizes to "ru". */
    locale?: string;
  }) => apiClient.patch('/users/me', data),
};
