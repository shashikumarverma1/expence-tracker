import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import CText from '../../../core/component/CText';
import { CLoading } from '../../../core/component';
import { showAlert } from '../../../core/store/alert/useAlertStore';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAudioPlayer } from 'expo-audio';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as brandColors } from '../../../core/utils';
import { RecordingState, useRecording } from '../hooks/useRecording';
// ── Helpers ───────────────────────────────────────────────────
function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDateTime(): string {
  const d     = new Date();
  const days  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0');
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} · ${h%12||12}:${m} ${h>=12?'PM':'AM'}`;
}

// ── Waveform bar configs (fixed so hooks are stable) ──────────
const BAR_CONFIGS = [
  {dur:150,maxH:12,del:0},  {dur:220,maxH:28,del:40}, {dur:180,maxH:20,del:80},
  {dur:260,maxH:32,del:20}, {dur:140,maxH:10,del:60}, {dur:200,maxH:24,del:100},
  {dur:170,maxH:16,del:30}, {dur:240,maxH:30,del:70}, {dur:160,maxH:8,del:50},
  {dur:210,maxH:26,del:90}, {dur:190,maxH:22,del:10}, {dur:230,maxH:14,del:55},
  {dur:155,maxH:28,del:75}, {dur:245,maxH:18,del:35}, {dur:175,maxH:32,del:95},
  {dur:205,maxH:10,del:15}, {dur:165,maxH:24,del:65}, {dur:250,maxH:20,del:45},
  {dur:185,maxH:30,del:85}, {dur:215,maxH:14,del:25},
];

// ── Individual waveform bar ───────────────────────────────────
function WaveBar({ dur, maxH, del, active, barColor }: { dur: number; maxH: number; del: number; active: boolean; barColor: string }) {
  const h = useSharedValue(4);

  useEffect(() => {
    if (active) {
      h.value = withDelay(del,
        withRepeat(withSequence(
          withTiming(maxH, { duration: dur, easing: Easing.inOut(Easing.ease) }),
          withTiming(4,    { duration: dur, easing: Easing.inOut(Easing.ease) }),
        ), -1, false),
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(maxH * 0.35, { duration: 300 });
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View
      style={[{ width: 4, borderRadius: 2, backgroundColor: barColor, opacity: 0.7 }, style]}
    />
  );
}

// ── Waveform container ────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40, marginTop: 12, marginBottom: 8 }}>
      {BAR_CONFIGS.map((cfg, i) => (
        <WaveBar key={i} {...cfg} active={active} barColor={colors.primary} />
      ))}
    </View>
  );
}

// ── Pulse ring ────────────────────────────────────────────────
const CIRCLE = 90;
function PulseRing({ color, delay }: { color: string; delay: number }) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay,
      withRepeat(withSequence(
        withTiming(1,   { duration: 0 }),
        withTiming(1.9, { duration: 1400, easing: Easing.out(Easing.ease) }),
      ), -1, false),
    );
    opacity.value = withDelay(delay,
      withRepeat(withSequence(
        withTiming(0.4, { duration: 0 }),
        withTiming(0,   { duration: 1400, easing: Easing.out(Easing.ease) }),
      ), -1, false),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:    opacity.value,
    borderColor: color,
  }));

  return (
    <Animated.View
      style={[{ position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: 1.5 }, style]}
    />
  );
}

// ── Main circle button ────────────────────────────────────────
const BTN_BG = (colors: AppColors): Record<RecordingState, string> => ({
  idle:      brandColors.micBlueDark,
  recording: colors.error,
  stopped:   colors.success,
});

function CircleButton({ state, onPress }: { state: RecordingState; onPress: () => void }) {
  const { colors } = useTheme();
  const s          = makeStyles(colors);
  const bg         = BTN_BG(colors);
  const pulseColor = state === 'idle' ? brandColors.micBlue : bg[state];

  return (
    <View style={s.circleWrapper}>
      <PulseRing color={pulseColor} delay={0}   />
      <PulseRing color={pulseColor} delay={500} />

      <TouchableOpacity
        style={[s.circleBtn, { backgroundColor: bg[state] }]}
        onPress={onPress}
        activeOpacity={0.85}
        disabled={state === 'stopped'}
      >
        {state === 'stopped' ? (
          <Ionicons name="checkmark" size={38} color="#fff" />
        ) : (
          <Ionicons name="mic" size={38} color={state === 'idle' ? brandColors.micBlue : '#fff'} />
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Transcript card ───────────────────────────────────────────
function TranscriptCard({
  text,
  isTranscribing,
}: {
  text: string | null;
  isTranscribing: boolean;
}) {
  const { colors } = useTheme();
  const s           = makeStyles(colors);

  if (isTranscribing) {
    return <CLoading visible tx="record_screen.transcribing" variant="compact" />;
  }

  if (!text) return null;

  return (
    <View style={s.transcriptCard}>
      <CText tx="record_screen.your_words" style={s.transcriptLabel} />
      <CText txt={text} style={s.transcriptText} />
    </View>
  );
}

// ── Tips card ─────────────────────────────────────────────────
function TipsCard() {
  const { colors } = useTheme();
  const s          = makeStyles(colors);
  return (
    <View style={s.tips}>
      <CText txt="💡" style={s.tipsIcon} />
      <CText tx="record_screen.tips" style={s.tipsTxt} />
    </View>
  );
}

// ── Recording playback (preview before saving) ────────────────
function RecordingPlayer({ uri }: { uri: string }) {
  const { colors }             = useTheme();
  const s                      = makeStyles(colors);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current,   setCurrent]   = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [ready,     setReady]     = useState(false);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    const init = setTimeout(() => {
      try {
        const p = createAudioPlayer(uri, { updateInterval: 250 });
        p.addListener('playbackStatusUpdate', (s: any) => {
          setIsPlaying(s.playing ?? false);
          setCurrent(s.currentTime ?? 0);
          setDuration(s.duration   ?? 0);
        });
        playerRef.current = p;
        setReady(true);
      } catch (e) {
        console.warn('RecordingPlayer init failed:', e);
      }
    }, 400);

    return () => {
      clearTimeout(init);
      try { playerRef.current?.remove(); } catch {}
    };
  }, [uri]);

  const progress = duration > 0 ? Math.min(current / duration, 1) : 0;

  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (isPlaying) {
        p.pause();
      } else {
        if (current >= duration && duration > 0) p.seekTo(0);
        p.play();
      }
    } catch (e) {
      console.warn('Playback error:', e);
    }
  };

  if (!ready) {
    return <CLoading visible tx="record_screen.preparing_audio" variant="compact" />;
  }

  return (
    <View style={s.playbackBar}>
      <TouchableOpacity onPress={toggle} style={s.playbackBtn} activeOpacity={0.8}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
      </TouchableOpacity>

      <View style={s.playbackMid}>
        <CText tx="record_screen.preview_recording" style={s.playbackLabel} />
        <View style={s.playbackProgressBg}>
          <View style={[s.playbackProgressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>

      <CText
        txt={`${String(Math.floor(current / 60)).padStart(2, '0')}:${String(Math.floor(current % 60)).padStart(2, '0')} / ${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(Math.floor(duration % 60)).padStart(2, '0')}`}
        style={s.playbackTime}
      />
    </View>
  );
}

// ── Permission denied screen ──────────────────────────────────
function PermissionDenied({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { colors } = useTheme();
  const s          = makeStyles(colors);
  return (
    <View style={s.permCenter}>
      <Ionicons name="mic-off-outline" size={52} color={colors.textMuted} />
      <CText tx="record_screen.mic_needed_title" style={s.permTitle} />
      <CText tx="record_screen.mic_needed_sub" style={s.permSub} />
      <TouchableOpacity style={s.settingsBtn} onPress={onOpenSettings}>
        <CText tx="record_screen.open_settings" style={s.settingsBtnTxt} />
      </TouchableOpacity>
    </View>
  );
}

// ── RecordScreen ──────────────────────────────────────────────
export function RecordScreen() {
  const nav        = useNavigation<any>();
  const { colors } = useTheme();
  const { t }      = useTranslation();
  const styles     = makeStyles(colors);
  const {
    state,
    elapsed,
    hasPermission,
    audioUri,
    transcript,
    isTranscribing,
    startRecording,
    stopRecording,
    reset,
    openSettings,
  } = useRecording();

  const [dateStr] = useState(formatDateTime);

  // Disable Continue while Whisper is running OR transcript hasn't arrived yet
  const notReady = isTranscribing || !transcript;

  const handleClose = () => {
    if (state === 'idle') {
      nav.goBack();
      return;
    }
    showAlert(
      t('record_screen.discard_title'),
      state === 'recording'
        ? t('record_screen.discard_recording')
        : t('record_screen.discard_transcript'),
      [
        { text: t('record_screen.no'),  style: 'cancel' },
        { text: t('record_screen.yes'), style: 'destructive', onPress: () => { reset(); nav.goBack(); } },
      ],
    );
  };

  const handleCirclePress = () => {
    if (state === 'idle')           startRecording();
    else if (state === 'recording') stopRecording();
  };

  const handleContinue = () => {
    if (!transcript) return; // guard — button is already disabled, but safety-first
    nav.navigate('ConfirmTransactionScreen', { audioUri, transcript });
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#1A1825" />
        </TouchableOpacity>
        <CText tx="record_screen.title" style={styles.title} />
        <View style={styles.topRight} />
      </View>

      {/* Date */}
      <CText txt={dateStr} style={styles.dateStr} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Permission denied */}
          {hasPermission === false ? (
            <PermissionDenied onOpenSettings={openSettings} />
          ) : (
            <>
              {/* Timer */}
              <View style={styles.timerRow}>
                {(state === 'recording' || state === 'stopped') && (
                  <CText txt={formatTimer(elapsed)} style={[styles.timer, state === 'recording' && styles.timerRed]} />
                )}
              </View>

              {/* Circle button */}
              <CircleButton state={state} onPress={handleCirclePress} />

              {/* Label below circle */}
              <CText
                txt={
                  state === 'idle'      ? t('record_screen.tap_to_start') :
                  state === 'recording' ? t('record_screen.recording') :
                  isTranscribing        ? t('record_screen.processing') : ''
                }
                style={styles.stateLabel}
              />
              <CText
                txt={
                  state === 'idle'      ? t('record_screen.speak_freely') :
                  state === 'recording' ? t('record_screen.tap_to_stop') : ''
                }
                style={styles.stateHint}
              />

              {/* Waveform */}
              {(state === 'recording' || state === 'stopped') && (
                <Waveform active={state === 'recording'} />
              )}

              {/* Tips */}
              {state === 'idle' && <TipsCard />}

              {/* Live partial transcript preview while recording */}
              {state === 'recording' && !!transcript && (
                <View style={styles.livePreview}>
                  <CText tx="record_screen.live_preview" style={styles.livePreviewLabel} />
                  <CText txt={transcript} style={styles.livePreviewText} numberOfLines={4} />
                </View>
              )}

              {/* Audio playback preview */}
              {state === 'stopped' && !isTranscribing && !!audioUri && (
                <RecordingPlayer uri={audioUri} />
              )}

              {/* Transcript card */}
              {state === 'stopped' && (
                <TranscriptCard
                  text={transcript}
                  isTranscribing={isTranscribing}
                />
              )}

              {/* Bottom buttons */}
              {state === 'stopped' && (
                <View style={styles.actionRow}>
                  {/* Re-record — disabled while transcribing */}
                  <TouchableOpacity
                    style={[styles.rerecordBtn, isTranscribing && { opacity: 0.4 }]}
                    onPress={reset}
                    disabled={isTranscribing}
                  >
                    <Ionicons name="refresh" size={18} color="#6B5CE7" />
                    <CText tx="record_screen.re_record" style={styles.rerecordTxt} />
                  </TouchableOpacity>

                  {/* Continue — disabled until transcript is ready */}
                  <TouchableOpacity
                    style={[styles.continueBtn, notReady && { opacity: 0.6 }]}
                    onPress={handleContinue}
                    disabled={notReady}
                  >
                    {notReady ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <CText tx="record_screen.continue" style={styles.continueTxt} />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────
const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40 },

  topBar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  closeBtn: { padding: 4 },
  title:    { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.text },
  topRight: { width: 32 },

  dateStr: { textAlign: 'center', fontSize: 13, color: colors.textMuted, marginTop: 10, marginBottom: 8 },

  timerRow: { height: 40, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  timer:    { fontSize: 32, fontWeight: '600', color: colors.text, letterSpacing: 2 },
  timerRed: { color: colors.error },

  circleWrapper: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center', marginVertical: 4 },
  pulseRing:     { position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: 1.5 },
  circleBtn:     { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },

  stateLabel: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12, textAlign: 'center' },
  stateHint:  { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center', marginBottom: 8 },

  waveform: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40, marginTop: 12, marginBottom: 8 },
  bar:      { width: 4, borderRadius: 2, backgroundColor: colors.primary, opacity: 0.7 },

  playbackBar:          { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', backgroundColor: colors.surface, borderRadius: 14, padding: 12, marginTop: 12, borderWidth: 1, borderColor: colors.border, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  playbackBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  playbackMid:          { flex: 1, gap: 4 },
  playbackLabel:        { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  playbackProgressBg:   { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  playbackProgressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  playbackTime:         { fontSize: 11, color: colors.textMuted, fontWeight: '500' },

  tips:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginTop: 24, borderWidth: 1, borderColor: colors.border, width: '100%' },
  tipsIcon:{ fontSize: 20 },
  tipsTxt: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 20 },

  transcribingOverlay: {
    width: '100%', marginTop: 24, marginBottom: 8,
    alignItems: 'center', gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 16, padding: 28,
    borderWidth: 1, borderColor: colors.primaryDim,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  transcribingOverlayTxt: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },

  livePreview:      { width: '100%', backgroundColor: colors.primaryDim, borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: colors.border },
  livePreviewLabel: { fontSize: 10, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  livePreviewText:  { fontSize: 14, color: colors.text, lineHeight: 22 },

  transcriptCard:   { width: '100%', backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginTop: 20, borderWidth: 1, borderColor: colors.border, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, alignItems: 'center' },
  transcriptLabel:  { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, alignSelf: 'flex-start', marginBottom: 10 },
  transcriptText:   { fontSize: 15, color: colors.text, lineHeight: 24, width: '100%' },
  transcribingTxt:  { fontSize: 14, color: colors.textMuted, marginTop: 10 },

  actionRow:   { flexDirection: 'row', gap: 12, width: '100%', marginTop: 20 },
  rerecordBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface },
  rerecordTxt: { fontSize: 15, fontWeight: '600', color: colors.primary },
  continueBtn: { flex: 1.5, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
  continueTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  permCenter:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14, marginTop: 60 },
  permTitle:      { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  permSub:        { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  settingsBtn:    { marginTop: 8, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
  settingsBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
