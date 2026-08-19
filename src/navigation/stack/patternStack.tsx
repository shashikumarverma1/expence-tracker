import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { PatternScreen } from '../../features/insights';

const Stack = createStackNavigator();

export function PatternStack() {
  return (
    <Stack.Navigator screenOptions={{ animation: 'slide_from_right', headerShown: false }}>
      <Stack.Screen name="PatternScreen" component={PatternScreen} />
    </Stack.Navigator>
  );
}
