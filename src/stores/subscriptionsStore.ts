import { create } from 'zustand';
import { Subscription } from '../types';

export type FilterType = 'all' | 'active' | 'trial' | 'cancelled' | 'category';

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

/**
 * In-memory store only — no AsyncStorage persistence.
 * TanStack Query is the single source of truth for server data; this store
 * only holds UI filters and a mirror of the latest fetched list.
 */
export const useSubscriptionsStore = create<SubscriptionsState>((set, get) => ({
  subscriptions: [],
  filter: 'all',
  searchQuery: '',
  selectedCategory: null,
  // Defensive dedup by ID. The server has been observed returning the same
  // subscription twice during the AI-add flow when a background refetch
  // races the optimistic insert — without this every dup ended up as
  // `key={sub.id}` collisions in subscriptions.tsx / analytics.tsx.
  setSubscriptions: (subs) => {
    const seen = new Set<string>();
    const unique: Subscription[] = [];
    for (const sub of subs) {
      if (!sub?.id || seen.has(sub.id)) continue;
      seen.add(sub.id);
      unique.push(sub);
    }
    set({ subscriptions: unique });
  },
  // Idempotent: if the same ID is already in the list we replace it in
  // place (keeps position, picks up any fresher fields from `sub`) instead
  // of prepending a second copy. Fixes the race where a background
  // `setSubscriptions` from the server lands between `subscriptionsApi
  // .create()` and the optimistic `addSubscription(res.data)` call.
  addSubscription: (sub) =>
    set((s) => {
      const idx = s.subscriptions.findIndex((x) => x.id === sub.id);
      if (idx >= 0) {
        const next = s.subscriptions.slice();
        next[idx] = sub;
        return { subscriptions: next };
      }
      return { subscriptions: [sub, ...s.subscriptions] };
    }),
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
    if (filter === 'category') {
      return selectedCategory
        ? result.filter((s) => s.category === selectedCategory)
        : result;
    }
    return result.filter((s) => s.status.toLowerCase() === filter);
  },
}));
