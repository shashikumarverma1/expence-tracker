import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { ExpenseListScreen, EditTransactionScreen } from '../../features/home/screens';

const Stack = createStackNavigator();

export function ExpenseStack() {
  return (
    <Stack.Navigator screenOptions={{ animation: 'slide_from_right', headerShown: false }}>
      <Stack.Screen name="ExpenseListScreen" component={ExpenseListScreen} />
      <Stack.Screen name="EditTransactionScreen" component={EditTransactionScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}
