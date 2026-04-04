import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { reportError } from '../utils/errorReporter';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.subradar.ai/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // User not found (deleted account, stale JWT) — force logout
    if (error.response?.status === 404 && error.response?.data?.message === 'User not found') {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const { refreshToken } = useAuthStore.getState();

      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = data;

        useAuthStore.getState().setTokens(accessToken, newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const status: number | undefined = error.response?.status;
    const url = error.config?.url ?? 'unknown';
    const method = error.config?.method?.toUpperCase() ?? '?';

    // Report all non-auth errors: 4xx (except 401/403) + 5xx + network errors
    const isAuthError = status === 401 || status === 403;
    const shouldReport = !isAuthError && (!status || status >= 400);
    if (shouldReport) {
      const serverMsg = error.response?.data?.message ?? error.response?.data?.error ?? '';
      reportError(
        `API ${method} ${url} → ${status ?? 'network error'}${serverMsg ? `: ${serverMsg}` : ''}`,
        error.stack,
        { status, url, method },
      );
    }

    return Promise.reject(error);
  }
);
