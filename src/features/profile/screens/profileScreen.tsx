import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import CText from '../../../core/component/CText';
import { CTextInput } from '../../../core/component/TextInput';
import { CButton } from '../../../core/component/Button';
import { useTheme } from '../../../core/hook';
import { useProfile } from '../hook/useProfile';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../../core/store';
import { auth } from '../../../core/config';
import { useTranslation } from 'react-i18next';

export const ProfileScreen = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const {
    avatarUrl,
    displayName,
    setDisplayName,
    email,
    uploading,
    progress,
    uploadError,
    saving,
    showSourceModal,
    setShowSourceModal,
    handlePickFromLibrary,
    handleTakePhoto,
    handleSave,
  } = useProfile();
  const navigation = useNavigation();
  const s = makeStyles(colors);

  const { deleteAccount, isDeleting, deleteError, clearDeleteError } = useAuthStore();
  const isEmailUser = auth.currentUser?.providerData.some((p) => p.providerId === 'password') ?? false;
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  const openDeleteModal = () => {
    clearDeleteError();
    setPassword('');
    setDeleteModalVisible(true);
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount(password || undefined);
      setDeleteModalVisible(false);
    } catch {
      // errors shown via deleteError from store
    }
  };

  const errorTxKey = () => {
    if (!deleteError) return '';
    if (deleteError === 'auth/requires-recent-login') return 'requires_recent_login';
    if (deleteError === 'auth/wrong-password' || deleteError === 'auth/invalid-credential') return 'wrong_password';
    return deleteError;
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <CText tx="profile" size="xl" weight="bold" />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={s.avatarSection}>
          <Pressable
            style={s.avatarWrap}
            onPress={() => setShowSourceModal(true)}
            disabled={uploading}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: colors.primaryDim }]}>
                <Ionicons name="person" size={48} color={colors.primary} />
              </View>
            )}

            <View style={[s.editBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>

            {uploading && (
              <View style={s.uploadOverlay}>
                <ActivityIndicator color="#fff" size="small" />
                <CText txt={`${Math.round(progress)}%`} size="xs" color="#fff" style={s.progressText} />
              </View>
            )}
          </Pressable>
          <CText tx="change_photo" size="sm" color={colors.primary} style={s.changePhotoHint} />
          {!!uploadError && (
            <CText txt={uploadError} size="xs" color={colors.error} style={s.errorText} />
          )}
        </View>
  
        {/* Profile fields */}
        <CText tx="profile" weight="bold" size="sm"  style={s.sectionLabel} />
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.field}>
            <CText tx="fname" size="sm" color={colors.textMuted} style={s.fieldLabel} />
            <CTextInput
              value={displayName}
              onChangeText={setDisplayName}
              ptxt="Full Name"
              variant="outlined"
            />
          </View>

          <View style={[s.divider, { backgroundColor: colors.border }]} />

          <View style={s.field}>
            <CText tx="email" size="sm" color={colors.textMuted} style={s.fieldLabel} />
            <CText txt={email} size="md" color={colors.textMuted} />
          </View>
        </View>

        <View style={s.saveBtn}>
          <CButton tx="save_changes" onPress={handleSave} loading={saving} />
        </View>

        {/* Danger zone */}
        <CText tx="account" weight="semiBold" size="xs" color={colors.textMuted} style={s.sectionLabel} />
        <View style={[s.dangerCard, { borderColor: colors.error }]}>
          <Pressable style={s.deleteRow} onPress={openDeleteModal}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <CText tx="delete_account" size="md" color={colors.error} weight="semiBold" style={s.deleteLabel} />
            <Ionicons name="chevron-forward" size={18} color={colors.error} />
          </Pressable>
        </View>

      </ScrollView>
  
      {/* Delete Account Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={s.deleteOverlay}>
          <View style={[s.deleteModal, { backgroundColor: colors.surface }]}>
            <Ionicons name="warning-outline" size={36} color={colors.error} style={s.modalIcon} />
            <CText tx="delete_account_title" size="lg" weight="bold" style={s.modalTitle} />
            <CText tx="delete_account_warning" size="sm" color={colors.textMuted} style={s.modalWarning} />

            {isEmailUser && (
              <View style={[s.passwordWrap, { borderColor: deleteError ? colors.error : colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[s.passwordInput, { color: colors.text }]}
                  placeholder={t('delete_account_password_prompt')}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setPasswordVisible((v) => !v)}>
                  <Ionicons
                    name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
            )}

            {deleteError && (
              <CText tx={errorTxKey()} size="sm" color={colors.error} style={s.errorText} />
            )}

            <View style={s.modalActions}>
              <Pressable
                style={[s.modalBtn, s.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeleting}
              >
                <CText tx="cancel" weight="semiBold" color={colors.textMuted} />
              </Pressable>
              <Pressable
                style={[s.modalBtn, { backgroundColor: colors.error }, (isDeleting || (isEmailUser && !password)) && s.disabledBtn]}
                onPress={handleDeleteAccount}
                disabled={isDeleting || (isEmailUser && !password)}
              >
                {isDeleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <CText tx="confirm" weight="semiBold" color="#fff" />
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo source bottom sheet */}
      <Modal
        visible={showSourceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourceModal(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowSourceModal(false)}>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />

            <Pressable style={s.sheetRow} onPress={handleTakePhoto}>
              <Ionicons name="camera-outline" size={22} color={colors.text} style={s.sheetIcon} />
              <CText tx="take_photo" size="md" />
            </Pressable>

            <View style={[s.sheetDivider, { backgroundColor: colors.border }]} />

            <Pressable style={s.sheetRow} onPress={handlePickFromLibrary}>
              <Ionicons name="image-outline" size={22} color={colors.text} style={s.sheetIcon} />
              <CText tx="choose_from_library" size="md" />
            </Pressable>

            <View style={[s.sheetDivider, { backgroundColor: colors.border }]} />

            <Pressable style={s.sheetRow} onPress={() => setShowSourceModal(false)}>
              <CText tx="cancel" size="md" color={colors.error} weight="semiBold" style={s.sheetCancel} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 8,
    },
    backBtn: { padding: 4 },
    scroll: { padding: 20, paddingBottom: 40, alignItems: 'center' },

    // Avatar
    avatarSection: { alignItems: 'center', marginBottom: 28 },
    avatarWrap: { position: 'relative', marginBottom: 8 },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    editBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    uploadOverlay: {
      ...StyleSheet.absoluteFill,
      borderRadius: 50,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressText: { marginTop: 4 },
    changePhotoHint: { marginTop: 4 },
    errorText: { marginTop: 6, textAlign: 'center' },

    // Fields
    sectionLabel: {
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      alignSelf: 'flex-start',
      width: '100%',
    },
    card: {
      width: '100%',
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 16,
    },
    field: { paddingVertical: 14 },
    fieldLabel: { marginBottom: 6 },
    divider: { height: StyleSheet.hairlineWidth, marginHorizontal: -16 },
    saveBtn: { width: '100%', marginTop: 28 },
    sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 28, alignSelf: 'flex-start', width: '100%' },
    dangerCard: { width: '100%', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
    deleteRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    deleteLabel: { flex: 1 },
    deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    deleteModal: { width: '100%', borderRadius: 20, padding: 24, alignItems: 'center' },
    modalIcon: { marginBottom: 12 },
    modalTitle: { marginBottom: 8, textAlign: 'center' },
    modalWarning: { textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    passwordWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4, width: '100%', marginBottom: 8 },
    passwordInput: { flex: 1, fontSize: 15, paddingVertical: 10, backgroundColor: 'transparent' },
    errorText: { marginBottom: 12, textAlign: 'center' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
    modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    modalCancelBtn: { borderWidth: 1 },
    disabledBtn: { opacity: 0.5 },

    // Bottom sheet
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
      paddingTop: 12,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 12,
    },
    sheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    sheetIcon: { marginRight: 14 },
    sheetDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20 },
    sheetCancel: { flex: 1, textAlign: 'center' },
  });
}
