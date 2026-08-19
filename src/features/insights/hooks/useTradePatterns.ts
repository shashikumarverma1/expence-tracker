import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../../../core/config';

export type PatternSeverity = 'danger' | 'warning' | 'positive';

export interface TradePattern {
  text:     string;
  severity: PatternSeverity;
  count:    number;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MIN_TRADES = 5;

const SYSTEM_PROMPT =
  'Analyze these trade voice notes from an Indian F&O trader. ' +
  'Identify 3-5 recurring behavioral patterns that are costing them money. ' +
  'For each pattern write one plain English sentence a trader would immediately recognize. ' +
  'Add severity: danger if it is causing consistent losses, warning if occasional, ' +
  'positive if it is a strength. Add count of how many times it appeared. ' +
  'Return ONLY a JSON array: [{text, severity, count}]. No other text.';

async function generatePatterns(transcriptions: string[]): Promise<TradePattern[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  const userContent = transcriptions
    .map((t, i) => `Trade ${i + 1}: ${t || '(no transcript)'}`)
    .join('\n\n');

  const res = await fetch(OPENAI_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model:      'gpt-4o-mini',
      max_tokens: 600,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userContent },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const json    = await res.json();
  const raw     = (json.choices?.[0]?.message?.content as string)?.trim() ?? '[]';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as TradePattern[];
}

export function useTradePatterns() {
  const [patterns,    setPatterns]    = useState<TradePattern[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [hasDoc,      setHasDoc]      = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [entryCount,  setEntryCount]  = useState(0);

  const uid       = auth.currentUser?.uid;
  const triggered = useRef(false);

  // ── Listen for entryCount on user doc ────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      setEntryCount((snap.data()?.entryCount as number) ?? 0);
    });
    return unsub;
  }, [uid]);

  // ── Listen for existing pattern doc ──────────────────────────
  useEffect(() => {
    if (!uid) { setIsLoading(false); return; }

    const q = query(
      collection(db, 'users', uid, 'patterns'),
      orderBy('createdAt', 'desc'),
      limit(1),
    );

    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setHasDoc(false);
        setPatterns([]);
      } else {
        setHasDoc(true);
        setPatterns((snap.docs[0].data().patterns as TradePattern[]) ?? []);
      }
      setIsLoading(false);
    }, () => setIsLoading(false));

    return unsub;
  }, [uid]);

  // ── Auto-generate every time patterns tab opens (always fresh) ─
  useEffect(() => {
    if (isLoading || generating || triggered.current || !uid) return;

    triggered.current = true;
    setGenerating(true);

    (async () => {
      try {
        const tradesSnap = await getDocs(
          query(
            collection(db, 'users', uid, 'trades'),
            orderBy('createdAt', 'desc'),
            limit(5),
          ),
        );

        if (tradesSnap.size < MIN_TRADES) {
          console.log(`[Patterns] only ${tradesSnap.size} trades — need ${MIN_TRADES}`);
          setGenerating(false);
          return;
        }

        const transcriptions = tradesSnap.docs.map(
          (d) => (d.data().transcription as string) || '(no transcript)',
        );

        const result = await generatePatterns(transcriptions);

        // Delete old pattern docs then write fresh one
        const oldSnap = await getDocs(collection(db, 'users', uid, 'patterns'));
        await Promise.all(oldSnap.docs.map((d) => deleteDoc(d.ref)));

        await addDoc(collection(db, 'users', uid, 'patterns'), {
          patterns:  result,
          createdAt: serverTimestamp(),
        });
        // onSnapshot picks up the new doc → renders automatically
      } catch (e) {
        console.warn('[Patterns] generation failed:', e);
        triggered.current = false; // allow retry on next mount
      } finally {
        setGenerating(false);
      }
    })();
  }, [isLoading, uid]);

  return { patterns, isLoading, hasDoc, generating, entryCount };
}
