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
      parameters: { model: 'whisper-1' },
      headers:    { Authorization: `Bearer ${apiKey}` },
    });

    const result = await task.uploadAsync();

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
