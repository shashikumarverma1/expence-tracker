import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View } from 'react-native';
import { HomeStack } from '../stack/homeStack';
import { ExpenseStack } from '../stack/expenseStack';
import { AssetStack } from '../stack/assetStack';
import { PatternStack } from '../stack/patternStack';
import { useTheme } from '../../core/hook/useTheme';

// Placeholder — never actually rendered; drawer opens instead
function SettingsPlaceholder() { return <View style={{ flex: 1 }} />; }

const Tab = createBottomTabNavigator();

export function Tabs() {
  const { colors } = useTheme();
  const navigation = useNavigation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor:  colors.border,
          borderTopWidth:  0.5,
        },
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: React.ComponentProps<typeof Ionicons>['name'];

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Expenses') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else if (route.name === 'Assets') {
            iconName = focused ? 'trending-up' : 'trending-up-outline';
          } else if (route.name === 'Patterns') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Expenses" component={ExpenseStack} />
      <Tab.Screen name="Assets" component={AssetStack} />
      <Tab.Screen name="Patterns" component={PatternStack} />
      <Tab.Screen
        name="Settings"
        component={SettingsPlaceholder}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(DrawerActions.openDrawer());
          },
        }}
      />
    </Tab.Navigator>
  );
}
