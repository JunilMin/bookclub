import { useEffect, useRef, useState, useCallback } from 'react';
import { IMessage, StompSubscription } from '@stomp/stompjs';
import { createWebSocketClient, WebSocketClient } from '../api/websocket';
import { useAuth } from '../AuthContext/AuthContext';

export function useWebSocket(sessionId: string) {
  const { accessToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);
  const subscriptionsRef = useRef<StompSubscription[]>([]);

  useEffect(() => {
    if (!accessToken || !sessionId) return;

    const wsClient = createWebSocketClient(accessToken);
    clientRef.current = wsClient;

    wsClient.connect()
      .then(() => {
        setIsConnected(true);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Failed to connect to WebSocket');
        setIsConnected(false);
      });

    return () => {
      // Unsubscribe from all subscriptions
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
      // Disconnect
      wsClient.disconnect();
      setIsConnected(false);
    };
  }, [accessToken, sessionId]);

  const subscribe = useCallback((
    destination: string,
    callback: (message: IMessage) => void
  ): (() => void) => {
    if (!clientRef.current?.isConnected()) {
      console.warn('Cannot subscribe: not connected');
      return () => {};
    }

    const subscription = clientRef.current.subscribe(destination, callback);
    if (subscription) {
      subscriptionsRef.current.push(subscription);
      return () => {
        subscription.unsubscribe();
        subscriptionsRef.current = subscriptionsRef.current.filter(s => s !== subscription);
      };
    }
    return () => {};
  }, []);

  const send = useCallback((destination: string, body: object) => {
    if (!clientRef.current?.isConnected()) {
      console.warn('Cannot send: not connected');
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
