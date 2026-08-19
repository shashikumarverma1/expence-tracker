import { create } from 'zustand';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../core/config/firebase';
import { collections } from '../../../core/enum/eCollections';
import { useAuthStore } from '../../../core/store/auth/useAuthStore';

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  receivedAt: string;
  read: boolean;
};

type NotificationListState = {
  items: NotificationItem[];
  isLoading: boolean;
  loadNotifications: () => Promise<void>;
  saveNotification: (title: string, body: string, data?: Record<string, unknown>) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

function getUid(): string | null {
  return useAuthStore.getState().user?.uid ?? null;
}

function notifCollectionRef(uid: string) {
  return collection(db, collections.users, uid, 'notifications');
}

export const useNotificationListStore = create<NotificationListState>((set, get) => ({
  items: [],
  isLoading: false,

  loadNotifications: async () => {
    const uid = getUid();
    if (!uid) return;

    set({ isLoading: true });
    try {
      const q = query(notifCollectionRef(uid), orderBy('receivedAt', 'desc'));
      const snap = await getDocs(q);
      const items: NotificationItem[] = snap.docs.map((d) => {
        const data = d.data();
        const ts = data.receivedAt as Timestamp | null;
        return {
          id: d.id,
          title: data.title ?? '',
          body: data.body ?? '',
          data: data.data ?? {},
          receivedAt: ts ? ts.toDate().toISOString() : new Date().toISOString(),
          read: data.read ?? false,
        };
      });
      set({ items, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  saveNotification: async (title, body, data) => {
    const uid = getUid();
    if (!uid) return;

    const newItem = {
      title,
      body,
      data: data ?? {},
      receivedAt: serverTimestamp(),
      read: false,
    };

    try {
      const ref = await addDoc(notifCollectionRef(uid), newItem);
      const localItem: NotificationItem = {
        id: ref.id,
        title,
        body,
        data: data ?? {},
        receivedAt: new Date().toISOString(),
        read: false,
      };
      set((state) => ({ items: [localItem, ...state.items] }));
    } catch {
      // ignore save errors silently
    }
  },

  markRead: async (id: string) => {
    const uid = getUid();
    if (!uid) return;

    set((state) => ({
      items: state.items.map((n) => n.id === id ? { ...n, read: true } : n),
    }));

    await updateDoc(doc(db, collections.users, uid, 'notifications', id), { read: true });
  },

  markAllRead: async () => {
    const uid = getUid();
    if (!uid) return;

    const { items } = get();
    const unread = items.filter((n) => !n.read);

    set((state) => ({
      items: state.items.map((n) => ({ ...n, read: true })),
    }));

    await Promise.all(
      unread.map((n) =>
        updateDoc(doc(db, collections.users, uid, 'notifications', n.id), { read: true })
      )
    );
  },
}));
