import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import type { Subscription } from '../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

const makeSub = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 'sub-1',
  name: 'Netflix',
  category: 'STREAMING',
  amount: 9.99,
  currency: 'USD',
  billingPeriod: 'MONTHLY',
  status: 'ACTIVE',
  nextPaymentDate: '2026-04-01',
  ...overrides,
});

describe('useSubscriptionsStore', () => {
  beforeEach(() => {
    useSubscriptionsStore.setState({
      subscriptions: [],
      filter: 'all',
      searchQuery: '',
      selectedCategory: null,
    });
  });

  it('starts with empty subscriptions', () => {
    expect(useSubscriptionsStore.getState().subscriptions).toEqual([]);
  });

  it('setSubscriptions replaces the list', () => {
    const subs = [makeSub(), makeSub({ id: 'sub-2', name: 'Spotify' })];
    useSubscriptionsStore.getState().setSubscriptions(subs);
    expect(useSubscriptionsStore.getState().subscriptions).toHaveLength(2);
  });

  it('addSubscription prepends', () => {
    useSubscriptionsStore.getState().setSubscriptions([makeSub()]);
    useSubscriptionsStore.getState().addSubscription(makeSub({ id: 'sub-2', name: 'Spotify' }));
    const subs = useSubscriptionsStore.getState().subscriptions;
    expect(subs).toHaveLength(2);
    expect(subs[0].name).toBe('Spotify');
  });

  it('updateSubscription merges data', () => {
    useSubscriptionsStore.getState().setSubscriptions([makeSub()]);
    useSubscriptionsStore.getState().updateSubscription('sub-1', { amount: 14.99 });
    expect(useSubscriptionsStore.getState().subscriptions[0].amount).toBe(14.99);
  });

  it('removeSubscription removes by id', () => {
    useSubscriptionsStore.getState().setSubscriptions([makeSub(), makeSub({ id: 'sub-2' })]);
    useSubscriptionsStore.getState().removeSubscription('sub-1');
    expect(useSubscriptionsStore.getState().subscriptions).toHaveLength(1);
    expect(useSubscriptionsStore.getState().subscriptions[0].id).toBe('sub-2');
  });

  describe('getFiltered', () => {
    beforeEach(() => {
      useSubscriptionsStore.getState().setSubscriptions([
        makeSub({ id: '1', status: 'ACTIVE', category: 'STREAMING', name: 'Netflix' }),
        makeSub({ id: '2', status: 'TRIAL', category: 'AI_SERVICES', name: 'ChatGPT' }),
        makeSub({ id: '3', status: 'CANCELLED', category: 'STREAMING', name: 'Disney+' }),
      ]);
    });

    it('returns all when filter is "all"', () => {
      expect(useSubscriptionsStore.getState().getFiltered()).toHaveLength(3);
    });

    it('filters by status "active"', () => {
      useSubscriptionsStore.getState().setFilter('active');
      expect(useSubscriptionsStore.getState().getFiltered()).toHaveLength(1);
    });

    it('filters by status "trial"', () => {
      useSubscriptionsStore.getState().setFilter('trial');
      expect(useSubscriptionsStore.getState().getFiltered()).toHaveLength(1);
    });

    it('filters by category', () => {
      useSubscriptionsStore.getState().setFilter('category');
      useSubscriptionsStore.getState().setSelectedCategory('STREAMING');
      expect(useSubscriptionsStore.getState().getFiltered()).toHaveLength(2);
    });

    it('filters by search query', () => {
      useSubscriptionsStore.getState().setSearchQuery('net');
      expect(useSubscriptionsStore.getState().getFiltered()).toHaveLength(1);
      expect(useSubscriptionsStore.getState().getFiltered()[0].name).toBe('Netflix');
    });

    it('search is case-insensitive', () => {
      useSubscriptionsStore.getState().setSearchQuery('CHATGPT');
      expect(useSubscriptionsStore.getState().getFiltered()).toHaveLength(1);
    });
  });
});
