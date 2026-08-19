import React from 'react';
import { Pressable, Switch, StyleSheet, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import CText from './CText';
import { useTheme } from '../hook';

type RowColor = 'primary' | 'danger';

interface SettingRowProps {
  /** i18n translation key for the label */
  tx: string;
  /** Ionicons icon name */
  icon: string;
  /** Color variant — affects icon and label tint */
  color?: RowColor;
  /** Show a right-side chevron arrow */
  showChevron?: boolean;
  /** Render a Switch on the right */
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  /** Plain text badge on the right (e.g. "EN") */
  badge?: string;
  /** Any custom right element */
  right?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function SettingRow({
  tx,
  icon,
  color = 'primary',
  showChevron = false,
  toggle = false,
  toggleValue = false,
  onToggle,
  badge,
  right,
  onPress,
  style,
}: SettingRowProps) {
  const { colors } = useTheme();

  const tint = color === 'danger' ? colors.error : colors.primary;

  const inner = (
    <View style={[styles.row, { borderBottomColor: colors.border }, style]}>
      <Ionicons name={icon as any} size={20} color={tint} />
      <CText tx={tx} weight="semiBold" color={tint === colors.error ? colors.error : undefined} style={styles.label} />

      {toggle && (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          thumbColor={colors.primary}
          trackColor={{ false: colors.border, true: colors.primaryDim }}
        />
      )}
      {badge && (
        <CText txt={badge} size="sm" weight="bold" color={colors.textMuted} />
      )}
      {right}
      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color={tint} />
      )}
    </View>
  );

  if (toggle) {
    // Switch already handles interaction; wrap in non-pressable View
    return inner;
  }

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  label: { flex: 1 },
});
