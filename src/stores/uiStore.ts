import { create } from 'zustand';

// Подписки, которые юзер тапнул в onboarding hook (Quick-add). Прокидываются
// через funnel и используются на Step 5 / Dashboard, чтобы expectation
// "I picked these → they appear" не ломалось.
export interface PendingQuickAddItem {
  name: string;
  amount: number;
}

interface UIState {
  addSheetVisible: boolean;
  openAddSheet: () => void;
  closeAddSheet: () => void;
  pendingQuickAdd: PendingQuickAddItem[];
  setPendingQuickAdd: (items: PendingQuickAddItem[]) => void;
  clearPendingQuickAdd: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  addSheetVisible: false,
  openAddSheet: () => set({ addSheetVisible: true }),
  closeAddSheet: () => set({ addSheetVisible: false }),
  pendingQuickAdd: [],
  setPendingQuickAdd: (items) => set({ pendingQuickAdd: items }),
  clearPendingQuickAdd: () => set({ pendingQuickAdd: [] }),
}));
