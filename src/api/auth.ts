import { apiClient } from './client';

export const authApi = {
  loginWithGoogle: (idToken: string) =>
    apiClient.post('/auth/google/token', { idToken }),
  loginWithGoogleMobile: (accessToken: string) =>
    apiClient.post('/auth/google/mobile', { accessToken }),
  loginWithApple: (identityToken: string) =>
    apiClient.post('/auth/apple', { identityToken }),
  sendMagicLink: (email: string) =>
    apiClient.post('/auth/magic-link', { email }),
  verifyMagicLink: (token: string) =>
    apiClient.post('/auth/magic-link/verify', { token }),
  getProfile: () => apiClient.get('/auth/me'),
  updateProfile: (data: any) => apiClient.put('/auth/me', data),
};
