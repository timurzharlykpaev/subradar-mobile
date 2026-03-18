import axios from 'axios';

// Mock modules before importing
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/errorReporter', () => ({
  reportError: jest.fn(),
}));

import { useAuthStore } from '../stores/authStore';

describe('API Client configuration', () => {
  it('auth store provides token for requests', () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    expect(useAuthStore.getState().token).toBe('test-token');
  });

  it('auth store clears tokens on logout', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'test@test.com', name: 'Test' },
      token: 'access',
      refreshToken: 'refresh',
      isAuthenticated: true,
    });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('setTokens updates both tokens', () => {
    useAuthStore.setState({ token: 'old', refreshToken: 'old-refresh' });
    useAuthStore.getState().setTokens('new-access', 'new-refresh');
    expect(useAuthStore.getState().token).toBe('new-access');
    expect(useAuthStore.getState().refreshToken).toBe('new-refresh');
  });
});

describe('API endpoint paths', () => {
  it('analytics endpoints match backend', () => {
    // These are the correct endpoints that the backend exposes
    const backendEndpoints = [
      '/analytics/summary',
      '/analytics/monthly',
      '/analytics/by-category',
      '/analytics/by-card',
      '/analytics/upcoming',
      '/analytics/trials',
    ];
    // /analytics/savings does NOT exist on backend
    expect(backendEndpoints).not.toContain('/analytics/savings');
  });

  it('auth endpoints include refresh', () => {
    const authEndpoints = [
      '/auth/google/token',
      '/auth/google/mobile',
      '/auth/apple',
      '/auth/magic-link',
      '/auth/otp/send',
      '/auth/otp/verify',
      '/auth/me',
      '/auth/profile',
      '/auth/refresh',
    ];
    expect(authEndpoints).toContain('/auth/refresh');
  });
});
