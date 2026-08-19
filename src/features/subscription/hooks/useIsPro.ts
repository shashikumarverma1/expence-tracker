import { useSubscriptionStore } from '../../../core/store/subscription/useSubscriptionStore';

export function useIsPro(): boolean {
  return useSubscriptionStore((s) => s.isPro);
}
