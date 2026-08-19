import Ionicons from '@expo/vector-icons/Ionicons';
import { httpsCallable } from 'firebase/functions';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
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
import { AppColors, colors as brandColors, radius } from '../../../core/utils';
import { fbFunctions } from '../../../core/config/firebase';
import { confirmTransaction } from '../hooks/useTransactions';
import {
  categoriesForType,
  ASSET_CLASSES,
  LIABILITY_TYPES,
  EMOTIONS,
  Emotion,
  TransactionType,
} from '../../../core/types/transaction';

type RouteParams = { ConfirmTransactionScreen: { audioUri?: string; transcript: string } };

const TYPES: TransactionType[] = [
  'EXPENSE', 'INCOME', 'ASSET_ADD', 'ASSET_REDUCE', 'LIABILITY_ADD', 'LIABILITY_REDUCE',
];

const TYPE_LABEL: Record<TransactionType, string> = {
  EXPENSE: 'Expense', INCOME: 'Income', ASSET_ADD: 'Asset Added',
  ASSET_REDUCE: 'Asset Sold/Withdrawn', LIABILITY_ADD: 'Debt Taken', LIABILITY_REDUCE: 'Debt Paid',
};

const FUND_SOURCES = ['Bank/Digital Cash', 'Cash', 'Card', 'UPI', 'Other'];

interface ClassifyResult {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string | null;
  asset_class: string | null;
  liability_type: string | null;
  fund_source: string | null;
  merchant_or_source: string | null;
  emotion: Emotion;
  confidence: number;
  raw_summary: string;
  needsConfirmation: boolean;
}

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

export function ConfirmTransactionScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'ConfirmTransactionScreen'>>();
  const { colors } = useTheme();
  const { transcript, audioUri } = route.params;

  const [isClassifying, setIsClassifying] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);

  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [assetClass, setAssetClass] = useState<string | null>(null);
  const [liabilityType, setLiabilityType] = useState<string | null>(null);
  const [fundSource, setFundSource] = useState<string | null>('Bank/Digital Cash');
  const [merchant, setMerchant] = useState('');
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [rawSummary, setRawSummary] = useState('');
  const [confidence, setConfidence] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const classify = httpsCallable<{ transcript: string; audioUrl: string | null }, ClassifyResult>(
          fbFunctions, 'classifyTransaction',
        );
        const res = await classify({ transcript, audioUrl: null });
        const d = res.data;
        setDocId(d.id);
        setType(d.type);
        setAmount(d.amount ? String(d.amount) : '');
        setCategory(d.category);
        setAssetClass(d.asset_class);
        setLiabilityType(d.liability_type);
        setFundSource(d.fund_source ?? 'Bank/Digital Cash');
        setMerchant(d.merchant_or_source ?? '');
        setEmotion(d.emotion ?? 'neutral');
        setRawSummary(d.raw_summary ?? '');
        setConfidence(d.confidence ?? 0);
      } catch (e: any) {
        setError(e?.message ?? 'Could not classify this entry — you can still fill it in manually.');
      } finally {
        setIsClassifying(false);
      }
    })();
  }, [transcript]);

  const isAsset = type === 'ASSET_ADD' || type === 'ASSET_REDUCE';
  const isLiability = type === 'LIABILITY_ADD' || type === 'LIABILITY_REDUCE';
  const needsFundSource = type === 'EXPENSE' || type === 'ASSET_ADD';

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!docId || isNaN(amt) || amt <= 0) return;
    setIsSaving(true);
    try {
      await confirmTransaction(docId, {
        type,
        amount: amt,
        currency: 'INR',
        category: type === 'EXPENSE' || type === 'INCOME' ? category : null,
        assetClass: isAsset ? assetClass : null,
        liabilityType: isLiability ? liabilityType : null,
        fundSource: needsFundSource ? fundSource : (type === 'LIABILITY_REDUCE' ? fundSource : null),
        merchantOrSource: merchant || null,
        emotion,
        rawSummary,
      });
      nav.navigate('HomeScreen');
    } catch (e) {
      setIsSaving(false);
    }
  };

  const styles2 = makeStyles(colors);

  return (
    <SafeAreaView style={styles2.safe}>
      <View style={styles2.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <CText txt="Confirm Entry" style={styles2.title} />
        <View style={{ width: 24 }} />
      </View>

      {isClassifying ? (
        <View style={styles2.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <CText txt="Reading your entry…" style={styles2.centerTxt} />
        </View>
      ) : (
        <KeyboardAvoidingView style={styles2.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles2.scroll} keyboardShouldPersistTaps="handled">
            {error && <CText txt={error} style={styles2.errorTxt} />}
            {confidence < 0.5 && (
              <View style={styles2.warnBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={brandColors.amberText} />
                <CText txt="Low confidence — please review before saving." style={styles2.warnTxt} />
              </View>
            )}

            <CText txt={`"${transcript}"`} style={styles2.transcript} numberOfLines={3} />

            <CText txt="Type" style={styles2.label} />
            <View style={styles2.chipRow}>
              {TYPES.map((tp) => (
                <Chip key={tp} label={TYPE_LABEL[tp]} active={type === tp} onPress={() => setType(tp)} />
              ))}
            </View>

            <CText txt="Amount (₹)" style={styles2.label} />
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={styles2.input}
            />

            {(type === 'EXPENSE' || type === 'INCOME') && (
              <>
                <CText txt="Category" style={styles2.label} />
                <View style={styles2.chipRow}>
                  {categoriesForType(type).map((c) => (
                    <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
                  ))}
                </View>
              </>
            )}

            {isAsset && (
              <>
                <CText txt="Asset Class" style={styles2.label} />
                <View style={styles2.chipRow}>
                  {ASSET_CLASSES.map((c) => (
                    <Chip key={c} label={c} active={assetClass === c} onPress={() => setAssetClass(c)} />
                  ))}
                </View>
              </>
            )}

            {isLiability && (
              <>
                <CText txt="Liability Type" style={styles2.label} />
                <View style={styles2.chipRow}>
                  {LIABILITY_TYPES.map((c) => (
                    <Chip key={c} label={c} active={liabilityType === c} onPress={() => setLiabilityType(c)} />
                  ))}
                </View>
              </>
            )}

            {(needsFundSource || type === 'LIABILITY_REDUCE' || type === 'ASSET_REDUCE') && (
              <>
                <CText txt="Fund Source" style={styles2.label} />
                <View style={styles2.chipRow}>
                  {FUND_SOURCES.map((c) => (
                    <Chip key={c} label={c} active={fundSource === c} onPress={() => setFundSource(c)} />
                  ))}
                </View>
              </>
            )}

            <CText txt="Emotion" style={styles2.label} />
            <View style={styles2.chipRow}>
              {EMOTIONS.map((e) => (
                <Chip key={e} label={e} active={emotion === e} onPress={() => setEmotion(e)} />
              ))}
            </View>

            <CText txt="Merchant / Source" style={styles2.label} />
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder="e.g. Swiggy, Zerodha, Employer"
              placeholderTextColor={colors.textMuted}
              style={styles2.input}
            />

            <TouchableOpacity
              style={[styles2.saveBtn, (isSaving || !amount) && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={isSaving || !amount}
            >
              {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <CText txt="Save" style={styles2.saveTxt} />}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerTxt: { fontSize: 14, color: colors.textMuted },
  scroll: { padding: 20, paddingBottom: 60 },
  errorTxt: { color: colors.error, fontSize: 13, marginBottom: 12 },
  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: brandColors.amberBg, borderRadius: radius.md, padding: 10, marginBottom: 14 },
  warnTxt: { fontSize: 12, color: brandColors.amberText, flex: 1 },
  transcript: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.surface, marginBottom: 8 },
  saveBtn: { marginTop: 24, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
