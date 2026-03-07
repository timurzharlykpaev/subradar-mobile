import { create } from 'zustand';
import { Subscription, SubscriptionStatus } from '../types';

export type FilterType = 'all' | 'ACTIVE' | 'TRIAL' | 'CANCELLED' | 'PAUSED' | 'category';

interface SubscriptionsState {
  subscriptions: Subscription[];
  filter: FilterType;
  searchQuery: string;
  selectedCategory: string | null;
  setSubscriptions: (subs: Subscription[]) => void;
  addSubscription: (sub: Subscription) => void;
  updateSubscription: (id: string, data: Partial<Subscription>) => void;
  removeSubscription: (id: string) => void;
  setFilter: (filter: FilterType) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (cat: string | null) => void;
  getFiltered: () => Subscription[];
}

export const useSubscriptionsStore = create<SubscriptionsState>((set, get) => ({
  subscriptions: [],
  filter: 'all',
  searchQuery: '',
  selectedCategory: null,
  setSubscriptions: (subs) => set({ subscriptions: subs }),
  addSubscription: (sub) =>
    set((s) => ({ subscriptions: [sub, ...s.subscriptions] })),
  updateSubscription: (id, data) =>
    set((s) => ({
      subscriptions: s.subscriptions.map((sub) =>
        sub.id === id ? { ...sub, ...data } : sub
      ),
    })),
  removeSubscription: (id) =>
    set((s) => ({
      subscriptions: s.subscriptions.filter((sub) => sub.id !== id),
    })),
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  getFiltered: () => {
    const { subscriptions, filter, searchQuery, selectedCategory } = get();
    let result = subscriptions;
    if (searchQuery) {
      result = result.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (filter === 'all') return result;
    if (filter === 'category' && selectedCategory) {
      return result.filter((s) => s.category === selectedCategory);
    }
    return result.filter((s) => s.status === filter);
  },
}));
