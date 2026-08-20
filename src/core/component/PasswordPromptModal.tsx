import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useTheme } from '../hook';
import CText from './CText';
import { AppColors, radius, shadow } from '../utils';
import { auth } from '../config/firebase';
import { usePasswordPrompt, resolvePasswordPrompt } from '../store/balance/usePasswordPrompt';

export function PasswordPromptModal() {
  const { colors } = useTheme();
  const { visible, verifying, error, cancel, setVerifying, setError } = usePasswordPrompt();
  const [password, setPassword] = useState('');
  const s = makeStyles(colors);

  const close = (ok: boolean) => {
    setPassword('');
    if (ok) resolvePasswordPrompt(true);
    else cancel();
  };

  const handleVerify = async () => {
    const user = auth.currentUser;
    if (!user?.email || !password) return;
    setVerifying(true);
    setError(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      setPassword('');
      resolvePasswordPrompt(true);
    } catch (e: any) {
      setError(
        e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential'
          ? 'Incorrect password.'
          : e?.message ?? 'Could not verify password.',
      );
      setVerifying(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(false)}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} />
        <View style={[s.card, { backgroundColor: colors.surface }, shadow.card]}>
          <CText txt="Enter your password" style={[s.title, { color: colors.text }]} />
          <CText txt="Verify it's you before showing your net worth." style={[s.hint, { color: colors.textMuted }]} />

          <TextInput
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            secureTextEntry
            autoFocus
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            style={[s.input, { color: colors.text, borderColor: error ? colors.error : colors.border, backgroundColor: colors.background }]}
            onSubmitEditing={handleVerify}
            returnKeyType="done"
          />
          {error && <CText txt={error} style={[s.error, { color: colors.error }]} />}

          <View style={s.btnRow}>
            <TouchableOpacity onPress={() => close(false)} style={s.cancelBtn}>
              <CText txt="Cancel" style={{ color: colors.textMuted, fontWeight: '600' }} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleVerify}
              disabled={!password || verifying}
              style={[s.verifyBtn, { backgroundColor: colors.primary, opacity: !password || verifying ? 0.5 : 1 }]}
            >
              {verifying ? <ActivityIndicator size="small" color="#fff" /> : <CText txt="Verify" style={{ color: '#fff', fontWeight: '700' }} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 28 },
  card: { borderRadius: radius.xl, padding: 22 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 12, fontSize: 15, marginBottom: 6 },
  error: { fontSize: 12, marginBottom: 6 },
  btnRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  verifyBtn: { borderRadius: radius.md, paddingHorizontal: 22, paddingVertical: 12, minWidth: 84, alignItems: 'center' },
});
