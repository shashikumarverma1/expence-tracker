import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Animated,
  ViewStyle,
  TextStyle,
  StyleProp,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons'; 
import CText from './CText';
import { useTheme } from '../hook';
import { t } from 'i18next';
import i18n from '../i18n';
import { AppColors, font, radius } from '../utils';

// ── Types ────────────────────────────────────────────────────
type SelectVariant = 'outlined' | 'filled' | 'underline';
type SelectSize = 'sm' | 'md' | 'lg';
type SelectStatus = 'default' | 'error' | 'success' | 'warning';

export interface SelectOption {
  id?: string | number;
  label: string;
  value: string | number;
}

export interface CSelectProps {
  options: SelectOption[];
  value?: string | number;
  onSelect: (option: SelectOption) => void;

  // Label
  label?: string;
  labelStyle?: StyleProp<TextStyle>;

  // Placeholder
  ptx?: string;
  ptxt?: string;

  // Icons
  leftIcon?: React.ReactNode;

  // Validation
  status?: SelectStatus;
  errorMessage?: string;
  hint?: string;

  // Appearance
  variant?: SelectVariant;
  size?: SelectSize;
  disabled?: boolean;

  // Layout
  containerStyle?: StyleProp<ViewStyle>;

  // Search
  searchable?: boolean;
  searchPlaceholder?: string;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DROPDOWN_MAX_HEIGHT = 280;

// ── Component ────────────────────────────────────────────────
export function CSelect({
  options,
  value,
  onSelect,
  label,
  labelStyle,
  ptx,
  ptxt,
  leftIcon,
  status = 'default',
  errorMessage,
  hint,
  variant = 'outlined',
  size = 'md',
  disabled = false,
  containerStyle,
  searchable = true,
  searchPlaceholder = 'Search…',
}: CSelectProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const triggerRef = useRef<View>(null);
  const searchRef = useRef<TextInput>(null);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0, openUp: false });

  const animatedBorder = useRef(new Animated.Value(0)).current;
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const selectedOption = options.find(o => o.value === value);
  const placeholder = ptx ? t(ptx) : ptxt ?? 'Select an option';
  const resolvedLabel = label
    ? i18n.exists(label) ? t(label) : label
    : undefined;

  const filteredOptions = searchQuery.trim()
    ? options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const sizeMap = {
    sm: { height: 40, paddingHorizontal: 12, fontSize: 13 },
    md: { height: 50, paddingHorizontal: 16, fontSize: 15 },
    lg: { height: 58, paddingHorizontal: 18, fontSize: 16 },
  }[size];

  const statusColor =
    status === 'error' ? colors.error
      : status === 'success' ? colors.success
        : status === 'warning' ? colors.warning
          : colors.textMuted;

  const bottomMessage = status === 'error' ? errorMessage : hint;

  const borderColor = animatedBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [
      status === 'error' ? colors.error : status === 'success' ? colors.success : colors.border,
      status === 'error' ? colors.error : status === 'success' ? colors.success : colors.primary,
    ],
  });

  const variantWrapperStyle: ViewStyle =
    variant === 'filled'
      ? { backgroundColor: disabled ? colors.background : colors.background, borderWidth: 0, borderBottomWidth: 1.5 }
      : variant === 'underline'
        ? { backgroundColor: 'transparent', borderWidth: 0, borderBottomWidth: 1.5, borderRadius: 0, paddingHorizontal: 0 }
        : { backgroundColor: disabled ? colors.background : colors.surface, borderWidth: 1.5 };

  const openDropdown = () => {
    if (disabled) return;
    triggerRef.current?.measure((_fx, _fy, width, height, px, py) => {
      const spaceBelow = SCREEN_HEIGHT - py - height;
      const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT + 20;
      setDropdownPos({ x: px, y: openUp ? py - DROPDOWN_MAX_HEIGHT - 4 : py + height + 4, width, openUp });
      setSearchQuery('');
      setOpen(true);
      Animated.parallel([
        Animated.timing(animatedBorder, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(dropdownAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start(() => searchRef.current?.focus());
    });
  };

  const closeDropdown = () => {
    Animated.parallel([
      Animated.timing(animatedBorder, { toValue: 0, duration: 180, useNativeDriver: false }),
      Animated.timing(dropdownAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  };

  const handleSelect = (option: SelectOption) => {
    onSelect(option);
    closeDropdown();
  };

  const dropdownStyle = {
    opacity: dropdownAnim,
    transform: [{
      translateY: dropdownAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [dropdownPos.openUp ? 8 : -8, 0],
      }),
    }],
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>

      {/* Label */}
      {resolvedLabel && (
        <CText
          txt={resolvedLabel}
          style={[
            styles.label,
            open && styles.labelFocused,
            status === 'error' && styles.labelError,
            disabled && styles.labelDisabled,
            labelStyle,
          ]}
        />
      )}

      {/* Trigger */}
      <TouchableOpacity
        ref={triggerRef as any}
        onPress={openDropdown}
        activeOpacity={disabled ? 1 : 0.8}
        disabled={disabled}
      >
        <Animated.View style={[
          styles.trigger,
          variantWrapperStyle,
          { borderColor },
          disabled && styles.triggerDisabled,
          open && variant === 'outlined' && styles.triggerOpen,
          { borderRadius: variant === 'underline' ? 0 : radius.md, minHeight: sizeMap.height },
        ]}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

          <CText
            numberOfLines={1}
            txt={selectedOption ? selectedOption.label : placeholder}
            style={[
              styles.triggerText,
              { fontSize: sizeMap.fontSize, paddingHorizontal: leftIcon ? 8 : sizeMap.paddingHorizontal },
              { color: selectedOption ? colors.text : colors.textMuted },
            ]}
          />

          <Animated.View style={[
            styles.chevronWrap,
            {
              transform: [{
                rotate: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
              }],
            },
          ]}>
            <Ionicons
              name="chevron-down"
              size={18}
              color={open ? colors.primary : colors.textMuted}
            />
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>

      {/* Helper / Error */}
      {bottomMessage && (
        <CText style={[styles.helperText, { color: statusColor }]} txt={bottomMessage} />
      )}

      {/* Inline dropdown modal */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={closeDropdown}
        statusBarTranslucent
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDropdown} />

        <Animated.View style={[
          styles.dropdown,
          {
            top: dropdownPos.y,
            left: dropdownPos.x,
            width: dropdownPos.width,
            backgroundColor: colors.surface,
          },
          dropdownStyle,
        ]}>

          {/* Search row */}
          {searchable && (
            <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                ref={searchRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.text }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Options list */}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item, index) => item.id != null ? String(item.id) : `${String(item.value)}_${index}`}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: searchable ? DROPDOWN_MAX_HEIGHT - 52 : DROPDOWN_MAX_HEIGHT }}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <CText txt="No results found" style={[styles.emptyText, { color: colors.textMuted }]} />
            }
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <TouchableOpacity
                  style={[
                    styles.option,
                    selected && { backgroundColor: colors.primaryDim },
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <CText
                    txt={item.label}
                    style={[
                      styles.optionText,
                      { color: selected ? colors.primary : colors.text },
                      selected && font.semiBold,
                    ]}
                  />
                  {selected && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} style={styles.checkmark} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </Animated.View>
      </Modal>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────
const makeStyles = (colors: AppColors) => StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    ...font.medium,
    color: colors.textMuted,
    marginBottom: 6,
  },
  labelFocused: { color: colors.primary },
  labelError: { color: colors.error },
  labelDisabled: { color: colors.textMuted },

  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  triggerOpen: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  triggerDisabled: { opacity: 0.6 },
  triggerText: {
    flex: 1,
    ...font.regular,
    paddingVertical: 0,
  },
  leftIcon: { paddingLeft: 14 },
  chevronWrap: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    ...font.regular,
    marginTop: 5,
    paddingHorizontal: 2,
  },

  // Dropdown
  dropdown: {
    position: 'absolute',
    borderRadius: radius.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    ...font.regular,
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
  },
  // Options
  listContent: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    marginBottom: 1,
  },
  optionText: {
    fontSize: 15,
    ...font.regular,
    flex: 1,
  },
  checkmark: {
    marginLeft: 8,
  },
  emptyText: {
    fontSize: 14,
    ...font.regular,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
