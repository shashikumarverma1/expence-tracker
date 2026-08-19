import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors as brandColors, font, radius, shadow } from '../../../core/utils';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import CText from '../../../core/component/CText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../core/hook';
import { AppColors } from '../../../core/utils';
import {
  collection, addDoc, doc, updateDoc, increment, serverTimestamp,
} from 'firebase/firestore';
import { TradeResult, useTradeLog } from '../hooks/useTradeLog';
import { useIsPro } from '../../subscription/hooks/useIsPro';
import { SubscriptionModal } from '../../subscription/screens/SubscriptionModal';
import { db } from '../../../core/config/firebase';
import { useAuthStore } from '../../../core/store/auth/useAuthStore';
import { transcribeWithWhisper } from '../utils/whisper';

// ─── Types ───────────────────────────────────────────────────────

type RouteParams = {
  TradeEntryDetailScreen: { audioUri?: string; transcription?: string };
};

type Emotion  = 'Panic' | 'FOMO' | 'Calm' | 'Revenge';
type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';

const EMOTIONS: Emotion[] = ['Panic', 'FOMO', 'Calm', 'Revenge'];
const VALID_CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP'];

const CURRENCY_SYMBOL: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

const EMOTION_STYLE: Record<Emotion, { bg: string; text: string }> = {
  Panic:   { bg: brandColors.redBg,   text: brandColors.redText   },
  FOMO:    { bg: brandColors.amberBg, text: brandColors.amberText },
  Calm:    { bg: brandColors.greenBg, text: brandColors.greenText },
  Revenge: { bg: brandColors.redBg,   text: brandColors.red       },
};

// ─── Helpers ─────────────────────────────────────────────────────

function formatDateTime(): string {
  const now  = new Date();
  const date = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const h    = now.getHours();
  const m    = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${date} · ${h % 12 || 12}:${m} ${ampm}`;
}

// ─── GPT calls (two parallel calls: summary + fields) ────────────

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const SUMMARY_PROMPT =
  'You are an AI trading psychology coach for Indian F&O traders. ' +
  'Read this trade note and write 2-3 plain English sentences: what happened, what emotion drove it, and one pattern to watch. ' +
  'No bullet points, no markdown, no JSON — just conversational text.';

const FIELDS_PROMPT =
  'Extract trading metadata from this text. Return ONLY one line of valid JSON, nothing else:\n' +
  '{"emotion":"Panic"|"FOMO"|"Calm"|"Revenge","result":"profit"|"loss"|"no-trade"|null,"pnl":number|null,"currency":"INR"|"USD"|"EUR"|"GBP"}\n\n' +
  'Rules:\n' +
  '- emotion: pick what best matches the trader mindset\n' +
  '- result: no-trade if they did NOT trade/skipped/sat out; profit if they made money; loss if they lost; null if unclear\n' +
  '- pnl: numeric amount only (no symbol), positive for profit, negative for loss, null if no number mentioned\n' +
  '- currency: INR for rupees/lakh/₹ (default), USD for dollars/$, EUR for €, GBP for £';

interface GPTResult {
  summary:  string;
  emotion:  Emotion;
  result:   TradeResult | null;
  pnl:      number | null;
  currency: Currency;
}

async function callGPT(transcription: string): Promise<GPTResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  const post = (system: string, maxTokens: number) =>
    fetch(OPENAI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model:      'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: transcription },
        ],
      }),
    });

  const [sumRes, fieldsRes] = await Promise.all([
    post(SUMMARY_PROMPT, 200),
    post(FIELDS_PROMPT,  120),
  ]);

  if (!sumRes.ok) throw new Error(`OpenAI summary error ${sumRes.status}`);

  const [sumJson, fieldsJson] = await Promise.all([
    sumRes.json(),
    fieldsRes.ok ? fieldsRes.json() : Promise.resolve({}),
  ]);

  const summary   = (sumJson.choices?.[0]?.message?.content as string)?.trim() ?? '';
  const rawFields = (fieldsJson.choices?.[0]?.message?.content as string)?.trim() ?? '{}';

  let emotion:  Emotion        = 'Calm';
  let result:   TradeResult | null = null;
  let pnl:      number | null  = null;
  let currency: Currency       = 'INR';

  try {
    const p = JSON.parse(rawFields.replace(/```json|```/g, '').trim());
    if (['Panic','FOMO','Calm','Revenge'].includes(p.emotion)) emotion  = p.emotion;
    if (['profit','loss','no-trade'].includes(p.result))       result   = p.result;
    if (typeof p.pnl === 'number')                             pnl      = p.pnl;
    if (VALID_CURRENCIES.includes(p.currency))                 currency = p.currency;
  } catch { /* fields parsing failed — summary still shows fine */ }

  return { summary, emotion, result, pnl, currency };
}

// ─── Skeleton ────────────────────────────────────────────────────

function SkeletonLine({ width, height = 14, colors }: { width: string | number; height?: number; colors: AppColors }) {
  return (
    <View
      style={[
        { height, borderRadius: 6, backgroundColor: colors.border, marginBottom: 8 },
        typeof width === 'string' ? { width: width as any } : { width },
      ]}
    />
  );
}

function AISkeleton({ colors }: { colors: AppColors }) {
  return (
    <View>
      <SkeletonLine width="100%" colors={colors} />
      <SkeletonLine width="90%"  colors={colors} />
      <SkeletonLine width="75%"  colors={colors} />
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────

export function TradeEntryDetailScreen() {
  const nav      = useNavigation<any>();
  const route    = useRoute<RouteProp<RouteParams, 'TradeEntryDetailScreen'>>();
  const uid      = useAuthStore((s) => s.user?.uid);
  const { colors } = useTheme();
  const { t }    = useTranslation();

  const { audioUri, transcription: routeTranscription } = route.params ?? {};

  const isPro          = useIsPro();
  const { trades }     = useTradeLog();
  const FREE_LIMIT     = 10;

  const [loading,       setLoading]       = useState(true);
  const [stepLabel,     setStepLabel]     = useState('');
  const [summary,       setSummary]       = useState('');
  const [emotion,       setEmotion]       = useState<Emotion | null>(null);
  const [result,        setResult]        = useState<TradeResult | null>(null);
  const [docId,         setDocId]         = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [noteModal,     setNoteModal]     = useState(false);
  const [note,          setNote]          = useState('');
  const [savingNote,    setSavingNote]    = useState(false);
  const [validationErr, setValidationErr] = useState('');

  const pendingRef = useRef<{
    transcription: string;
    aiSummary:     string;
    emotion:       Emotion;
    pnl:           number | null;
    currency:      Currency;
  } | null>(null);

  const dateTime = useRef(formatDateTime()).current;
  const styles   = makeStyles(colors);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let transcription: string;

        if (audioUri) {
          setStepLabel(t('trade.transcribing'));
          const whisperResult = await transcribeWithWhisper(audioUri);
          if (cancelled) return;
          if (!whisperResult) throw new Error('Whisper returned empty transcript');
          transcription = whisperResult;
        } else if (routeTranscription) {
          transcription = routeTranscription;
        } else {
          throw new Error('No audio or text to analyse');
        }

        setStepLabel(t('trade.analyzing'));
        const gpt = await callGPT(transcription);
        if (cancelled) return;

        pendingRef.current = {
          transcription,
          aiSummary: gpt.summary,
          emotion:   gpt.emotion,
          pnl:       gpt.pnl,
          currency:  gpt.currency,
        };
        setSummary(gpt.summary);
        setEmotion(gpt.emotion);
        if (gpt.result) setResult(gpt.result);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setSummary(t('auth.err_network'));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const saveEntry = async () => {
    const pending = pendingRef.current;
    if (!uid || !pending || !emotion || !result) return;
    setSaving(true);
    try {
      const tradeRef = await addDoc(collection(db, 'users', uid, 'trades'), {
        transcription: pending.transcription,
        aiSummary:     pending.aiSummary,
        emotion,
        result,
        pnl:           pending.pnl ?? null,
        currency:      pending.currency ?? 'INR',
        audioUri:      audioUri ?? '',
        createdAt:     serverTimestamp(),
      });
      setDocId(tradeRef.id);
      await updateDoc(doc(db, 'users', uid), { entryCount: increment(1) }).catch(() => {});
    } catch {}
    setSaving(false);
  };

  const handleEmotionSelect = async (e: Emotion) => {
    setValidationErr('');
    setEmotion(e);
    if (uid && docId) {
      updateDoc(doc(db, 'users', uid, 'trades', docId), { emotion: e }).catch(() => {});
    }
  };

  const handleResultSelect = (r: TradeResult) => {
    setValidationErr('');
    const next = result === r ? null : r;
    setResult(next);
    if (uid && docId) {
      updateDoc(doc(db, 'users', uid, 'trades', docId), { result: next ?? '' }).catch(() => {});
    }
  };

  const handleSaveNote = async () => {
    const trimmed = note.trim();
    if (!trimmed) { setNoteModal(false); return; }
    setSavingNote(true);
    setNoteModal(false);
    setLoading(true);
    setStepLabel(t('trade.analyzing'));
    try {
      const originalTranscription = pendingRef.current?.transcription ?? '';
      const combined = originalTranscription
        ? `Voice note: ${originalTranscription}\n\nUser added: ${trimmed}`
        : trimmed;

      const gpt = await callGPT(combined);
      setSummary(gpt.summary);
      setEmotion(gpt.emotion);
      if (gpt.result) setResult(gpt.result);

      if (pendingRef.current) {
        pendingRef.current = {
          ...pendingRef.current,
          aiSummary: gpt.summary,
          emotion:   gpt.emotion,
          pnl:       gpt.pnl ?? pendingRef.current.pnl,
          currency:  gpt.currency,
        };
      }

      if (uid && docId) {
        await updateDoc(doc(db, 'users', uid, 'trades', docId), {
          note:      trimmed,
          aiSummary: gpt.summary,
          emotion:   gpt.emotion,
          ...(gpt.result != null ? { result:   gpt.result }   : {}),
          ...(gpt.pnl    != null ? { pnl:      gpt.pnl }      : {}),
          currency:  gpt.currency,
        });
      }
    } catch {
      if (uid && docId) {
        await updateDoc(doc(db, 'users', uid, 'trades', docId), { note: trimmed }).catch(() => {});
      }
    } finally {
      setSavingNote(false);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>

      {/* ── Header ── */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <CText
            txt={audioUri ? t('trade.detail_title_audio') : t('trade.detail_title_text')}
            style={[styles.topTitle, { color: colors.text }]}
          />
          <CText txt={dateTime} style={[styles.topSubtitle, { color: colors.textMuted }]} />
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── AI Summary card ── */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <CText tx="trade.ai_summary_label" style={[styles.cardLabel, { color: colors.primary }]} />
          {loading
            ? (
              <>
                <CText txt={stepLabel} style={[styles.stepLabel, { color: colors.textMuted }]} />
                <AISkeleton colors={colors} />
              </>
            )
            : <CText txt={summary} style={[styles.summaryText, { color: colors.text }]} />
          }
        </View>

        {/* ── Emotion detected card ── */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardLabelRow}>
            <CText tx="trade.emotion_label" style={[styles.cardLabel, { color: colors.primary }]} />
            <CText txt=" *" style={[styles.required, { color: brandColors.red }]} />
          </View>
          <View style={styles.chipRow}>
            {EMOTIONS.map((e) => {
              const selected = emotion === e;
              const es       = EMOTION_STYLE[e];
              return (
                <TouchableOpacity
                  key={e}
                  onPress={() => handleEmotionSelect(e)}
                  activeOpacity={0.75}
                  disabled={loading}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: es.bg }
                      : { backgroundColor: colors.primaryDim },
                  ]}
                >
                  <CText
                    txt={e}
                    style={[styles.chipText, { color: selected ? es.text : colors.textMuted }]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Trade result card ── */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardLabelRow}>
            <CText tx="trade.result_label" style={[styles.cardLabel, { color: colors.primary }]} />
            <CText txt=" *" style={[styles.required, { color: brandColors.red }]} />
          </View>
          <View style={styles.chipRow}>
            {([
              { key: 'profit',   label: `📈 ${t('trade.result_profit')}`,   bg: brandColors.greenBg,   text: brandColors.greenText },
              { key: 'loss',     label: `📉 ${t('trade.result_loss')}`,     bg: brandColors.redBg,     text: brandColors.redText   },
              { key: 'no-trade', label: `➖ ${t('trade.result_no_trade')}`, bg: colors.primaryDim,     text: colors.textMuted       },
            ] as { key: TradeResult; label: string; bg: string; text: string }[]).map(({ key, label, bg, text }) => {
              const selected = result === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleResultSelect(key)}
                  activeOpacity={0.75}
                  disabled={loading}
                  style={[
                    styles.chip,
                    selected ? { backgroundColor: bg } : { backgroundColor: colors.border + '50' },
                  ]}
                >
                  <CText
                    txt={label}
                    style={[styles.chipText, { color: selected ? text : colors.textMuted }]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Validation error ── */}
        {!!validationErr && (
          <CText txt={`⚠ ${validationErr}`} style={[styles.validationErr, { color: brandColors.red }]} />
        )}

        {/* ── Primary button ── */}
        <TouchableOpacity
          onPress={async () => {
            if (loading) return;
            if (!emotion) { setValidationErr(t('trade.select_emotion')); return; }
            if (!result)  { setValidationErr(t('trade.select_result'));  return; }
            const overLimit = !isPro && trades.length >= FREE_LIMIT;
            if (overLimit && !docId) { setShowPaywall(true); return; }
            if (!docId) await saveEntry();
            nav.navigate('MainTabs', { screen: 'Home' });
          }}
          activeOpacity={0.85}
          disabled={saving}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <CText tx="trade.looks_right" style={styles.primaryBtnText} />}
        </TouchableOpacity>

        {/* ── Ghost button ── */}
        <TouchableOpacity
          onPress={() => {
            const overLimit = !isPro && trades.length >= FREE_LIMIT && !docId;
            if (overLimit) { setShowPaywall(true); return; }
            setNoteModal(true);
          }}
          activeOpacity={0.85}
          style={[styles.ghostBtn, { backgroundColor: colors.primaryDim }]}
        >
          <CText tx="trade.add_note" style={[styles.ghostBtnText, { color: colors.primary }]} />
        </TouchableOpacity>

      </ScrollView>

      {/* ── Paywall ── */}
      <SubscriptionModal
        visible={showPaywall}
        onClose={async () => {
          setShowPaywall(false);
          if (isPro && !docId) {
            await saveEntry();
            nav.navigate('MainTabs', { screen: 'Home' });
          }
        }}
      />

      {/* ── Note modal ── */}
      <Modal
        visible={noteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <CText tx="trade.add_note" style={[styles.modalTitle, { color: colors.text }]} />
            <CText
              tx="trade.mandatory_hint"
              style={[styles.modalHint, { color: colors.textMuted }]}
            />
            <TextInput
              style={[styles.noteInput, {
                borderColor: colors.border,
                color:       colors.text,
                backgroundColor: colors.background,
              }]}
              placeholder={t('trade.note_placeholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              value={note}
              onChangeText={setNote}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setNoteModal(false)} style={styles.modalCancel}>
                <CText tx="cancel" style={{ color: colors.textMuted, ...font.semiBold }} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveNote}
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
                disabled={savingNote}
              >
                {savingNote
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <CText tx="trade.save_note" style={{ color: '#fff', ...font.semiBold }} />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe:   { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { padding: 4, marginRight: 8 },
  topTitle:    { fontSize: 17, ...font.semiBold },
  topSubtitle: { fontSize: 12, marginTop: 1 },

  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },

  card: {
    borderRadius: radius.lg, padding: 16, marginBottom: 16, ...shadow.card,
  },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardLabel: {
    fontSize: 11, ...font.semiBold, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  required:      { fontSize: 13, fontWeight: '700' },
  validationErr: { fontSize: 13, textAlign: 'center', marginBottom: 10, marginHorizontal: 16 },
  stepLabel:     { fontSize: 12, marginBottom: 10 },
  summaryText:   { fontSize: 14, ...font.regular, lineHeight: 22 },

  chipRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  chipText: { fontSize: 13, ...font.semiBold },

  primaryBtn: {
    borderRadius: radius.xl, paddingVertical: 16,
    alignItems: 'center', marginHorizontal: 16, marginBottom: 12, ...shadow.button,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, ...font.semiBold },

  ghostBtn: {
    borderRadius: radius.xl, paddingVertical: 16,
    alignItems: 'center', marginHorizontal: 16,
  },
  ghostBtnText: { fontSize: 16, ...font.semiBold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: 20, paddingBottom: 36, ...shadow.card,
  },
  modalTitle: { fontSize: 16, ...font.semiBold, marginBottom: 4 },
  modalHint:  { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  noteInput: {
    borderWidth: 1, borderRadius: radius.md, padding: 12,
    fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 16,
  },
  modalBtns:   { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  modalSave: {
    borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 10,
    minWidth: 70, alignItems: 'center',
  },
});
