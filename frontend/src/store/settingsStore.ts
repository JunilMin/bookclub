// frontend/src/store/settingsStore.ts
import { create } from 'zustand';
import { UserLocation } from '../api/user';

// =============================================================================
// Types
// =============================================================================

// 프로필 사진 설정
export interface PhotoSettings {
  google: string | null;  // Google 프로필 사진 URL (원본, 변경 불가)
  custom: string | null;  // 사용자 커스텀 사진 URL
}

// Profile 탭 설정
export interface ProfileSettings {
  displayName: string;
  username: string;
  bio: string;
  website: string;
  selectedGenres: string[];
  keywords: string[];
  readingStyle: string;
  preferredTime: string;
  discussionSize: string;
  aiUsage: string;
  discussionGoal: number;
  noteGoal: number;
}

// Privacy 탭 설정
export interface PrivacySettings {
  visibilityScope: 'public' | 'users' | 'private';
  showEmail: boolean;
  showLocation: boolean;
  showActivity: boolean;
  userLocation: UserLocation | null;
}

// 전체 설정 상태
export interface SettingsState {
  // Profile 설정
  profile: ProfileSettings;
  // Privacy 설정
  privacy: PrivacySettings;
  // Photo 설정
  photo: PhotoSettings;
  // 원본 데이터 (변경 감지용)
  originalProfile: ProfileSettings | null;
  originalPrivacy: PrivacySettings | null;
  originalPhoto: PhotoSettings | null;
  // 상태 플래그
  isProfileDirty: boolean;
  isPrivacyDirty: boolean;
  isPhotoDirty: boolean;
  isSaving: boolean;
  // 위치 관련
  isLocationLoading: boolean;
  locationError: string | null;
  showLocationConsentModal: boolean;
  // 사진 업로드 관련
  isPhotoUploading: boolean;
  photoError: string | null;
}

export interface SettingsActions {
  // Profile 액션
  setProfileField: <K extends keyof ProfileSettings>(field: K, value: ProfileSettings[K]) => void;
  setProfile: (profile: Partial<ProfileSettings>) => void;
  addKeyword: (keyword: string) => void;
  removeKeyword: (keyword: string) => void;
  toggleGenre: (genre: string) => void;

  // Privacy 액션
  setPrivacyField: <K extends keyof PrivacySettings>(field: K, value: PrivacySettings[K]) => void;
  setPrivacy: (privacy: Partial<PrivacySettings>) => void;
  setUserLocation: (location: UserLocation | null) => void;

  // Photo 액션
  setPhotoCustom: (url: string | null) => void;
  clearPhotoCustom: () => void;
  setPhotoUploading: (uploading: boolean) => void;
  setPhotoError: (error: string | null) => void;
  markPhotoSaved: () => void;
  resetPhoto: () => void;

  // 원본 데이터 초기화 (DB에서 로드 시)
  initializeFromUser: (profile: ProfileSettings, privacy: PrivacySettings, photo: PhotoSettings) => void;

  // 변경 취소 (원본으로 복원)
  resetProfile: () => void;
  resetPrivacy: () => void;

  // 저장 상태
  setSaving: (isSaving: boolean) => void;
  markProfileSaved: () => void;
  markPrivacySaved: () => void;

  // 위치 관련
  setLocationLoading: (loading: boolean) => void;
  setLocationError: (error: string | null) => void;
  setShowLocationConsentModal: (show: boolean) => void;

  // 전체 초기화
  reset: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

// =============================================================================
// Initial State
// =============================================================================

const initialProfileSettings: ProfileSettings = {
  displayName: '',
  username: '',
  bio: '',
  website: '',
  selectedGenres: [],
  keywords: [],
  readingStyle: '',
  preferredTime: '',
  discussionSize: '',
  aiUsage: '',
  discussionGoal: 0,
  noteGoal: 0,
};

const initialPrivacySettings: PrivacySettings = {
  visibilityScope: 'public',
  showEmail: false,
  showLocation: true,
  showActivity: true,
  userLocation: null,
};

const initialPhotoSettings: PhotoSettings = {
  google: null,
  custom: null,
};

const initialState: SettingsState = {
  profile: { ...initialProfileSettings },
  privacy: { ...initialPrivacySettings },
  photo: { ...initialPhotoSettings },
  originalProfile: null,
  originalPrivacy: null,
  originalPhoto: null,
  isProfileDirty: false,
  isPrivacyDirty: false,
  isPhotoDirty: false,
  isSaving: false,
  isLocationLoading: false,
  locationError: null,
  showLocationConsentModal: false,
  isPhotoUploading: false,
  photoError: null,
};

// =============================================================================
// Helper: 깊은 비교
// =============================================================================

const isProfileEqual = (a: ProfileSettings, b: ProfileSettings): boolean => {
  return (
    a.displayName === b.displayName &&
    a.username === b.username &&
    a.bio === b.bio &&
    a.website === b.website &&
    JSON.stringify(a.selectedGenres) === JSON.stringify(b.selectedGenres) &&
    JSON.stringify(a.keywords) === JSON.stringify(b.keywords) &&
    a.readingStyle === b.readingStyle &&
    a.preferredTime === b.preferredTime &&
    a.discussionSize === b.discussionSize &&
    a.aiUsage === b.aiUsage &&
    a.discussionGoal === b.discussionGoal &&
    a.noteGoal === b.noteGoal
  );
};

const isPrivacyEqual = (a: PrivacySettings, b: PrivacySettings): boolean => {
  return (
    a.visibilityScope === b.visibilityScope &&
    a.showEmail === b.showEmail &&
    a.showLocation === b.showLocation &&
    a.showActivity === b.showActivity &&
    JSON.stringify(a.userLocation) === JSON.stringify(b.userLocation)
  );
};

const isPhotoEqual = (a: PhotoSettings, b: PhotoSettings): boolean => {
  return a.google === b.google && a.custom === b.custom;
};

// =============================================================================
// Store
// =============================================================================

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...initialState,

  // Profile 필드 개별 설정
  setProfileField: (field, value) => {
    set((state) => {
      const newProfile = { ...state.profile, [field]: value };
      const isDirty = state.originalProfile ? !isProfileEqual(newProfile, state.originalProfile) : true;
      return {
        profile: newProfile,
        isProfileDirty: isDirty,
      };
    });
  },

  // Profile 여러 필드 한번에 설정
  setProfile: (profile) => {
    set((state) => {
      const newProfile = { ...state.profile, ...profile };
      const isDirty = state.originalProfile ? !isProfileEqual(newProfile, state.originalProfile) : true;
      return {
        profile: newProfile,
        isProfileDirty: isDirty,
      };
    });
  },

  // 키워드 추가
  addKeyword: (keyword) => {
    const { profile, originalProfile } = get();
    if (profile.keywords.includes(keyword) || profile.keywords.length >= 10) return;

    const newKeywords = [...profile.keywords, keyword];
    const newProfile = { ...profile, keywords: newKeywords };
    const isDirty = originalProfile ? !isProfileEqual(newProfile, originalProfile) : true;

    set({
      profile: newProfile,
      isProfileDirty: isDirty,
    });
  },

  // 키워드 제거
  removeKeyword: (keyword) => {
    const { profile, originalProfile } = get();
    const newKeywords = profile.keywords.filter((k) => k !== keyword);
    const newProfile = { ...profile, keywords: newKeywords };
    const isDirty = originalProfile ? !isProfileEqual(newProfile, originalProfile) : true;

    set({
      profile: newProfile,
      isProfileDirty: isDirty,
    });
  },

  // 장르 토글
  toggleGenre: (genre) => {
    const { profile, originalProfile } = get();
    let newGenres: string[];

    if (profile.selectedGenres.includes(genre)) {
      newGenres = profile.selectedGenres.filter((g) => g !== genre);
    } else if (profile.selectedGenres.length < 8) {
      newGenres = [...profile.selectedGenres, genre];
    } else {
      return; // 최대 8개 제한
    }

    const newProfile = { ...profile, selectedGenres: newGenres };
    const isDirty = originalProfile ? !isProfileEqual(newProfile, originalProfile) : true;

    set({
      profile: newProfile,
      isProfileDirty: isDirty,
    });
  },

  // Privacy 필드 개별 설정
  setPrivacyField: (field, value) => {
    set((state) => {
      const newPrivacy = { ...state.privacy, [field]: value };
      const isDirty = state.originalPrivacy ? !isPrivacyEqual(newPrivacy, state.originalPrivacy) : true;
      return {
        privacy: newPrivacy,
        isPrivacyDirty: isDirty,
      };
    });
  },

  // Privacy 여러 필드 한번에 설정
  setPrivacy: (privacy) => {
    set((state) => {
      const newPrivacy = { ...state.privacy, ...privacy };
      const isDirty = state.originalPrivacy ? !isPrivacyEqual(newPrivacy, state.originalPrivacy) : true;
      return {
        privacy: newPrivacy,
        isPrivacyDirty: isDirty,
      };
    });
  },

  // 위치 설정
  setUserLocation: (location) => {
    set((state) => {
      const newPrivacy = { ...state.privacy, userLocation: location };
      const isDirty = state.originalPrivacy ? !isPrivacyEqual(newPrivacy, state.originalPrivacy) : true;
      return {
        privacy: newPrivacy,
        isPrivacyDirty: isDirty,
      };
    });
  },

  // 커스텀 사진 설정
  setPhotoCustom: (url) => {
    set((state) => {
      const newPhoto = { ...state.photo, custom: url };
      const isDirty = state.originalPhoto ? !isPhotoEqual(newPhoto, state.originalPhoto) : true;
      return {
        photo: newPhoto,
        isPhotoDirty: isDirty,
      };
    });
  },

  // 커스텀 사진 삭제 (Google 사진으로 복원)
  clearPhotoCustom: () => {
    set((state) => {
      const newPhoto = { ...state.photo, custom: null };
      const isDirty = state.originalPhoto ? !isPhotoEqual(newPhoto, state.originalPhoto) : true;
      return {
        photo: newPhoto,
        isPhotoDirty: isDirty,
      };
    });
  },

  // 사진 업로드 상태
  setPhotoUploading: (uploading) => set({ isPhotoUploading: uploading }),

  // 사진 에러
  setPhotoError: (error) => set({ photoError: error }),

  // Photo 저장 완료 후 원본 업데이트
  markPhotoSaved: () => {
    const { photo } = get();
    set({
      originalPhoto: { ...photo },
      isPhotoDirty: false,
    });
  },

  // Photo 변경 취소
  resetPhoto: () => {
    const { originalPhoto } = get();
    if (originalPhoto) {
      set({
        photo: { ...originalPhoto },
        isPhotoDirty: false,
        photoError: null,
      });
    }
  },

  // DB에서 로드한 데이터로 초기화
  initializeFromUser: (profile, privacy, photo) => {
    set({
      profile: { ...profile },
      privacy: { ...privacy },
      photo: { ...photo },
      originalProfile: { ...profile },
      originalPrivacy: { ...privacy },
      originalPhoto: { ...photo },
      isProfileDirty: false,
      isPrivacyDirty: false,
      isPhotoDirty: false,
    });
  },

  // Profile 변경 취소
  resetProfile: () => {
    const { originalProfile } = get();
    if (originalProfile) {
      set({
        profile: { ...originalProfile },
        isProfileDirty: false,
      });
    }
  },

  // Privacy 변경 취소
  resetPrivacy: () => {
    const { originalPrivacy } = get();
    if (originalPrivacy) {
      set({
        privacy: { ...originalPrivacy },
        isPrivacyDirty: false,
        locationError: null,
      });
    }
  },

  // 저장 상태 설정
  setSaving: (isSaving) => set({ isSaving }),

  // Profile 저장 완료 후 원본 업데이트
  markProfileSaved: () => {
    const { profile } = get();
    set({
      originalProfile: { ...profile },
      isProfileDirty: false,
    });
  },

  // Privacy 저장 완료 후 원본 업데이트
  markPrivacySaved: () => {
    const { privacy } = get();
    set({
      originalPrivacy: { ...privacy },
      isPrivacyDirty: false,
    });
  },

  // 위치 로딩 상태
  setLocationLoading: (loading) => set({ isLocationLoading: loading }),

  // 위치 에러
  setLocationError: (error) => set({ locationError: error }),

  // 위치 동의 모달
  setShowLocationConsentModal: (show) => set({ showLocationConsentModal: show }),

  // 전체 초기화
  reset: () => set(initialState),
}));

// =============================================================================
// Selectors
// =============================================================================

export const selectProfile = (state: SettingsStore) => state.profile;
export const selectPrivacy = (state: SettingsStore) => state.privacy;
export const selectIsProfileDirty = (state: SettingsStore) => state.isProfileDirty;
export const selectIsPrivacyDirty = (state: SettingsStore) => state.isPrivacyDirty;
export const selectIsSaving = (state: SettingsStore) => state.isSaving;
