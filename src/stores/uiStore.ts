import { create } from 'zustand';

interface UIState {
  addSheetVisible: boolean;
  openAddSheet: () => void;
  closeAddSheet: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  addSheetVisible: false,
  openAddSheet: () => set({ addSheetVisible: true }),
  closeAddSheet: () => set({ addSheetVisible: false }),
}));
