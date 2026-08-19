import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { HomeScreen, TradeLogScreen } from '../../features/home/screens';
import { ProfileScreen } from '../../features/profile/screens/profileScreen';
import SubscriptionScreen from '../../features/subscription/screens/SubscriptionScreen';
import { PlanScreen } from '../../features/subscription/screens/PlanScreen';

const Stack = createStackNavigator();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ animation: 'slide_from_right', headerShown: false }}>
      <Stack.Screen name="HomeScreen"        component={HomeScreen} />
      <Stack.Screen name="TradeLogScreen"    component={TradeLogScreen} />
      <Stack.Screen name="ProfileScreen"     component={ProfileScreen} />
      <Stack.Screen name="SubscriptionScreen" component={SubscriptionScreen} />
      <Stack.Screen name="PlanScreen"        component={PlanScreen} />
    </Stack.Navigator>
  );
}
