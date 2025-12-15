/**
 * ModelRiver Client SDK Utilities
 * 
 * Helper functions for JWT decoding, localStorage operations, and URL building.
 */

import type { ActiveRequest, WorkflowStep, TokenPayload } from './types';

/**
 * Default WebSocket base URL
 */
export const DEFAULT_BASE_URL = 'wss://api.modelriver.com/socket';

/**
 * Default storage key prefix
 */
export const DEFAULT_STORAGE_KEY_PREFIX = 'modelriver_';

/**
 * Default heartbeat interval (30 seconds)
 */
export const DEFAULT_HEARTBEAT_INTERVAL = 30000;

/**
 * Default request timeout (5 minutes)
 */
export const DEFAULT_REQUEST_TIMEOUT = 300000;

/**
 * Active request storage key suffix
 */
export const ACTIVE_REQUEST_KEY = 'active_request';

/**
 * Decode a base64url string to a regular string
 */
function base64UrlDecode(str: string): string {
  // Replace base64url characters with base64 characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Pad with '=' to make length a multiple of 4
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  
  // Decode
  try {
    return atob(base64);
  } catch {
    throw new Error('Invalid base64url string');
  }
}

/**
 * Decode a JWT token and extract the payload
 * Note: This does NOT verify the signature - that's done server-side
 */
export function decodeToken(token: string): TokenPayload {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: token must be a non-empty string');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token: JWT must have 3 parts');
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    
    // Validate required fields
    if (!payload.project_id || !payload.channel_id) {
      throw new Error('Invalid token: missing required fields (project_id, channel_id)');
    }
    
    // Build topic if not present
    const topic = payload.topic || `ai_response:${payload.project_id}:${payload.channel_id}`;
    
    return {
      project_id: payload.project_id,
      channel_id: payload.channel_id,
      topic,
      exp: payload.exp,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid token:')) {
      throw error;
    }
    throw new Error('Invalid token: failed to decode payload');
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(payload: TokenPayload): boolean {
  if (!payload.exp) {
    return false; // No expiration set
  }
  
  // exp is in seconds, Date.now() is in milliseconds
  return Date.now() >= payload.exp * 1000;
}

/**
 * Build the WebSocket URL with token
 */
export function buildWebSocketUrl(baseUrl: string, token: string): string {
  const url = baseUrl.endsWith('/websocket') ? baseUrl : `${baseUrl}/websocket`;
  return `${url}?token=${encodeURIComponent(token)}&vsn=2.0.0`;
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__modelriver_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save active request to localStorage
 */
export function saveActiveRequest(
  prefix: string,
  channelId: string,
  wsToken: string,
  websocketUrl?: string,
  websocketChannel?: string
): void {
  if (!isStorageAvailable()) return;

  const request: ActiveRequest = {
    channelId,
    wsToken,
    timestamp: Date.now(),
    websocketUrl,
    websocketChannel,
  };

  try {
    localStorage.setItem(
      `${prefix}${ACTIVE_REQUEST_KEY}`,
      JSON.stringify(request)
    );
  } catch {
    // Storage might be full or disabled
  }
}

/**
 * Get active request from localStorage
 * Returns null if not found or expired (older than 5 minutes)
 */
export function getActiveRequest(prefix: string): ActiveRequest | null {
  if (!isStorageAvailable()) return null;

  try {
    const stored = localStorage.getItem(`${prefix}${ACTIVE_REQUEST_KEY}`);
    if (!stored) return null;

    const request = JSON.parse(stored) as ActiveRequest;

    // Check if request is less than 5 minutes old
    const age = Date.now() - request.timestamp;
    if (age > DEFAULT_REQUEST_TIMEOUT) {
      clearActiveRequest(prefix);
      return null;
    }

    return request;
  } catch {
    return null;
  }
}

/**
 * Clear active request from localStorage
 */
export function clearActiveRequest(prefix: string): void {
  if (!isStorageAvailable()) return;

  try {
    localStorage.removeItem(`${prefix}${ACTIVE_REQUEST_KEY}`);
  } catch {
    // Ignore errors
  }
}

/**
 * Create initial workflow steps
 */
export function createInitialSteps(): WorkflowStep[] {
  return [
    { id: 'queue', name: 'Queueing request', status: 'pending' },
    { id: 'process', name: 'Processing AI request', status: 'pending' },
    { id: 'receive', name: 'Waiting for response', status: 'pending' },
    { id: 'complete', name: 'Response received', status: 'pending' },
  ];
}

/**
 * Update a step in the steps array
 */
export function updateStep(
  steps: WorkflowStep[],
  id: string,
  updates: Partial<WorkflowStep>
): WorkflowStep[] {
  return steps.map((step) =>
    step.id === id ? { ...step, ...updates } : step
  );
}

/**
 * Logger utility for debug mode
 */
export function createLogger(debug: boolean) {
  const prefix = '[ModelRiver]';
  
  return {
    log: (...args: unknown[]) => {
      if (debug) console.log(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      if (debug) console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      // Always log errors
      console.error(prefix, ...args);
    },
  };
}

