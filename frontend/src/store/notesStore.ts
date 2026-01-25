// frontend/src/store/notesStore.ts
import { create } from 'zustand';
import { getMyNotesEnriched, UserNoteResponse } from '../api/notes';

// =============================================================================
// Types
// =============================================================================

export interface NotesState {
  // Normalized note storage
  byId: Record<string, UserNoteResponse>;
  // Ordered list of note IDs (sorted by updatedAt desc)
  order: string[];

  // Loading states
  isInitialLoading: boolean;
  isRefreshing: boolean;

  // Fetch state
  lastFetchTime: number | null;
  inFlight: boolean;

  // Error state
  error: string | null;
}

export interface NotesActions {
  // Core fetch actions
  initNotes: (accessToken: string) => Promise<void>;
  refreshNotes: (accessToken: string) => Promise<void>;

  // Data manipulation
  updateNote: (note: UserNoteResponse) => void;
  removeNote: (noteId: string) => void;
  toggleFavorite: (noteId: string) => void;

  // Reset
  reset: () => void;
}

export type NotesStore = NotesState & NotesActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: NotesState = {
  byId: {},
  order: [],
  isInitialLoading: true,
  isRefreshing: false,
  lastFetchTime: null,
  inFlight: false,
  error: null,
};

// =============================================================================
// Store
// =============================================================================

export const useNotesStore = create<NotesStore>((set, get) => ({
  ...initialState,

  // ---------------------------------------------------------------------------
  // initNotes: Initial fetch on page mount
  // ---------------------------------------------------------------------------
  initNotes: async (accessToken: string) => {
    const state = get();

    // If already have data, do silent refresh instead
    if (Object.keys(state.byId).length > 0) {
      get().refreshNotes(accessToken);
      return;
    }

    set({ isInitialLoading: true, inFlight: true, error: null });

    try {
      const notes = await getMyNotesEnriched(accessToken);

      // Sort notes by updatedAt desc (latest first)
      const sortedNotes = [...notes].sort(
        (a, b) => new Date(b.noteUpdatedAt).getTime() - new Date(a.noteUpdatedAt).getTime()
      );

      // Build normalized state
      const byId: Record<string, UserNoteResponse> = {};
      const order: string[] = [];

      sortedNotes.forEach((note) => {
        byId[note.noteId] = note;
        order.push(note.noteId);
      });

      set({
        byId,
        order,
        isInitialLoading: false,
        inFlight: false,
        lastFetchTime: Date.now(),
        error: null,
      });
    } catch (error) {
      console.error('initNotes failed:', error);
      set({
        isInitialLoading: false,
        inFlight: false,
        error: 'Failed to fetch notes',
      });
    }
  },

  // ---------------------------------------------------------------------------
  // refreshNotes: Silent background refresh
  // ---------------------------------------------------------------------------
  refreshNotes: async (accessToken: string) => {
    const state = get();

    // Deduplication: if already in flight, skip
    if (state.inFlight) {
      return;
    }

    set({ isRefreshing: true, inFlight: true });

    try {
      const notes = await getMyNotesEnriched(accessToken);

      // Sort notes by updatedAt desc
      const sortedNotes = [...notes].sort(
        (a, b) => new Date(b.noteUpdatedAt).getTime() - new Date(a.noteUpdatedAt).getTime()
      );

      // Build normalized state
      const byId: Record<string, UserNoteResponse> = {};
      const order: string[] = [];

      sortedNotes.forEach((note) => {
        byId[note.noteId] = note;
        order.push(note.noteId);
      });

      set({
        byId,
        order,
        isRefreshing: false,
        inFlight: false,
        lastFetchTime: Date.now(),
        error: null,
      });
    } catch (error) {
      console.error('refreshNotes failed:', error);
      set({
        isRefreshing: false,
        inFlight: false,
      });
    }
  },

  // ---------------------------------------------------------------------------
  // Data Manipulation
  // ---------------------------------------------------------------------------
  updateNote: (note: UserNoteResponse) => {
    set((state) => ({
      byId: { ...state.byId, [note.noteId]: note },
    }));
  },

  removeNote: (noteId: string) => {
    set((state) => {
      const newById = { ...state.byId };
      delete newById[noteId];
      const newOrder = state.order.filter((id) => id !== noteId);
      return {
        byId: newById,
        order: newOrder,
      };
    });
  },

  toggleFavorite: (noteId: string) => {
    set((state) => {
      const note = state.byId[noteId];
      if (!note) return state;
      return {
        byId: {
          ...state.byId,
          [noteId]: { ...note, isFavorite: !note.isFavorite },
        },
      };
    });
  },

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  reset: () => {
    set(initialState);
  },
}));

// =============================================================================
// Selectors
// =============================================================================

/**
 * Get all notes as array (sorted)
 */
export const selectAllNotes = (state: NotesStore): UserNoteResponse[] => {
  return state.order.map((id) => state.byId[id]).filter(Boolean);
};

/**
 * Get a single note by ID
 */
export const selectNoteById = (state: NotesStore, noteId: string): UserNoteResponse | undefined => {
  return state.byId[noteId];
};

/**
 * Get notes count
 */
export const selectNotesCount = (state: NotesStore): number => {
  return state.order.length;
};

/**
 * Get favorites count
 */
export const selectFavoritesCount = (state: NotesStore): number => {
  return state.order.filter((id) => state.byId[id]?.isFavorite).length;
};
