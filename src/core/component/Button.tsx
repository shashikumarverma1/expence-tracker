import React, { useRef, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Animated,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import CText from './CText';
import i18n from '../i18n';
import { t } from 'i18next';
import { AppColors, font, radius, shadow } from '../utils';
import { useTheme } from '../hook';

type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonColor = 'primary' | 'danger' | 'success' | 'warning' | 'dark' | 'light';

export interface AppButtonProps {
  txt?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  color?: ButtonColor;
  rounded?: boolean;
  fullWidth?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  buttonStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tx?: string;
}

const sizeMap: Record<ButtonSize, { height: number; fontSize: number; paddingHorizontal: number; iconSize: number }> = {
  sm: { height: 38, fontSize: 13, paddingHorizontal: 16, iconSize: 14 },
  md: { height: 50, fontSize: 15, paddingHorizontal: 20, iconSize: 16 },
  lg: { height: 58, fontSize: 17, paddingHorizontal: 28, iconSize: 18 },
};

export function CButton({
  txt,
  leftIcon,
  rightIcon,
  onPress,
  disabled = false,
  loading = false,
  loadingText,
  variant = 'solid',
  size = 'md',
  color = 'primary',
  rounded = false,
  fullWidth = true,
  containerStyle,
  buttonStyle,
  textStyle,
  tx,
}: AppButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const colorMap = useMemo<Record<ButtonColor, { solid: string; light: string; text: string }>>(() => ({
    primary: { solid: colors.primary,  light: colors.primaryDim, text: colors.primary },
    danger:  { solid: colors.error,    light: colors.error,      text: colors.error },
    success: { solid: colors.success,  light: colors.success,    text: colors.success },
    warning: { solid: colors.warning,  light: colors.warning,    text: colors.warning },
    dark:    { solid: colors.text,     light: colors.surface,    text: colors.text },
    light:   { solid: colors.surface,  light: colors.background, text: colors.textMuted },
  }), [colors]);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const palette = colorMap[color];
  const sizing = sizeMap[size];
  const isDisabled = disabled || loading;

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const getButtonStyle = (): ViewStyle => {
    const base: ViewStyle = {
      height: sizing.height,
      paddingHorizontal: sizing.paddingHorizontal,
      borderRadius: rounded ? radius.full : radius.md,
      alignSelf: fullWidth ? 'stretch' : 'flex-start',
    };
    switch (variant) {
      case 'solid':
        return {
          ...base,
          backgroundColor: palette.solid,
          ...shadow.button,
        };
      case 'outline':
        return {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: palette.solid,
        };
      case 'ghost':
        return {
          ...base,
          backgroundColor: palette.light,
        };
      case 'link':
        return { ...base, backgroundColor: 'transparent', paddingHorizontal: 4, height: 'auto' as any };
      default:
        return base;
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'solid': return colors.white;
      case 'outline':
      case 'ghost':
      case 'link': return palette.text;
      default: return colors.text;
    }
  };

  const spinnerColor = variant === 'solid' ? colors.white : palette.solid;
  const label = loading && loadingText ? loadingText : tx ? t(tx) : txt;

  return (
    <View style={[fullWidth && styles.fullWidth, containerStyle]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: isDisabled ? 0.5 : 1 }}>
        <TouchableOpacity
          style={[styles.button, getButtonStyle(), buttonStyle]}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={isDisabled}
          activeOpacity={0.9}
        >
          {!loading && leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          {loading && <ActivityIndicator size="small" color={spinnerColor} style={styles.spinner} />}
          <Text style={[styles.text, { fontSize: sizing.fontSize, color: getTextColor() }, variant === 'link' && styles.linkUnderline, textStyle]}>
            {label}
          </Text>
          {!loading && rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  fullWidth: { width: '100%' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { ...font.semiBold, letterSpacing: 0.2 },
  linkUnderline: { textDecorationLine: 'underline' },
  leftIcon: { marginRight: 8 },
  rightIcon: { marginLeft: 8 },
  spinner: { marginRight: 8 },
});
