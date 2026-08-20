import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { AssetListScreen, EditTransactionScreen } from '../../features/home/screens';

const Stack = createStackNavigator();

export function AssetStack() {
  return (
    <Stack.Navigator screenOptions={{ animation: 'slide_from_right', headerShown: false }}>
      <Stack.Screen name="AssetListScreen" component={AssetListScreen} />
      <Stack.Screen name="EditTransactionScreen" component={EditTransactionScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}
