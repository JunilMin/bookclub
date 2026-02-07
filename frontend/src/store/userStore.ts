// frontend/src/store/userStore.ts
import { create } from 'zustand';

// =============================================================================
// Types
// =============================================================================

export interface UserState {
  id: string | null;
  uid: string | null;
  email: string | null;
  username: string | null;
  photoUrl: string | null;
  rating: number;
  isLoggedIn: boolean;
}

export interface UserActions {
  setUser: (user: Partial<UserState>) => void;
  clearUser: () => void;
}

export type UserStore = UserState & UserActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: UserState = {
  id: null,
  uid: null,
  email: null,
  username: null,
  photoUrl: null,
  rating: 0,
  isLoggedIn: false,
};

// =============================================================================
// Store
// =============================================================================

export const useUserStore = create<UserStore>((set) => ({
  ...initialState,

  setUser: (user: Partial<UserState>) => {
    set((state) => ({
      ...state,
      ...user,
      isLoggedIn: true,
    }));
  },

  clearUser: () => {
    set(initialState);
  },
}));

// =============================================================================
// Selectors
// =============================================================================

export const selectUserId = (state: UserStore): string | null => state.id;
export const selectUsername = (state: UserStore): string | null => state.username;
export const selectIsLoggedIn = (state: UserStore): boolean => state.isLoggedIn;
