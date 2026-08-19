import React from 'react';
import {
  Modal,
  View,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../hook';
import CText from './CText';
import { t } from 'i18next';
import { AppColors, radius, shadow } from '../utils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────
type LoadingVariant = 'compact' | 'half' | 'fullscreen';
type LoadingSize = 'sm' | 'lg';
type LoadingAnimation = 'fade' | 'slide' | 'none';

export interface CLoadingProps {
  visible: boolean;

  // Modal shape
  variant?: LoadingVariant;

  // Spinner size
  size?: LoadingSize;

  // Modal enter/exit animation
  animation?: LoadingAnimation;

  // Optional message below the spinner
  message?: string;
  tx?: string; // i18n key

  // Style override for the inner content card
  containerStyle?: StyleProp<ViewStyle>;
}

// ── Size map ──────────────────────────────────────────────────
const spinnerSizeMap: Record<LoadingSize, 'small' | 'large'> = {
  sm: 'small',
  lg: 'large',
};

// ── Component ─────────────────────────────────────────────────
export function CLoading({
  visible,
  variant = 'compact',
  size = 'lg',
  animation = 'fade',
  message,
  tx,
  containerStyle,
}: CLoadingProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const label = tx ? t(tx) : message;

  const spinnerNode = (
    <>
      <ActivityIndicator size={spinnerSizeMap[size]} color={colors.primary} />
      {label ? (
        <CText
          txt={label}
          size="md"
          weight="medium"
          color={colors.textMuted}
          style={styles.message}
        />
      ) : null}
    </>
  );

  // ── Fullscreen (large modal, margins on all 4 sides) ──────
  if (variant === 'fullscreen') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType={animation}
        statusBarTranslucent
      >
        <View style={styles.fullscreenOverlay}>
          <View style={[styles.fullscreenContent, containerStyle]}>
            {spinnerNode}
          </View>
        </View>
      </Modal>
    );
  }

  // ── Half (40 % centered modal) ────────────────────────────
  if (variant === 'half') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType={animation}
        statusBarTranslucent
      >
        <View style={styles.halfOverlay}>
          <View style={[styles.halfContent, containerStyle]}>
            {spinnerNode}
          </View>
        </View>
      </Modal>
    );
  }

  // ── Compact (centered card) ────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType={animation}
      statusBarTranslucent
    >
      <View style={styles.compactOverlay}>
        <View style={[styles.compactContent, containerStyle]}>
          {spinnerNode}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────
const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    // Fullscreen — 80% height, centered, margins on all 4 sides
    fullscreenOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    fullscreenContent: {
      width: '100%',
      height: SCREEN_HEIGHT * 0.6,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadow.card,
    },

    // Half — 40% height, centered on screen
    halfOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    halfContent: {
      width: '100%',
      height: SCREEN_HEIGHT * 0.4,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadow.card,
    },

    // Compact — square centered card
    compactOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    compactContent: {
      width: 220,
      height: 220,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadow.card,
    },

    // Shared
    message: {
      marginTop: 12,
      textAlign: 'center',
    },
  });
