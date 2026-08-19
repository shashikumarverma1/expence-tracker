import { create } from 'zustand';

export type MoodType = 'sad' | 'worried' | 'neutral' | 'good' | 'happy';

export interface JournalEntry {
  id: string;
  title: string;
  audioUri: string;
  transcript?: string;
  createdAt: number;
  mood?: MoodType;
  moodTag?: string;
  duration?: number; // seconds
  aiInsight?: string;
  coachMessage?: string;
  coachMoodEmoji?: string;
}

interface JournalState {
  entries: JournalEntry[];
  isRecording: boolean;
  addEntry: (entry: JournalEntry) => void;
  setEntries: (entries: JournalEntry[]) => void;
  setIsRecording: (status: boolean) => void;
}

export const useJournalStore = create<JournalState>((set) => ({
  entries: [],
  isRecording: false,
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((state) => ({ entries: [entry, ...state.entries] })),
  setIsRecording: (status) => set({ isRecording: status }),
}));