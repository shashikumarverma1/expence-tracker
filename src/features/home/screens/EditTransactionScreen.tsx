import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, radius } from '../../../core/utils';
import { confirmTransaction, deleteTransaction } from '../hooks/useTransactions';
import { showAlert } from '../../../core/store/alert/useAlertStore';
import {
  categoriesForType,
  EMOTIONS,
  Emotion,
  Transaction,
  TransactionType,
} from '../../../core/types/transaction';

type RouteParams = { EditTransactionScreen: { transaction: Transaction } };

const TYPES: TransactionType[] = ['EXPENSE', 'ASSET', 'OTHER'];

const TYPE_LABEL: Record<TransactionType, string> = {
  EXPENSE: 'Expense', ASSET: 'Asset', OTHER: 'Other',
};

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.surface },
      ]}
    >
      <CText txt={label} style={[styles.chipTxt, { color: active ? '#fff' : colors.text }]} />
    </TouchableOpacity>
  );
}

export function EditTransactionScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'EditTransactionScreen'>>();
  const { colors } = useTheme();
  const { transaction: tx } = route.params;

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<TransactionType>(tx.type);
  const [amount, setAmount] = useState(String(tx.amount));
  const [category, setCategory] = useState<string | null>(tx.category);
  const [emotion, setEmotion] = useState<Emotion>(tx.emotion);
  const [rawSummary, setRawSummary] = useState(tx.rawSummary);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setIsSaving(true);
    try {
      await confirmTransaction(tx.id, {
        type,
        amount: amt,
        currency: tx.currency ?? 'INR',
        category,
        emotion,
        rawSummary,
      });
      nav.goBack();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save this entry.');
      setIsSaving(false);
    }
  };

  const doDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTransaction(tx.id);
      nav.goBack();
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete this entry.');
      setIsDeleting(false);
    }
  };

  const handleDelete = () => {
    showAlert('Delete this entry?', 'This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <CText txt="Edit Entry" style={s.title} />
        <TouchableOpacity onPress={handleDelete} hitSlop={12} disabled={isDeleting}>
          {isDeleting ? <ActivityIndicator size="small" color={colors.error} /> : (
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {error && <CText txt={error} style={s.errorTxt} />}

          {!!tx.rawVoiceText && (
            <CText txt={`"${tx.rawVoiceText}"`} style={s.transcript} numberOfLines={3} />
          )}

          <CText txt="Type" style={s.label} />
          <View style={s.chipRow}>
            {TYPES.map((tp) => (
              <Chip
                key={tp}
                label={TYPE_LABEL[tp]}
                active={type === tp}
                onPress={() => { setType(tp); setCategory(null); }}
              />
            ))}
          </View>

          <CText txt="Amount (₹)" style={s.label} />
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={s.input}
          />

          {categoriesForType(type).length > 0 && (
            <>
              <CText txt="Category" style={s.label} />
              <View style={s.chipRow}>
                {categoriesForType(type).map((c) => (
                  <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
                ))}
              </View>
            </>
          )}

          <CText txt="Emotion" style={s.label} />
          <View style={s.chipRow}>
            {EMOTIONS.map((e) => (
              <Chip key={e} label={e} active={emotion === e} onPress={() => setEmotion(e)} />
            ))}
          </View>

          <TouchableOpacity
            style={[s.saveBtn, (isSaving || !amount) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isSaving || isDeleting || !amount}
          >
            {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <CText txt="Save Changes" style={s.saveTxt} />}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  chipTxt: { fontSize: 13, fontWeight: '600' },
});

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  scroll: { padding: 20, paddingBottom: 60 },
  errorTxt: { color: colors.error, fontSize: 13, marginBottom: 12 },
  transcript: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.surface, marginBottom: 8 },
  saveBtn: { marginTop: 24, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
