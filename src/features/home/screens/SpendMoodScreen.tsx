import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors } from '../../../core/utils';
import { TradeCalendarView } from '../components/TradeCalendarView';
import { TradeListView } from '../components/TradeListView';

type ViewMode = 'list' | 'calendar';

export function SpendMoodScreen() {
  const { colors } = useTheme();
  const { t }      = useTranslation();
  const s          = makeStyles(colors);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <CText tx="journal_list.title" style={s.headerTitle} />
          <CText tx="pattern.subtitle"   style={s.headerSub} />
        </View>
      </View>

      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.toggleBtn, viewMode === 'list' && s.toggleBtnActive]}
          onPress={() => setViewMode('list')}
          activeOpacity={0.8}
        >
          <Ionicons name="list" size={15} color={viewMode === 'list' ? '#fff' : colors.primary} style={{ marginRight: 5 }} />
          <CText
            txt={t('journal_list.filter_all')}
            style={[s.toggleTxt, viewMode === 'list' && s.toggleTxtActive]}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.toggleBtn, viewMode === 'calendar' && s.toggleBtnActive]}
          onPress={() => setViewMode('calendar')}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar" size={15} color={viewMode === 'calendar' ? '#fff' : colors.primary} style={{ marginRight: 5 }} />
          <CText
            tx="mood_calendar.title"
            style={[s.toggleTxt, viewMode === 'calendar' && s.toggleTxtActive]}
          />
        </TouchableOpacity>
      </View>

      {viewMode === 'list'     ? <TradeListView />     : null}
      {viewMode === 'calendar' ? <TradeCalendarView /> : null}
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub:   { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  toggleRow:       { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  toggleBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleTxt:       { fontSize: 13, fontWeight: '600', color: colors.primary },
  toggleTxtActive: { color: '#fff' },
});
