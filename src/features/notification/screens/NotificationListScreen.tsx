import React, { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../core/hook';
import { AppColors, radius } from '../../../core/utils';
import CText from '../../../core/component/CText';
import { NotificationItem, useNotificationListStore } from '../hook/useNotificationListStore';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotifCard({
  item,
  colors,
  onPress,
}: {
  item: NotificationItem;
  colors: AppColors;
  onPress: () => void;
}) {
  const s = cardStyles(colors);
  return (
    <TouchableOpacity
      style={[s.card, !item.read && s.unread]}
      onPress={onPress}
      activeOpacity={item.read ? 1 : 0.7}
    >
      <View style={s.row}>
        {!item.read && <View style={s.dot} />}
        <View style={s.content}>
          <CText txt={item.title} size="sm" weight="semiBold" color={colors.text} />
          <CText txt={item.body} size="xs" color={colors.textMuted} style={s.body} />
        </View>
        <CText txt={timeAgo(item.receivedAt)} size="xs" color={colors.textMuted} style={s.time} />
      </View>
    </TouchableOpacity>
  );
}

export function NotificationListScreen() {
  const { colors } = useTheme();
  const { t }      = useTranslation();
  const { items, isLoading, loadNotifications, markRead, markAllRead } = useNotificationListStore();
  const s = makeStyles(colors);

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = items.filter((n) => !n.read).length;

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotifCard
        item={item}
        colors={colors}
        onPress={() => { if (!item.read) markRead(item.id); }}
      />
    ),
    [colors, markRead]
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <CText tx="notifications_screen.title" size="xxl" weight="bold" color={colors.text} />
          {unreadCount > 0 && (
            <CText
              txt={t('notifications_screen.unread', { count: unreadCount })}
              size="xs"
              color={colors.primary}
              style={s.unreadLabel}
            />
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.7} style={s.markBtn}>
            <CText tx="notifications_screen.mark_all_read" size="xs" weight="medium" color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={s.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? s.emptyContainer : s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <CText tx="notifications_screen.no_title" size="md" color={colors.textMuted} />
              <CText
                tx="notifications_screen.no_sub"
                size="sm"
                color={colors.textMuted}
                style={s.emptySubtitle}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    unreadLabel: { marginTop: 2 },
    markBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radius.full,
      backgroundColor: colors.primaryDim,
    },
    loader: { flex: 1 },
    list: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
    emptyContainer: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptySubtitle: { marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  });
}

function cardStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    unread: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryDim,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    content: { flex: 1 },
    body: { marginTop: 3, lineHeight: 18 },
    time: { marginTop: 2, flexShrink: 0 },
  });
}
