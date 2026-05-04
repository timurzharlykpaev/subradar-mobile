import { create } from 'zustand';
import type { Candidate } from '../api/emailImport';

interface UIState {
  addSheetVisible: boolean;
  openAddSheet: () => void;
  closeAddSheet: () => void;

  /**
   * Candidates surfaced by an opportunistic Gmail re-scan on launch.
   * The dashboard's `OpportunisticBanner` reads this; tapping Review
   * navigates to /email-import/review with these as initial state.
   * Cleared on dismiss or after navigation.
   */
  opportunisticGmailFindings: Candidate[] | null;
  setOpportunisticGmailFindings: (candidates: Candidate[]) => void;
  dismissOpportunisticGmail: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  addSheetVisible: false,
  openAddSheet: () => set({ addSheetVisible: true }),
  closeAddSheet: () => set({ addSheetVisible: false }),

  opportunisticGmailFindings: null,
  setOpportunisticGmailFindings: (candidates) =>
    set({ opportunisticGmailFindings: candidates.length > 0 ? candidates : null }),
  dismissOpportunisticGmail: () => set({ opportunisticGmailFindings: null }),
}));
