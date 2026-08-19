import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { RecordScreen, TradeEntryDetailScreen } from '../../features/home/screens';
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
        name="TradeEntryDetailScreen"
        component={TradeEntryDetailScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
