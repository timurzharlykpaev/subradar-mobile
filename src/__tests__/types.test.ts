/**
 * Type alignment tests — verify that mobile types match backend field names.
 * These tests don't call the API but ensure our interfaces have the correct field names
 * that the backend returns.
 */
import type {
  Subscription,
  PaymentCard,
  User,
  Receipt,
  Report,
  BillingPlan,
  BillingPlanFeature,
  BillingStatus,
  BillingPeriod,
  SubscriptionStatus,
  Category,
  CardBrand,
  SourceType,
  ReportType,
  ReportStatus,
} from '../types';

describe('Type alignment with backend', () => {
  describe('Subscription', () => {
    it('has nextPaymentDate (not nextBillingDate)', () => {
      const sub: Subscription = {
        id: '1',
        name: 'Netflix',
        category: 'STREAMING',
        amount: 9.99,
        currency: 'USD',
        billingPeriod: 'MONTHLY',
        status: 'ACTIVE',
        nextPaymentDate: '2026-04-01',
      };
      expect(sub.nextPaymentDate).toBe('2026-04-01');
      expect((sub as any).nextBillingDate).toBeUndefined();
    });

    it('has currentPlan (not plan)', () => {
      const sub: Subscription = {
        id: '1', name: 'Test', category: 'OTHER', amount: 5,
        currency: 'USD', billingPeriod: 'MONTHLY', status: 'ACTIVE',
        currentPlan: 'Pro',
      };
      expect(sub.currentPlan).toBe('Pro');
    });

    it('has serviceUrl (not websiteUrl)', () => {
      const sub: Subscription = {
        id: '1', name: 'Test', category: 'OTHER', amount: 5,
        currency: 'USD', billingPeriod: 'MONTHLY', status: 'ACTIVE',
        serviceUrl: 'https://test.com',
      };
      expect(sub.serviceUrl).toBe('https://test.com');
    });

    it('has reminderDaysBefore as number[] (not number)', () => {
      const sub: Subscription = {
        id: '1', name: 'Test', category: 'OTHER', amount: 5,
        currency: 'USD', billingPeriod: 'MONTHLY', status: 'ACTIVE',
        reminderDaysBefore: [1, 3, 7],
      };
      expect(Array.isArray(sub.reminderDaysBefore)).toBe(true);
    });

    it('has trialEndDate and cancelledAt', () => {
      const sub: Subscription = {
        id: '1', name: 'Test', category: 'OTHER', amount: 5,
        currency: 'USD', billingPeriod: 'MONTHLY', status: 'TRIAL',
        trialEndDate: '2026-04-01',
        cancelledAt: '2026-03-01',
      };
      expect(sub.trialEndDate).toBe('2026-04-01');
      expect(sub.cancelledAt).toBe('2026-03-01');
    });

    it('has color field (string | null)', () => {
      const sub: Subscription = {
        id: '1', name: 'Test', category: 'OTHER', amount: 5,
        currency: 'USD', billingPeriod: 'MONTHLY', status: 'ACTIVE',
        color: '#3B82F6',
      };
      expect(sub.color).toBe('#3B82F6');
    });

    it('has tags field (string[] | null)', () => {
      const sub: Subscription = {
        id: '1', name: 'Test', category: 'OTHER', amount: 5,
        currency: 'USD', billingPeriod: 'MONTHLY', status: 'ACTIVE',
        tags: ['work', 'essential'],
      };
      expect(sub.tags).toEqual(['work', 'essential']);
      expect(Array.isArray(sub.tags)).toBe(true);
    });

    it('has startDate field', () => {
      const sub: Subscription = {
        id: '1', name: 'Test', category: 'OTHER', amount: 5,
        currency: 'USD', billingPeriod: 'MONTHLY', status: 'ACTIVE',
        startDate: '2026-01-15',
      };
      expect(sub.startDate).toBe('2026-01-15');
    });
  });

  describe('User', () => {
    it('has defaultCurrency (not currency)', () => {
      const user: User = {
        id: '1', email: 'test@test.com', name: 'Test',
        defaultCurrency: 'USD',
      };
      expect(user.defaultCurrency).toBe('USD');
      expect((user as any).currency).toBeUndefined();
    });
  });

  describe('Receipt', () => {
    it('has fileUrl (not url)', () => {
      const receipt: Receipt = {
        id: '1', filename: 'receipt.pdf',
        fileUrl: 'https://cdn.example.com/receipt.pdf',
        uploadedAt: '2026-03-01',
      };
      expect(receipt.fileUrl).toBe('https://cdn.example.com/receipt.pdf');
      expect((receipt as any).url).toBeUndefined();
    });

    it('has receiptDate (not date) and uploadedAt (not createdAt)', () => {
      const receipt: Receipt = {
        id: '1', filename: 'test.pdf',
        fileUrl: 'https://cdn.example.com/test.pdf',
        receiptDate: '2026-03-01',
        uploadedAt: '2026-03-02',
      };
      expect(receipt.receiptDate).toBe('2026-03-01');
      expect(receipt.uploadedAt).toBe('2026-03-02');
    });
  });

  describe('Report', () => {
    it('has from/to (not startDate/endDate) and fileUrl (not url)', () => {
      const report: Report = {
        id: '1', type: 'SUMMARY', status: 'READY',
        from: '2026-01-01', to: '2026-03-01',
        fileUrl: 'https://cdn.example.com/report.pdf',
        createdAt: '2026-03-02',
      };
      expect(report.from).toBe('2026-01-01');
      expect(report.to).toBe('2026-03-01');
      expect(report.fileUrl).toBeDefined();
      expect((report as any).startDate).toBeUndefined();
      expect((report as any).endDate).toBeUndefined();
    });
  });

  describe('BillingPlan', () => {
    it('features is array of objects with key/value/label (not string[])', () => {
      const plan: BillingPlan = {
        id: 'pro', name: 'Pro', price: 2.99, currency: 'USD',
        period: 'month',
        features: [
          { key: 'subscriptions', value: null, label: 'Unlimited subscriptions' },
          { key: 'ai_requests', value: 200, label: '200 AI requests/month' },
        ],
      };
      expect(plan.features[0].key).toBe('subscriptions');
      expect(plan.features[0].value).toBeNull();
      expect(plan.features[0].label).toBe('Unlimited subscriptions');
    });

    it('period is string | null (not BillingPeriod enum)', () => {
      const freePlan: BillingPlan = {
        id: 'free', name: 'Free', price: 0, currency: 'USD',
        period: null,
        features: [{ key: 'subscriptions', value: 5, label: 'Up to 5 subscriptions' }],
      };
      expect(freePlan.period).toBeNull();

      const proPlan: BillingPlan = {
        id: 'pro', name: 'Pro', price: 2.99, currency: 'USD',
        period: 'month',
        features: [],
      };
      expect(proPlan.period).toBe('month');
    });
  });

  describe('Enums match backend UPPERCASE', () => {
    it('BillingPeriod values', () => {
      const values: BillingPeriod[] = ['MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY', 'LIFETIME', 'ONE_TIME'];
      expect(values).toHaveLength(6);
    });

    it('SubscriptionStatus values', () => {
      const values: SubscriptionStatus[] = ['ACTIVE', 'PAUSED', 'CANCELLED', 'TRIAL'];
      expect(values).toHaveLength(4);
    });

    it('Category values', () => {
      const values: Category[] = ['STREAMING', 'AI_SERVICES', 'INFRASTRUCTURE', 'MUSIC', 'GAMING', 'PRODUCTIVITY', 'HEALTH', 'NEWS', 'OTHER'];
      expect(values).toHaveLength(9);
    });

    it('CardBrand values', () => {
      const values: CardBrand[] = ['VISA', 'MC', 'AMEX', 'MIR', 'OTHER'];
      expect(values).toHaveLength(5);
    });

    it('SourceType values', () => {
      const values: SourceType[] = ['MANUAL', 'AI_VOICE', 'AI_SCREENSHOT', 'AI_TEXT'];
      expect(values).toHaveLength(4);
    });
  });
});
