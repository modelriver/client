/**
 * Test Setup
 * 
 * Configure jsdom and mock external dependencies for testing.
 */

import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
});

// Mock Phoenix Socket
vi.mock('phoenix', () => {
  return {
    Socket: vi.fn().mockImplementation((url: string, opts?: any) => ({
      url,
      opts,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
      channel: vi.fn().mockReturnValue({
        join: vi.fn().mockReturnValue({
          receive: vi.fn().mockReturnThis(),
        }),
        leave: vi.fn(),
        on: vi.fn(),
        push: vi.fn(),
      }),
    })),
    Channel: vi.fn(),
  };
});

// Clear mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

