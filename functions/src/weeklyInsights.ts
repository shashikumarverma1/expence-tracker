import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import * as https from 'https';
import { db, REGION } from './config';
import { sendExpoNotifications } from './notification/expo.service';

const MIN_ENTRIES = 3;

interface WeeklyReport {
  topMood: string;
  recurringTheme: string;
  insight: string;
  entriesCount: number;
  weekStartDate: admin.firestore.Timestamp;
  weekEndDate: admin.firestore.Timestamp;
  createdAt: admin.firestore.FieldValue;
}

interface GptInsight {
  topMood: string;
  recurringTheme: string;
  insight: string;
}

function getWeekBounds(): { weekStart: Date; weekEnd: Date; weekStartStr: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);

  const weekStartStr = weekStart.toISOString().split('T')[0];
  return { weekStart, weekEnd, weekStartStr };
}

function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 300,
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

function localTopMood(entries: admin.firestore.DocumentData[]): string {
  const moodEmojis: Record<string, string> = {
    happy:   '😊 Happy',
    good:    '🙂 Good',
    neutral: '😐 Neutral',
    worried: '😕 Anxious',
    sad:     '😢 Sad',
  };
  const counts: Record<string, number> = {};
  entries.forEach((e) => {
    const m = e['mood'] as string | undefined;
    if (m) counts[m] = (counts[m] ?? 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  return moodEmojis[top] ?? top;
}

async function processUser(
  uid: string,
  weekStart: Date,
  weekEnd: Date,
  weekStartStr: string,
  userData: admin.firestore.DocumentData,
): Promise<void> {
  const reportRef = db
    .collection('users')
    .doc(uid)
    .collection('weeklyReports')
    .doc(weekStartStr);

  // Never regenerate the same week
  const existing = await reportRef.get();
  if (existing.exists) return;

  const entriesSnap = await db
    .collection('users')
    .doc(uid)
    .collection('entries')
    .where('createdAt', '>=', weekStart.getTime())
    .where('createdAt', '<=', weekEnd.getTime())
    .get();

  const entries = entriesSnap.docs.map((d) => d.data());
  if (entries.length < MIN_ENTRIES) {
    console.log(`[weeklyInsights] uid=${uid}: only ${entries.length} entries — skipping`);
    return;
  }

  // Build fallback topMood before calling GPT
  let topMood = localTopMood(entries);
  let recurringTheme = '';
  let insight = '';

  const entriesText = entries
    .map((e: admin.firestore.DocumentData, i: number) =>
      `Entry ${i + 1}: ${(e['transcript'] as string | undefined) ?? '(no transcript)'}`)
    .join('\n\n');

  const moodsText = entries
    .map((e: admin.firestore.DocumentData) => e['mood'] as string | undefined)
    .filter(Boolean)
    .join(', ');

  const prompt =
    `Here are journal entries from the past 7 days:\n${entriesText}\n\n` +
    `Moods logged: ${moodsText}\n\n` +
    `Please analyze and return ONLY a JSON object with these exact fields:\n` +
    `{\n` +
    `  "topMood": "the most common mood as emoji + label",\n` +
    `  "recurringTheme": "the main topic or theme the user talked about in 1-3 words",\n` +
    `  "insight": "one warm, personal, powerful insight sentence about their week"\n` +
    `}\n` +
    `Return only the JSON. No other text.`;

  try {
    const raw = await callOpenAI(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<GptInsight>;
    topMood        = parsed.topMood        ?? topMood;
    recurringTheme = parsed.recurringTheme ?? '';
    insight        = parsed.insight        ?? '';
  } catch (e) {
    console.error(`[weeklyInsights] GPT failed for uid=${uid}:`, e);
    // Partial report with just topMood is saved below
  }

  const report: WeeklyReport = {
    topMood,
    recurringTheme,
    insight,
    entriesCount:  entries.length,
    weekStartDate: admin.firestore.Timestamp.fromDate(weekStart),
    weekEndDate:   admin.firestore.Timestamp.fromDate(weekEnd),
    createdAt:     admin.firestore.FieldValue.serverTimestamp(),
  };

  await reportRef.set(report);
  console.log(`[weeklyInsights] Saved report for uid=${uid} week=${weekStartStr}`);

  const expoPushToken = userData['expoPushToken'] as string | undefined;
  if (expoPushToken) {
    await sendExpoNotifications([{
      to: expoPushToken,
      title: 'Your weekly reflection is ready 📊',
      body: 'Tap to see your top mood, themes, and a personal insight from this week.',
      sound: 'default',
      channelId: 'myNotificationChannel',
    }]).catch((e) => console.error(`[weeklyInsights] Push failed for uid=${uid}:`, e));
  }
}

export const generateWeeklyInsights = functions
  .region(REGION)
  .pubsub
  .schedule('every sunday 22:00')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    console.log('[weeklyInsights] Starting weekly insights generation');
    const { weekStart, weekEnd, weekStartStr } = getWeekBounds();

    const usersSnap = await db.collection('users').get();
    console.log(`[weeklyInsights] Processing ${usersSnap.size} users`);

    await Promise.all(
      usersSnap.docs.map((userDoc: admin.firestore.QueryDocumentSnapshot) =>
        processUser(
          userDoc.id,
          weekStart,
          weekEnd,
          weekStartStr,
          userDoc.data(),
        ).catch((e) => console.error(`[weeklyInsights] Error for uid=${userDoc.id}:`, e)),
      ),
    );

    console.log('[weeklyInsights] Done');
  });

// ── Local test trigger (HTTP) — remove before production deploy ───────────────
export const testWeeklyInsights = functions
  .region(REGION)
  .https.onRequest(async (_req, res) => {
    const { weekStart, weekEnd, weekStartStr } = getWeekBounds();
    const usersSnap = await db.collection('users').get();
    await Promise.all(
      usersSnap.docs.map((userDoc: admin.firestore.QueryDocumentSnapshot) =>
        processUser(userDoc.id, weekStart, weekEnd, weekStartStr, userDoc.data())
          .catch((e: unknown) => console.error(`Error for uid=${userDoc.id}:`, e)),
      ),
    );
    res.json({ success: true, week: weekStartStr, users: usersSnap.size });
  });

// Callable — sends the weekly report notification immediately to the calling user (for testing).
export const testWeeklyReportNotification = functions
  .region(REGION)
  .https.onCall(async (_data: unknown, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Login required');

    const snap  = await db.collection('users').doc(uid).get();
    const data  = snap.data() ?? {};
    const token = data.expoPushToken as string | undefined;

    if (!token) throw new functions.https.HttpsError('failed-precondition', 'No push token saved for this user');

    const tickets = await sendExpoNotifications([{
      to:        token,
      title:     'ReflectAI Weekly Report 📊',
      body:      'Your weekly insights are ready! See your mood trends, top themes & AI reflection.',
      sound:     'default',
      channelId: 'myNotificationChannel',
      data:      { screen: 'InsightsScreen' },
    }]);

    return { success: true, tickets };
  });
