import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../hook';
import CText from './CText';
import { AppColors, radius, shadow } from '../utils';
import { AlertButton, useAlertStore } from '../store/alert/useAlertStore';

export function CustomAlert() {
  const { colors } = useTheme();
  const { visible, title, message, buttons, hide } = useAlertStore();
  const s = makeStyles(colors);

  const handlePress = (btn: AlertButton) => {
    hide();
    btn.onPress?.();
  };

  const textColor = (style?: AlertButton['style']) =>
    style === 'destructive' ? colors.error : style === 'cancel' ? colors.textMuted : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
      <Pressable style={s.overlay} onPress={hide}>
        <Pressable style={s.card} onPress={() => {}}>
          <CText txt={title} size="lg" weight="bold" style={s.title} />
          {message ? <CText txt={message} size="sm" color={colors.textMuted} style={s.message} /> : null}

          <View style={[s.actions, buttons.length > 2 && s.actionsColumn]}>
            {buttons.map((btn, i) => (
              <Pressable
                key={`${btn.text}-${i}`}
                style={({ pressed }) => [
                  s.button,
                  buttons.length > 2 && s.buttonFull,
                  i > 0 && buttons.length > 2 && s.buttonTopBorder,
                  i > 0 && buttons.length <= 2 && s.buttonDivider,
                  pressed && s.buttonPressed,
                ]}
                onPress={() => handlePress(btn)}
              >
                <CText
                  txt={btn.text}
                  size="md"
                  weight={btn.style === 'cancel' ? 'regular' : 'semiBold'}
                  color={textColor(btn.style)}
                />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  title: { textAlign: 'center', paddingTop: 20, paddingHorizontal: 20 },
  message: { textAlign: 'center', paddingTop: 8, paddingHorizontal: 20, paddingBottom: 20, lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 12,
  },
  actionsColumn: { flexDirection: 'column' },
  button: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFull: {
    flex: undefined,
  },
  buttonTopBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  buttonDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  buttonPressed: { opacity: 0.6 },
});
