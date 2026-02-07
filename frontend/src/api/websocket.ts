import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_URL = 'http://localhost:8080/ws';

export interface WebSocketClient {
  client: Client;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (destination: string, callback: (message: IMessage) => void) => StompSubscription | null;
  send: (destination: string, body: object) => void;
  isConnected: () => boolean;
  addRef: () => void;
  removeRef: () => number;
  getRefCount: () => number;
}

// ============================================
// WebSocket Connection Cache (Singleton per session/token)
// ============================================

interface CachedConnection {
  client: WebSocketClient;
  refCount: number;
  sessionId: string;
  token: string;
}

const connectionCache = new Map<string, CachedConnection>();

function getCacheKey(sessionId: string, token: string): string {
  // Use sessionId + token hash as cache key
  return `${sessionId}:${token.slice(-16)}`;
}

/**
 * Get or create a WebSocket client for the given session.
 * This ensures only one connection per session exists.
 */
export function getWebSocketClient(sessionId: string, accessToken: string): WebSocketClient {
  const cacheKey = getCacheKey(sessionId, accessToken);

  const cached = connectionCache.get(cacheKey);
  if (cached && cached.client.isConnected()) {
    console.log(`[WS] Reusing existing connection for session ${sessionId} (refCount: ${cached.refCount + 1})`);
    cached.client.addRef();
    return cached.client;
  }

  // Clean up stale connection if exists
  if (cached) {
    console.log(`[WS] Cleaning up stale connection for session ${sessionId}`);
    connectionCache.delete(cacheKey);
  }

  console.log(`[WS] Creating new connection for session ${sessionId}`);
  const client = createWebSocketClient(accessToken, cacheKey);

  connectionCache.set(cacheKey, {
    client,
    refCount: 1,
    sessionId,
    token: accessToken,
  });

  return client;
}

/**
 * Release a WebSocket client reference.
 * Only disconnects when refCount reaches 0.
 */
export function releaseWebSocketClient(cacheKey: string): void {
  const cached = connectionCache.get(cacheKey);
  if (!cached) return;

  const remaining = cached.client.removeRef();
  console.log(`[WS] Released connection for session ${cached.sessionId} (refCount: ${remaining})`);

  if (remaining <= 0) {
    console.log(`[WS] Disconnecting connection for session ${cached.sessionId} (no more refs)`);
    cached.client.disconnect();
    connectionCache.delete(cacheKey);
  }
}

export function createWebSocketClient(accessToken: string, _cacheKey?: string): WebSocketClient {
  let refCount = 1;

  const client = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    debug: (str) => {
      if (process.env.NODE_ENV === 'development') {
        // Reduce log spam - only log important messages
        if (str.includes('CONNECT') || str.includes('DISCONNECT') || str.includes('ERROR')) {
          console.log('[STOMP]', str);
        }
      }
    },
  });

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (client.active) {
        console.log('[WS] Already connected');
        resolve();
        return;
      }

      client.onConnect = () => {
        console.log('[WS] WebSocket connected');
        resolve();
      };

      client.onStompError = (frame) => {
        console.error('[WS] STOMP error:', frame.headers['message']);
        reject(new Error(frame.headers['message']));
      };

      client.onWebSocketClose = () => {
        console.log('[WS] WebSocket closed');
      };

      client.activate();
    });
  };

  const disconnect = () => {
    if (client.active) {
      client.deactivate();
    }
  };

  const subscribe = (destination: string, callback: (message: IMessage) => void): StompSubscription | null => {
    if (!client.active) {
      console.warn('[WS] Cannot subscribe: WebSocket not connected');
      return null;
    }
    return client.subscribe(destination, callback);
  };

  const send = (destination: string, body: object) => {
    if (!client.active) {
      console.warn('[WS] Cannot send: WebSocket not connected');
      return;
    }
    client.publish({
      destination,
      body: JSON.stringify(body),
    });
  };

  const isConnected = () => client.active;

  const addRef = () => {
    refCount++;
  };

  const removeRef = () => {
    refCount--;
    return refCount;
  };

  const getRefCount = () => refCount;

  return {
    client,
    connect,
    disconnect,
    subscribe,
    send,
    isConnected,
    addRef,
    removeRef,
    getRefCount,
  };
}
