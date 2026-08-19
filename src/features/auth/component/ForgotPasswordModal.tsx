import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../core/hook';
import CText from '../../../core/component/CText';
import { CButton, CTextInput } from '../../../core/component';
import { AppColors } from '../../../core/utils';

interface Props {
  visible: boolean;
  loading: boolean;
  onSubmit: (email: string) => void;
  onDismiss: () => void;
}

export function ForgotPasswordModal({ visible, loading, onSubmit, onDismiss }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSend = () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t('email-invalid'));
      return;
    }
    setError(undefined);
    onSubmit(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={s.overlay} onPress={onDismiss}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <CText tx="auth.forgot_password_title" size="lg" weight="bold" style={s.title} />
          <CText tx="auth.forgot_password_desc" size="sm" color={colors.textMuted} style={s.desc} />

          <CTextInput
            label="email"
            ptx="email-address"
            value={email}
            onChangeText={(v) => { setEmail(v); if (error) setError(undefined); }}
            keyboardType="email-address"
            autoCapitalize="none"
            status={error ? 'error' : undefined}
            errorMessage={error}
          />

          <View style={s.actions}>
            <CButton
              tx="auth.send_reset_link"
              onPress={handleSend}
              color="primary"
              size="md"
              loading={loading}
            />
            <CButton
              tx="cancel"
              onPress={onDismiss}
              variant="link"
              color="primary"
              size="sm"
            />
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
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: { marginBottom: 2 },
  desc: { marginBottom: 8 },
  actions: { marginTop: 8, gap: 4 },
});
