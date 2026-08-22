import { File, UploadTask, UploadType } from 'expo-file-system';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Sends a local audio file to OpenAI Whisper and returns the transcript.
 * Uses expo-file-system SDK 56 UploadTask (the old uploadAsync API was removed).
 * Returns null if the key is missing, the file can't be read, or the request fails.
 */
export async function transcribeWithWhisper(audioUri: string): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    console.log('[Whisper] skipped — EXPO_PUBLIC_OPENAI_API_KEY not set');
    return null;
  }

  try {
    const file = new File(audioUri);
    const task = new UploadTask(file, WHISPER_URL, {
      uploadType: UploadType.MULTIPART,
      fieldName:  'file',
      mimeType:   'audio/m4a',
      parameters: {
        model: 'whisper-1',
        // Force Roman script — without a language hint, Whisper auto-detects
        // spoken Hindi and transcribes in Devanagari, which the classifier
        // prompt (Hinglish examples like "maine 50000 salary mili") can't
        // read. "language: en" + a Hinglish-styled prompt keeps output in
        // English/Hinglish Roman script even for Hindi speech.
        language: 'en',
        prompt: 'Transcribe in English or Hinglish (Hindi written in Roman/English letters), never in Devanagari script. For example: "maine 500 rupaye kharch kiye" not "मैंने 500 रुपये खर्च किए".',
      },
      headers:    { Authorization: `Bearer ${apiKey}` },
    });

    const result = await Promise.race([
      task.uploadAsync(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Whisper upload timed out')), 20000),
      ),
    ]);

    if (result.status !== 200) {
      console.warn('[Whisper] API error:', result.status, result.body);
      return null;
    }

    const json   = JSON.parse(result.body);
    const text   = (json.text as string)?.trim() || null;
    console.log('[Whisper] transcript:', text);
    return text;
  } catch (e) {
    console.warn('[Whisper] transcription failed:', e);
    return null;
  }
}
