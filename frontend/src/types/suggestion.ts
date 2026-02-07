// 건의사항 타입
export interface Suggestion {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  status: SuggestionStatus;
  tags: string[];
  upvoteCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  hasVoted: boolean;
}

// 건의사항 상태
export type SuggestionStatus = 'open' | 'in_review' | 'planned' | 'implemented' | 'rejected';

// 댓글 타입
export interface SuggestionComment {
  id: string;
  suggestionId: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 건의사항 생성 요청
export interface CreateSuggestionRequest {
  title: string;
  content: string;
  tags?: string[];
}

// 댓글 생성 요청
export interface CreateCommentRequest {
  content: string;
}

// 상태 매핑 (UI 표시용)
export const STATUS_MAP: Record<SuggestionStatus, { label: string; labelEn: string; color: string }> = {
  open: { label: '대기중', labelEn: 'Pending', color: '#64748b' },
  in_review: { label: '검토중', labelEn: 'Reviewing', color: '#3b82f6' },
  planned: { label: '진행중', labelEn: 'In Progress', color: '#f59e0b' },
  implemented: { label: '해결완료', labelEn: 'Completed', color: '#10b981' },
  rejected: { label: '반려', labelEn: 'Rejected', color: '#ef4444' },
};

// 티어 정의
export const TIERS = {
  APEX: { min: 50, max: Infinity, label: 'APEX', labelKo: '최상위 건의사항' },
  ELITE: { min: 20, max: 49, label: 'ELITE', labelKo: '우수 건의사항' },
  RISING: { min: 5, max: 19, label: 'RISING', labelKo: '주목받는 건의사항' },
  EMERGING: { min: 0, max: 4, label: 'EMERGING', labelKo: '신규 건의사항' },
} as const;
