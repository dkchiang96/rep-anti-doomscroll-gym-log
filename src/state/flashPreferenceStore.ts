import { create } from 'zustand';

// DESIGN-SPEC.md §5.4: flash colour is "user-selectable, default
// slab-secondary." There is no backing schema column for it (adding one is
// out of scope for a UI-only session — see docs/PROGRESS.md's R5 entry), so
// this is in-memory only: it resets to the default every app launch, same
// tradeoff Session 10's instrumentationStore already accepted for
// session-scoped, non-training-log state.

type FlashTone = 'primary' | 'secondary';

interface FlashPreferenceState {
  tone: FlashTone;
  setTone: (tone: FlashTone) => void;
}

export const useFlashPreferenceStore = create<FlashPreferenceState>((set) => ({
  tone: 'secondary',
  setTone: (tone) => set({ tone }),
}));
