import { create } from 'zustand';

export interface AnalyticsSummary {
  totalMonthly: number;
  activeCount: number;
  trialCount: number;
  cancelledThisMonth: number;
  avgMonthly: number;
  mostExpensive: { name: string; amount: number } | null;
  totalThisYear: number;
}

export interface MonthlyData {
  month: string;
  amount: number;
}

export interface CategoryData {
  category: string;
  amount: number;
  count: number;
}

interface AnalyticsState {
  summary: AnalyticsSummary | null;
  monthly: MonthlyData[];
  byCategory: CategoryData[];
  setSummary: (s: AnalyticsSummary) => void;
  setMonthly: (m: MonthlyData[]) => void;
  setByCategory: (c: CategoryData[]) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  summary: null,
  monthly: [],
  byCategory: [],
  setSummary: (summary) => set({ summary }),
  setMonthly: (monthly) => set({ monthly }),
  setByCategory: (byCategory) => set({ byCategory }),
}));
