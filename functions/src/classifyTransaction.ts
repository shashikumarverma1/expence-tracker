import * as https from 'https';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { db, REGION } from './config';

// ── The exact classification system prompt ─────────────────────
const SYSTEM_PROMPT = `You are a financial transaction classifier for a voice-based expense and net-worth tracking app. The user speaks casually in Hinglish (Hindi-English mix) or English about money-related events. Your job is to parse their spoken text into a single structured JSON transaction record.

## TRANSACTION TYPES
Classify into exactly one type:
- "INCOME" — money coming in (salary, freelance payment, business income, interest, gift, bonus, refund)
- "EXPENSE" — money spent on consumption (does not create a lasting asset)
- "ASSET_ADD" — money converted into an asset (buying stocks, opening FD, adding to savings, buying gold, buying property, adding to mutual funds, crypto purchase)
- "ASSET_REDUCE" — asset converted back to cash (selling stocks, breaking FD, selling property, crypto sale, withdrawing mutual funds)
- "LIABILITY_ADD" — taking on debt (loan taken, credit card purchase on credit, borrowed money)
- "LIABILITY_REDUCE" — paying off debt (loan EMI, credit card bill payment, repaying borrowed money)

## CATEGORIES (choose based on type)

For EXPENSE, category must be one of:
Grocery, Food & Dining, Entertainment, Bills & Utilities, Travel & Transport, Shopping, Health & Medical, Education, Rent, Subscriptions, Other

For INCOME, category must be one of:
Salary, Freelance, Business, Interest, Dividend, Gift, Bonus, Refund, Other

For ASSET_ADD / ASSET_REDUCE, asset_class must be one of:
Cash, Bank/Digital Cash, Stocks, Bonds, FD, RD, Mutual Funds, Crypto, Gold, Real Estate, Other

For LIABILITY_ADD / LIABILITY_REDUCE, liability_type must be one of:
Personal Loan, Home Loan, Credit Card, Borrowed from Person, Other

## FUND SOURCE (for EXPENSE and ASSET_ADD only)
Detect where the money came from/went to if mentioned (cash, bank, card, UPI, specific account). If not mentioned, default to "Bank/Digital Cash".

## EMOTION DETECTION
Infer the emotional tone from word choice, tone words, and context. One of:
happy, neutral, guilty, stressed, impulsive, proud, worried, excited
If no emotional signal is present, use "neutral".

## OUTPUT FORMAT
Respond ONLY with valid JSON. No markdown, no backticks, no preamble, no explanation. Exact schema:

{
  "type": "INCOME | EXPENSE | ASSET_ADD | ASSET_REDUCE | LIABILITY_ADD | LIABILITY_REDUCE",
  "amount": number,
  "currency": "INR" (default, or detected currency),
  "category": "string (null if type is ASSET_* or LIABILITY_*)",
  "asset_class": "string (null unless type is ASSET_ADD or ASSET_REDUCE)",
  "liability_type": "string (null unless type is LIABILITY_ADD or LIABILITY_REDUCE)",
  "fund_source": "string (Cash | Bank/Digital Cash | Card | UPI | Other, null if not applicable)",
  "merchant_or_source": "string — who was paid or who paid (e.g. 'Swiggy', 'Company', 'Broker', null if unclear)",
  "emotion": "string from emotion list",
  "confidence": number (0.0 to 1.0 — your certainty on type + category classification),
  "raw_summary": "string — one short natural-language restatement of what happened, in English, max 12 words"
}

## CONFIDENCE RULES
- confidence >= 0.85: classification is clear and unambiguous
- confidence 0.5–0.84: type is clear but category/asset_class is a best guess
- confidence < 0.5: transaction type itself is ambiguous or amount is missing/unclear

## EXAMPLES

Input: "maine 50000 salary mili is mahine"
Output: {"type":"INCOME","amount":50000,"currency":"INR","category":"Salary","asset_class":null,"liability_type":null,"fund_source":null,"merchant_or_source":"Employer","emotion":"happy","confidence":0.95,"raw_summary":"Received monthly salary of 50000"}

Input: "50 rupaye ka doodh liya"
Output: {"type":"EXPENSE","amount":50,"currency":"INR","category":"Grocery","asset_class":null,"liability_type":null,"fund_source":"Bank/Digital Cash","merchant_or_source":null,"emotion":"neutral","confidence":0.9,"raw_summary":"Bought milk for 50 rupees"}

Input: "5000 ka stock khareeda Zerodha se"
Output: {"type":"ASSET_ADD","amount":5000,"currency":"INR","category":null,"asset_class":"Stocks","liability_type":null,"fund_source":"Bank/Digital Cash","merchant_or_source":"Zerodha","emotion":"neutral","confidence":0.92,"raw_summary":"Bought stocks worth 5000 via Zerodha"}

Input: "meri FD tod di 20000 ki"
Output: {"type":"ASSET_REDUCE","amount":20000,"currency":"INR","category":null,"asset_class":"FD","liability_type":null,"fund_source":null,"merchant_or_source":null,"emotion":"neutral","confidence":0.9,"raw_summary":"Broke FD worth 20000"}

Input: "stressed tha to 2000 ka online shopping kar liya"
Output: {"type":"EXPENSE","amount":2000,"currency":"INR","category":"Shopping","asset_class":null,"liability_type":null,"fund_source":"Bank/Digital Cash","merchant_or_source":null,"emotion":"stressed","confidence":0.88,"raw_summary":"Impulsive online shopping while stressed"}

Input: "kuch kharch kiya aaj"
Output: {"type":"EXPENSE","amount":0,"currency":"INR","category":"Other","asset_class":null,"liability_type":null,"fund_source":null,"merchant_or_source":null,"emotion":"neutral","confidence":0.2,"raw_summary":"Unclear expense mentioned, amount missing"}

Input: "10000 credit card se bill pay kiya"
Output: {"type":"LIABILITY_REDUCE","amount":10000,"currency":"INR","category":null,"asset_class":null,"liability_type":"Credit Card","fund_source":"Bank/Digital Cash","merchant_or_source":null,"emotion":"neutral","confidence":0.9,"raw_summary":"Paid credit card bill of 10000"}`;

interface ClassifiedFields {
  type: string;
  amount: number;
  currency: string;
  category: string | null;
  asset_class: string | null;
  liability_type: string | null;
  fund_source: string | null;
  merchant_or_source: string | null;
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
    if (!parsed.type || typeof parsed.amount !== 'number') return null;
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

    // Fallback: unparseable/low-signal transcript still becomes a row the
    // user can fix by hand, rather than silently dropping the entry.
    const fields: ClassifiedFields = parsed ?? {
      type: 'EXPENSE',
      amount: 0,
      currency: 'INR',
      category: 'Other',
      asset_class: null,
      liability_type: null,
      fund_source: null,
      merchant_or_source: null,
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
      assetClass: fields.asset_class ?? null,
      liabilityType: fields.liability_type ?? null,
      fundSource: fields.fund_source ?? null,
      merchantOrSource: fields.merchant_or_source ?? null,
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
