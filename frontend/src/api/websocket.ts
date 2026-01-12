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
}

export function createWebSocketClient(accessToken: string): WebSocketClient {
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
        console.log('[STOMP]', str);
      }
    },
  });

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      client.onConnect = () => {
        console.log('WebSocket connected');
        resolve();
      };

      client.onStompError = (frame) => {
        console.error('STOMP error:', frame.headers['message']);
        reject(new Error(frame.headers['message']));
      };

      client.onWebSocketClose = () => {
        console.log('WebSocket closed');
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
      console.warn('Cannot subscribe: WebSocket not connected');
      return null;
    }
    return client.subscribe(destination, callback);
  };

  const send = (destination: string, body: object) => {
    if (!client.active) {
      console.warn('Cannot send: WebSocket not connected');
      return;
    }
    client.publish({
      destination,
      body: JSON.stringify(body),
    });
  };

  const isConnected = () => client.active;

  return {
    client,
    connect,
    disconnect,
    subscribe,
    send,
    isConnected,
  };
}
