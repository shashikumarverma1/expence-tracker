import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { HomeScreen, SpendMoodScreen, EditTransactionScreen, NetWorthScreen, AssetClassDetailScreen, DashboardScreen, TransactionListScreen } from '../../features/home/screens';
import { ProfileScreen } from '../../features/profile/screens/profileScreen';
import SubscriptionScreen from '../../features/subscription/screens/SubscriptionScreen';
import { PlanScreen } from '../../features/subscription/screens/PlanScreen';

const Stack = createStackNavigator();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ animation: 'slide_from_right', headerShown: false }}>
      <Stack.Screen name="HomeScreen"        component={HomeScreen} />
      <Stack.Screen name="EditTransactionScreen" component={EditTransactionScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
      <Stack.Screen name="NetWorthScreen" component={NetWorthScreen} />
      <Stack.Screen name="AssetClassDetailScreen" component={AssetClassDetailScreen} />
      <Stack.Screen name="TransactionListScreen" component={TransactionListScreen} />
      <Stack.Screen name="SpendMoodScreen"    component={SpendMoodScreen} />
      <Stack.Screen name="ProfileScreen"     component={ProfileScreen} />
      <Stack.Screen name="SubscriptionScreen" component={SubscriptionScreen} />
      <Stack.Screen name="PlanScreen"        component={PlanScreen} />
    </Stack.Navigator>
  );
}
