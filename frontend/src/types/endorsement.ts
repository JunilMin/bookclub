// Endorsement system types

/**
 * The 6 endorsement categories.
 */
export type EndorsementCategory =
  | 'ENGAGEMENT'
  | 'COMMUNICATION'
  | 'RESPECT'
  | 'RULE_ADHERENCE'
  | 'PREPARATION'
  | 'REMATCH';

/**
 * All available endorsement categories with their i18n keys.
 */
export const ENDORSEMENT_CATEGORIES: {
  code: EndorsementCategory;
  i18nKey: string;
}[] = [
  { code: 'ENGAGEMENT', i18nKey: 'endorsement_category_engagement' },
  { code: 'COMMUNICATION', i18nKey: 'endorsement_category_communication' },
  { code: 'RESPECT', i18nKey: 'endorsement_category_respect' },
  { code: 'RULE_ADHERENCE', i18nKey: 'endorsement_category_ruleAdherence' },
  { code: 'PREPARATION', i18nKey: 'endorsement_category_preparation' },
  { code: 'REMATCH', i18nKey: 'endorsement_category_rematch' },
];

/**
 * A participant pending endorsement.
 */
export interface PendingParticipant {
  userId: string;
  username: string;
  photoUrl: string | null;
  alreadyEndorsed: boolean;
}

/**
 * Response from GET /api/endorsements/pending
 */
export interface PendingResponse {
  sessionId: string;
  participants: PendingParticipant[];
}

/**
 * Request body for POST /api/endorsements
 */
export interface EndorsementRequest {
  sessionId: string;
  targetUserId: string;
  selected: EndorsementCategory[];
}

/**
 * Response from POST /api/endorsements
 */
export interface EndorsementResponse {
  id: string;
  sessionId: string;
  targetUserId: string;
  targetUsername: string;
  selected: EndorsementCategory[];
  points: number;
  createdAt: string;
}

/**
 * User's endorsement statistics.
 */
export interface UserEndorsementStats {
  count: number;
  points: number;
  categoryCounts: {
    ENGAGEMENT: number;
    COMMUNICATION: number;
    RESPECT: number;
    RULE_ADHERENCE: number;
    PREPARATION: number;
    REMATCH: number;
  };
  lastEndorsedAt: string | null;
}
