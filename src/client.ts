/**
 * ModelRiver Client SDK
 * 
 * Core client class for connecting to ModelRiver's WebSocket-based AI response streaming.
 */

import { Socket, Channel } from 'phoenix';
import type {
  ModelRiverClientOptions,
  ConnectOptions,
  TokenPayload,
  ModelRiverEventType,
  ModelRiverEventMap,
  ConnectionState,
  WorkflowStep,
  AIResponse,
  ModelRiverState,
} from './types';
import {
  DEFAULT_BASE_URL,
  DEFAULT_STORAGE_KEY_PREFIX,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_REQUEST_TIMEOUT,
  decodeToken,
  isTokenExpired,
  buildWebSocketUrl,
  saveActiveRequest,
  getActiveRequest,
  clearActiveRequest,
  createInitialSteps,
  updateStep,
  createLogger,
} from './utils';

/**
 * ModelRiver WebSocket Client
 * 
 * Connects to ModelRiver's Phoenix Channels for real-time AI response streaming.
 * 
 * @example
 * ```typescript
 * const client = new ModelRiverClient({
 *   baseUrl: 'wss://api.modelriver.com/socket',
 *   debug: true,
 * });
 * 
 * client.on('response', (data) => {
 *   console.log('AI Response:', data);
 * });
 * 
 * client.connect({ wsToken: 'your-token-from-backend' });
 * ```
 */
export class ModelRiverClient {
  private options: Required<ModelRiverClientOptions>;
  private socket: Socket | null = null;
  private channel: Channel | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private steps: WorkflowStep[] = [];
  private response: AIResponse | null = null;
  private error: string | null = null;
  private currentToken: TokenPayload | null = null;
  private currentWsToken: string | null = null;
  private isConnecting = false;
  private logger: ReturnType<typeof createLogger>;

  // Event listeners
  private listeners: Map<ModelRiverEventType, Set<Function>> = new Map();

  constructor(options: ModelRiverClientOptions = {}) {
    this.options = {
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      debug: options.debug ?? false,
      persist: options.persist ?? true,
      storageKeyPrefix: options.storageKeyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX,
      heartbeatInterval: options.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL,
      requestTimeout: options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
    };

    this.logger = createLogger(this.options.debug);
    this.logger.log('Client initialized with options:', this.options);
  }

  /**
   * Get current client state
   */
  getState(): ModelRiverState {
    return {
      connectionState: this.connectionState,
      isConnected: this.connectionState === 'connected',
      isConnecting: this.isConnecting,
      steps: [...this.steps],
      response: this.response,
      error: this.error,
      hasPendingRequest: this.hasPendingRequest(),
    };
  }

  /**
   * Check if there's a pending request that can be reconnected
   */
  hasPendingRequest(): boolean {
    if (!this.options.persist) return false;
    const request = getActiveRequest(this.options.storageKeyPrefix);
    return request !== null;
  }

  /**
   * Connect to WebSocket with token
   */
  connect(options: ConnectOptions): void {
    if (this.isConnecting) {
      this.logger.warn('Connection already in progress, skipping...');
      return;
    }

    const { wsToken } = options;

    // Decode and validate token
    let tokenPayload: TokenPayload;
    try {
      tokenPayload = decodeToken(wsToken);
      this.logger.log('Token decoded:', {
        projectId: tokenPayload.project_id,
        channelId: tokenPayload.channel_id,
        topic: tokenPayload.topic,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid token';
      this.setError(errorMsg);
      this.emit('error', errorMsg);
      return;
    }

    // Check token expiration
    if (isTokenExpired(tokenPayload)) {
      const errorMsg = 'Token has expired';
      this.setError(errorMsg);
      this.emit('error', errorMsg);
      return;
    }

    this.isConnecting = true;
    this.currentToken = tokenPayload;
    this.currentWsToken = wsToken;
    this.emit('connecting');

    // Clean up any existing connection
    this.cleanupConnection();

    // Initialize steps
    this.steps = createInitialSteps();
    this.error = null;
    this.response = null;

    // Save to localStorage for persistence
    if (this.options.persist) {
      saveActiveRequest(
        this.options.storageKeyPrefix,
        tokenPayload.project_id,
        tokenPayload.channel_id,
        wsToken
      );
    }

    // Update queue step to loading
    this.updateStepAndEmit('queue', { status: 'loading' });

    // Create Phoenix Socket
    const wsUrl = buildWebSocketUrl(this.options.baseUrl, wsToken);
    this.logger.log('Connecting to:', wsUrl.replace(wsToken, '***TOKEN***'));

    this.socket = new Socket(this.options.baseUrl, {
      params: { token: wsToken },
    });

    this.socket.onOpen(() => {
      this.logger.log('Socket connected');
      this.connectionState = 'connected';
      this.isConnecting = false;
      this.emit('connected');

      // Join channel
      this.joinChannel(tokenPayload.topic);
    });

    this.socket.onError((error) => {
      this.logger.error('Socket error:', error);
      this.connectionState = 'error';
      this.isConnecting = false;
      const errorMsg = 'WebSocket connection error';
      this.setError(errorMsg);
      this.updateStepAndEmit('queue', { status: 'error', errorMessage: errorMsg });
      this.emit('error', errorMsg);
    });

    this.socket.onClose((event) => {
      this.logger.log('Socket closed:', event);
      this.connectionState = 'disconnected';
      this.isConnecting = false;
      this.stopHeartbeat();
      this.emit('disconnected', 'Socket closed');
    });

    this.socket.connect();
  }

  /**
   * Join the Phoenix channel
   */
  private joinChannel(topic: string): void {
    if (!this.socket) return;

    this.logger.log('Joining channel:', topic);
    this.channel = this.socket.channel(topic, {});

    this.channel.join()
      .receive('ok', () => {
        this.logger.log('Channel joined successfully');
        this.updateStepAndEmit('queue', { status: 'success', duration: 100 });
        this.updateStepAndEmit('process', { status: 'loading' });
        this.updateStepAndEmit('receive', { status: 'loading' });
        this.emit('channel_joined');
        this.startHeartbeat();
      })
      .receive('error', (error: { reason?: string }) => {
        const reason = error?.reason || 'unknown';
        this.logger.error('Channel join failed:', reason);
        
        let errorMsg = 'Failed to join channel';
        if (reason === 'unauthorized_project_access') {
          errorMsg = 'Unauthorized: You do not have access to this project';
        } else if (reason === 'invalid_channel_format') {
          errorMsg = 'Invalid channel format';
        } else if (reason === 'invalid_project_uuid' || reason === 'invalid_channel_uuid') {
          errorMsg = 'Invalid project or channel ID';
        } else if (reason !== 'unknown') {
          errorMsg = `Channel join failed: ${reason}`;
        }

        this.setError(errorMsg);
        this.updateStepAndEmit('queue', { status: 'error', errorMessage: errorMsg });
        this.emit('channel_error', reason);
      });

    // Listen for AI response
    this.channel.on('response', (payload: AIResponse) => {
      this.logger.log('AI Response received:', payload);
      this.handleResponse(payload);
    });

    // Listen for errors
    this.channel.on('error', (payload: { message?: string }) => {
      const errorMsg = payload?.message || 'An error occurred';
      this.logger.error('Channel error:', errorMsg);
      this.handleError(errorMsg);
    });
  }

  /**
   * Handle AI response
   */
  private handleResponse(payload: AIResponse): void {
    const isSuccess = 
      payload.status === 'success' || 
      payload.status === 'SUCCESS' || 
      payload.meta?.status === 'success' ||
      payload.status === 'ok';

    if (isSuccess) {
      this.updateStepAndEmit('process', { status: 'success', duration: payload.meta?.duration_ms });
      this.updateStepAndEmit('receive', { status: 'success', duration: 50 });
      this.updateStepAndEmit('complete', { status: 'success' });
      this.response = payload;
    } else {
      const errorMsg = payload.error?.message || 'Unknown error';
      this.updateStepAndEmit('process', { status: 'error', errorMessage: errorMsg });
      this.updateStepAndEmit('receive', { status: 'error' });
      this.updateStepAndEmit('complete', { status: 'error' });
      this.setError(errorMsg);
    }

    // Clear active request from localStorage
    if (this.options.persist) {
      clearActiveRequest(this.options.storageKeyPrefix);
    }

    // Emit response event
    this.emit('response', payload);

    // Close connection after receiving response
    setTimeout(() => {
      this.cleanupConnection();
    }, 1000);
  }

  /**
   * Handle error
   */
  private handleError(errorMsg: string): void {
    this.setError(errorMsg);
    this.updateStepAndEmit('process', { status: 'error', errorMessage: errorMsg });
    this.emit('error', errorMsg);

    if (this.options.persist) {
      clearActiveRequest(this.options.storageKeyPrefix);
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.logger.log('Disconnecting...');
    this.isConnecting = false;
    this.cleanupConnection();

    if (this.options.persist) {
      clearActiveRequest(this.options.storageKeyPrefix);
    }

    this.emit('disconnected', 'Manual disconnect');
  }

  /**
   * Reset state and clear stored data
   */
  reset(): void {
    this.logger.log('Resetting...');
    this.disconnect();
    this.steps = [];
    this.response = null;
    this.error = null;
    this.currentToken = null;
    this.currentWsToken = null;
  }

  /**
   * Try to reconnect using stored token
   */
  reconnect(): boolean {
    if (!this.options.persist) {
      this.logger.warn('Persistence is disabled, cannot reconnect');
      return false;
    }

    const activeRequest = getActiveRequest(this.options.storageKeyPrefix);
    if (!activeRequest) {
      this.logger.log('No active request found for reconnection');
      return false;
    }

    this.logger.log('Reconnecting with stored token...');
    this.connect({ wsToken: activeRequest.wsToken });
    return true;
  }

  /**
   * Add event listener
   */
  on<K extends ModelRiverEventType>(
    event: K,
    callback: ModelRiverEventMap[K]
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Remove event listener
   */
  off<K extends ModelRiverEventType>(
    event: K,
    callback: ModelRiverEventMap[K]
  ): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends ModelRiverEventType>(
    event: K,
    ...args: Parameters<ModelRiverEventMap[K]>
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          (callback as Function)(...args);
        } catch (err) {
          this.logger.error(`Error in ${event} listener:`, err);
        }
      });
    }
  }

  /**
   * Update step and emit event
   */
  private updateStepAndEmit(id: string, updates: Partial<WorkflowStep>): void {
    this.steps = updateStep(this.steps, id, updates);
    const step = this.steps.find((s) => s.id === id);
    if (step) {
      this.emit('step', step);
    }
  }

  /**
   * Set error state
   */
  private setError(error: string): void {
    this.error = error;
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.channel) {
        this.channel.push('heartbeat', {});
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Clean up connection resources
   */
  private cleanupConnection(): void {
    this.stopHeartbeat();

    if (this.channel) {
      try {
        this.channel.leave();
      } catch {
        // Ignore errors during cleanup
      }
      this.channel = null;
    }

    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch {
        // Ignore errors during cleanup
      }
      this.socket = null;
    }

    this.connectionState = 'disconnected';
  }

  /**
   * Destroy the client and clean up all resources
   */
  destroy(): void {
    this.reset();
    this.listeners.clear();
  }
}

