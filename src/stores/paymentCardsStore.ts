import { create } from 'zustand';

export interface PaymentCard {
  id: string;
  nickname: string;
  last4: string;
  brand: 'Visa' | 'Mastercard' | 'Amex' | 'Mir' | 'Other';
  color: string;
}

interface PaymentCardsState {
  cards: PaymentCard[];
  setCards: (cards: PaymentCard[]) => void;
  addCard: (card: PaymentCard) => void;
  updateCard: (id: string, data: Partial<PaymentCard>) => void;
  removeCard: (id: string) => void;
  getCard: (id: string) => PaymentCard | undefined;
}

export const usePaymentCardsStore = create<PaymentCardsState>((set, get) => ({
  cards: [],
  setCards: (cards) => set({ cards }),
  addCard: (card) => set((s) => ({ cards: [...s.cards, card] })),
  updateCard: (id, data) =>
    set((s) => ({
      cards: s.cards.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),
  removeCard: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
  getCard: (id) => get().cards.find((c) => c.id === id),
}));
