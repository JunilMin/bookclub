/**
 * Op-based Collaborative Editing Types
 *
 * 아키텍처:
 * ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 * │  Client A   │     │   Server    │     │  Client B   │
 * │             │     │  (Relay)    │     │             │
 * │ TipTap Edit │     │             │     │             │
 * │     ↓       │     │             │     │             │
 * │ Transaction │     │             │     │             │
 * │     ↓       │     │             │     │             │
 * │ Step.toJSON │──→──│ Broadcast  │──→──│ JSON→Step   │
 * │             │     │ (stateless) │     │     ↓       │
 * │             │     │             │     │ Apply Step  │
 * │             │     │             │     │ (no re-send)│
 * └─────────────┘     └─────────────┘     └─────────────┘
 *
 * 핵심 원칙:
 * 1. 로컬 편집 → 즉시 반영 (optimistic)
 * 2. 서버는 상태 저장 ❌, 연산(op)만 중계
 * 3. 원격 Step 적용 시 재전송 방지 (isRemote flag)
 */


// ============================================
// Block Model (Notion-style)
// ============================================

/**
 * Block 타입 정의 (TipTap 노드 타입에 대응)
 */
export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'listItem'
  | 'taskList'
  | 'taskItem'
  | 'blockquote'
  | 'codeBlock'
  | 'horizontalRule'
  | 'table'
  | 'tableRow'
  | 'tableCell';

/**
 * Block 모델
 * - TipTap 노드의 attribute로 blockId 부여
 * - 각 블록은 독립적인 편집 단위
 */
export interface Block {
  blockId: string;           // UUID v4
  type: BlockType;
  content: string;           // 텍스트 내용 (렌더링용 캐시)
  parentId?: string;         // 중첩 블록용 (리스트 아이템 등)
  order: number;             // 형제 블록 간 순서
  createdAt: number;
  updatedAt: number;
}

/**
 * Block의 편집 상태 (presence용)
 */
export interface BlockPresence {
  blockId: string;
  userId: string;
  username: string;
  color: string;             // 사용자별 커서 색상
  timestamp: number;
}

/**
 * Block Info (for tracking blocks in editor)
 */
export interface BlockInfo {
  id: string;
  type: BlockType;
  pos: number;              // Position in document
  size: number;             // Node size
  lockedBy?: string;        // User ID who has the lock
  lockUntil?: number;       // Lock expiration timestamp
}

/**
 * Block Lock State (client-side tracking)
 */
export interface BlockLockState {
  blockId: string;
  lockedBy: string;
  username: string;
  lockToken: string;
  lockUntil: number;
}

// ============================================
// Operation Model (ProseMirror Step 기반)
// ============================================

/**
 * Step JSON 타입 (ProseMirror Step.toJSON() 결과)
 * - ReplaceStep, ReplaceAroundStep, AddMarkStep, RemoveMarkStep 등
 */
export interface StepJSON {
  stepType: string;
  from?: number;
  to?: number;
  slice?: {
    content: any[];
    openStart?: number;
    openEnd?: number;
  };
  mark?: any;
  [key: string]: any;
}

/**
 * 편집 Operation
 * - 클라이언트가 생성하는 단위 연산
 */
export interface EditOperation {
  type: 'edit';
  docId: string;             // 문서(세션) ID
  userId: string;            // Firebase UID
  username: string;
  clientSeq: number;         // 클라이언트 시퀀스 (로컬 순서 보장)
  steps: StepJSON[];         // ProseMirror Step 배열
  clientId: string;          // 클라이언트 인스턴스 ID (탭 구분)
  timestamp: number;
}

/**
 * Presence Operation
 * - 커서 위치, 선택 영역, 편집 중인 블록 정보
 */
export interface PresenceOperation {
  type: 'presence';
  docId: string;
  userId: string;
  username: string;
  clientId: string;
  cursor?: {
    anchor: number;          // 커서 앵커 위치
    head: number;            // 커서 헤드 위치
  };
  selection?: {
    from: number;
    to: number;
  };
  activeBlockId?: string;    // 현재 편집 중인 블록
  color: string;
  timestamp: number;
}

/**
 * Join/Leave Operation
 */
export interface JoinLeaveOperation {
  type: 'join' | 'leave';
  docId: string;
  userId: string;
  username: string;
  clientId: string;
  timestamp: number;
}

/**
 * Block Reorder Operation (v1.5)
 * - Reorder blocks within the document
 */
export interface ReorderOperation {
  type: 'reorder';
  docId: string;
  userId: string;
  username: string;
  clientId: string;
  blockId: string;           // Block being moved
  fromIndex: number;         // Original position
  toIndex: number;           // New position
  baseVersion: number;       // Document version for conflict detection
  timestamp: number;
}

/**
 * Block Lock Operation (v1.5)
 * - Request/release lock on a block
 */
export interface LockOperation {
  type: 'lock_request' | 'lock_acquired' | 'lock_release' | 'lock_renew' | 'lock_denied';
  docId: string;
  userId: string;
  username: string;
  clientId: string;
  blockId: string;
  lockToken?: string;        // Token for lock validation
  lockUntil?: number;        // Lock expiration timestamp
  reason?: string;           // Reason for denial
  timestamp: number;
}

export type Operation = EditOperation | PresenceOperation | JoinLeaveOperation | ReorderOperation | LockOperation;

// ============================================
// WebSocket Message Types
// ============================================

/**
 * STOMP 메시지 토픽
 */
export const TOPICS = {
  // 클라이언트 → 서버 (SEND)
  SEND_EDIT: (docId: string) => `/app/docs/${docId}/edit`,
  SEND_PRESENCE: (docId: string) => `/app/docs/${docId}/presence`,
  SEND_JOIN: (docId: string) => `/app/docs/${docId}/join`,
  SEND_LEAVE: (docId: string) => `/app/docs/${docId}/leave`,

  // Block reorder/lock (v1.5)
  SEND_REORDER: (docId: string) => `/app/docs/${docId}/reorder`,
  SEND_LOCK: (docId: string) => `/app/docs/${docId}/lock`,

  // 서버 → 클라이언트 (SUBSCRIBE)
  RECEIVE_EDIT: (docId: string) => `/topic/docs/${docId}/edit`,
  RECEIVE_PRESENCE: (docId: string) => `/topic/docs/${docId}/presence`,
  RECEIVE_USERS: (docId: string) => `/topic/docs/${docId}/users`,

  // Block reorder/lock (v1.5)
  RECEIVE_REORDER: (docId: string) => `/topic/docs/${docId}/reorder`,
  RECEIVE_LOCK: (docId: string) => `/topic/docs/${docId}/lock`,
} as const;

/**
 * 수신 메시지 타입
 */
export interface EditMessage {
  type: 'edit';
  payload: EditOperation;
}

export interface PresenceMessage {
  type: 'presence';
  payload: PresenceOperation;
}

export interface UsersMessage {
  type: 'users';
  payload: {
    docId: string;
    users: Array<{
      userId: string;
      username: string;
      clientId: string;
      color: string;
      joinedAt: number;
    }>;
  };
}

export type WebSocketMessage = EditMessage | PresenceMessage | UsersMessage;

// ============================================
// Editor State Types
// ============================================

/**
 * 협업 에디터 상태
 */
export interface CollaborativeState {
  docId: string;
  isConnected: boolean;
  isSyncing: boolean;

  // 로컬 상태
  localClientId: string;
  localSeq: number;
  pendingSteps: StepJSON[];  // 전송 대기 중인 steps

  // 원격 사용자 상태
  remoteUsers: Map<string, RemoteUser>;
  remotePresence: Map<string, PresenceOperation>;
}

/**
 * 원격 사용자 정보
 */
export interface RemoteUser {
  userId: string;
  username: string;
  clientId: string;
  color: string;
  photoUrl?: string;
  cursor?: { anchor: number; head: number };
  selection?: { from: number; to: number };
  activeBlockId?: string;
  lastSeen: number;
}

// ============================================
// Utility Types
// ============================================

/**
 * 사용자별 색상 생성 (일관된 색상)
 */
export function getUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * 클라이언트 ID 생성 (탭/세션 구분용)
 */
export function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Block ID 생성
 */
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
