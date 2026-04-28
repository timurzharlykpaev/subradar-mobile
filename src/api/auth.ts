import { apiClient } from './client';
import i18n from '../i18n';

// Auth flows happen before the user is logged in (and before we have a
// stored locale on the backend), so the client has to forward whichever
// language the app is currently rendering. Backend falls back to `en`
// when `locale` is missing.
const currentLocale = () => (i18n.language || 'en').split('-')[0];

export const authApi = {
  loginWithGoogle: (idToken: string) =>
    apiClient.post('/auth/google/token', { idToken }),
  loginWithGoogleMobile: (accessToken: string) =>
    apiClient.post('/auth/google/mobile', { accessToken }),
  loginWithApple: (identityToken: string, name?: string) =>
    apiClient.post('/auth/apple', { idToken: identityToken, name }),
  sendMagicLink: (email: string) =>
    apiClient.post('/auth/magic-link', { email, locale: currentLocale() }),
  verifyMagicLink: (token: string) =>
    apiClient.get(`/auth/magic?token=${token}`),
  sendOtp: (email: string) =>
    apiClient.post('/auth/otp/send', { email, locale: currentLocale() }),
  verifyOtp: (email: string, code: string) =>
    apiClient.post('/auth/otp/verify', { email, code }),
  getProfile: () => apiClient.get('/auth/me'),
  updateProfile: (data: { name?: string; avatarUrl?: string }) =>
    apiClient.post('/auth/profile', data),
  refresh: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }),
  deleteAccount: () => apiClient.delete('/users/me'),
};
