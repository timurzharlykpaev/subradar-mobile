/**
 * AnalyticsService — verify v1.4.0 event signatures.
 *
 * We swap out the underlying track() via a spy on the service instance so
 * we can assert the emitted event name + properties without needing a real
 * Amplitude SDK in the test environment.
 */
import { analytics } from '../services/analytics';

jest.mock('../stores/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ analyticsOptOut: false }) },
}));

describe('analytics v1.4.0 events', () => {
  let trackSpy: jest.SpyInstance;

  beforeEach(() => {
    trackSpy = jest.spyOn(analytics as any, 'track').mockImplementation(() => {});
  });

  afterEach(() => {
    trackSpy.mockRestore();
  });

  describe('sync retry', () => {
    it('emits sync_retry_attempt with attempt + product_id', () => {
      analytics.syncRetryAttempt(2, 'io.subradar.mobile.pro.monthly');
      expect(trackSpy).toHaveBeenCalledWith('sync_retry_attempt', {
        attempt: 2,
        product_id: 'io.subradar.mobile.pro.monthly',
      });
    });

    it('emits sync_retry_succeeded with attempt + product_id', () => {
      analytics.syncRetrySucceeded(3, 'p');
      expect(trackSpy).toHaveBeenCalledWith('sync_retry_succeeded', {
        attempt: 3,
        product_id: 'p',
      });
    });

    it('emits sync_retry_exhausted and truncates long error strings', () => {
      const longError = 'x'.repeat(300);
      analytics.syncRetryExhausted('p', longError);
      const call = trackSpy.mock.calls.find(([name]) => name === 'sync_retry_exhausted');
      expect(call![1].last_error).toHaveLength(200);
    });

    it('tolerates undefined error on sync_retry_exhausted', () => {
      analytics.syncRetryExhausted('p');
      expect(trackSpy).toHaveBeenCalledWith('sync_retry_exhausted', {
        product_id: 'p',
        last_error: undefined,
      });
    });
  });

  describe('pending receipt recovery', () => {
    it('emits pending_receipt_recovered', () => {
      analytics.pendingReceiptRecovered('p');
      expect(trackSpy).toHaveBeenCalledWith('pending_receipt_recovered', { product_id: 'p' });
    });

    it('truncates error on pending_receipt_recovery_failed', () => {
      analytics.pendingReceiptRecoveryFailed('p', 'x'.repeat(500));
      const call = trackSpy.mock.calls.find(([name]) => name === 'pending_receipt_recovery_failed');
      expect(call![1].error).toHaveLength(200);
    });
  });

  describe('restore purchases', () => {
    it('emits restore_initiated with origin', () => {
      analytics.restoreInitiated('paywall');
      expect(trackSpy).toHaveBeenCalledWith('restore_initiated', { origin: 'paywall' });
    });

    it('emits restore_completed with origin + success + product_id', () => {
      analytics.restoreCompleted('settings', true, 'p');
      expect(trackSpy).toHaveBeenCalledWith('restore_completed', {
        origin: 'settings',
        success: true,
        product_id: 'p',
      });
    });

    it('restore_completed falls back product_id to null when missing', () => {
      analytics.restoreCompleted('paywall', false);
      expect(trackSpy).toHaveBeenCalledWith('restore_completed', {
        origin: 'paywall',
        success: false,
        product_id: null,
      });
    });

    it('truncates error on restore_failed', () => {
      analytics.restoreFailed('settings', 'x'.repeat(400));
      const call = trackSpy.mock.calls.find(([name]) => name === 'restore_failed');
      expect(call![1].error).toHaveLength(200);
    });
  });

  describe('banner routing', () => {
    it('emits banner_shown with priority + merged payload', () => {
      analytics.bannerShown('grace', { days_left: 3 });
      expect(trackSpy).toHaveBeenCalledWith('banner_shown', {
        priority: 'grace',
        days_left: 3,
      });
    });

    it('banner_shown without payload still has priority', () => {
      analytics.bannerShown('win_back');
      expect(trackSpy).toHaveBeenCalledWith('banner_shown', { priority: 'win_back' });
    });

    it('emits banner_action_tapped with priority + action + payload', () => {
      analytics.bannerActionTapped('billing_issue', 'cta', { where: 'dashboard' });
      expect(trackSpy).toHaveBeenCalledWith('banner_action_tapped', {
        priority: 'billing_issue',
        action: 'cta',
        where: 'dashboard',
      });
    });
  });
});
