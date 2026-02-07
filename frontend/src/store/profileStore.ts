// frontend/src/store/profileStore.ts
import { create } from 'zustand';
import {
  getMyReputation,
  UserReputationResponse,
  ParticipationStats,
  EndorsementStatsDto,
  BadgeInfo,
  ActivityItem,
  MonthlyAttendance,
} from '../api/user';

// =============================================================================
// Types
// =============================================================================

export interface ProfileState {
  // Full reputation data (cached)
  reputationData: UserReputationResponse | null;

  // Loading states
  isLoading: boolean;
  isLoadingDetails: boolean;

  // Tab-specific loading states
  loadedTabs: {
    overview: boolean;
    activity: boolean;
    badges: boolean;
    interests: boolean;
  };

  // Cache management
  lastFetchTime: number | null;
  cacheLocale: string | null;

  // Error state
  error: string | null;
}

export interface ProfileActions {
  // Core fetch actions
  fetchReputation: (accessToken: string, locale: string, forceRefresh?: boolean) => Promise<void>;

  // Tab-specific data getters
  getParticipationStats: () => ParticipationStats | null;
  getEndorsementStats: () => EndorsementStatsDto | null;
  getBadgeInfo: () => BadgeInfo | null;
  getRecentActivities: () => ActivityItem[];
  getMonthlyAttendance: () => MonthlyAttendance[];

  // Cache control
  markTabLoaded: (tab: keyof ProfileState['loadedTabs']) => void;
  invalidateCache: () => void;
  reset: () => void;
}

export type ProfileStore = ProfileState & ProfileActions;

// =============================================================================
// Constants
// =============================================================================

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Initial State
// =============================================================================

const initialState: ProfileState = {
  reputationData: null,
  isLoading: false,
  isLoadingDetails: false,
  loadedTabs: {
    overview: false,
    activity: false,
    badges: false,
    interests: false,
  },
  lastFetchTime: null,
  cacheLocale: null,
  error: null,
};

// =============================================================================
// Store
// =============================================================================

export const useProfileStore = create<ProfileStore>((set, get) => ({
  ...initialState,

  // ---------------------------------------------------------------------------
  // fetchReputation: Fetch reputation data with caching
  // ---------------------------------------------------------------------------
  fetchReputation: async (accessToken: string, locale: string, forceRefresh = false) => {
    const state = get();

    // Check if cache is valid
    const now = Date.now();
    const cacheValid =
      state.reputationData &&
      state.lastFetchTime &&
      state.cacheLocale === locale &&
      now - state.lastFetchTime < CACHE_DURATION_MS;

    if (cacheValid && !forceRefresh) {
      // Cache hit - mark overview as loaded and return
      set((s) => ({
        loadedTabs: { ...s.loadedTabs, overview: true },
      }));
      return;
    }

    // Start loading
    set({ isLoading: true, error: null });

    try {
      const data = await getMyReputation(accessToken, locale);

      set({
        reputationData: data,
        isLoading: false,
        lastFetchTime: now,
        cacheLocale: locale,
        loadedTabs: {
          overview: true,
          activity: true,
          badges: true,
          interests: true,
        },
        error: null,
      });
    } catch (error) {
      console.error('fetchReputation failed:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reputation',
      });
    }
  },

  // ---------------------------------------------------------------------------
  // Tab-specific data getters
  // ---------------------------------------------------------------------------
  getParticipationStats: () => {
    return get().reputationData?.participationStats ?? null;
  },

  getEndorsementStats: () => {
    return get().reputationData?.endorsementStats ?? null;
  },

  getBadgeInfo: () => {
    return get().reputationData?.badgeInfo ?? null;
  },

  getRecentActivities: () => {
    return get().reputationData?.recentActivities ?? [];
  },

  getMonthlyAttendance: () => {
    return get().reputationData?.monthlyAttendance ?? [];
  },

  // ---------------------------------------------------------------------------
  // Cache control
  // ---------------------------------------------------------------------------
  markTabLoaded: (tab: keyof ProfileState['loadedTabs']) => {
    set((state) => ({
      loadedTabs: { ...state.loadedTabs, [tab]: true },
    }));
  },

  invalidateCache: () => {
    set({
      lastFetchTime: null,
      loadedTabs: {
        overview: false,
        activity: false,
        badges: false,
        interests: false,
      },
    });
  },

  reset: () => {
    set(initialState);
  },
}));

// =============================================================================
// Selectors
// =============================================================================

/**
 * Check if cache is still valid
 */
export const selectIsCacheValid = (state: ProfileStore, locale: string): boolean => {
  if (!state.reputationData || !state.lastFetchTime) return false;
  if (state.cacheLocale !== locale) return false;
  return Date.now() - state.lastFetchTime < CACHE_DURATION_MS;
};

/**
 * Get top rating category and score
 */
export const selectTopRating = (state: ProfileStore): { score: number; category: string } => {
  const scores = state.reputationData?.endorsementStats?.categoryScores;
  if (!scores) return { score: 0, category: '' };

  const entries = Object.entries(scores) as [string, number][];
  if (entries.length === 0) return { score: 0, category: '' };

  const [maxCategory, maxScore] = entries.reduce((max, curr) =>
    curr[1] > max[1] ? curr : max
  );

  return { score: maxScore, category: maxCategory };
};
