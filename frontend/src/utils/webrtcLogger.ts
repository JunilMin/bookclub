/**
 * WebRTC Logger Utility
 *
 * Provides leveled logging for WebRTC operations.
 * Set LOG_LEVEL in development/production as needed.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

// Set default log level based on environment
const DEFAULT_LOG_LEVEL: LogLevel =
  import.meta.env.DEV ? 'debug' : 'warn';

class WebRTCLogger {
  private level: LogLevel;
  private prefix = '[WebRTC]';

  constructor(level?: LogLevel) {
    this.level = level ?? DEFAULT_LOG_LEVEL;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.prefix, ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.prefix, ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.prefix, ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.prefix, ...args);
    }
  }

  /**
   * Log with timing information
   */
  time(label: string): void {
    if (this.shouldLog('debug')) {
      console.time(`${this.prefix} ${label}`);
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog('debug')) {
      console.timeEnd(`${this.prefix} ${label}`);
    }
  }

  /**
   * Log connection state changes
   */
  connectionState(peerId: string, state: RTCPeerConnectionState): void {
    const level = state === 'failed' || state === 'disconnected' ? 'warn' : 'info';
    if (this.shouldLog(level)) {
      const emoji = {
        new: '🆕',
        connecting: '🔄',
        connected: '✅',
        disconnected: '⚠️',
        failed: '❌',
        closed: '🚫',
      }[state] || '❓';

      this[level](`${emoji} Connection state [${peerId}]: ${state}`);
    }
  }

  /**
   * Log ICE connection state changes
   */
  iceState(peerId: string, state: RTCIceConnectionState): void {
    if (this.shouldLog('debug')) {
      const emoji = {
        new: '🆕',
        checking: '🔍',
        connected: '✅',
        completed: '✅',
        disconnected: '⚠️',
        failed: '❌',
        closed: '🚫',
      }[state] || '❓';

      this.debug(`${emoji} ICE state [${peerId}]: ${state}`);
    }
  }

  /**
   * Log signaling events
   */
  signal(type: string, direction: 'sent' | 'received', peerId?: string): void {
    if (this.shouldLog('debug')) {
      const arrow = direction === 'sent' ? '→' : '←';
      const target = peerId ? ` [${peerId.slice(0, 8)}]` : '';
      this.debug(`${arrow} Signal ${type}${target}`);
    }
  }
}

// Singleton instance
export const webrtcLogger = new WebRTCLogger();

// Export for custom instances
export default WebRTCLogger;
