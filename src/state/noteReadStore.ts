import { create } from 'zustand';

// Which programme notes (template_exercise.notes) have been read and
// dismissed on the live screen, keyed by session_exercise id — so a note
// shows open the first time you reach that exercise in a session, then
// stays tucked behind the top bar's NOTE chip. In-memory only, the same
// tradeoff flashPreferenceStore accepts: after an app restart a note opens
// once more, which costs one tap and loses no training data.

interface NoteReadState {
  readIds: Record<string, true>;
  markRead: (sessionExerciseId: string) => void;
  markUnread: (sessionExerciseId: string) => void;
}

export const useNoteReadStore = create<NoteReadState>((set) => ({
  readIds: {},
  markRead: (id) => set((s) => ({ readIds: { ...s.readIds, [id]: true } })),
  markUnread: (id) =>
    set((s) => {
      const next = { ...s.readIds };
      delete next[id];
      return { readIds: next };
    }),
}));
