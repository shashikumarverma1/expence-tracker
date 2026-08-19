import React from 'react';
import { Text, TextStyle, StyleSheet, TextProps, StyleProp } from 'react-native';

import { useTranslation } from 'react-i18next';  
import { font } from '../utils';
import { useTheme } from '../hook';


type FontWeight = 'regular' | 'medium' | 'bold' | 'semiBold';
type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface CTextProps extends TextProps {
  children?: React.ReactNode;
  size?: FontSize;
  weight?: FontWeight;
  color?: string;
  style?: StyleProp<TextStyle>;
  tx?: string;
  txt?: string;
}

const fontSizeMap: Record<FontSize, number> = {
  xs: 11,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
};

const fontWeightMap: any = {
  regular: font.regular,
  medium: font.medium,
  bold: font.bold,
  semiBold: font.semiBold,
};

export default function CText({
  children,
  size = 'md',
  weight = 'regular',
  color,                // ✅ no default here, handled below
  style,
  tx,
  txt,
  ...rest
}: CTextProps) {
  const { colors } = useTheme();              // ✅ reactive theme
  const { t, i18n } = useTranslation();            // ✅ reactive i18n

  const textColor = color ?? colors.text;

  const label = tx
    ? (i18n.exists(tx) ? t(tx) : 'no translation')
    : txt
      ? txt
      : (children as string) || '';

  return (
    <Text
      style={[
        styles.base,
        { fontSize: fontSizeMap[size], color: textColor },
        fontWeightMap[weight],
        style,
      ]}
      {...rest}
    >
      {label}  {/* ✅ single source of truth, no children ?? label */}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});