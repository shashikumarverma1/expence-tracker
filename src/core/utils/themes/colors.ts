// theme.ts — TradeLog (copied from ReflectAI, no changes needed)

export const colors = {
  purple: '#6B5CE7',
  purpleLight: '#8B7CF8',
  purpleDark: '#4A3BB5',
  purpleDim: '#EEEEFF',
  purpleBg: '#F4F3FF',
  white: '#FFFFFF',
  text: '#17132d',
  textMuted: '#9896A8',
  textLight: '#C5C3D4',
  border: '#EEECF9',
  cardBg: '#FAFAFE',
  green: '#3DD68C',
  greenBg: '#EDFBF4',
  greenText: '#1A7A4A',
  amber: '#FFB547',
  amberBg: '#FFF6E8',
  amberText: '#7A5200',
  red: '#FF6B8A',
  redBg: '#FFF0F4',
  redText: '#8C1A38',
  blue: '#47C8F5',
  blueBg: '#E8F8FF',
  blueText: '#0A6080',
  micBlue: '#3B82F6',
  micBlueDark: '#1E2A45',
  black: '#534d52',
  error: '#EF4444',
  errorLight: '#FEF2F2',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
};

export const lightColors = {
  primary:      '#6B5CE7',
  primaryLight: '#8B7CF8',
  primaryDim:   '#EEEEFF',
  background:   '#F7F6FF',
  surface:      '#FFFFFF',
  text:         '#1A1825',
  textMuted:    '#9896A8',
  border:       '#EEECF9',
  error:        '#EF4444',
  success:      '#10B981',
  warning:      '#F59E0B',
  white:        '#FFFFFF',
  black:        '#000000',
};

export const darkColors: typeof lightColors = {
  primary:      '#8B7CF8',
  primaryLight: '#6B5CE7',
  primaryDim:   '#2A2640',
  background:   '#12111A',
  surface:      '#1C1A28',
  text:         '#F0EFF8',
  textMuted:    '#7A788A',
  border:       '#2E2B42',
  error:        '#FF6B6B',
  success:      '#34D399',
  warning:      '#FBBF24',
  white:        '#FFFFFF',
  black:        '#000000',
};

export type AppColors = typeof lightColors;

export const font = {
  regular:  { fontWeight: '400' as const },
  medium:   { fontWeight: '500' as const },
  semiBold: { fontWeight: '600' as const },
  bold:     { fontWeight: '700' as const },
};

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
};

export const shadow = {
  card: {
    shadowColor:   '#6B5CE7',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius:  16,
    elevation:     4,
  },
  button: {
    shadowColor:   '#6B5CE7',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius:  20,
    elevation:     8,
  },
};

// ─── TradeLog UI map ───────────────────────────────────────────
// Screen background        → lightColors.background  #F7F6FF
// Cards / modals           → lightColors.surface     #FFFFFF  + shadow.card
// Primary button           → lightColors.primary     #6B5CE7  + shadow.button
// Ghost button             → colors.purpleDim bg     #EEEEFF  + colors.purple text
// Record button bg         → colors.micBlueDark      #1E2A45
// Mic icon                 → colors.micBlue          #3B82F6
// Body text                → colors.text             #17132d
// Muted text               → colors.textMuted        #9896A8
// Borders / dividers       → colors.border           #EEECF9
// Pattern card — danger    → colors.redBg  bg        #FFF0F4  + colors.red border
// Pattern card — warning   → colors.amberBg bg       #FFF6E8  + colors.amber border
// Pattern card — positive  → colors.greenBg bg       #EDFBF4  + colors.green border
// Emotion: Panic           → colors.redBg + colors.redText
// Emotion: FOMO            → colors.amberBg + colors.amberText
// Emotion: Calm            → colors.greenBg + colors.greenText
// Emotion: Revenge         → colors.redBg + colors.red
// Paywall highlight border → lightColors.primary     #6B5CE7
// ──────────────────────────────────────────────────────────────