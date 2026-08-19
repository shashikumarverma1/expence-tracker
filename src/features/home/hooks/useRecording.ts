import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { transcribeWithWhisper } from '../utils/whisper';

export type RecordingState = 'idle' | 'recording' | 'stopped';

export interface UseRecordingReturn {
  state:           RecordingState;
  elapsed:         number;
  hasPermission:   boolean | null;
  audioUri:        string | null;
  transcript:      string | null;
  isTranscribing:  boolean;
  startRecording:  () => Promise<void>;
  stopRecording:   () => void;
  reset:           () => void;
  openSettings:    () => void;
  setTranscript:   (text: string) => void;
}

export function useRecording(): UseRecordingReturn {
  const recorder      = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 500);

  const [state,          setState]          = useState<RecordingState>('idle');
  const [hasPermission,  setHasPermission]  = useState<boolean | null>(null);
  const [audioUri,       setAudioUri]       = useState<string | null>(null);
  const [transcript,     setTranscript]     = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const finalElapsedRef      = useRef(0);
  const accumulatedRef       = useRef('');
  const stateRef             = useRef<RecordingState>('idle');
  const transcribingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechEnabledRef     = useRef(false);
  const whisperPendingRef    = useRef(false); // true while Whisper API call is in flight

  const currentElapsed = Math.floor((recorderState.durationMillis ?? 0) / 1000);
  if (state === 'recording') finalElapsedRef.current = currentElapsed;
  const elapsed = state === 'recording' ? currentElapsed : finalElapsedRef.current;

  const setStateSync = (s: RecordingState) => { stateRef.current = s; setState(s); };

  const armTranscribingTimeout = () => {
    if (transcribingTimerRef.current) clearTimeout(transcribingTimerRef.current);
    transcribingTimerRef.current = setTimeout(() => {
      setTranscript(accumulatedRef.current || null);
      setIsTranscribing(false);
    }, 3000);
  };

  const clearTranscribingTimeout = () => {
    if (transcribingTimerRef.current) {
      clearTimeout(transcribingTimerRef.current);
      transcribingTimerRef.current = null;
    }
  };

  // ── Speech recognition events ─────────────────────────────────
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript ?? '';
    if (e.isFinal) {
      if (text) accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
      setTranscript(accumulatedRef.current || null);
      if (stateRef.current !== 'recording') {
        clearTranscribingTimeout();
        setIsTranscribing(false);
      }
    } else {
      setTranscript(((accumulatedRef.current + ' ' + text).trim()) || null);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (stateRef.current === 'recording') {
      setTimeout(() => {
        if (stateRef.current !== 'recording') return;
        try {
          ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
        } catch {}
      }, 150);
      return;
    }
    // Whisper is still in flight — let it set the final transcript
    if (whisperPendingRef.current) return;
    clearTranscribingTimeout();
    setTranscript(accumulatedRef.current || null);
    setIsTranscribing(false);
  });

  useSpeechRecognitionEvent('error', () => {
    if (stateRef.current !== 'recording') {
      clearTranscribingTimeout();
      setTranscript(accumulatedRef.current || null);
      setIsTranscribing(false);
    }
  });

  // ── Permissions ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // 1. Microphone permission (expo-audio)
      const { granted: micGranted } = await getRecordingPermissionsAsync();
      if (!micGranted) {
        const { granted: g2 } = await requestRecordingPermissionsAsync();
        if (!g2) { setHasPermission(false); return; }
      }

      // 2. Speech recognition permission (@jamsch/expo-speech-recognition)
      try {
        const { granted: srGranted } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        if (!srGranted) {
          const { granted: sr2 } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          speechEnabledRef.current = sr2;
        } else {
          speechEnabledRef.current = true;
        }
      } catch {
        // Speech recognition unavailable on this device — audio-only recording still works
        speechEnabledRef.current = false;
      }

      setHasPermission(true);
    })();

    return () => { clearTranscribingTimeout(); };
  }, []);

  // ── Actions ───────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!hasPermission) return;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();

      accumulatedRef.current = '';
      finalElapsedRef.current = 0;
      setTranscript(null);
      setAudioUri(null);
      setStateSync('recording');

      // Start speech recognition only if the permission was granted
      if (speechEnabledRef.current) {
        try {
          ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
        } catch (e) {
          console.warn('Speech recognition start failed (audio recording continues):', e);
        }
      }
    } catch (e) {
      console.warn('startRecording failed:', e);
    }
  }, [hasPermission, recorder]);

  const stopRecording = useCallback(async () => {
    if (!recorderState.isRecording) return;
    try {
      setIsTranscribing(true);
      setStateSync('stopped');

      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri ?? null;
      if (uri) setAudioUri(uri);

      // Stop on-device recognition (gives partial live preview)
      if (speechEnabledRef.current) {
        try { ExpoSpeechRecognitionModule.stop(); } catch {}
      }

      // Whisper — keeps isTranscribing=true until it resolves so the 'end'
      // event can't clear the spinner or overwrite the result mid-flight
      if (uri) {
        console.log('[Recording] audio saved at:', uri);
        console.log('[Recording] on-device partial so far:', accumulatedRef.current);
        whisperPendingRef.current = true;
        try {
          const whisperText = await transcribeWithWhisper(uri);
          if (whisperText) {
            console.log('[Recording] using Whisper result');
            accumulatedRef.current = whisperText;
            setTranscript(whisperText);
          } else {
            console.log('[Recording] Whisper returned null — using on-device result');
            setTranscript(accumulatedRef.current || null);
          }
        } finally {
          whisperPendingRef.current = false;
          setIsTranscribing(false);
        }
        return;
      }

      // No audio URI — fall back to on-device only
      if (speechEnabledRef.current) {
        armTranscribingTimeout();
      } else {
        setTranscript(accumulatedRef.current || null);
        setIsTranscribing(false);
      }
    } catch (e) {
      console.warn('stopRecording failed:', e);
      setTranscript(accumulatedRef.current || null);
      setIsTranscribing(false);
    }
  }, [recorder, recorderState.isRecording]);

  const reset = useCallback(() => {
    try { ExpoSpeechRecognitionModule.abort(); } catch {}
    if (recorderState.isRecording) recorder.stop().catch(() => {});
    clearTranscribingTimeout();
    accumulatedRef.current = '';
    finalElapsedRef.current = 0;
    setStateSync('idle');
    setAudioUri(null);
    setTranscript(null);
    setIsTranscribing(false);
  }, [recorder, recorderState.isRecording]);

  const openSettings = useCallback(() => { Linking.openSettings(); }, []);

  return {
    state, elapsed, hasPermission, audioUri,
    transcript, isTranscribing,
    startRecording, stopRecording, reset, openSettings, setTranscript,
  };
}
