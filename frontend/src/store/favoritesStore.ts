// frontend/src/store/favoritesStore.ts
import { create } from 'zustand';
import { getMyFav, UserFavorite, AIRecommendation, regenerateAIRecommendations, getEnhancedAIRecommendations } from '../api/favorites';
import { getBookByISBN, BookSearchResult } from '../api/bookSearch';

// =============================================================================
// Types
// =============================================================================

export interface EnrichedFavorite extends UserFavorite {
  bookInfo?: BookSearchResult;
}

export interface EnrichedAIRecommendation extends AIRecommendation {
  bookInfo?: BookSearchResult;
}

export interface FavoritesState {
  // Data
  userFavorites: EnrichedFavorite[];
  aiRecommendations: EnrichedAIRecommendation[];

  // Loading states
  isLoading: boolean;
  isEnriching: boolean;
  isRegenerating: boolean;
  error: string | null;

  // Cache management
  lastFetchTime: number | null;
}

export interface FavoritesActions {
  // Fetch
  fetchFavorites: (forceRefresh?: boolean, lang?: string) => Promise<void>;

  // AI Recommendations
  regenerateAIRecommendations: (lang?: string) => Promise<boolean>;

  // Mutations
  addFavorite: (favorite: EnrichedFavorite) => void;
  removeFavorite: (isbn: string) => void;
  updateFavoriteBookInfo: (isbn: string, bookInfo: BookSearchResult) => void;

  // Cache control
  invalidateCache: () => void;
  reset: () => void;
}

export type FavoritesStore = FavoritesState & FavoritesActions;

// =============================================================================
// Constants
// =============================================================================

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Initial State
// =============================================================================

const initialState: FavoritesState = {
  userFavorites: [],
  aiRecommendations: [],
  isLoading: false,
  isEnriching: false,
  isRegenerating: false,
  error: null,
  lastFetchTime: null,
};

// =============================================================================
// Helper Functions
// =============================================================================

const isCacheValid = (lastFetchTime: number | null): boolean => {
  if (!lastFetchTime) return false;
  return Date.now() - lastFetchTime < CACHE_DURATION_MS;
};

// Enrich favorites with book info (background)
const enrichWithBookInfo = async <T extends { isbn: string }>(
  items: T[]
): Promise<(T & { bookInfo?: BookSearchResult })[]> => {
  return Promise.all(
    items.map(async (item) => {
      try {
        const bookInfo = await getBookByISBN(item.isbn);
        return { ...item, bookInfo: bookInfo || undefined };
      } catch {
        return { ...item, bookInfo: undefined };
      }
    })
  );
};

// =============================================================================
// Store
// =============================================================================

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  ...initialState,

  // ---------------------------------------------------------------------------
  // fetchFavorites: 2-phase loading with caching
  // ---------------------------------------------------------------------------
  fetchFavorites: async (forceRefresh = false, lang = 'ko') => {
    const state = get();

    // Check cache validity
    if (!forceRefresh && isCacheValid(state.lastFetchTime)) {
      return;
    }

    // Prevent duplicate requests
    if (state.isLoading) return;

    set({ isLoading: true, error: null });

    try {
      // Fetch user favorites and AI recommendations in parallel
      const [fav, aiResponse] = await Promise.all([
        getMyFav(),
        getEnhancedAIRecommendations(lang),
      ]);

      // AI recommendations: enhanced API already includes title/author/coverUrl (no N+1)
      const enrichedAIRecs: EnrichedAIRecommendation[] = aiResponse.recommendations.map((rec) => ({
        isbn: rec.isbn,
        reason: rec.reason,
        recommendedAt: rec.recommendedAt,
        bookInfo: {
          isbn: rec.isbn,
          title: rec.title,
          author: rec.author,
          thumbnail: rec.coverUrl ? { small: rec.coverUrl, medium: rec.coverUrl } : undefined,
          categories: rec.genre ? [rec.genre] : [],
        },
      }));

      // Phase 1: Show user favorites basic + AI already enriched
      const basicUserFavs: EnrichedFavorite[] = (fav.user || []).map((f) => ({ ...f }));

      set({
        userFavorites: basicUserFavs,
        aiRecommendations: enrichedAIRecs,
        isLoading: false,
        isEnriching: true,
        lastFetchTime: Date.now(),
      });

      // Phase 2: Enrich only user favorites (AI already done)
      const enrichedUserFavs = await enrichWithBookInfo(fav.user || []);

      set({
        userFavorites: enrichedUserFavs,
        isEnriching: false,
      });
    } catch (error) {
      console.error('fetchFavorites failed:', error);
      set({
        isLoading: false,
        isEnriching: false,
        error: error instanceof Error ? error.message : 'Failed to fetch favorites',
      });
    }
  },

  // ---------------------------------------------------------------------------
  // regenerateAIRecommendations: Request new AI recommendations
  // ---------------------------------------------------------------------------
  regenerateAIRecommendations: async (lang = 'ko') => {
    const state = get();
    if (state.isRegenerating) return false;

    set({ isRegenerating: true, error: null });

    try {
      const response = await regenerateAIRecommendations(lang);

      if (response.success && response.data) {
        // Convert enhanced recommendations to EnrichedAIRecommendation format
        const newRecommendations: EnrichedAIRecommendation[] = response.data.recommendations.map((rec) => ({
          isbn: rec.isbn,
          reason: rec.reason,
          recommendedAt: rec.recommendedAt,
          bookInfo: {
            isbn: rec.isbn,
            title: rec.title,
            author: rec.author,
            thumbnail: rec.coverUrl ? { small: rec.coverUrl, medium: rec.coverUrl } : undefined,
            categories: rec.genre ? [rec.genre] : [],
          },
        }));

        set({
          aiRecommendations: newRecommendations,
          isRegenerating: false,
          lastFetchTime: Date.now(),
        });

        return true;
      } else {
        throw new Error(response.error || 'Failed to regenerate recommendations');
      }
    } catch (error) {
      console.error('regenerateAIRecommendations failed:', error);
      set({
        isRegenerating: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate recommendations',
      });
      return false;
    }
  },

  // ---------------------------------------------------------------------------
  // addFavorite: Optimistically add to local state
  // ---------------------------------------------------------------------------
  addFavorite: (favorite) => {
    set((state) => ({
      userFavorites: [...state.userFavorites, favorite],
    }));
  },

  // ---------------------------------------------------------------------------
  // removeFavorite: Optimistically remove from local state
  // ---------------------------------------------------------------------------
  removeFavorite: (isbn) => {
    set((state) => ({
      userFavorites: state.userFavorites.filter((f) => f.isbn !== isbn),
    }));
  },

  // ---------------------------------------------------------------------------
  // updateFavoriteBookInfo: Update book info for a specific favorite
  // ---------------------------------------------------------------------------
  updateFavoriteBookInfo: (isbn, bookInfo) => {
    set((state) => ({
      userFavorites: state.userFavorites.map((f) =>
        f.isbn === isbn ? { ...f, bookInfo } : f
      ),
    }));
  },

  // ---------------------------------------------------------------------------
  // Cache control
  // ---------------------------------------------------------------------------
  invalidateCache: () => {
    set({ lastFetchTime: null });
  },

  reset: () => {
    set(initialState);
  },
}));

// =============================================================================
// Selectors
// =============================================================================

/**
 * Check if a book is in favorites
 */
export const selectIsBookFavorited = (
  state: FavoritesStore,
  isbn: string | undefined
): boolean => {
  if (!isbn) return false;
  return state.userFavorites.some((f) => f.isbn === isbn);
};

/**
 * Get favorite ISBNs as a Set (for efficient lookup)
 */
export const selectFavoriteIsbnSet = (state: FavoritesStore): Set<string> => {
  return new Set(state.userFavorites.map((f) => f.isbn));
};

/**
 * Get total count of all favorites
 */
export const selectTotalCount = (state: FavoritesStore): number => {
  return state.userFavorites.length + state.aiRecommendations.length;
};

/**
 * Check if cache is valid
 */
export const selectIsCacheValid = (state: FavoritesStore): boolean => {
  return isCacheValid(state.lastFetchTime);
};
