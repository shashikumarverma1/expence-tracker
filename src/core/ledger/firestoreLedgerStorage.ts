// Firestore-backed persistence for the ledger store — one doc per user at
// ledgers/{uid}, replacing the AsyncStorage adapter useLedger.ts started
// with. Implements zustand persist's StateStorage interface, so it's a
// drop-in `storage:` swap; nothing in ledger.ts or useLedger.ts's actions
// needed to change.
//
// Two things AsyncStorage didn't need to worry about that Firestore does:
//  1. It's keyed by the signed-in user, resolved at call time (not at
//     store-creation time, since auth may not be ready yet).
//  2. Firestore rejects `undefined` field values (LedgerTransaction.note is
//     optional) — but since the value we're given here is already a JSON
//     string (JSON.stringify drops undefined keys on the way out), the
//     parsed object handed to setDoc is already clean.
import { deleteDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import type { StateStorage } from 'zustand/middleware';
import { auth, db } from '../config';

const COLLECTION = 'ledgers';

function currentLedgerDocRef() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  return doc(db, COLLECTION, uid);
}

export const firestoreLedgerStorage: StateStorage = {
  getItem: async (_name) => {
    const ref = currentLedgerDocRef();
    if (!ref) return null;
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return JSON.stringify(snap.data());
  },
  setItem: async (_name, value) => {
    const ref = currentLedgerDocRef();
    if (!ref) return; // not signed in yet — persist will retry on the next state change
    await setDoc(ref, JSON.parse(value));
  },
  removeItem: async (_name) => {
    const ref = currentLedgerDocRef();
    if (!ref) return;
    await deleteDoc(ref);
  },
};

/**
 * Keeps the ledger store synced across devices/tabs: subscribes to
 * ledgers/{uid} and re-hydrates the zustand store whenever the doc changes
 * remotely (a write from another device, or this device's own write coming
 * back). Call once — e.g. from the same place the app already reacts to
 * onAuthStateChanged (see src/navigation/drawer/drawer.tsx) — passing the
 * new uid on sign-in and `null` on sign-out.
 *
 * Returns an unsubscribe function; call it again (or pass a new uid) to
 * tear down the previous listener before attaching a new one.
 */
export function subscribeLedgerToFirestore(
  uid: string | null,
  onData: (raw: string | null) => void,
): () => void {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, COLLECTION, uid),
    (snap) => onData(snap.exists() ? JSON.stringify(snap.data()) : null),
    () => onData(null),
  );
}
