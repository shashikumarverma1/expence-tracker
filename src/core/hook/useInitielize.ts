import { useEffect } from "react";
import { loadSavedTheme } from "./useTheme";
import { useSubscription } from "./useSubscription";



export const useInitielize = () => {
  const { subscriptionInitialize } = useSubscription();

  useEffect(() => {

    loadSavedTheme();
    subscriptionInitialize()

    
  }, []);

  return
}