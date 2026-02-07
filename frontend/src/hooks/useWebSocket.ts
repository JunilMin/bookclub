import { useEffect, useRef, useState, useCallback } from 'react';
import { IMessage, StompSubscription } from '@stomp/stompjs';
import { getWebSocketClient, releaseWebSocketClient, WebSocketClient } from '../api/websocket';
import { useAuth } from '../AuthContext/AuthContext';

// ============================================
// useWebSocket Hook (Singleton per session)
// ============================================
// Multiple hook instances with the same sessionId will share
// the same underlying WebSocket connection.
// ============================================

export interface UseWebSocketReturn {
  isConnected: boolean;
  error: string | null;
  subscribe: (destination: string, callback: (message: IMessage) => void) => () => void;
  send: (destination: string, body: object) => void;
}

export function useWebSocket(sessionId: string): UseWebSocketReturn {
  const { accessToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);
  const subscriptionsRef = useRef<StompSubscription[]>([]);
  const cacheKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!accessToken || !sessionId) return;

    // Get or create shared WebSocket client
    const cacheKey = `${sessionId}:${accessToken.slice(-16)}`;
    cacheKeyRef.current = cacheKey;

    const wsClient = getWebSocketClient(sessionId, accessToken);
    clientRef.current = wsClient;

    // Connect if not already connected
    if (!wsClient.isConnected()) {
      wsClient.connect()
        .then(() => {
          setIsConnected(true);
          setError(null);
        })
        .catch((err) => {
          setError(err.message || 'Failed to connect to WebSocket');
          setIsConnected(false);
        });
    } else {
      // Already connected (shared connection)
      setIsConnected(true);
      setError(null);
    }

    return () => {
      // Unsubscribe from all subscriptions created by this hook instance
      subscriptionsRef.current.forEach(sub => {
        try {
          sub.unsubscribe();
        } catch (e) {
          // Ignore errors during cleanup
        }
      });
      subscriptionsRef.current = [];

      // Release reference to shared connection
      if (cacheKeyRef.current) {
        releaseWebSocketClient(cacheKeyRef.current);
      }

      setIsConnected(false);
    };
  }, [accessToken, sessionId]);

  const subscribe = useCallback((
    destination: string,
    callback: (message: IMessage) => void
  ): (() => void) => {
    if (!clientRef.current?.isConnected()) {
      console.warn('[useWebSocket] Cannot subscribe: not connected');
      return () => {};
    }

    const subscription = clientRef.current.subscribe(destination, callback);
    if (subscription) {
      subscriptionsRef.current.push(subscription);
      return () => {
        try {
          subscription.unsubscribe();
        } catch (e) {
          // Ignore errors during cleanup
        }
        subscriptionsRef.current = subscriptionsRef.current.filter(s => s !== subscription);
      };
    }
    return () => {};
  }, []);

  const send = useCallback((destination: string, body: object) => {
    if (!clientRef.current?.isConnected()) {
      console.warn('[useWebSocket] Cannot send: not connected');
      return;
    }
    clientRef.current.send(destination, body);
  }, []);

  return {
    isConnected,
    error,
    subscribe,
    send,
  };
}
