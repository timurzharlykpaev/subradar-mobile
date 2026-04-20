import { useAuthStore } from '../stores/authStore';

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

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isOnboarded: false,
    });
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it('setUser sets user, token, and refreshToken', () => {
    const user = { id: '1', email: 'test@test.com', name: 'Test' };
    useAuthStore.getState().setUser(user, 'access-token', 'refresh-token');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.token).toBe('access-token');
    expect(state.refreshToken).toBe('refresh-token');
  });

  it('setUser without refreshToken sets it to null', () => {
    const user = { id: '1', email: 'test@test.com', name: 'Test' };
    useAuthStore.getState().setUser(user, 'access-token');
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it('setTokens updates tokens without changing user', () => {
    const user = { id: '1', email: 'test@test.com', name: 'Test' };
    useAuthStore.getState().setUser(user, 'old-access', 'old-refresh');
    useAuthStore.getState().setTokens('new-access', 'new-refresh');
    const state = useAuthStore.getState();
    expect(state.token).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
    expect(state.user).toEqual(user);
  });

  it('updateUser merges partial data', () => {
    const user = { id: '1', email: 'test@test.com', name: 'Test' };
    useAuthStore.getState().setUser(user, 'token', 'refresh');
    useAuthStore.getState().updateUser({ name: 'Updated' });
    expect(useAuthStore.getState().user?.name).toBe('Updated');
    expect(useAuthStore.getState().user?.email).toBe('test@test.com');
  });

  it('updateUser does nothing when user is null', () => {
    useAuthStore.getState().updateUser({ name: 'Test' });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('logout clears everything', () => {
    const user = { id: '1', email: 'test@test.com', name: 'Test' };
    useAuthStore.getState().setUser(user, 'token', 'refresh');
    useAuthStore.getState().setOnboarded();
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isOnboarded).toBe(false);
  });

  it('setOnboarded sets isOnboarded to true', () => {
    useAuthStore.getState().setOnboarded();
    expect(useAuthStore.getState().isOnboarded).toBe(true);
  });
});
