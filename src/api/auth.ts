import { apiClient } from './client';

export const authApi = {
  loginWithGoogle: (idToken: string) =>
    apiClient.post('/auth/google/token', { idToken }),
  loginWithGoogleMobile: (accessToken: string) =>
    apiClient.post('/auth/google/mobile', { accessToken }),
  loginWithApple: (identityToken: string) =>
    apiClient.post('/auth/apple', { idToken: identityToken }),
  sendMagicLink: (email: string) =>
    apiClient.post('/auth/magic-link', { email }),
  verifyMagicLink: (token: string) =>
    apiClient.get(`/auth/magic?token=${token}`),
  sendOtp: (email: string) =>
    apiClient.post('/auth/otp/send', { email }),
  verifyOtp: (email: string, code: string) =>
    apiClient.post('/auth/otp/verify', { email, code }),
  getProfile: () => apiClient.get('/auth/me'),
  updateProfile: (data: any) => apiClient.post('/auth/profile', data),
  deleteAccount: () => apiClient.delete('/users/me'),
};
