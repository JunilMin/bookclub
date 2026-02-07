// frontend/src/store/reputationStore.ts
import { create } from 'zustand';
import {
  getMyReputationSummary,
  getMyReputationDetails,
  ReputationSummaryResponse,
  ReputationDetailsResponse,
} from '../api/user';

// =============================================================================
// Types
// =============================================================================

export interface ReputationState {
  // Summary data (초기 렌더링용 - 빠른 로드)
  summaryData: ReputationSummaryResponse | null;
  isSummaryLoading: boolean;
  summaryError: string | null;

  // Details data (지연 로드 - 배지, 월별 출석 등)
  detailsData: ReputationDetailsResponse | null;
  isDetailsLoading: boolean;
  detailsFetched: boolean;

  // Cache management
  lastSummaryFetch: number | null;
  lastDetailsFetch: number | null;
  cacheLocale: string | null;
}

export interface ReputationActions {
  // Fetch actions
  fetchSummary: (accessToken: string, locale: string, forceRefresh?: boolean) => Promise<void>;
  fetchDetails: (accessToken: string, locale: string, forceRefresh?: boolean) => Promise<void>;

  // Combined activities getter (details 우선, 없으면 summary)
  getAllActivities: () => ReputationSummaryResponse['recentActivities'];

  // Cache control
  invalidateCache: () => void;
  reset: () => void;
}

export type ReputationStore = ReputationState & ReputationActions;

// =============================================================================
// Constants
// =============================================================================

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Initial State
// =============================================================================

const initialState: ReputationState = {
  summaryData: null,
  isSummaryLoading: false,
  summaryError: null,

  detailsData: null,
  isDetailsLoading: false,
  detailsFetched: false,

  lastSummaryFetch: null,
  lastDetailsFetch: null,
  cacheLocale: null,
};

// =============================================================================
// Helper Functions
// =============================================================================

const isCacheValid = (
  lastFetch: number | null,
  cacheLocale: string | null,
  currentLocale: string
): boolean => {
  if (!lastFetch) return false;
  if (cacheLocale !== currentLocale) return false;
  return Date.now() - lastFetch < CACHE_DURATION_MS;
};

// =============================================================================
// Store
// =============================================================================

export const useReputationStore = create<ReputationStore>((set, get) => ({
  ...initialState,

  // ---------------------------------------------------------------------------
  // fetchSummary: Fetch summary data with caching
  // ---------------------------------------------------------------------------
  fetchSummary: async (accessToken: string, locale: string, forceRefresh = false) => {
    const state = get();

    // Check if cache is valid
    if (!forceRefresh && isCacheValid(state.lastSummaryFetch, state.cacheLocale, locale)) {
      return;
    }

    // Already loading
    if (state.isSummaryLoading) return;

    set({ isSummaryLoading: true, summaryError: null });

    try {
      const data = await getMyReputationSummary(accessToken, locale);

      set({
        summaryData: data,
        isSummaryLoading: false,
        lastSummaryFetch: Date.now(),
        cacheLocale: locale,
        summaryError: null,
      });
    } catch (error) {
      console.error('fetchSummary failed:', error);
      set({
        isSummaryLoading: false,
        summaryError: error instanceof Error ? error.message : 'Failed to fetch summary',
      });
    }
  },

  // ---------------------------------------------------------------------------
  // fetchDetails: Fetch details data with caching
  // ---------------------------------------------------------------------------
  fetchDetails: async (accessToken: string, locale: string, forceRefresh = false) => {
    const state = get();

    // Check if cache is valid
    if (!forceRefresh && isCacheValid(state.lastDetailsFetch, state.cacheLocale, locale)) {
      return;
    }

    // Already loading or fetched
    if (state.isDetailsLoading) return;
    if (state.detailsFetched && !forceRefresh) return;

    set({ isDetailsLoading: true });

    try {
      const data = await getMyReputationDetails(accessToken, locale, {
        activitiesLimit: 50,
        months: 12,
      });

      set({
        detailsData: data,
        isDetailsLoading: false,
        detailsFetched: true,
        lastDetailsFetch: Date.now(),
      });
    } catch (error) {
      console.error('fetchDetails failed:', error);
      set({
        isDetailsLoading: false,
      });
    }
  },

  // ---------------------------------------------------------------------------
  // getAllActivities: Get activities from details or summary
  // ---------------------------------------------------------------------------
  getAllActivities: () => {
    const state = get();

    // Prefer details data if available
    if (state.detailsData?.recentActivities) {
      return state.detailsData.recentActivities;
    }

    // Fallback to summary data
    return state.summaryData?.recentActivities || [];
  },

  // ---------------------------------------------------------------------------
  // Cache control
  // ---------------------------------------------------------------------------
  invalidateCache: () => {
    set({
      lastSummaryFetch: null,
      lastDetailsFetch: null,
      detailsFetched: false,
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
 * Check if summary cache is valid
 */
export const selectIsSummaryCacheValid = (
  state: ReputationStore,
  locale: string
): boolean => {
  return isCacheValid(state.lastSummaryFetch, state.cacheLocale, locale);
};

/**
 * Check if details cache is valid
 */
export const selectIsDetailsCacheValid = (
  state: ReputationStore,
  locale: string
): boolean => {
  return isCacheValid(state.lastDetailsFetch, state.cacheLocale, locale);
};

/**
 * Get badge info (from details) or summary badges
 */
export const selectBadgeInfo = (state: ReputationStore) => {
  if (state.detailsData?.badgeInfo) {
    return state.detailsData.badgeInfo;
  }
  return null;
};

/**
 * Get monthly attendance (from details)
 */
const EMPTY_ATTENDANCE: never[] = [];
export const selectMonthlyAttendance = (state: ReputationStore) => {
  return state.detailsData?.monthlyAttendance || EMPTY_ATTENDANCE;
};

/**
 * Get all activities (details first, then summary)
 */
const EMPTY_ACTIVITIES: never[] = [];
export const selectAllActivities = (state: ReputationStore) => {
  if (state.detailsData?.recentActivities) {
    return state.detailsData.recentActivities;
  }
  return state.summaryData?.recentActivities || EMPTY_ACTIVITIES;
};
