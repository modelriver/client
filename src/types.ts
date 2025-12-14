/**
 * ModelRiver Client SDK Types
 * 
 * TypeScript interfaces for the ModelRiver WebSocket client.
 */

/**
 * Configuration options for ModelRiverClient
 */
export interface ModelRiverClientOptions {
  /**
   * WebSocket base URL for ModelRiver
   * @default 'wss://api.modelriver.com/socket'
   */
  baseUrl?: string;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Enable localStorage persistence for reconnection on page refresh
   * @default true
   */
  persist?: boolean;

  /**
   * Storage key prefix for localStorage
   * @default 'modelriver_'
   */
  storageKeyPrefix?: string;

  /**
   * Heartbeat interval in milliseconds
   * @default 30000 (30 seconds)
   */
  heartbeatInterval?: number;

  /**
   * Request timeout in milliseconds
   * @default 300000 (5 minutes)
   */
  requestTimeout?: number;
}

/**
 * Connection options for connect()
 */
export interface ConnectOptions {
  /**
   * WebSocket token from your backend
   * This JWT contains project_id, channel_id, and topic claims
   */
  wsToken: string;
}

/**
 * Decoded token payload
 */
export interface TokenPayload {
  /** Project ID */
  project_id: string;
  /** Channel ID */
  channel_id: string;
  /** Channel topic (e.g., ai_response:project_id:channel_id) */
  topic: string;
  /** Token expiration timestamp */
  exp?: number;
}

/**
 * Workflow step status
 */
export type WorkflowStepStatus = 'pending' | 'loading' | 'success' | 'error';

/**
 * Workflow step for progress tracking
 */
export interface WorkflowStep {
  /** Step identifier */
  id: string;
  /** Step display name */
  name: string;
  /** Current status */
  status: WorkflowStepStatus;
  /** Duration in milliseconds (if completed) */
  duration?: number;
  /** Error message (if failed) */
  errorMessage?: string;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  workflow?: string;
  status?: string;
  duration_ms?: number;
  usage?: TokenUsage;
}

/**
 * Error details in response
 */
export interface ResponseError {
  message: string;
  details?: unknown;
}

/**
 * AI response payload from WebSocket
 */
export interface AIResponse {
  /** Response status */
  status: string;
  /** Channel ID */
  channel_id?: string;
  /** Response data */
  data?: unknown;
  /** Response metadata */
  meta?: ResponseMeta;
  /** Error information (if failed) */
  error?: ResponseError;
}

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Active request stored in localStorage for persistence
 */
export interface ActiveRequest {
  /** Channel ID */
  channelId: string;
  /** Timestamp when request was created */
  timestamp: number;
  /** Project ID */
  projectId: string;
  /** WebSocket token */
  wsToken: string;
}

/**
 * Event types emitted by ModelRiverClient
 */
export type ModelRiverEventType = 
  | 'connected'
  | 'disconnected'
  | 'response'
  | 'error'
  | 'step'
  | 'connecting'
  | 'channel_joined'
  | 'channel_error';

/**
 * Event listener callback types
 */
export interface ModelRiverEventMap {
  connected: () => void;
  disconnected: (reason?: string) => void;
  response: (data: AIResponse) => void;
  error: (error: Error | string) => void;
  step: (step: WorkflowStep) => void;
  connecting: () => void;
  channel_joined: () => void;
  channel_error: (reason: string) => void;
}

/**
 * Client state exposed to consumers
 */
export interface ModelRiverState {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Whether connected to WebSocket */
  isConnected: boolean;
  /** Whether currently connecting */
  isConnecting: boolean;
  /** Current workflow steps */
  steps: WorkflowStep[];
  /** Latest response */
  response: AIResponse | null;
  /** Latest error */
  error: string | null;
  /** Whether there's a pending request that can be reconnected */
  hasPendingRequest: boolean;
}

/**
 * Return type for React hook
 */
export interface UseModelRiverReturn extends ModelRiverState {
  /** Connect to WebSocket with token */
  connect: (options: ConnectOptions) => void;
  /** Disconnect from WebSocket */
  disconnect: () => void;
  /** Reset state and clear stored data */
  reset: () => void;
}

/**
 * Return type for Vue composable
 */
export interface UseModelRiverVueReturn {
  /** Reactive connection state */
  connectionState: import('vue').Ref<ConnectionState>;
  /** Reactive connected status */
  isConnected: import('vue').Ref<boolean>;
  /** Reactive connecting status */
  isConnecting: import('vue').Ref<boolean>;
  /** Reactive workflow steps */
  steps: import('vue').Ref<WorkflowStep[]>;
  /** Reactive response */
  response: import('vue').Ref<AIResponse | null>;
  /** Reactive error */
  error: import('vue').Ref<string | null>;
  /** Reactive pending request status */
  hasPendingRequest: import('vue').Ref<boolean>;
  /** Connect to WebSocket with token */
  connect: (options: ConnectOptions) => void;
  /** Disconnect from WebSocket */
  disconnect: () => void;
  /** Reset state and clear stored data */
  reset: () => void;
}

/**
 * Svelte store return type
 */
export interface ModelRiverSvelteStore {
  /** Readable store for connection state */
  connectionState: import('svelte/store').Readable<ConnectionState>;
  /** Readable store for connected status */
  isConnected: import('svelte/store').Readable<boolean>;
  /** Readable store for connecting status */
  isConnecting: import('svelte/store').Readable<boolean>;
  /** Readable store for workflow steps */
  steps: import('svelte/store').Readable<WorkflowStep[]>;
  /** Readable store for response */
  response: import('svelte/store').Readable<AIResponse | null>;
  /** Readable store for error */
  error: import('svelte/store').Readable<string | null>;
  /** Readable store for pending request status */
  hasPendingRequest: import('svelte/store').Readable<boolean>;
  /** Connect to WebSocket with token */
  connect: (options: ConnectOptions) => void;
  /** Disconnect from WebSocket */
  disconnect: () => void;
  /** Reset state and clear stored data */
  reset: () => void;
}

