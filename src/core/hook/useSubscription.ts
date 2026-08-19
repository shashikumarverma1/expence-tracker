import { useEffect } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from 'react-native-purchases';


export const useSubscription = () => {
  const subscriptionInitialize = () => {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    const apiKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!;
    Purchases.configure({ apiKey });

  }

return {
    subscriptionInitialize
}

}