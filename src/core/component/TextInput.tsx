import React, { memo, useRef, useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInputProps,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';

type FocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
type BlurEvent = Parameters<NonNullable<TextInputProps['onBlur']>>[0];
import CText from './CText';
import { t } from 'i18next'; 
import i18n from '../i18n';
import { AppColors, font, radius } from '../utils';
import { useTheme } from '../hook';  

type InputVariant = 'outlined' | 'filled' | 'underline';
type InputSize = 'sm' | 'md' | 'lg';
type InputStatus = 'default' | 'error' | 'success' | 'warning';

export interface AppInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  status?: InputStatus;
  errorMessage?: string;
  successMessage?: string;
  hint?: string;
  variant?: InputVariant;
  size?: InputSize;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  showCharCount?: boolean;
  maxLength?: number;
  ptx?: string;
  ptxt?: string;
}

export interface AppInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  isFocused: () => boolean;
}

const EyeIcon = memo(({ visible, color }: { visible: boolean; color: string }) => (
  <Text style={{ fontSize: 18, color }}>{visible ? '👁' : '🙈'}</Text>
));

export const CTextInput = forwardRef<AppInputRef, AppInputProps>(({
  label: tx,
  labelStyle,
  leftIcon,
  rightIcon,
  onRightIconPress,
  isPassword = false,
  status = 'default',
  errorMessage,
  successMessage,
  hint,
  variant = 'outlined',
  size = 'md',
  disabled = false,
  containerStyle,
  inputStyle,
  showCharCount = false,
  maxLength,
  value,
  onFocus,
  onBlur,
  ptx,
  ptxt,
  ...rest
}, ref) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const animatedBorder = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: () => inputRef.current?.clear(),
    isFocused: () => inputRef.current?.isFocused() ?? false,
  }));

  const handleFocus = (e: FocusEvent) => {
    setIsFocused(true);
    Animated.timing(animatedBorder, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: BlurEvent) => {
    setIsFocused(false);
    Animated.timing(animatedBorder, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    onBlur?.(e);
  };

  const borderColor = animatedBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [
      status === 'error' ? colors.error : status === 'success' ? colors.success : colors.border,
      status === 'error' ? colors.error : status === 'success' ? colors.success : colors.primary,
    ],
  });

  const sizeStyles = {
    sm: { height: 40, paddingHorizontal: 12, fontSize: 13 },
    md: { height: 50, paddingHorizontal: 16, fontSize: 15 },
    lg: { height: 58, paddingHorizontal: 18, fontSize: 16 },
  }[size];

  const variantWrapperStyle: ViewStyle =
    variant === 'filled'
      ? { backgroundColor: disabled ? colors.background : isFocused ? colors.white : colors.background, borderWidth: 0, borderBottomWidth: 1.5 }
      : variant === 'underline'
        ? { backgroundColor: 'transparent', borderWidth: 0, borderBottomWidth: 1.5, borderRadius: 0, paddingHorizontal: 0 }
        : { backgroundColor: disabled ? colors.background : colors.surface, borderWidth: 1.5 };

  const statusColor =
    status === 'error' ? colors.error
      : status === 'success' ? colors.success
        : status === 'warning' ? colors.warning
          : colors.textMuted;

  const bottomMessage =
    status === 'error' ? errorMessage
      : status === 'success' ? successMessage
        : hint;

  const charCount = typeof value === 'string' ? value.length : 0;

  const label = tx
    ? (i18n.exists(tx) ? t(tx) : 'no translation')
    : undefined;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.label, isFocused && styles.labelFocused, status === 'error' && styles.labelError, disabled && styles.labelDisabled, labelStyle]}>
          {label}
        </Text>
      )}

      <Animated.View style={[
        styles.inputWrapper,
        variantWrapperStyle,
        { borderColor },
        disabled && styles.inputWrapperDisabled,
        isFocused && variant === 'outlined' && styles.inputWrapperFocused,
        { borderRadius: variant === 'underline' ? 0 : radius.md },
        { minHeight: sizeStyles.height },
      ]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            { fontSize: sizeStyles.fontSize, paddingHorizontal: leftIcon ? 8 : sizeStyles.paddingHorizontal, color: disabled ? colors.textMuted : colors.text },
            disabled && styles.inputDisabled,
            inputStyle,
          ]}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={ptx ? t(ptx) : ptxt ?? ''}
          editable={!disabled}
          secureTextEntry={isPassword && secureText}
          maxLength={maxLength}
          placeholderTextColor={colors.textMuted}
          {...rest}
        />

        {isPassword ? (
          <TouchableOpacity style={styles.rightIcon} onPress={() => setSecureText(p => !p)} activeOpacity={0.7}>
            <EyeIcon visible={!secureText} color={colors.textMuted} />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity style={styles.rightIcon} onPress={onRightIconPress} activeOpacity={onRightIconPress ? 0.7 : 1} disabled={!onRightIconPress}>
            {rightIcon}
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {bottomMessage && (
        <View style={styles.bottomRow}>
          <CText style={[styles.helperText, { color: statusColor }]} tx={bottomMessage} />
          {showCharCount && maxLength && (
            <CText style={[styles.charCount, charCount >= maxLength && styles.charCountOver]}>
              {`${charCount}/${maxLength}`}
            </CText>
          )}
        </View>
      )}
    </View>
  );
});

const makeStyles = (colors: AppColors) => StyleSheet.create({
  wrapper: { width: '100%', marginBottom: 4 },
  label: { fontSize: 13, ...font.medium, color: colors.textMuted, marginBottom: 6 },
  labelFocused: { color: colors.primary },
  labelError: { color: colors.error },
  labelDisabled: { color: colors.textMuted },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  inputWrapperFocused: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 },
  inputWrapperDisabled: { opacity: 0.6 },
  input: { flex: 1, color: colors.text, ...font.regular, paddingVertical: 0 },
  inputDisabled: { color: colors.textMuted },
  leftIcon: { paddingLeft: 14 },
  rightIcon: { paddingHorizontal: 14 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, paddingHorizontal: 2 },
  helperText: { fontSize: 14, ...font.regular, flex: 1 },
  charCount: { fontSize: 11, ...font.regular, color: colors.textMuted },
  charCountOver: { color: colors.error },
});
