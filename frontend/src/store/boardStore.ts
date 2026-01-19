// frontend/src/store/boardStore.ts
import { create } from 'zustand';
import { Post, getAllPosts } from '../api/posts';
import { getRoomStatuses, RoomStatus } from '../api/sessions';

// =============================================================================
// Types
// =============================================================================

export interface BoardState {
  // Normalized post storage
  byId: Record<string, Post>;
  // Ordered list of post IDs (sorted by due date desc by default)
  order: string[];
  // Room statuses for active participants
  roomStatuses: Record<string, RoomStatus>;

  // Total count of posts fetched
  totalCount: number;

  // Loading states
  isInitialLoading: boolean; // Only true on first load
  isRefreshingSilent: boolean; // True during background refresh

  // Polling state
  lastFetchTime: number | null;
  pollTimerId: ReturnType<typeof setTimeout> | null;
  isPollActive: boolean;

  // Request state for deduplication
  inFlight: boolean;
  pendingRefresh: boolean;

  // Connection stability
  connectionUnstable: boolean;
  consecutiveFailures: number;
}

export interface BoardActions {
  // Core fetch actions
  initBoard: (accessToken: string, userId?: string) => Promise<void>;
  refreshNow: (reason: string, accessToken: string, userId?: string) => Promise<void>;

  // Polling control
  startPolling: (accessToken: string, userId?: string) => void;
  stopPolling: () => void;
  scheduleNextPoll: (accessToken: string, userId?: string) => void;

  // Data manipulation
  mergePosts: (posts: Post[]) => void;
  mergeRoomStatuses: (statuses: Record<string, RoomStatus>) => void;
  removePost: (postId: string) => void;
  updatePost: (post: Post) => void;

  // Reset
  reset: () => void;
}

export type BoardStore = BoardState & BoardActions;

// =============================================================================
// Constants
// =============================================================================

const POLL_INTERVAL = 15000; // 15 seconds
const MAX_CONSECUTIVE_FAILURES = 3;

// =============================================================================
// Initial State
// =============================================================================

const initialState: BoardState = {
  byId: {},
  order: [],
  roomStatuses: {},
  totalCount: 0,
  isInitialLoading: true,
  isRefreshingSilent: false,
  lastFetchTime: null,
  pollTimerId: null,
  isPollActive: false,
  inFlight: false,
  pendingRefresh: false,
  connectionUnstable: false,
  consecutiveFailures: 0,
};

// =============================================================================
// Store
// =============================================================================

export const useBoardStore = create<BoardStore>((set, get) => ({
  ...initialState,

  // ---------------------------------------------------------------------------
  // initBoard: Initial fetch on page mount
  // ---------------------------------------------------------------------------
  initBoard: async (accessToken: string, userId?: string) => {
    const state = get();

    // If already have data, don't show loading - do silent refresh
    if (Object.keys(state.byId).length > 0) {
      get().refreshNow('init-with-data', accessToken, userId);
      return;
    }

    set({ isInitialLoading: true, inFlight: true });

    try {
      const posts = await getAllPosts(accessToken, userId);

      // Sort posts by due date desc (latest first)
      const sortedPosts = [...posts].sort(
        (a, b) => new Date(b.due).getTime() - new Date(a.due).getTime()
      );

      // Build normalized state
      const byId: Record<string, Post> = {};
      const order: string[] = [];

      sortedPosts.forEach((post) => {
        byId[post.id] = post;
        order.push(post.id);
      });

      // Fetch room statuses
      let roomStatuses: Record<string, RoomStatus> = {};
      if (order.length > 0) {
        try {
          roomStatuses = await getRoomStatuses(order, accessToken);
        } catch (e) {
          console.warn('Failed to fetch room statuses:', e);
        }
      }

      set({
        byId,
        order,
        roomStatuses,
        totalCount: order.length,
        isInitialLoading: false,
        inFlight: false,
        lastFetchTime: Date.now(),
        consecutiveFailures: 0,
        connectionUnstable: false,
      });
    } catch (error) {
      console.error('initBoard failed:', error);
      set({
        isInitialLoading: false,
        inFlight: false,
        consecutiveFailures: get().consecutiveFailures + 1,
        connectionUnstable: get().consecutiveFailures + 1 >= MAX_CONSECUTIVE_FAILURES,
      });
    }
  },

  // ---------------------------------------------------------------------------
  // refreshNow: Silent background refresh
  // ---------------------------------------------------------------------------
  refreshNow: async (reason: string, accessToken: string, userId?: string) => {
    const state = get();

    // Deduplication: if already in flight, mark pending and return
    if (state.inFlight) {
      set({ pendingRefresh: true });
      return;
    }

    set({ isRefreshingSilent: true, inFlight: true });
    console.debug(`[boardStore] refreshNow called, reason: ${reason}`);

    try {
      const posts = await getAllPosts(accessToken, userId);

      // Sort posts by due date desc
      const sortedPosts = [...posts].sort(
        (a, b) => new Date(b.due).getTime() - new Date(a.due).getTime()
      );

      // Fetch room statuses
      let roomStatuses: Record<string, RoomStatus> = state.roomStatuses;
      const postIds = sortedPosts.map((p) => p.id);
      if (postIds.length > 0) {
        try {
          roomStatuses = await getRoomStatuses(postIds, accessToken);
        } catch (e) {
          console.warn('Failed to fetch room statuses:', e);
        }
      }

      // Merge posts incrementally
      get().mergePosts(sortedPosts);
      get().mergeRoomStatuses(roomStatuses);

      set({
        isRefreshingSilent: false,
        inFlight: false,
        lastFetchTime: Date.now(),
        consecutiveFailures: 0,
        connectionUnstable: false,
      });

      // Handle pending refresh
      if (get().pendingRefresh) {
        set({ pendingRefresh: false });
        get().refreshNow('pending', accessToken, userId);
      }
    } catch (error) {
      console.error('refreshNow failed:', error);
      const failures = get().consecutiveFailures + 1;
      set({
        isRefreshingSilent: false,
        inFlight: false,
        consecutiveFailures: failures,
        connectionUnstable: failures >= MAX_CONSECUTIVE_FAILURES,
      });

      // Handle pending refresh even on failure
      if (get().pendingRefresh) {
        set({ pendingRefresh: false });
      }
    }
  },

  // ---------------------------------------------------------------------------
  // Polling Control
  // ---------------------------------------------------------------------------
  startPolling: (accessToken: string, userId?: string) => {
    const state = get();
    if (state.isPollActive) return;

    set({ isPollActive: true });
    get().scheduleNextPoll(accessToken, userId);
  },

  stopPolling: () => {
    const state = get();
    if (state.pollTimerId) {
      clearTimeout(state.pollTimerId);
    }
    set({ isPollActive: false, pollTimerId: null });
  },

  scheduleNextPoll: (accessToken: string, userId?: string) => {
    const state = get();

    // Clear existing timer
    if (state.pollTimerId) {
      clearTimeout(state.pollTimerId);
    }

    if (!state.isPollActive) return;

    const timerId = setTimeout(async () => {
      // Check visibility before polling
      if (document.visibilityState !== 'visible') {
        // Reschedule when tab becomes visible again
        get().scheduleNextPoll(accessToken, userId);
        return;
      }

      await get().refreshNow('polling', accessToken, userId);
      get().scheduleNextPoll(accessToken, userId);
    }, POLL_INTERVAL);

    set({ pollTimerId: timerId });
  },

  // ---------------------------------------------------------------------------
  // Data Manipulation
  // ---------------------------------------------------------------------------
  mergePosts: (posts: Post[]) => {
    set((state) => {
      const newById = { ...state.byId };
      const incomingIds = new Set(posts.map((p) => p.id));

      // Update existing and add new posts
      posts.forEach((post) => {
        newById[post.id] = post;
      });

      // Remove deleted posts (posts that exist in state but not in incoming)
      const removedIds = state.order.filter((id) => !incomingIds.has(id));
      removedIds.forEach((id) => {
        delete newById[id];
      });

      // Build new order from incoming posts (already sorted)
      const newOrder = posts.map((p) => p.id);

      return {
        byId: newById,
        order: newOrder,
        totalCount: newOrder.length,
      };
    });
  },

  mergeRoomStatuses: (statuses: Record<string, RoomStatus>) => {
    set((state) => ({
      roomStatuses: { ...state.roomStatuses, ...statuses },
    }));
  },

  removePost: (postId: string) => {
    set((state) => {
      const newById = { ...state.byId };
      delete newById[postId];
      const newOrder = state.order.filter((id) => id !== postId);
      return {
        byId: newById,
        order: newOrder,
        totalCount: newOrder.length,
      };
    });
  },

  updatePost: (post: Post) => {
    set((state) => ({
      byId: { ...state.byId, [post.id]: post },
    }));
  },

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  reset: () => {
    const state = get();
    if (state.pollTimerId) {
      clearTimeout(state.pollTimerId);
    }
    set(initialState);
  },
}));

// =============================================================================
// Selectors
// =============================================================================

/**
 * Get all posts as array (sorted)
 */
export const selectAllPosts = (state: BoardStore): Post[] => {
  return state.order.map((id) => state.byId[id]).filter(Boolean);
};

/**
 * Get a single post by ID
 */
export const selectPostById = (state: BoardStore, postId: string): Post | undefined => {
  return state.byId[postId];
};

/**
 * Get room status for a post
 */
export const selectRoomStatus = (
  state: BoardStore,
  postId: string
): RoomStatus | undefined => {
  return state.roomStatuses[postId];
};
