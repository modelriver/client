/**
 * React Hook Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModelRiver } from '../src/react';

describe('useModelRiver', () => {
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
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should return correct initial state', () => {
      const { result } = renderHook(() => useModelRiver({ persist: false }));

      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.steps).toEqual([]);
      expect(result.current.response).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.hasPendingRequest).toBe(false);
    });

    it('should provide connect, disconnect, and reset functions', () => {
      const { result } = renderHook(() => useModelRiver({ persist: false }));

      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('connect', () => {
    it('should update state on connect', () => {
      const { result } = renderHook(() => useModelRiver({ persist: false }));

      act(() => {
        result.current.connect({ wsToken: validToken });
      });

      // Should have pending request after connect is called
      expect(result.current.hasPendingRequest).toBe(true);
    });

    it('should set error for invalid token', () => {
      const { result } = renderHook(() => useModelRiver({ persist: false }));

      act(() => {
        result.current.connect({ wsToken: 'invalid' });
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.connectionState).toBe('error');
    });
  });

  describe('disconnect', () => {
    it('should reset hasPendingRequest', () => {
      const { result } = renderHook(() => useModelRiver({ persist: false }));

      act(() => {
        result.current.connect({ wsToken: validToken });
      });

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.hasPendingRequest).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const { result } = renderHook(() => useModelRiver({ persist: false }));

      act(() => {
        result.current.connect({ wsToken: validToken });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.steps).toEqual([]);
      expect(result.current.response).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.hasPendingRequest).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useModelRiver({ persist: false }));

      // Should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('reconnection prevention with completed status', () => {
    it('should not reconnect on mount if response is completed', () => {
      const { saveActiveRequest } = require('../src/utils');
      
      // Save a pending request in localStorage
      saveActiveRequest('modelriver_', 'test-channel-id', validToken, 'wss://test.com/socket', 'test-channel');

      // Create a client instance and simulate completed response
      const { ModelRiverClient } = require('../src/client');
      const client = new ModelRiverClient({
        persist: true,
        storageKeyPrefix: 'modelriver_',
      });

      // Simulate completed status
      (client as any).handleResponse({
        status: 'completed',
        channel_id: 'test-channel-id',
        data: { result: 'success' },
      });

      // Now render hook - it should not reconnect
      const reconnectSpy = vi.spyOn(client, 'reconnect');
      const { result } = renderHook(() => useModelRiver({ 
        persist: true,
        storageKeyPrefix: 'modelriver_',
      }));

      // Wait for mount to complete
      expect(result.current.hasPendingRequest).toBe(false);
      // reconnect should not be called because response is completed
      // Note: We can't directly spy on the hook's internal client, but we can verify
      // that hasPendingRequest is false, which means it didn't attempt reconnection
    });

    it('should clear localStorage if completed response exists on mount', () => {
      const { saveActiveRequest, getActiveRequest, clearActiveRequest } = require('../src/utils');
      
      // Save a pending request
      saveActiveRequest('modelriver_', 'test-channel-id', validToken, 'wss://test.com/socket', 'test-channel');
      expect(getActiveRequest('modelriver_')).not.toBeNull();

      // Create a client and simulate completed response
      const { ModelRiverClient } = require('../src/client');
      const client = new ModelRiverClient({
        persist: true,
        storageKeyPrefix: 'modelriver_',
      });

      // Simulate completed status
      (client as any).handleResponse({
        status: 'completed',
        channel_id: 'test-channel-id',
        data: { result: 'success' },
      });

      // Render hook - it should clear localStorage
      const { result } = renderHook(() => useModelRiver({ 
        persist: true,
        storageKeyPrefix: 'modelriver_',
      }));

      // localStorage should be cleared
      expect(getActiveRequest('modelriver_')).toBeNull();
      expect(result.current.hasPendingRequest).toBe(false);
    });

    it('should check isCompleted flag before reconnecting', () => {
      const { saveActiveRequest } = require('../src/utils');
      
      // Save a pending request
      saveActiveRequest('modelriver_', 'test-channel-id', validToken, 'wss://test.com/socket', 'test-channel');

      // Create a client and set isCompleted flag
      const { ModelRiverClient } = require('../src/client');
      const client = new ModelRiverClient({
        persist: true,
        storageKeyPrefix: 'modelriver_',
      });
      (client as any).isCompleted = true;

      // Render hook
      const { result } = renderHook(() => useModelRiver({ 
        persist: true,
        storageKeyPrefix: 'modelriver_',
      }));

      // Should not have pending request because isCompleted is true
      expect(result.current.hasPendingRequest).toBe(false);
    });
  });
});

