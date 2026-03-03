import { apiClient } from './client';

export const authApi = {
  loginWithGoogle: (idToken: string) =>
    apiClient.post('/auth/google', { idToken }),
  loginWithGoogleToken: (accessToken: string) =>
    apiClient.post('/auth/google/token', { accessToken }),
  loginWithApple: (identityToken: string) =>
    apiClient.post('/auth/apple', { identityToken }),
  sendMagicLink: (email: string) =>
    apiClient.post('/auth/magic-link', { email }),
  verifyMagicLink: (token: string) =>
    apiClient.post('/auth/verify', { token }),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data: any) => apiClient.put('/auth/profile', data),
};
