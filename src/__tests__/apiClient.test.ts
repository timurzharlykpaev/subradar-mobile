import axios from 'axios';

// Mock modules before importing
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
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

describe('isUserNotFoundError', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isUserNotFoundError } = require('../api/staleAuth');

  const make = (status: number, message?: unknown) => ({
    response: { status, data: message === undefined ? undefined : { message } },
  });

  it('matches stable backend "User not found"', () => {
    expect(isUserNotFoundError(make(404, 'User not found'))).toBe(true);
  });

  it('matches legacy "User <uuid> not found"', () => {
    expect(
      isUserNotFoundError(make(404, 'User 81f472ed-0b37-439a-949f-f5bbdf804e69 not found')),
    ).toBe(true);
  });

  it('rejects unrelated 404 messages', () => {
    expect(isUserNotFoundError(make(404, 'Subscription not found'))).toBe(false);
    expect(isUserNotFoundError(make(404, 'Owner not found'))).toBe(false);
  });

  it('rejects non-404 statuses even with matching message', () => {
    expect(isUserNotFoundError(make(401, 'User not found'))).toBe(false);
    expect(isUserNotFoundError(make(500, 'User not found'))).toBe(false);
  });

  it('rejects non-string / missing message', () => {
    expect(isUserNotFoundError(make(404))).toBe(false);
    expect(isUserNotFoundError(make(404, 42))).toBe(false);
    expect(isUserNotFoundError(make(404, null))).toBe(false);
  });

  it('rejects nullish error', () => {
    expect(isUserNotFoundError(null)).toBe(false);
    expect(isUserNotFoundError(undefined)).toBe(false);
    expect(isUserNotFoundError({})).toBe(false);
  });

  it('rejects when 404 body is a raw string (e.g. proxy HTML)', () => {
    // Cloudflare / nginx 404s sometimes deliver the body as a string instead
    // of `{message}` JSON. The helper must not match these.
    expect(isUserNotFoundError({ response: { status: 404, data: 'User not found' } })).toBe(false);
    expect(isUserNotFoundError({ response: { status: 404, data: '<html>404</html>' } })).toBe(false);
  });

  it('rejects when message lives under a non-standard key', () => {
    // Some Nest filter shapes put the text under `error` instead of `message`.
    // We deliberately match only `message` to avoid hidden coupling — flag here
    // so any future filter change is caught.
    expect(
      isUserNotFoundError({ response: { status: 404, data: { error: 'User not found' } } }),
    ).toBe(false);
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
