import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as brandColors, font, radius, shadow } from '../../../core/utils';
import { TradeCalendarView } from '../../home/components/TradeCalendarView';
import { TradeEmotion, TradeEntry, TradeResult, useTradeLog } from '../../home/hooks/useTradeLog';
import { TradePattern, useTradePatterns } from '../hooks/useTradePatterns';
import { DailyReport, MonthlyReport, TradePnl, WeeklyReport, useTradeReports } from '../hooks/useTradeReports';

type TabMode = 'reports' | 'entries' | 'calendar';

const SCREEN_W = Dimensions.get('window').width;

// ─── Config ──────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<TradePattern['severity'], string> = {
  danger:   brandColors.red,
  warning:  brandColors.amber,
  positive: brandColors.green,
};

const SEVERITY_BG: Record<TradePattern['severity'], string> = {
  danger:   brandColors.redBg,
  warning:  brandColors.amberBg,
  positive: brandColors.greenBg,
};

const EMOTION_COLOR: Record<TradeEmotion, string> = {
  Panic:   brandColors.red,
  FOMO:    brandColors.amber,
  Calm:    brandColors.green,
  Revenge: brandColors.red,
};

const EMOTION_BG: Record<TradeEmotion, string> = {
  Panic:   brandColors.redBg,
  FOMO:    brandColors.amberBg,
  Calm:    brandColors.greenBg,
  Revenge: brandColors.redBg,
};

// ─── Helpers ─────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

function formatPnl(pnl: number, currency = 'INR'): string {
  const sym = CURRENCY_SYMBOL[currency] ?? '₹';
  const abs = Math.abs(pnl);
  let str: string;
  if (currency === 'INR') {
    str = abs >= 100000
      ? `${sym}${(abs / 100000).toFixed(abs % 100000 === 0 ? 0 : 1)}L`
      : abs >= 1000
      ? `${sym}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`
      : `${sym}${abs}`;
  } else {
    str = abs >= 1000000
      ? `${sym}${(abs / 1000000).toFixed(1)}M`
      : abs >= 1000
      ? `${sym}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`
      : `${sym}${abs}`;
  }
  return pnl >= 0 ? `+${str}` : `-${str}`;
}

function formatTime(ms: number): string {
  const d   = new Date(ms);
  const h   = d.getHours();
  const m   = String(d.getMinutes()).padStart(2, '0');
  const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${day} · ${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ─── Tab toggle ──────────────────────────────────────────────────

const TABS: { key: TabMode; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { key: 'reports',  icon: 'bar-chart-outline', label: 'Reports'  },
  { key: 'entries',  icon: 'list',              label: 'Entries'  },
  { key: 'calendar', icon: 'calendar',          label: 'Calendar' },
];

function TabToggle({ tab, setTab, colors }: { tab: TabMode; setTab: (t: TabMode) => void; colors: AppColors }) {
  const ts = StyleSheet.create({
    row:    { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
    btn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary },
    active: { backgroundColor: colors.primary },
    txt:    { fontSize: 12, fontWeight: '600', color: colors.primary },
    txtA:   { color: '#fff' },
  });
  return (
    <View style={ts.row}>
      {TABS.map(({ key, icon, label }) => (
        <TouchableOpacity key={key} style={[ts.btn, tab === key && ts.active]} onPress={() => setTab(key)} activeOpacity={0.8}>
          <Ionicons name={icon} size={13} color={tab === key ? '#fff' : colors.primary} />
          <CText txt={label} style={[ts.txt, tab === key && ts.txtA]} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Animated bar row ────────────────────────────────────────────

function PatternBar({ item, maxCount, index, colors }: { item: TradePattern; maxCount: number; index: number; colors: AppColors }) {
  const color   = SEVERITY_COLOR[item.severity];
  const bgColor = SEVERITY_BG[item.severity];
  const anim    = useRef(new Animated.Value(0)).current;
  const ratio   = maxCount > 0 ? item.count / maxCount : 0;

  useEffect(() => {
    Animated.timing(anim, { toValue: ratio, duration: 600, delay: index * 100, useNativeDriver: false }).start();
  }, [ratio]);

  const barWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={ps.barRow}>
      <View style={[ps.pill, { backgroundColor: bgColor }]}>
        <CText style={[ps.pillTxt, { color }]}>{item.severity.toUpperCase()}</CText>
      </View>
      <View style={[ps.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[ps.bar, { width: barWidth, backgroundColor: color }]} />
        <View style={ps.countWrap}>
          <CText style={[ps.countTxt, { color }]}>{item.count}×</CText>
        </View>
      </View>
      <CText style={[ps.barLabel, { color: colors.text }]}>{item.text}</CText>
    </View>
  );
}

// ─── Pattern chart card ──────────────────────────────────────────

function PatternChart({ patterns, colors }: { patterns: TradePattern[]; colors: AppColors }) {
  const { t }    = useTranslation();
  const maxCount = Math.max(...patterns.map((p) => p.count), 1);
  const danger   = patterns.filter((p) => p.severity === 'danger').length;
  const warning  = patterns.filter((p) => p.severity === 'warning').length;
  const positive = patterns.filter((p) => p.severity === 'positive').length;

  return (
    <View style={[ps.chartCard, { backgroundColor: colors.surface }, shadow.card]}>
      <View style={ps.legend}>
        {danger   > 0 && <LegendDot color={brandColors.red}   label={`${danger} ${t('pattern.severity_high')}`}   colors={colors} />}
        {warning  > 0 && <LegendDot color={brandColors.amber} label={`${warning} ${t('pattern.severity_medium')}`} colors={colors} />}
        {positive > 0 && <LegendDot color={brandColors.green} label={`${positive} ${t('pattern.severity_low')}`}  colors={colors} />}
      </View>
      {patterns.map((p, i) => (
        <PatternBar key={i} item={p} maxCount={maxCount} index={i} colors={colors} />
      ))}
    </View>
  );
}

function LegendDot({ color, label, colors }: { color: string; label: string; colors: AppColors }) {
  return (
    <View style={ps.legendItem}>
      <View style={[ps.legendDot, { backgroundColor: color }]} />
      <CText style={[ps.legendTxt, { color: colors.textMuted }]}>{label}</CText>
    </View>
  );
}

// ─── Entry card ──────────────────────────────────────────────────

function EntryCard({ item, colors }: { item: TradeEntry; colors: AppColors }) {
  const { t }        = useTranslation();
  const emotionColor = EMOTION_COLOR[item.emotion] ?? brandColors.purple;
  const emotionBg    = EMOTION_BG[item.emotion]   ?? brandColors.purpleDim;
  const ms           = item.createdAt?.toMillis?.() ?? 0;
  const s            = makeStyles(colors);

  const RESULT_STYLE: Record<TradeResult, { bg: string; text: string; label: string }> = {
    profit:     { bg: brandColors.greenBg,   text: brandColors.greenText,  label: `📈 ${t('trade.result_profit')}` },
    loss:       { bg: brandColors.redBg,     text: brandColors.redText,    label: `📉 ${t('trade.result_loss')}`   },
    'no-trade': { bg: brandColors.purpleDim, text: brandColors.textMuted,  label: `➖ ${t('trade.result_no_trade')}` },
  };

  return (
    <View style={[s.card, { borderLeftColor: emotionColor, backgroundColor: colors.surface }]}>
      <View style={s.entryTop}>
        <View style={[s.emotionChip, { backgroundColor: emotionBg }]}>
          <CText txt={item.emotion} style={[s.emotionTxt, { color: emotionColor }]} />
        </View>
        {item.result && (() => {
          const rs = RESULT_STYLE[item.result!];
          return (
            <View style={[s.resultChip, { backgroundColor: rs.bg }]}>
              <CText txt={rs.label} style={[s.resultTxt, { color: rs.text }]} />
            </View>
          );
        })()}
        {item.pnl != null && (
          <View style={[s.pnlBadge, { backgroundColor: item.pnl >= 0 ? brandColors.greenBg : brandColors.redBg }]}>
            <CText
              txt={formatPnl(item.pnl, item.currency)}
              style={[s.pnlTxt, { color: item.pnl >= 0 ? brandColors.greenText : brandColors.redText }]}
            />
          </View>
        )}
        <CText txt={ms ? formatTime(ms) : ''} style={[s.entryTime, { color: colors.textMuted }]} />
      </View>
      {!!item.aiSummary && (
        <CText txt={item.aiSummary} style={[s.entryText, { color: colors.text }]} />
      )}
      {!!item.note && (
        <CText txt={`📝 ${item.note}`} style={[s.noteText, { color: colors.textMuted }]} />
      )}
    </View>
  );
}

function SLabel({ txt, colors }: { txt: string; colors: AppColors }) {
  const s = makeStyles(colors);
  return <CText txt={txt} style={[s.sectionLabel, { color: colors.textMuted }]} />;
}

// ─── Skeleton card ───────────────────────────────────────────────

function SkeletonCard({ colors }: { colors: AppColors }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: anim, borderRadius: radius.lg, padding: 16, marginBottom: 10, backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.border }, shadow.card]}>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.border, marginBottom: 10, width: '80%' }} />
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border, width: '50%' }} />
    </Animated.View>
  );
}

// ─── Summary strip ───────────────────────────────────────────────

function PatternSummary({ patterns, colors }: { patterns: TradePattern[]; colors: AppColors }) {
  const danger   = patterns.filter((p) => p.severity === 'danger').length;
  const warning  = patterns.filter((p) => p.severity === 'warning').length;
  const positive = patterns.filter((p) => p.severity === 'positive').length;

  return (
    <View style={[ps.summaryRow, { backgroundColor: colors.surface, borderColor: colors.border }, shadow.card]}>
      {danger > 0 && (
        <View style={ps.summaryChip}>
          <View style={[ps.summaryDot, { backgroundColor: brandColors.red }]} />
          <CText txt={`${danger} danger`} style={[ps.summaryTxt, { color: colors.textMuted }]} />
        </View>
      )}
      {warning > 0 && (
        <View style={ps.summaryChip}>
          <View style={[ps.summaryDot, { backgroundColor: brandColors.amber }]} />
          <CText txt={`${warning} warning`} style={[ps.summaryTxt, { color: colors.textMuted }]} />
        </View>
      )}
      {positive > 0 && (
        <View style={ps.summaryChip}>
          <View style={[ps.summaryDot, { backgroundColor: brandColors.green }]} />
          <CText txt={`${positive} strength`} style={[ps.summaryTxt, { color: colors.textMuted }]} />
        </View>
      )}
    </View>
  );
}

// ─── Pattern card ─────────────────────────────────────────────────

const SEVERITY_ICON: Record<TradePattern['severity'], React.ComponentProps<typeof Ionicons>['name']> = {
  danger:   'alert-circle',
  warning:  'warning',
  positive: 'checkmark-circle',
};

const SEVERITY_LABEL: Record<TradePattern['severity'], string> = {
  danger:   'DANGER',
  warning:  'WARNING',
  positive: 'STRENGTH',
};

function PatternCard({ item, index, colors }: { item: TradePattern; index: number; colors: AppColors }) {
  const { t }   = useTranslation();
  const color   = SEVERITY_COLOR[item.severity];
  const bgColor = SEVERITY_BG[item.severity];
  const anim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue:        1,
      duration:       380,
      delay:          index * 80,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <View style={[ps.pCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadow.card]}>
        {/* ── Colored header band ── */}
        <View style={[ps.pBand, { backgroundColor: bgColor }]}>
          <View style={ps.pBandLeft}>
            <Ionicons name={SEVERITY_ICON[item.severity]} size={14} color={color} />
            <CText txt={SEVERITY_LABEL[item.severity]} style={[ps.pBandLabel, { color }]} />
          </View>
          <View style={[ps.pCountPill, { backgroundColor: color }]}>
            <CText txt={`${item.count}×`} style={ps.pCountTxt} />
          </View>
        </View>

        {/* ── Pattern text ── */}
        <View style={ps.pBody}>
          <CText txt={item.text} style={[ps.pText, { color: colors.text }]} />
          <CText
            txt={t('pattern.happened_count', { count: item.count })}
            style={[ps.pSub, { color: colors.textMuted }]}
          />
        </View>

        {/* ── Bottom accent line ── */}
        <View style={[ps.pAccent, { backgroundColor: color }]} />
      </View>
    </Animated.View>
  );
}

// ─── Shared report helpers ────────────────────────────────────────

function AnimatedBar({ value, color, delay = 0, colors }: { value: number; color: string; delay?: number; colors: AppColors }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value / 100, duration: 700, delay, useNativeDriver: false }).start();
  }, [value]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[rs.track, { backgroundColor: colors.border }]}>
      <Animated.View style={[rs.bar, { width, backgroundColor: color }]} />
    </View>
  );
}

function barColor(pct: number): string {
  if (pct >= 50) return brandColors.red;
  if (pct >= 25) return brandColors.amber;
  return brandColors.green;
}

function CardHeader({ label, labelColor, right, colors }: { label: string; labelColor: string; right: string; colors: AppColors }) {
  return (
    <View style={rs.cardHeader}>
      <CText txt={label} style={[rs.cardLabel, { color: labelColor }]} />
      <CText txt={right}  style={[rs.cardDate,  { color: colors.textMuted }]} />
    </View>
  );
}

const EMOTION_CHIP: Record<string, { bg: string; text: string }> = {
  Panic:   { bg: brandColors.redBg,   text: brandColors.redText   },
  FOMO:    { bg: brandColors.amberBg, text: brandColors.amberText },
  Calm:    { bg: brandColors.greenBg, text: brandColors.greenText },
  Revenge: { bg: brandColors.redBg,   text: brandColors.red       },
};

function EmotionChip({ emotion }: { emotion: string }) {
  const chip = EMOTION_CHIP[emotion] ?? { bg: brandColors.purpleDim, text: brandColors.purple };
  return (
    <View style={[rs.chip, { backgroundColor: chip.bg }]}>
      <CText txt={emotion} style={[rs.chipTxt, { color: chip.text }]} />
    </View>
  );
}

// ─── Locked card ──────────────────────────────────────────────────

function LockedCard({ needed, colors }: { needed: number; colors: AppColors }) {
  return (
    <View style={[rs.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.border }, shadow.card]}>
      <View style={rs.lockedInner}>
        <View style={[rs.lockIcon, { backgroundColor: colors.primaryDim }]}>
          <Ionicons name="lock-closed" size={24} color={colors.primary} />
        </View>
        <CText
          txt={`Log ${needed} more trade${needed === 1 ? '' : 's'} to unlock`}
          style={[rs.lockedTxt, { color: colors.textMuted }]}
        />
      </View>
    </View>
  );
}

// ─── Daily report card ────────────────────────────────────────────

function BestWorstRow({ bestTrade, worstTrade, colors }: { bestTrade: TradePnl | null; worstTrade: TradePnl | null; colors: AppColors }) {
  if (!bestTrade && !worstTrade) return null;
  return (
    <View style={rs.bwRow}>
      {bestTrade != null && (
        <View style={[rs.bwChip, { backgroundColor: brandColors.greenBg }]}>
          <Ionicons name="trending-up" size={13} color={brandColors.greenText} />
          <CText txt={formatPnl(bestTrade.amount, bestTrade.currency)} style={[rs.bwTxt, { color: brandColors.greenText }]} />
          <CText txt="best" style={[rs.bwLabel, { color: brandColors.greenText }]} />
        </View>
      )}
      {worstTrade != null && (
        <View style={[rs.bwChip, { backgroundColor: brandColors.redBg }]}>
          <Ionicons name="trending-down" size={13} color={brandColors.redText} />
          <CText txt={formatPnl(worstTrade.amount, worstTrade.currency)} style={[rs.bwTxt, { color: brandColors.redText }]} />
          <CText txt="worst" style={[rs.bwLabel, { color: brandColors.redText }]} />
        </View>
      )}
    </View>
  );
}

function EmotionRows({ data, colors }: {
  data: { panicPercent: number; fomoPercent: number; revengePercent: number; calmPercent: number } | null | undefined;
  colors: AppColors;
}) {
  const rows = [
    { label: 'Panic',   emoji: '🔴', value: data?.panicPercent   ?? 0 },
    { label: 'FOMO',    emoji: '🟡', value: data?.fomoPercent    ?? 0 },
    { label: 'Revenge', emoji: '🔴', value: data?.revengePercent ?? 0 },
    { label: 'Calm',    emoji: '🟢', value: data?.calmPercent    ?? 0 },
  ];
  return (
    <>
      {rows.map((r, i) => (
        <View key={i} style={rs.behaviorRow}>
          <View style={rs.rowBetween}>
            <CText txt={`${r.emoji}  ${r.label}`} style={[rs.rowLabel, { color: colors.textMuted }]} />
            <CText txt={`${r.value}%`}              style={[rs.rowValue, { color: colors.text }]} />
          </View>
          <AnimatedBar
            value={r.value}
            color={
              r.label === 'Calm'    ? brandColors.green :
              r.label === 'Revenge' ? brandColors.red   :
              barColor(r.value)
            }
            delay={i * 80}
            colors={colors}
          />
        </View>
      ))}
    </>
  );
}

function WinRateRow({ winRate, colors }: { winRate: number | null | undefined; colors: AppColors }) {
  const hasData  = winRate != null;
  const winColor = hasData && winRate >= 50 ? brandColors.green : hasData ? brandColors.red : colors.textMuted;
  return (
    <>
      <View style={rs.rowBetween}>
        <CText txt="Win rate" style={[rs.rowLabel, { color: colors.textMuted }]} />
        <CText txt={hasData ? `${winRate}%` : '— (no result logged)'} style={[rs.rowValue, { color: winColor }]} />
      </View>
      <AnimatedBar value={winRate ?? 0} color={winColor} colors={colors} />
    </>
  );
}

function DailyCard({ data, colors }: { data: DailyReport | null; colors: AppColors }) {
  return (
    <View style={[rs.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: brandColors.blue }, shadow.card]}>
      <CardHeader label="DAILY REPORT" labelColor={brandColors.blue} right={data?.date ?? '—'} colors={colors} />

      <CText
        txt={`${data?.tradesLogged ?? 0} trades logged`}
        style={[rs.statLine, { color: colors.text }]}
      />

      <WinRateRow winRate={data?.winRate} colors={colors} />

      <View style={[rs.divider, { backgroundColor: colors.border }]} />
      <CText txt="Emotions" style={[rs.sectionHint, { color: colors.textMuted }]} />
      <EmotionRows data={data} colors={colors} />

      <View style={[rs.divider, { backgroundColor: colors.border }]} />
      <View style={rs.rowBetween}>
        <CText txt="Dominant emotion" style={[rs.rowLabel, { color: colors.textMuted }]} />
        {data?.dominantEmotion ? <EmotionChip emotion={data.dominantEmotion} /> : <CText txt="—" style={[rs.rowLabel, { color: colors.textMuted }]} />}
      </View>
      <View style={[rs.rowBetween, { marginTop: 8 }]}>
        <CText txt="Best trade time" style={[rs.rowLabel, { color: colors.textMuted }]} />
        <CText txt={data?.bestTradeTime ?? '—'} style={[rs.rowValue, { color: colors.text }]} />
      </View>

      <BestWorstRow bestTrade={data?.bestTrade ?? null} worstTrade={data?.worstTrade ?? null} colors={colors} />
    </View>
  );
}

// ─── Weekly report card ───────────────────────────────────────────

function WeeklyCard({ data, colors }: { data: WeeklyReport | null; colors: AppColors }) {
  const hasWR   = data?.winRate != null;
  const winColor = hasWR && data!.winRate! >= 50 ? brandColors.green : brandColors.red;
  return (
    <View style={[rs.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: brandColors.purple }, shadow.card]}>
      <CardHeader label="WEEKLY REPORT" labelColor={brandColors.purple} right={data?.weekRange ?? '—'} colors={colors} />

      <View style={rs.statRow}>
        <CText txt={`${data?.totalTrades ?? 0} trades`}                                                             style={[rs.statLine, { color: colors.text }]} />
        <CText txt={hasWR ? `${data!.winRate}% win rate` : 'No results logged'} style={[rs.statLine, { color: hasWR ? winColor : colors.textMuted }]} />
      </View>

      <View style={[rs.divider, { backgroundColor: colors.border }]} />
      <CText txt="Emotions" style={[rs.sectionHint, { color: colors.textMuted }]} />
      <EmotionRows data={data} colors={colors} />
      <View style={[rs.divider, { backgroundColor: colors.border }]} />

      <View style={rs.rowBetween}>
        <CText txt={`📍  Best: ${data?.bestDay ?? '—'}`}  style={[rs.rowLabel, { color: brandColors.greenText }]} />
        <CText txt={`⚠️  Worst: ${data?.worstDay ?? '—'}`} style={[rs.rowLabel, { color: brandColors.redText }]} />
      </View>

      <BestWorstRow bestTrade={data?.bestTrade ?? null} worstTrade={data?.worstTrade ?? null} colors={colors} />
    </View>
  );
}

// ─── Monthly report card ──────────────────────────────────────────

function MonthlyCard({ data, colors }: { data: MonthlyReport | null; colors: AppColors }) {

  return (
    <View style={[rs.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: brandColors.amber }, shadow.card]}>
      <CardHeader label="MONTHLY REPORT" labelColor={brandColors.amber} right={data?.month ?? '—'} colors={colors} />

      <View style={rs.chipRow}>
        <View style={[rs.statChip, { backgroundColor: brandColors.greenBg }]}>
          <CText txt={data?.winRate  != null ? `${data.winRate}%`  : '—'} style={[rs.statChipTxt, { color: brandColors.greenText }]} />
          <CText txt="win"                                                  style={[rs.statChipSub, { color: brandColors.greenText }]} />
        </View>
        <View style={[rs.statChip, { backgroundColor: brandColors.redBg }]}>
          <CText txt={data?.lossRate != null ? `${data.lossRate}%` : '—'} style={[rs.statChipTxt, { color: brandColors.redText }]} />
          <CText txt="loss"                                                  style={[rs.statChipSub, { color: brandColors.redText }]} />
        </View>
      </View>

      <CText txt="Emotions" style={[rs.sectionHint, { color: colors.textMuted }]} />
      <EmotionRows data={data} colors={colors} />

      <View style={[rs.divider, { backgroundColor: colors.border }]} />

      <View style={rs.infoGrid}>
        <View style={rs.infoRow}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <CText txt={`Best time: ${data?.bestTimeOfDay ?? '—'}  ·  ${data?.bestTimeWinRate ?? 0}% wins`} style={[rs.infoTxt, { color: colors.text }]} />
        </View>
        <View style={rs.infoRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.textMuted} />
          <CText txt={`Worst day: ${data?.worstDay ?? '—'}`} style={[rs.infoTxt, { color: colors.text }]} />
        </View>
        <View style={rs.infoRow}>
          <Ionicons name="trending-down-outline" size={13} color={colors.textMuted} />
          <CText txt={`Loss streak: ${data?.streakTrigger ?? '—'}`} style={[rs.infoTxt, { color: colors.text }]} />
        </View>
      </View>

      <BestWorstRow bestTrade={data?.bestTrade ?? null} worstTrade={data?.worstTrade ?? null} colors={colors} />
    </View>
  );
}

// ─── Reports tab ──────────────────────────────────────────────────

function ReportsTab({ colors }: { colors: AppColors }) {
  const { todayCount, entryCount, daily, weekly, monthly, isLoading } = useTradeReports();
  const s = makeStyles(colors);

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <SkeletonCard colors={colors} />
        <SkeletonCard colors={colors} />
        <SkeletonCard colors={colors} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <SLabel txt="DAILY" colors={colors} />
      {todayCount >= 1
        ? <DailyCard   data={daily}   colors={colors} />
        : <LockedCard  needed={1}     colors={colors} />}

      <SLabel txt="WEEKLY" colors={colors} />
      {entryCount >= 5
        ? <WeeklyCard  data={weekly}  colors={colors} />
        : <LockedCard  needed={5 - entryCount}  colors={colors} />}

      <SLabel txt="MONTHLY" colors={colors} />
      {entryCount >= 20
        ? <MonthlyCard data={monthly} colors={colors} />
        : <LockedCard  needed={20 - entryCount} colors={colors} />}
    </ScrollView>
  );
}

// ─── Empty state ─────────────────────────────────────────────────

function PatternEmpty({ entryCount, colors }: { entryCount: number; colors: AppColors }) {
  const { t } = useTranslation();
  const s     = makeStyles(colors);
  const remaining = Math.max(0, 5 - entryCount);
  return (
    <View style={[s.emptyWrap]}>
      <View style={[s.emptyIconWrap, { backgroundColor: colors.primaryDim }]}>
        <Ionicons name="analytics-outline" size={48} color={colors.primary} />
      </View>
      <CText tx="pattern.no_trades_title" style={[s.emptyTitle, { color: colors.text }]} />
      <CText
        txt={t('pattern.no_trades_sub_count', { count: remaining })}
        style={[s.emptySub, { color: colors.textMuted }]}
      />
    </View>
  );
}

// ─── Entries tab content ─────────────────────────────────────────

function EntriesTab({ trades, colors }: { trades: TradeEntry[]; colors: AppColors }) {
  const { t } = useTranslation();
  const s     = makeStyles(colors);

  return (
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <SLabel txt={`${t('recent_entries.title').toUpperCase()}  ·  ${trades.length} ${t('journal_list.count_other', { count: trades.length })}`} colors={colors} />
      {trades.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={[s.emptyIconWrap, { backgroundColor: colors.primaryDim }]}>
            <Ionicons name="journal-outline" size={36} color={colors.primary} />
          </View>
          <CText tx="home_screen.no_trades_title" style={[s.emptyTitle, { color: colors.text }]} />
          <CText tx="home_screen.no_trades_sub"   style={[s.emptySub,   { color: colors.textMuted }]} />
        </View>
      ) : (
        trades.map((t) => <EntryCard key={t.id} item={t} colors={colors} />)
      )}
    </ScrollView>
  );
}

// ─── Screen ──────────────────────────────────────────────────────

export function PatternScreen() {
  const { colors }            = useTheme();
  const { trades, isLoading } = useTradeLog();
  const [tab, setTab]         = useState<TabMode>('reports');
  const s                     = makeStyles(colors);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <CText tx="pattern.title"           style={[s.title,    { color: colors.text }]} />
        <CText tx="pattern.subtitle_report" style={[s.subtitle, { color: colors.textMuted }]} />
      </View>

      <TabToggle tab={tab} setTab={setTab} colors={colors} />

      {tab === 'reports' ? (
        <ReportsTab colors={colors} />
      ) : tab === 'entries' ? (
        isLoading
          ? <ActivityIndicator style={{ marginTop: 80 }} size="large" color={colors.primary} />
          : <EntriesTab trades={trades} colors={colors} />
      ) : (
        <TradeCalendarView />
      )}
    </SafeAreaView>
  );
}

// ─── Report card styles ───────────────────────────────────────────

const rs = StyleSheet.create({
  card:           { borderRadius: radius.lg, padding: 16, marginBottom: 6, borderWidth: 1, borderLeftWidth: 3 },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel:      { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  cardDate:       { fontSize: 12 },
  statLine:       { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  statRow:        { flexDirection: 'row', gap: 14, marginBottom: 4 },
  rowBetween:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowLabel:       { fontSize: 13 },
  rowValue:       { fontSize: 13, fontWeight: '600' },
  track:          { height: 6, borderRadius: radius.full, overflow: 'hidden', marginBottom: 8 },
  bar:            { height: '100%' },
  behaviorRow:    { marginBottom: 2 },
  chip:           { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  chipTxt:        { fontSize: 12, fontWeight: '500' },
  chipRow:        { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statChip:       { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md },
  statChipTxt:    { fontSize: 20, fontWeight: '700' },
  statChipSub:    { fontSize: 11, fontWeight: '600', marginTop: 1 },
  divider:        { height: 1, marginVertical: 12 },
  sectionHint:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  infoGrid:       { gap: 6 },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoTxt:        { fontSize: 13, flex: 1 },
  topPatternBlock:{ borderRadius: radius.md, padding: 12, marginTop: 6 },
  topPatternTxt:  { fontSize: 14, fontWeight: '500', fontStyle: 'italic', lineHeight: 21 },
  topPatternSub:  { fontSize: 12, marginTop: 4 },
  bwRow:          { flexDirection: 'row', gap: 10, marginTop: 12 },
  bwChip:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md },
  bwTxt:          { fontSize: 14, fontWeight: '700' },
  bwLabel:        { fontSize: 11, fontWeight: '500', marginLeft: 'auto' },
  lockedInner:    { alignItems: 'center', paddingVertical: 24, gap: 10 },
  lockIcon:       { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  lockedTxt:      { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});

// ─── Pattern card & summary styles ──────────────────────────────

const ps = StyleSheet.create({
  // summary strip
  summaryRow:  { flexDirection: 'row', gap: 16, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14, borderWidth: 1, flexWrap: 'wrap' },
  summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryDot:  { width: 8, height: 8, borderRadius: 4 },
  summaryTxt:  { fontSize: 12, fontWeight: '600' },

  // pattern card
  pCard:       { borderRadius: radius.lg, marginBottom: 12, borderWidth: 1, overflow: 'hidden' },
  pBand:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  pBandLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pBandLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  pCountPill:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  pCountTxt:   { fontSize: 11, fontWeight: '700', color: '#fff' },
  pBody:       { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 6 },
  pText:       { fontSize: 15, fontWeight: '500', lineHeight: 23 },
  pSub:        { fontSize: 12 },
  pAccent:     { height: 3 },

  // legacy bar chart (kept for PatternChart component)
  chartCard: { borderRadius: radius.xl, padding: 20, marginBottom: 8 },
  legend:     { flexDirection: 'row', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { fontSize: 11, fontWeight: '600' },
  barRow:     { marginBottom: 18 },
  pill:       { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginBottom: 6 },
  pillTxt:    { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  track:      { height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 6, flexDirection: 'row', alignItems: 'center' },
  bar:        { height: '100%', borderRadius: 6 },
  countWrap:  { position: 'absolute', right: 6 },
  countTxt:   { fontSize: 9, fontWeight: '700' },
  barLabel:   { fontSize: 12, lineHeight: 18 },
});

// ─── Shared styles ────────────────────────────────────────────────

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe:     { flex: 1 },
  header:   { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  title:    { fontSize: 24, ...font.bold },
  subtitle: { fontSize: 13, marginTop: 2 },
  content:  { paddingHorizontal: 20, paddingBottom: 48 },

  sectionLabel: {
    fontSize: 11, ...font.bold, letterSpacing: 0.8,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 10,
  },

  card: {
    borderRadius: radius.lg, padding: 16, marginBottom: 10, borderLeftWidth: 3, ...shadow.card,
  },
  entryTop:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  emotionChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  emotionTxt:  { fontSize: 11, ...font.bold },
  resultChip:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  resultTxt:   { fontSize: 11, fontWeight: '700' },
  pnlBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pnlTxt:      { fontSize: 11, fontWeight: '700' },
  entryTime:   { marginLeft: 'auto', fontSize: 11 },
  entryText:   { fontSize: 13, lineHeight: 20 },
  noteText:    { fontSize: 11, marginTop: 6 },

  emptyWrap:    { paddingVertical: 36, alignItems: 'center', gap: 8 },
  emptyIconWrap:{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyIcon:    { fontSize: 40, marginBottom: 14 },
  emptyTitle:   { fontSize: 18, ...font.semiBold, textAlign: 'center' },
  emptySub:     { fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 16 },

});
