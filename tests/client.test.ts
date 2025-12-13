/**
 * ModelRiverClient Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelRiverClient } from '../src/client';

describe('ModelRiverClient', () => {
  let client: ModelRiverClient;

  // Create a valid test JWT
  const createTestToken = (payload: object): string => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const body = btoa(JSON.stringify(payload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const signature = 'test-signature';
    return `${header}.${body}.${signature}`;
  };

  const validToken = createTestToken({
    project_id: 'proj-123',
    channel_id: 'chan-456',
    topic: 'ai_response:proj-123:chan-456',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  beforeEach(() => {
    client = new ModelRiverClient({
      debug: false,
      persist: false,
    });
  });

  describe('constructor', () => {
    it('should create client with default options', () => {
      const defaultClient = new ModelRiverClient();
      const state = defaultClient.getState();

      expect(state.connectionState).toBe('disconnected');
      expect(state.isConnected).toBe(false);
      expect(state.steps).toEqual([]);
      expect(state.response).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should accept custom options', () => {
      const customClient = new ModelRiverClient({
        baseUrl: 'wss://custom.url/socket',
        debug: true,
        persist: false,
      });

      expect(customClient).toBeDefined();
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = client.getState();

      expect(state).toHaveProperty('connectionState');
      expect(state).toHaveProperty('isConnected');
      expect(state).toHaveProperty('isConnecting');
      expect(state).toHaveProperty('steps');
      expect(state).toHaveProperty('response');
      expect(state).toHaveProperty('error');
      expect(state).toHaveProperty('hasPendingRequest');
    });
  });

  describe('connect', () => {
    it('should emit error for invalid token', () => {
      const errorHandler = vi.fn();
      client.on('error', errorHandler);

      client.connect({ wsToken: 'invalid-token' });

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should emit error for expired token', () => {
      const errorHandler = vi.fn();
      client.on('error', errorHandler);

      const expiredToken = createTestToken({
        project_id: 'proj-123',
        channel_id: 'chan-456',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      });

      client.connect({ wsToken: expiredToken });

      expect(errorHandler).toHaveBeenCalledWith('Token has expired');
    });

    it('should emit connecting event', () => {
      const connectingHandler = vi.fn();
      client.on('connecting', connectingHandler);

      client.connect({ wsToken: validToken });

      expect(connectingHandler).toHaveBeenCalled();
    });

    it('should initialize steps on connect', () => {
      client.connect({ wsToken: validToken });

      const state = client.getState();
      expect(state.steps).toHaveLength(4);
      expect(state.steps[0].id).toBe('queue');
      expect(state.steps[0].status).toBe('loading');
    });
  });

  describe('disconnect', () => {
    it('should emit disconnected event', () => {
      const disconnectedHandler = vi.fn();
      client.on('disconnected', disconnectedHandler);

      client.disconnect();

      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it('should update connection state', () => {
      client.disconnect();

      const state = client.getState();
      expect(state.connectionState).toBe('disconnected');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      // Set up some state
      client.connect({ wsToken: validToken });
      client.reset();

      const state = client.getState();
      expect(state.connectionState).toBe('disconnected');
      expect(state.steps).toEqual([]);
      expect(state.response).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('event listeners', () => {
    it('should add and remove listeners', () => {
      const handler = vi.fn();

      const unsubscribe = client.on('connected', handler);
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      // Handler should be removed (we can't easily test this without triggering the event)
    });

    it('should support off method', () => {
      const handler = vi.fn();

      client.on('connected', handler);
      client.off('connected', handler);
      // Handler should be removed
    });

    it('should call step handler on step updates', () => {
      const stepHandler = vi.fn();
      client.on('step', stepHandler);

      client.connect({ wsToken: validToken });

      // Step handler should be called when steps are updated
      expect(stepHandler).toHaveBeenCalled();
    });
  });

  describe('hasPendingRequest', () => {
    it('should return false when persistence is disabled', () => {
      expect(client.hasPendingRequest()).toBe(false);
    });

    it('should return false when no active request stored', () => {
      const persistentClient = new ModelRiverClient({ persist: true });
      expect(persistentClient.hasPendingRequest()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      const handler = vi.fn();
      client.on('connected', handler);

      client.destroy();

      const state = client.getState();
      expect(state.connectionState).toBe('disconnected');
    });
  });
});
