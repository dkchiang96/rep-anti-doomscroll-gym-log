// Session-10 brief: instrument taps-per-set and time-per-set, exposed on a
// debug screen. Local, in-memory only (cleared when a new session starts,
// not persisted to SQLite) — this measures interaction cost during the
// field test, it isn't training-log data, so it doesn't belong in the schema.
import { create } from 'zustand';

export interface SetInstrumentationRecord {
  exerciseName: string;
  setIndex: number;
  taps: number;
  seconds: number;
}

interface InstrumentationState {
  pendingTaps: number;
  lastEventAt: number;
  records: SetInstrumentationRecord[];
  recordTap: () => void;
  recordSetCompletion: (exerciseName: string, setIndex: number) => void;
  resetForNewSession: () => void;
}

export const useInstrumentationStore = create<InstrumentationState>((set, get) => ({
  pendingTaps: 0,
  lastEventAt: Date.now(),
  records: [],

  recordTap: () => set((s) => ({ pendingTaps: s.pendingTaps + 1 })),

  recordSetCompletion: (exerciseName, setIndex) => {
    const now = Date.now();
    const { pendingTaps, lastEventAt, records } = get();
    const seconds = Math.max(0, Math.round((now - lastEventAt) / 1000));
    set({
      records: [...records, { exerciseName, setIndex, taps: pendingTaps, seconds }],
      pendingTaps: 0,
      lastEventAt: now,
    });
  },

  resetForNewSession: () => set({ pendingTaps: 0, lastEventAt: Date.now(), records: [] }),
}));
