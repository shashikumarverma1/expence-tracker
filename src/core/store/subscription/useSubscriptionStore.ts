import { create } from 'zustand';

export type PlanType = 'monthly' | 'annual' | 'lifetime' | 'other' | null;

interface SubscriptionState {
  isPro: boolean;
  planType: PlanType;
  planPrice: string | null;   // e.g. "$4.99"
  planExpiryDate: string | null; // ISO date string, null for lifetime / unknown
  setIsPro: (val: boolean) => void;
  setPlanType: (plan: PlanType) => void;
  setPlanPrice: (price: string | null) => void;
  setPlanExpiryDate: (date: string | null) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  isPro: false,
  planType: null,
  planPrice: null,
  planExpiryDate: null,
  setIsPro:    (val)   => set({ isPro: val }),
  setPlanType: (plan)  => set({ planType: plan }),
  setPlanPrice:(price) => set({ planPrice: price }),
  setPlanExpiryDate: (date) => set({ planExpiryDate: date }),
}));
