/**
 * Tests for useRevenueCat module-level helpers: resolveRcKey + configureRevenueCat.
 *
 * We stay away from the React hook itself here — rendering RN hooks in a node
 * jest env is painful and not worth it for this guard. The module-level logic
 * (env resolution + singleton init) is the part that matters for safety.
 *
 * Strategy:
 *   - mock react-native's Platform.OS
 *   - mock @sentry/react-native captureMessage / captureException
 *   - mock react-native-purchases so we can assert configure() was called
 *   - toggle __DEV__ + env vars, then jest.resetModules() + re-import
 */

type PurchasesMock = {
  configure: jest.Mock;
  setLogLevel: jest.Mock;
  logIn: jest.Mock;
  logOut: jest.Mock;
};

function setupMocks(opts: { platform?: 'ios' | 'android' } = {}) {
  const platform = opts.platform ?? 'ios';

  jest.doMock('react-native', () => ({
    Platform: { OS: platform },
    Alert: { alert: jest.fn() },
  }));

  const captureMessage = jest.fn();
  const captureException = jest.fn();
  jest.doMock('@sentry/react-native', () => ({
    captureMessage,
    captureException,
  }));

  const purchases: PurchasesMock = {
    configure: jest.fn().mockResolvedValue(undefined),
    setLogLevel: jest.fn().mockResolvedValue(undefined),
    logIn: jest.fn().mockResolvedValue(undefined),
    logOut: jest.fn().mockResolvedValue(undefined),
  };
  jest.doMock('react-native-purchases', () => ({
    __esModule: true,
    default: purchases,
    LOG_LEVEL: { DEBUG: 'DEBUG' },
    PURCHASES_ERROR_CODE: {},
  }));

  return { purchases, captureMessage, captureException };
}

const ENV_KEYS = [
  'EXPO_PUBLIC_REVENUECAT_KEY',
  'EXPO_PUBLIC_REVENUECAT_KEY_IOS',
  'EXPO_PUBLIC_REVENUECAT_KEY_ANDROID',
];

describe('resolveRcKey', () => {
  const originalDev = (global as any).__DEV__;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    (global as any).__DEV__ = originalDev;
    process.env = { ...originalEnv };
  });

  it('throws in prod when key starts with test_', async () => {
    (global as any).__DEV__ = false;
    process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS = 'test_sandbox_key_123';
    const { captureMessage } = setupMocks({ platform: 'ios' });

    const mod = await import('../useRevenueCat');
    expect(() => mod.resolveRcKey()).toThrow(/misconfigured/i);
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringMatching(/TEST key in production/i),
      'fatal',
    );
  });

  it('throws in prod when key is missing', async () => {
    (global as any).__DEV__ = false;
    // no env keys set
    const { captureMessage } = setupMocks({ platform: 'ios' });

    const mod = await import('../useRevenueCat');
    expect(() => mod.resolveRcKey()).toThrow(/RevenueCat key missing/i);
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringMatching(/missing in production/i),
      'fatal',
    );
  });

  it('returns the prod key when it does not start with test_', async () => {
    (global as any).__DEV__ = false;
    process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS = 'appl_realProdKey';
    const { captureMessage } = setupMocks({ platform: 'ios' });

    const mod = await import('../useRevenueCat');
    expect(mod.resolveRcKey()).toBe('appl_realProdKey');
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('returns test key in dev without throwing', async () => {
    (global as any).__DEV__ = true;
    process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS = 'test_sandbox_key_123';
    const { captureMessage } = setupMocks({ platform: 'ios' });

    const mod = await import('../useRevenueCat');
    expect(mod.resolveRcKey()).toBe('test_sandbox_key_123');
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('returns null in dev when key is missing (no crash)', async () => {
    (global as any).__DEV__ = true;
    const { captureMessage } = setupMocks({ platform: 'ios' });

    const mod = await import('../useRevenueCat');
    expect(mod.resolveRcKey()).toBeNull();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('falls back to EXPO_PUBLIC_REVENUECAT_KEY when iOS-specific key is absent', async () => {
    (global as any).__DEV__ = true;
    process.env.EXPO_PUBLIC_REVENUECAT_KEY = 'test_shared';
    const { captureMessage } = setupMocks({ platform: 'ios' });

    const mod = await import('../useRevenueCat');
    expect(mod.resolveRcKey()).toBe('test_shared');
    expect(captureMessage).not.toHaveBeenCalled();
  });
});

describe('configureRevenueCat', () => {
  const originalDev = (global as any).__DEV__;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    (global as any).__DEV__ = originalDev;
    process.env = { ...originalEnv };
  });

  it('is idempotent — second call returns the same promise without re-configuring', async () => {
    (global as any).__DEV__ = true;
    process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS = 'test_abc';
    const { purchases } = setupMocks({ platform: 'ios' });

    const mod = await import('../useRevenueCat');
    const p1 = mod.configureRevenueCat();
    const p2 = mod.configureRevenueCat();
    expect(p1).toBe(p2);
    await p1;
    expect(purchases.configure).toHaveBeenCalledTimes(1);
  });

  it('loginRevenueCat configures first then logs in', async () => {
    (global as any).__DEV__ = true;
    process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS = 'test_abc';
    const { purchases } = setupMocks({ platform: 'ios' });

    const mod = await import('../useRevenueCat');
    await mod.loginRevenueCat('user-123');
    expect(purchases.configure).toHaveBeenCalledTimes(1);
    expect(purchases.logIn).toHaveBeenCalledWith('user-123');
    // configure() must resolve before logIn() runs
    const configureOrder = purchases.configure.mock.invocationCallOrder[0];
    const loginOrder = purchases.logIn.mock.invocationCallOrder[0];
    expect(configureOrder).toBeLessThan(loginOrder);
  });

  it('rethrows (and resets promise) when resolveRcKey throws in prod', async () => {
    (global as any).__DEV__ = false;
    process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS = 'test_bad_prod';
    setupMocks({ platform: 'ios' });

    const mod = await import('../useRevenueCat');
    await expect(mod.configureRevenueCat()).rejects.toThrow(/misconfigured/i);

    // Promise was reset — a second call should try again (and throw again).
    await expect(mod.configureRevenueCat()).rejects.toThrow(/misconfigured/i);
  });
});
