/**
 * ModelRiver Angular Service
 * 
 * Angular injectable service for connecting to ModelRiver's WebSocket-based AI response streaming.
 * 
 * @example
 * ```typescript
 * import { Component, OnDestroy } from '@angular/core';
 * import { ModelRiverService } from '@modelriver/client/angular';
 * 
 * @Component({
 *   selector: 'app-chat',
 *   providers: [ModelRiverService],
 *   template: `
 *     <div *ngIf="modelRiver.response$ | async as response">
 *       {{ response | json }}
 *     </div>
 *   `
 * })
 * export class ChatComponent implements OnDestroy {
 *   constructor(public modelRiver: ModelRiverService) {
 *     this.modelRiver.init({ baseUrl: 'wss://api.modelriver.com/socket' });
 *   }
 * 
 *   async send() {
 *     const { ws_token } = await this.backendService.createRequest(message);
 *     this.modelRiver.connect({ wsToken: ws_token });
 *   }
 * 
 *   ngOnDestroy() {
 *     this.modelRiver.disconnect();
 *   }
 * }
 * ```
 */

import { BehaviorSubject, Observable } from 'rxjs';
import { ModelRiverClient } from './client';
import type {
  ModelRiverClientOptions,
  ConnectOptions,
  ConnectionState,
  WorkflowStep,
  AIResponse,
} from './types';

/**
 * Angular service for ModelRiver WebSocket client
 * 
 * Use with `providers: [ModelRiverService]` in your component or module.
 */
export class ModelRiverService {
  private client: ModelRiverClient | null = null;
  private unsubscribers: (() => void)[] = [];

  // BehaviorSubjects for reactive state
  private connectionStateSubject = new BehaviorSubject<ConnectionState>('disconnected');
  private stepsSubject = new BehaviorSubject<WorkflowStep[]>([]);
  private responseSubject = new BehaviorSubject<AIResponse | null>(null);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private hasPendingRequestSubject = new BehaviorSubject<boolean>(false);

  // Public observables
  readonly connectionState$: Observable<ConnectionState> = this.connectionStateSubject.asObservable();
  readonly steps$: Observable<WorkflowStep[]> = this.stepsSubject.asObservable();
  readonly response$: Observable<AIResponse | null> = this.responseSubject.asObservable();
  readonly error$: Observable<string | null> = this.errorSubject.asObservable();
  readonly hasPendingRequest$: Observable<boolean> = this.hasPendingRequestSubject.asObservable();

  // Convenience getters for current values
  get isConnected(): boolean {
    return this.connectionStateSubject.value === 'connected';
  }

  get isConnecting(): boolean {
    return this.connectionStateSubject.value === 'connecting';
  }

  /**
   * Initialize the ModelRiver client
   * Must be called before using connect()
   */
  init(options: ModelRiverClientOptions = {}): void {
    if (this.client) {
      this.cleanup();
    }

    this.client = new ModelRiverClient(options);

    // Set up event listeners
    this.unsubscribers.push(
      this.client.on('connecting', () => {
        this.connectionStateSubject.next('connecting');
      })
    );

    this.unsubscribers.push(
      this.client.on('connected', () => {
        this.connectionStateSubject.next('connected');
      })
    );

    this.unsubscribers.push(
      this.client.on('disconnected', () => {
        this.connectionStateSubject.next('disconnected');
      })
    );

    this.unsubscribers.push(
      this.client.on('response', (data) => {
        this.responseSubject.next(data);
        this.hasPendingRequestSubject.next(false);
      })
    );

    this.unsubscribers.push(
      this.client.on('error', (err) => {
        this.errorSubject.next(typeof err === 'string' ? err : err.message);
        this.connectionStateSubject.next('error');
      })
    );

    this.unsubscribers.push(
      this.client.on('step', () => {
        if (this.client) {
          const state = this.client.getState();
          this.stepsSubject.next([...state.steps]);
        }
      })
    );

    // Check for pending request
    if (this.client.hasPendingRequest()) {
      this.hasPendingRequestSubject.next(true);
      this.client.reconnect();
    }
  }

  /**
   * Connect to WebSocket with token
   */
  connect(options: ConnectOptions): void {
    if (!this.client) {
      console.error('[ModelRiver] Client not initialized. Call init() first.');
      return;
    }

    this.errorSubject.next(null);
    this.responseSubject.next(null);
    this.stepsSubject.next([]);
    this.hasPendingRequestSubject.next(true);

    this.client.connect(options);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (!this.client) return;

    this.client.disconnect();
    this.hasPendingRequestSubject.next(false);
  }

  /**
   * Reset state and clear stored data
   */
  reset(): void {
    if (!this.client) return;

    this.client.reset();
    this.connectionStateSubject.next('disconnected');
    this.stepsSubject.next([]);
    this.responseSubject.next(null);
    this.errorSubject.next(null);
    this.hasPendingRequestSubject.next(false);
  }

  /**
   * Clean up resources (call in ngOnDestroy)
   */
  destroy(): void {
    this.cleanup();
    this.connectionStateSubject.complete();
    this.stepsSubject.complete();
    this.responseSubject.complete();
    this.errorSubject.complete();
    this.hasPendingRequestSubject.complete();
  }

  private cleanup(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers.length = 0;

    if (this.client && !this.client.hasPendingRequest()) {
      this.client.destroy();
    }
    this.client = null;
  }
}

// Factory function for easier testing
export function createModelRiverService(options?: ModelRiverClientOptions): ModelRiverService {
  const service = new ModelRiverService();
  if (options) {
    service.init(options);
  }
  return service;
}
