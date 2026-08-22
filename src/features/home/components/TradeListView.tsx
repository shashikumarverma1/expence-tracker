import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as staticBrandColors, getBrandColors } from '../../../core/utils';
import { auth } from '../../../core/config';
import { TradeEntry, TradeEmotion, TradeResult, setTradeResult, useTradeLog } from '../hooks/useSpendMood';

type BrandColors = ReturnType<typeof getBrandColors>;

// ─── Config ──────────────────────────────────────────────────────

function getEmotionColor(brandColors: BrandColors): Record<TradeEmotion, string> {
  return {
    Panic:   brandColors.red,
    FOMO:    brandColors.amber,
    Calm:    brandColors.green,
    Revenge: brandColors.red,
  };
}

function getEmotionBg(brandColors: BrandColors): Record<TradeEmotion, string> {
  return {
    Panic:   brandColors.redBg,
    FOMO:    brandColors.amberBg,
    Calm:    brandColors.greenBg,
    Revenge: brandColors.redBg,
  };
}

const ALL_RESULTS: TradeResult[] = ['profit', 'loss', 'no-trade'];

// ─── Helpers ─────────────────────────────────────────────────────

function relativeDate(ts: number, t: (k: string) => string): string {
  const d     = new Date(ts);
  const today = new Date();
  const diff  = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
     new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000,
  );
  if (diff === 0) return t('journal_list.today');
  if (diff === 1) return t('journal_list.yesterday');
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ─── Entry card ──────────────────────────────────────────────────

function TradeCard({ entry, colors, brandColors, onResultChange }: {
  entry: TradeEntry; colors: AppColors; brandColors: BrandColors; onResultChange: (id: string, r: TradeResult) => void;
}) {
  const { t }        = useTranslation();
  const s            = makeStyles(colors);
  const emotionColor = getEmotionColor(brandColors)[entry.emotion] ?? brandColors.purple;
  const emotionBg    = getEmotionBg(brandColors)[entry.emotion]   ?? brandColors.purpleDim;
  const createdMs    = entry.createdAt?.toMillis?.() ?? 0;

  const RESULT_CFG: Record<TradeResult, { label: string; bg: string; text: string; icon: string }> = {
    profit:     { label: t('trade.result_profit'),   bg: brandColors.greenBg,   text: brandColors.greenText, icon: '📈' },
    loss:       { label: t('trade.result_loss'),     bg: brandColors.redBg,     text: brandColors.redText,   icon: '📉' },
    'no-trade': { label: t('trade.result_no_trade'), bg: colors.primaryDim,     text: colors.textMuted,      icon: '➖' },
  };

  return (
    <View style={[s.card, { borderLeftColor: emotionColor }]}>
      <View style={s.cardTop}>
        <View style={[s.emotionChip, { backgroundColor: emotionBg }]}>
          <CText txt={entry.emotion} style={[s.emotionTxt, { color: emotionColor }]} />
        </View>
        <CText
          txt={createdMs ? `${relativeDate(createdMs, t)} · ${formatTime(createdMs)}` : ''}
          style={s.timeText}
        />
      </View>

      {!!entry.aiSummary && (
        <CText txt={entry.aiSummary} style={s.summaryText} numberOfLines={2} />
      )}

      {!!entry.note && (
        <View style={s.noteRow}>
          <Ionicons name="pencil-outline" size={11} color={colors.textMuted} />
          <CText txt={entry.note} style={s.noteTxt} numberOfLines={1} />
        </View>
      )}

      <View style={s.resultRow}>
        <CText tx="trade.result_label" style={s.resultLabel} />
        {ALL_RESULTS.map((r) => {
          const cfg      = RESULT_CFG[r];
          const selected = entry.result === r;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => onResultChange(entry.id, r)}
              activeOpacity={0.75}
              style={[
                s.resultChip,
                selected ? { backgroundColor: cfg.bg } : { backgroundColor: colors.border + '50' },
              ]}
            >
              <CText
                txt={`${cfg.icon} ${cfg.label}`}
                style={[s.resultChipTxt, { color: selected ? cfg.text : colors.textMuted }]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── TradeListView ───────────────────────────────────────────────

export function TradeListView() {
  const { colors, brand: brandColors } = useTheme();
  const { t }                 = useTranslation();
  const { trades, isLoading } = useTradeLog();
  const uid                   = auth.currentUser?.uid;
  const s                     = makeStyles(colors);
  const [resultFilter, setResultFilter] = useState<TradeResult | null>(null);

  const RESULT_CFG: Record<TradeResult, { label: string; bg: string; text: string; icon: string }> = {
    profit:     { label: t('trade.result_profit'),   bg: brandColors.greenBg,   text: brandColors.greenText, icon: '📈' },
    loss:       { label: t('trade.result_loss'),     bg: brandColors.redBg,     text: brandColors.redText,   icon: '📉' },
    'no-trade': { label: t('trade.result_no_trade'), bg: colors.primaryDim,     text: colors.textMuted,      icon: '➖' },
  };

  const filtered = useMemo(() => {
    if (!resultFilter) return trades;
    return trades.filter((t) => t.result === resultFilter);
  }, [trades, resultFilter]);

  const sections = useMemo(() => {
    const map = new Map<string, TradeEntry[]>();
    filtered.forEach((entry) => {
      const ms  = entry.createdAt?.toMillis?.() ?? 0;
      const key = ms
        ? new Date(ms).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    });
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [filtered]);

  const handleResultChange = async (tradeId: string, result: TradeResult) => {
    if (!uid) return;
    await setTradeResult(uid, tradeId, result).catch(() => {});
  };

  if (isLoading) {
    return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />;
  }

  if (trades.length === 0) {
    return (
      <View style={s.empty}>
        <CText txt="🎙️" style={s.emptyIcon} />
        <CText tx="journal_list.no_entries_title" style={[s.emptyTitle, { color: colors.text }]} />
        <CText tx="journal_list.no_entries_sub"   style={[s.emptySub,   { color: colors.textMuted }]} />
      </View>
    );
  }

  return (
    <>
      {/* Result filter chips */}
      <View style={s.filterRow}>
        <TouchableOpacity
          style={[s.filterChip, !resultFilter && s.filterChipActive]}
          onPress={() => setResultFilter(null)}
          activeOpacity={0.8}
        >
          <CText tx="journal_list.filter_all" style={[s.filterTxt, !resultFilter && s.filterTxtActive]} />
        </TouchableOpacity>
        {ALL_RESULTS.map((r) => {
          const cfg    = RESULT_CFG[r];
          const active = resultFilter === r;
          return (
            <TouchableOpacity
              key={r}
              style={[s.filterChip, active && { backgroundColor: cfg.bg, borderColor: cfg.text + '60' }]}
              onPress={() => setResultFilter(active ? null : r)}
              activeOpacity={0.8}
            >
              <CText
                txt={`${cfg.icon} ${cfg.label}`}
                style={[s.filterTxt, active && { color: cfg.text }]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {sections.length === 0 ? (
        <View style={s.empty}>
          <CText txt="🔍" style={s.emptyIcon} />
          <CText tx="journal_list.no_matches_title" style={[s.emptyTitle, { color: colors.text }]} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <CText txt={section.title} style={s.sectionTitle} />
              <CText
                txt={t('journal_list.count_other', { count: section.data.length })}
                style={s.sectionCount}
              />
            </View>
          )}
          renderItem={({ item }) => (
            <TradeCard entry={item} colors={colors} brandColors={brandColors} onResultChange={handleResultChange} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const makeStyles = (colors: AppColors) => StyleSheet.create({
  filterRow:        { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 12, flexWrap: 'wrap' },
  filterChip:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterTxt:        { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterTxtActive:  { color: '#fff' },

  list:          { paddingHorizontal: 16, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginTop: 4 },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionCount:  { fontSize: 11, color: colors.textMuted },

  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border,
    shadowColor: staticBrandColors.purple, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  emotionChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  emotionTxt:  { fontSize: 11, fontWeight: '700' },
  timeText:    { fontSize: 11, color: colors.textMuted },
  summaryText: { fontSize: 13, color: colors.text, lineHeight: 20, marginBottom: 8 },
  noteRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  noteTxt:     { fontSize: 11, color: colors.textMuted, flex: 1 },

  resultRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  resultLabel:   { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  resultChip:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  resultChipTxt: { fontSize: 11, fontWeight: '600' },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 8 },
  emptyIcon:  { fontSize: 52, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub:   { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 },
});
