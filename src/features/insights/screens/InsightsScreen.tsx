import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors } from '../../../core/utils';
import { useIsPro } from '../../subscription/hooks/useIsPro';
import { WeeklyReport, useWeeklyInsights } from '../hooks/useWeeklyInsights';

// ── Date formatting ───────────────────────────────────────────────────────────

function formatWeekRange(report: WeeklyReport): string {
  const start = report.weekStartDate.toDate();
  const end   = report.weekEndDate.toDate();
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value, colors }: { label: string; value: string; colors: AppColors }) {
  return (
    <View style={[pill.wrap, { backgroundColor: colors.primaryDim, borderColor: colors.border }]}>
      <CText style={[pill.val, { color: colors.primary }]}>{value}</CText>
      <CText style={[pill.lbl, { color: colors.textMuted }]}>{label}</CText>
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  val:  { fontSize: 18, fontWeight: '700' },
  lbl:  { fontSize: 11, fontWeight: '500', marginTop: 2 },
});

function BlurredInsight({ onUpgrade, colors }: { onUpgrade: () => void; colors: AppColors }) {
  return (
    <View style={[blurred.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <CText style={[blurred.title, { color: colors.text }]}>AI Insight</CText>
      <CText style={[blurred.text, { color: colors.border }]}>
        {'This week showed patterns of growth and self-awareness that reveal something meaningful about where you are headed next.'}
      </CText>
      <TouchableOpacity
        onPress={onUpgrade}
        style={[blurred.btn, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
      >
        <Ionicons name="lock-closed" size={13} color="#fff" style={{ marginRight: 6 }} />
        <CText style={blurred.btnTxt}>Unlock with Pro</CText>
      </TouchableOpacity>
    </View>
  );
}

const blurred = StyleSheet.create({
  wrap:   { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 12 },
  title:  { fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  text:   { fontSize: 14, lineHeight: 22, marginBottom: 14 },
  btn:    { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  btnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

function ReportCard({
  report,
  isCurrentWeek,
  isPro,
  onUpgrade,
  colors,
}: {
  report: WeeklyReport;
  isCurrentWeek: boolean;
  isPro: boolean;
  onUpgrade: () => void;
  colors: AppColors;
}) {
  return (
    <View style={[card.wrap, { backgroundColor: colors.surface, borderColor: colors.border }, isCurrentWeek && { borderColor: colors.primary }]}>
      {isCurrentWeek && (
        <View style={[card.badge, { backgroundColor: colors.primaryDim }]}>
          <CText style={[card.badgeTxt, { color: colors.primary }]}>This week</CText>
        </View>
      )}

      <CText style={[card.week, { color: colors.textMuted }]}>{formatWeekRange(report)}</CText>

      {/* Stats row */}
      <View style={card.statsRow}>
        <StatPill label="Top mood"    value={report.topMood}    colors={colors} />
        <View style={{ width: 8 }} />
        <StatPill label="Entries"     value={String(report.entriesCount)} colors={colors} />
      </View>

      {/* Recurring theme */}
      {isPro && report.recurringTheme ? (
        <View style={[card.themeWrap, { backgroundColor: colors.primaryDim, borderColor: colors.border }]}>
          <CText style={[card.themeLabel, { color: colors.textMuted }]}>Recurring theme</CText>
          <CText style={[card.themeValue, { color: colors.text }]}>{report.recurringTheme}</CText>
        </View>
      ) : null}

      {/* Insight */}
      {isPro ? (
        report.insight ? (
          <View style={[card.insightWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <CText style={[card.insightLabel, { color: colors.textMuted }]}>AI Insight</CText>
            <CText style={[card.insightText, { color: colors.text }]}>{report.insight}</CText>
          </View>
        ) : null
      ) : (
        <BlurredInsight onUpgrade={onUpgrade} colors={colors} />
      )}
    </View>
  );
}

const card = StyleSheet.create({
  wrap:         { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 16 },
  badge:        { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 10 },
  badgeTxt:     { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  week:         { fontSize: 13, fontWeight: '500', marginBottom: 14 },
  statsRow:     { flexDirection: 'row', marginBottom: 12 },
  themeWrap:    { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  themeLabel:   { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  themeValue:   { fontSize: 15, fontWeight: '600' },
  insightWrap:  { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 4 },
  insightLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  insightText:  { fontSize: 14, lineHeight: 22 },
});

function PastReportRow({
  report,
  isPro,
  onUpgrade,
  colors,
}: {
  report: WeeklyReport;
  isPro: boolean;
  onUpgrade: () => void;
  colors: AppColors;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[row.wrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        style={row.header}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <CText style={[row.week, { color: colors.text }]}>{formatWeekRange(report)}</CText>
          <CText style={[row.meta, { color: colors.textMuted }]}>
            {report.topMood}  ·  {report.entriesCount} {report.entriesCount === 1 ? 'entry' : 'entries'}
          </CText>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={row.body}>
          {isPro ? (
            <>
              {report.recurringTheme ? (
                <View style={[row.chip, { backgroundColor: colors.primaryDim }]}>
                  <CText style={[row.chipTxt, { color: colors.primary }]}>
                    Theme: {report.recurringTheme}
                  </CText>
                </View>
              ) : null}
              {report.insight ? (
                <CText style={[row.insight, { color: colors.text }]}>{report.insight}</CText>
              ) : null}
            </>
          ) : (
            <TouchableOpacity
              onPress={onUpgrade}
              style={[row.upgrade, { backgroundColor: colors.primaryDim }]}
              activeOpacity={0.85}
            >
              <Ionicons name="lock-closed" size={12} color={colors.primary} style={{ marginRight: 6 }} />
              <CText style={[row.upgradeTxt, { color: colors.primary }]}>Unlock insights with Pro</CText>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const row = StyleSheet.create({
  wrap:       { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', padding: 14 },
  week:       { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  meta:       { fontSize: 12 },
  body:       { paddingHorizontal: 14, paddingBottom: 14 },
  chip:       { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginBottom: 10 },
  chipTxt:    { fontSize: 12, fontWeight: '600' },
  insight:    { fontSize: 14, lineHeight: 22 },
  upgrade:    { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8 },
  upgradeTxt: { fontSize: 13, fontWeight: '600' },
});

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ colors }: { colors: AppColors }) {
  return (
    <View style={[empty.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <CText style={empty.emoji}>📊</CText>
      <CText style={[empty.title, { color: colors.text }]}>No report yet</CText>
      <CText style={[empty.sub, { color: colors.textMuted }]}>
        Record at least 3 entries this week to get your weekly insights report.
      </CText>
    </View>
  );
}

const empty = StyleSheet.create({
  wrap:  { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: 'center' },
  emoji: { fontSize: 40, marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  sub:   { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export function InsightsScreen() {
  const nav              = useNavigation<any>();
  const { colors }       = useTheme();
  const isPro            = useIsPro();
  const { currentReport, pastReports, isLoading } = useWeeklyInsights();

  const goToSubscription = () => nav.navigate('SubscriptionScreen');

  if (isLoading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <CText style={[s.title, { color: colors.text }]}>Weekly Insights</CText>
          <View style={{ width: 22 }} />
        </View>
        <ActivityIndicator style={{ marginTop: 80 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <CText style={[s.title, { color: colors.text }]}>Weekly Insights</CText>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {/* Current week */}
        <CText style={[s.sectionLabel, { color: colors.textMuted }]}>THIS WEEK</CText>
        {currentReport ? (
          <ReportCard
            report={currentReport}
            isCurrentWeek
            isPro={isPro}
            onUpgrade={goToSubscription}
            colors={colors}
          />
        ) : (
          <EmptyState colors={colors} />
        )}

        {/* Past reports */}
        {pastReports.length > 0 && (
          <>
            <CText style={[s.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>PAST REPORTS</CText>
            {pastReports.map((r) => (
              <PastReportRow
                key={r.id}
                report={r}
                isPro={isPro}
                onUpgrade={goToSubscription}
                colors={colors}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:        { fontSize: 17, fontWeight: '700' },
  content:      { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
});
