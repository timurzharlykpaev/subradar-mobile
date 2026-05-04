import * as SecureStore from 'expo-secure-store';
import { gmailTokenStore } from '../services/gmail/gmailTokenStore';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('gmailTokenStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves refresh token under stable key', async () => {
    await gmailTokenStore.saveRefreshToken('rt-abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('gmail_refresh_token', 'rt-abc');
  });

  it('reads refresh token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('rt-abc');
    await expect(gmailTokenStore.getRefreshToken()).resolves.toBe('rt-abc');
  });

  it('returns null when missing', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    await expect(gmailTokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('saves and reads connected email separately from token', async () => {
    await gmailTokenStore.saveConnectedEmail('me@example.com');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('gmail_connected_email', 'me@example.com');
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('me@example.com');
    await expect(gmailTokenStore.getConnectedEmail()).resolves.toBe('me@example.com');
  });

  it('clear() wipes both refresh token and connected email', async () => {
    await gmailTokenStore.clear();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('gmail_refresh_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('gmail_connected_email');
  });
});
