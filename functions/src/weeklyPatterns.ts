import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import * as https from 'https';
import { db, REGION } from './config';
import { sendExpoNotifications } from './notification/expo.service';

const MIN_TRADES = 5;

interface PatternEntry {
  text: string;
  severity: 'danger' | 'warning' | 'positive';
  count: number;
}

function callOpenAI(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ message?: { content?: string } }> };
          resolve(parsed.choices?.[0]?.message?.content ?? '');
        } catch {
          reject(new Error('Failed to parse OpenAI response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const SYSTEM_PROMPT =
  'Analyze these trade voice notes from an Indian F&O trader. ' +
  'Identify 3-5 recurring behavioral patterns that are costing them money. ' +
  'For each pattern write one plain English sentence a trader would immediately recognize. ' +
  'Add severity: danger if it is causing consistent losses, warning if occasional, ' +
  'positive if it is a strength. Add count of how many times it appeared. ' +
  'Return JSON array: [{text, severity, count}]. Return only the JSON array, no other text.';

async function processUser(
  uid: string,
  userData: admin.firestore.DocumentData,
): Promise<void> {
  const tradesSnap = await db
    .collection('users')
    .doc(uid)
    .collection('trades')
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get();

  const trades = tradesSnap.docs.map((d) => d.data());
  if (trades.length < MIN_TRADES) {
    console.log(`[weeklyPatterns] uid=${uid}: only ${trades.length} trades — skipping`);
    return;
  }

  const tradesText = trades
    .map((t, i) => `Trade ${i + 1}: ${(t['transcription'] as string | undefined) ?? '(no transcription)'}`)
    .join('\n\n');

  let patterns: PatternEntry[] = [];

  try {
    const raw = await callOpenAI(SYSTEM_PROMPT, tradesText);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    patterns = JSON.parse(cleaned) as PatternEntry[];
  } catch (e) {
    console.error(`[weeklyPatterns] GPT failed for uid=${uid}:`, e);
    return;
  }

  await db
    .collection('users')
    .doc(uid)
    .collection('patterns')
    .add({
      patterns,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(`[weeklyPatterns] Saved ${patterns.length} patterns for uid=${uid}`);

  const expoPushToken = userData['expoPushToken'] as string | undefined;
  if (expoPushToken) {
    await sendExpoNotifications([{
      to: expoPushToken,
      title: 'Your trading patterns are ready 📈',
      body: 'See the behavioral patterns that are affecting your trades this week.',
      sound: 'default',
      channelId: 'myNotificationChannel',
    }]).catch((e) => console.error(`[weeklyPatterns] Push failed for uid=${uid}:`, e));
  }
}

export const generateWeeklyPatterns = functions
  .region(REGION)
  .pubsub
  .schedule('every sunday 22:30')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    console.log('[weeklyPatterns] Starting weekly pattern generation');
    const usersSnap = await db.collection('users').get();
    console.log(`[weeklyPatterns] Processing ${usersSnap.size} users`);

    await Promise.all(
      usersSnap.docs.map((userDoc: admin.firestore.QueryDocumentSnapshot) =>
        processUser(userDoc.id, userDoc.data())
          .catch((e) => console.error(`[weeklyPatterns] Error for uid=${userDoc.id}:`, e)),
      ),
    );

    console.log('[weeklyPatterns] Done');
  });

// HTTP trigger for local testing
export const testWeeklyPatterns = functions
  .region(REGION)
  .https.onRequest(async (_req, res) => {
    const usersSnap = await db.collection('users').get();
    await Promise.all(
      usersSnap.docs.map((userDoc: admin.firestore.QueryDocumentSnapshot) =>
        processUser(userDoc.id, userDoc.data())
          .catch((e: unknown) => console.error(`Error for uid=${userDoc.id}:`, e)),
      ),
    );
    res.json({ success: true, users: usersSnap.size });
  });
