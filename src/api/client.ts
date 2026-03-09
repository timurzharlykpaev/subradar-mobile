import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { reportError } from '../utils/errorReporter';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.subradar.ai/api/v1';

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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }

    const status: number | undefined = error.response?.status;
    if (!status || status >= 500) {
      const url = error.config?.url ?? 'unknown';
      const method = error.config?.method?.toUpperCase() ?? '?';
      reportError(
        `API ${method} ${url} → ${status ?? 'network error'}`,
        error.stack,
        { status, url, method },
      );
    }

    return Promise.reject(error);
  }
);
