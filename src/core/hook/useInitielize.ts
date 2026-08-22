import { useEffect } from "react";
import { loadSavedTheme } from "./useTheme";
import { useSubscription } from "./useSubscription";
import { loadSavedBalanceVisibility } from "../store/balance/useBalanceVisibility";



export const useInitielize = () => {
  const { subscriptionInitialize } = useSubscription();

  useEffect(() => {

    loadSavedTheme();
    loadSavedBalanceVisibility();
    subscriptionInitialize()


  }, []);

  return
}