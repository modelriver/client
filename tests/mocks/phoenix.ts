/**
 * Mock Phoenix Socket for Testing
 * 
 * Provides a mock implementation of Phoenix Socket and Channel
 * for testing WebSocket functionality without a real connection.
 */

import { vi } from 'vitest';

type Callback = (...args: any[]) => void;

/**
 * Mock Phoenix Channel
 */
export class MockChannel {
  topic: string;
  private listeners: Map<string, Set<Callback>> = new Map();
  private joinCallbacks: { ok?: Callback; error?: Callback; timeout?: Callback } = {};

  constructor(topic: string) {
    this.topic = topic;
  }

  /**
   * Join the channel
   */
  join() {
    return {
      receive: (status: 'ok' | 'error' | 'timeout', callback: Callback) => {
        this.joinCallbacks[status] = callback;
        return this;
      },
    };
  }

  /**
   * Leave the channel
   */
  leave = vi.fn();

  /**
   * Subscribe to events
   */
  on(event: string, callback: Callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Push message to channel
   */
  push = vi.fn();

  // Test helpers

  /**
   * Simulate successful join
   */
  simulateJoinOk() {
    this.joinCallbacks.ok?.();
  }

  /**
   * Simulate join error
   */
  simulateJoinError(error: { reason?: string } = {}) {
    this.joinCallbacks.error?.(error);
  }

  /**
   * Simulate receiving a message
   */
  simulateMessage(event: string, payload: any) {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }

  /**
   * Simulate error event
   */
  simulateError(error: { message?: string } = {}) {
    this.simulateMessage('error', error);
  }

  /**
   * Simulate AI response
   */
  simulateResponse(payload: any) {
    this.simulateMessage('response', payload);
  }
}

/**
 * Mock Phoenix Socket
 */
export class MockSocket {
  url: string;
  opts?: any;
  private channels: Map<string, MockChannel> = new Map();
  private openCallbacks: Callback[] = [];
  private closeCallbacks: Callback[] = [];
  private errorCallbacks: Callback[] = [];
  private connected = false;

  constructor(url: string, opts?: any) {
    this.url = url;
    this.opts = opts;
  }

  /**
   * Connect to socket
   */
  connect = vi.fn(() => {
    // Simulate async connection
    setTimeout(() => {
      this.connected = true;
      this.openCallbacks.forEach((cb) => cb());
    }, 0);
  });

  /**
   * Disconnect from socket
   */
  disconnect = vi.fn(() => {
    this.connected = false;
    this.closeCallbacks.forEach((cb) => cb({ code: 1000, reason: 'Normal closure' }));
  });

  /**
   * Register open callback
   */
  onOpen(callback: Callback) {
    this.openCallbacks.push(callback);
  }

  /**
   * Register close callback
   */
  onClose(callback: Callback) {
    this.closeCallbacks.push(callback);
  }

  /**
   * Register error callback
   */
  onError(callback: Callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Get or create a channel
   */
  channel(topic: string) {
    if (!this.channels.has(topic)) {
      this.channels.set(topic, new MockChannel(topic));
    }
    return this.channels.get(topic)!;
  }

  // Test helpers

  /**
   * Simulate connection open
   */
  simulateOpen() {
    this.connected = true;
    this.openCallbacks.forEach((cb) => cb());
  }

  /**
   * Simulate connection close
   */
  simulateClose(event: { code?: number; reason?: string } = {}) {
    this.connected = false;
    this.closeCallbacks.forEach((cb) => cb(event));
  }

  /**
   * Simulate connection error
   */
  simulateError(error: any = new Error('Connection error')) {
    this.errorCallbacks.forEach((cb) => cb(error));
  }

  /**
   * Get a channel for testing
   */
  getChannel(topic: string): MockChannel | undefined {
    return this.channels.get(topic);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Create mock Phoenix module
 */
export function createMockPhoenix() {
  let currentSocket: MockSocket | null = null;

  return {
    Socket: vi.fn().mockImplementation((url: string, opts?: any) => {
      currentSocket = new MockSocket(url, opts);
      return currentSocket;
    }),
    Channel: MockChannel,
    getCurrentSocket: () => currentSocket,
  };
}

