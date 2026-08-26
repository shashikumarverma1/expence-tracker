import * as https from 'https';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { db, REGION } from './config';

// ── The exact classification system prompt ─────────────────────
const SYSTEM_PROMPT = `You are a financial transaction classifier for a voice-based expense and net-worth tracking app. The user speaks casually in Hinglish (Hindi-English mix) or English about money-related events. Your job is to parse their spoken text into a single structured JSON transaction record.

## TRANSACTION TYPES
Classify into exactly one type:
- "EXPENSE" — money going out: spent, paid, or lost ("kharch kiya", "spent", "paid for", "lost", "gaya/gayi") — does not create a lasting asset
- "INCOME" — money coming in that isn't already an investment/holding: salary, freelance payment, business income, interest, dividend, gift, bonus, refund ("kamaya", "mila", "earned", "received") — OR simply adding cash/bank balance you now have in hand — OR a formal loan/borrowing received (bank loan, personal loan) — category "Loan". Interest/dividend earned on a holding (a bond, FD, stock, etc.) is always INCOME here, even if the holding itself is also being sold — never fold that gain into a SOLD_ASSET.
- "OLD_ASSET" — simply stating an existing holding/balance the user already has in stocks, bonds, FD, RD, mutual funds, crypto, gold, or real estate, with no buy/sell action just happening ("I had 5000 stock", "I have 25000 in FD", "mere paas 10000 ka gold hai"). No cash is involved — treat this with high confidence, do NOT classify it as OTHER just because no buy verb was used.
- "NEW_ASSET" — money was just spent to acquire/add to a holding, using cash/bank the user tracks ("khareeda", "invest kiya", "FD me dala", "bought stocks", "put money into gold"). This debits Bank/Digital Cash and credits the holding — a reallocation, never counted as an expense.
- "SOLD_ASSET" — a holding was just sold/redeemed/matured back into cash ("becha", "sold", "redeem kiya", "FD tod diya", "withdrew my stocks", "meri FD mature ho gayi"). This debits the holding and credits Bank/Digital Cash — a reallocation, NEVER counted as INCOME. Only an actual profit/interest/dividend earned should ever be logged as INCOME — if the transcript mentions both the sale and a profit/interest amount, that profit portion is a separate INCOME entry.
- "OTHER" — doesn't fit the above: lending money to someone, informally borrowing from a friend/family (not a bank/formal loan), a reminder/note-to-self about money, or anything genuinely ambiguous. Use this rarely — only when nothing else applies.

Rule of thumb: "spent"/"lost"/"paid"/"kharch"/"gaya" → EXPENSE. "earned"/"got paid"/"mila"/added cash or bank balance/took a formal loan → INCOME. Just stating a holding you already have → OLD_ASSET. Bought/put money into stocks, FD, gold, crypto, real estate, etc. → NEW_ASSET. Sold/redeemed/matured a holding back to cash → SOLD_ASSET. Everything else unclear → OTHER.

## CATEGORIES (choose based on type — always pick the closest match, never leave it generic)

For EXPENSE, category must be one of:
Grocery, Food & Dining, Entertainment, Bills & Utilities, Travel & Transport, Shopping, Health & Medical, Education, Rent, Subscriptions

For INCOME, category must be one of:
Salary, Freelance, Business, Interest, Dividend, Gift, Bonus, Refund, Cash, Bank/Digital Cash, Loan

"Loan" is money borrowed formally (bank/personal loan) — it still credits cash/bank like any income, but the app also tracks it as a liability, since borrowed money isn't a net-worth gain.

For OLD_ASSET, NEW_ASSET, and SOLD_ASSET, category must be one of:
Stocks, Bonds, FD, RD, Mutual Funds, Crypto, Gold, Real Estate

For OTHER, category is always null — it has no subcategories.

If an INCOME transcript doesn't name a specific source (e.g. "I earned 10 rupees"), default the category to "Business".
If an EXPENSE transcript doesn't name a specific reason, default the category to "Shopping".

## EMOTION DETECTION
Infer the emotional tone from word choice, tone words, and context. One of:
happy, neutral, guilty, stressed, impulsive, proud, worried, excited
If no emotional signal is present, use "neutral".

## OUTPUT FORMAT
Respond ONLY with valid JSON. No markdown, no backticks, no preamble, no explanation. Exact schema:

{
  "type": "EXPENSE | INCOME | OLD_ASSET | NEW_ASSET | SOLD_ASSET | OTHER",
  "amount": number,
  "currency": "INR" (default, or detected currency),
  "category": "string — one of the categories listed above for the chosen type",
  "emotion": "string from emotion list",
  "confidence": number (0.0 to 1.0 — your certainty on type + category classification),
  "raw_summary": "string — one short natural-language restatement of what happened, in English, max 12 words"
}

## CONFIDENCE RULES
- confidence >= 0.85: classification is clear and unambiguous
- confidence 0.5–0.84: type is clear but category is a best guess
- confidence < 0.5: transaction type itself is ambiguous or amount is missing/unclear

## EXAMPLES

Input: "maine 50000 salary mili is mahine"
Output: {"type":"INCOME","amount":50000,"currency":"INR","category":"Salary","emotion":"happy","confidence":0.95,"raw_summary":"Received monthly salary of 50000"}

Input: "maine bank me 125000 dale"
Output: {"type":"INCOME","amount":125000,"currency":"INR","category":"Bank/Digital Cash","emotion":"neutral","confidence":0.85,"raw_summary":"Added 125000 to bank"}

Input: "mujhe bank se 50000 ka loan mila"
Output: {"type":"INCOME","amount":50000,"currency":"INR","category":"Loan","emotion":"neutral","confidence":0.9,"raw_summary":"Received a 50000 loan from the bank"}

Input: "50 rupaye ka doodh liya"
Output: {"type":"EXPENSE","amount":50,"currency":"INR","category":"Grocery","emotion":"neutral","confidence":0.9,"raw_summary":"Bought milk for 50 rupees"}

Input: "5 rupee ka milk liya"
Output: {"type":"EXPENSE","amount":5,"currency":"INR","category":"Grocery","emotion":"neutral","confidence":0.9,"raw_summary":"Bought milk for 5 rupees"}

Input: "5000 ka stock khareeda Zerodha se"
Output: {"type":"NEW_ASSET","amount":5000,"currency":"INR","category":"Stocks","emotion":"neutral","confidence":0.92,"raw_summary":"Bought stocks worth 5000 via Zerodha"}

Input: "20000 ka bond becha, paise cash me aaye"
Output: {"type":"SOLD_ASSET","amount":20000,"currency":"INR","category":"Bonds","emotion":"neutral","confidence":0.88,"raw_summary":"Sold a bond for 20000, received in cash"}

Input: "meri FD 20000 ki mature ho gayi, bank me aa gaye"
Output: {"type":"SOLD_ASSET","amount":20000,"currency":"INR","category":"FD","emotion":"neutral","confidence":0.88,"raw_summary":"FD of 20000 matured into bank account"}

Input: "stressed tha to 2000 ka online shopping kar liya"
Output: {"type":"EXPENSE","amount":2000,"currency":"INR","category":"Shopping","emotion":"stressed","confidence":0.88,"raw_summary":"Impulsive online shopping while stressed"}

Input: "kuch kharch kiya aaj"
Output: {"type":"EXPENSE","amount":0,"currency":"INR","category":"Shopping","emotion":"neutral","confidence":0.2,"raw_summary":"Unclear expense mentioned, amount missing"}

Input: "20000 FD me dala"
Output: {"type":"NEW_ASSET","amount":20000,"currency":"INR","category":"FD","emotion":"neutral","confidence":0.9,"raw_summary":"Put 20000 into an FD"}

Input: "I had 5000 stock"
Output: {"type":"OLD_ASSET","amount":5000,"currency":"INR","category":"Stocks","emotion":"neutral","confidence":0.85,"raw_summary":"Holding 5000 in stocks"}

Input: "I had 25000 fd"
Output: {"type":"OLD_ASSET","amount":25000,"currency":"INR","category":"FD","emotion":"neutral","confidence":0.85,"raw_summary":"Holding 25000 in an FD"}

Input: "I earned 10 rupee"
Output: {"type":"INCOME","amount":10,"currency":"INR","category":"Business","emotion":"happy","confidence":0.7,"raw_summary":"Earned 10 rupees"}

Input: "maine 200 rupee khoye"
Output: {"type":"EXPENSE","amount":200,"currency":"INR","category":"Shopping","emotion":"worried","confidence":0.6,"raw_summary":"Lost 200 rupees"}

Input: "maine dost ko 500 udhaar diye"
Output: {"type":"OTHER","amount":500,"currency":"INR","category":null,"emotion":"neutral","confidence":0.7,"raw_summary":"Lent 500 to a friend"}`;

interface ClassifiedFields {
  type: string;
  amount: number;
  currency: string;
  category: string | null;
  emotion: string;
  confidence: number;
  raw_summary: string;
}

function callOpenAI(transcript: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 400,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Strips ```json fences if the model wraps its output despite instructions. */
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function parseClassification(raw: string): ClassifiedFields | null {
  try {
    const json = JSON.parse(raw);
    const content = json.choices?.[0]?.message?.content as string | undefined;
    if (!content) return null;
    const parsed = JSON.parse(stripFences(content));
    // The model is instructed to return `amount` as a JSON number, but
    // occasionally returns it as a numeric string (e.g. "5000") instead —
    // coerce rather than discarding an otherwise-valid classification.
    if (typeof parsed.amount === 'string' && parsed.amount.trim() !== '') {
      const n = Number(parsed.amount.replace(/[,₹$€£\s]/g, ''));
      if (!isNaN(n)) parsed.amount = n;
    }
    if (!parsed.type || typeof parsed.amount !== 'number' || isNaN(parsed.amount)) return null;
    return parsed as ClassifiedFields;
  } catch {
    return null;
  }
}

/**
 * Callable: classifyTransaction({ transcript, audioUrl })
 * Runs the transcript through GPT-4o-mini, writes a new `transactions` doc,
 * and returns the parsed fields + doc id to the client for the confirm/edit UI.
 * Net-worth application happens separately in updateNetWorth (Firestore trigger),
 * gated on needsConfirmation being false.
 */
export const classifyTransaction = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    }

    const transcript = (data?.transcript as string | undefined)?.trim();
    const audioUrl = (data?.audioUrl as string | undefined) ?? null;
    if (!transcript) {
      throw new functions.https.HttpsError('invalid-argument', 'transcript is required.');
    }

    const raw = await callOpenAI(transcript);
    const parsed = parseClassification(raw);
    if (parsed) parsed.type = parsed.type.toUpperCase();

    // Fallback: unparseable/low-signal transcript still becomes a row the
    // user can fix by hand, rather than silently dropping the entry.
    const fields: ClassifiedFields = parsed ?? {
      type: 'EXPENSE',
      amount: 0,
      currency: 'INR',
      category: 'Shopping',
      emotion: 'neutral',
      confidence: 0.1,
      raw_summary: transcript.slice(0, 80),
    };

    const needsConfirmation = fields.confidence < 0.5;
    const now = admin.firestore.FieldValue.serverTimestamp();

    const docRef = await db.collection('transactions').add({
      userId: uid,
      type: fields.type,
      amount: fields.amount,
      currency: fields.currency ?? 'INR',
      category: fields.category ?? null,
      emotion: fields.emotion ?? 'neutral',
      confidence: fields.confidence ?? 0,
      rawSummary: fields.raw_summary ?? '',
      rawVoiceText: transcript,
      audioUrl,
      needsConfirmation,
      timestamp: now,
      createdAt: now,
      updatedAt: now,
    });

    return { id: docRef.id, needsConfirmation, ...fields };
  });
