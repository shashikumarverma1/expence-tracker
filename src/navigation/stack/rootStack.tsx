import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { RecordScreen, TradeEntryDetailScreen, ConfirmTransactionScreen } from '../../features/home/screens';
import { Tabs } from '../tab';

const Stack = createStackNavigator();

/**
 * Root stack sits above the tab navigator so RecordingScreen and
 * TradeEntryDetailScreen render without the tab bar.
 */
export function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={Tabs} />
      <Stack.Screen
        name="RecordingScreen"
        component={RecordScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen
        name="ConfirmTransactionScreen"
        component={ConfirmTransactionScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      {/* TODO: still the old trade-journal detail screen — superseded by
          ConfirmTransactionScreen above, kept only so nothing else that
          references it breaks. Safe to remove once nothing navigates here. */}
      <Stack.Screen
        name="TradeEntryDetailScreen"
        component={TradeEntryDetailScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
