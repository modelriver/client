/**
 * ModelRiver Svelte Store
 * 
 * Svelte store factory for connecting to ModelRiver's WebSocket-based AI response streaming.
 * 
 * @example
 * ```svelte
 * <script>
 *   import { createModelRiver } from '@modelriver/client/svelte';
 *   import { onDestroy } from 'svelte';
 * 
 *   const modelRiver = createModelRiver({
 *     baseUrl: 'wss://api.modelriver.com/socket'
 *   });
 * 
 *   const { response, error, isConnected, connect, disconnect } = modelRiver;
 * 
 *   async function send() {
 *     const { channel_id, websocket_url } = await backendAPI.createRequest(message);
 *     connect({ channelId: channel_id, websocketUrl: websocket_url });
 *   }
 * 
 *   onDestroy(() => disconnect());
 * </script>
 * 
 * {#if $isConnected}
 *   <span>Connected</span>
 * {/if}
 * 
 * {#if $response}
 *   <pre>{JSON.stringify($response, null, 2)}</pre>
 * {/if}
 * 
 * {#if $error}
 *   <p class="error">{$error}</p>
 * {/if}
 * ```
 */

import { writable, derived, type Readable } from 'svelte/store';
import { ModelRiverClient } from './client';
import type {
  ModelRiverClientOptions,
  ConnectOptions,
  ConnectionState,
  WorkflowStep,
  AIResponse,
  ModelRiverSvelteStore,
} from './types';

/**
 * Create a ModelRiver Svelte store
 * 
 * @param options - Client configuration options
 * @returns Svelte store with reactive state and methods
 */
export function createModelRiver(
  options: ModelRiverClientOptions = {}
): ModelRiverSvelteStore {
  // Create writable stores for internal state
  const connectionStateStore = writable<ConnectionState>('disconnected');
  const stepsStore = writable<WorkflowStep[]>([]);
  const responseStore = writable<AIResponse | null>(null);
  const errorStore = writable<string | null>(null);
  const hasPendingRequestStore = writable<boolean>(false);

  // Derived stores for convenience
  const isConnectedStore = derived(
    connectionStateStore,
    ($state) => $state === 'connected'
  );
  const isConnectingStore = derived(
    connectionStateStore,
    ($state) => $state === 'connecting'
  );

  // Create client
  const client = new ModelRiverClient(options);
  const unsubscribers: (() => void)[] = [];

  // Set up event listeners
  unsubscribers.push(
    client.on('connecting', () => {
      connectionStateStore.set('connecting');
    })
  );

  unsubscribers.push(
    client.on('connected', () => {
      connectionStateStore.set('connected');
    })
  );

  unsubscribers.push(
    client.on('disconnected', () => {
      connectionStateStore.set('disconnected');
    })
  );

  unsubscribers.push(
    client.on('response', (data) => {
      responseStore.set(data);
      hasPendingRequestStore.set(false);
    })
  );

  unsubscribers.push(
    client.on('error', (err) => {
      errorStore.set(typeof err === 'string' ? err : err.message);
      connectionStateStore.set('error');
    })
  );

  unsubscribers.push(
    client.on('step', () => {
      const state = client.getState();
      stepsStore.set([...state.steps]);
    })
  );

  // Check for pending request on init
  if (client.hasPendingRequest()) {
    hasPendingRequestStore.set(true);
    client.reconnect();
  }

  // Connect method
  const connect = (connectOptions: ConnectOptions): void => {
    errorStore.set(null);
    responseStore.set(null);
    stepsStore.set([]);
    hasPendingRequestStore.set(true);

    client.connect(connectOptions);
  };

  // Disconnect method
  const disconnect = (): void => {
    client.disconnect();
    hasPendingRequestStore.set(false);

    // Cleanup listeners
    unsubscribers.forEach((unsub) => unsub());
    unsubscribers.length = 0;

    // Only destroy if no pending request
    if (!client.hasPendingRequest()) {
      client.destroy();
    }
  };

  // Reset method
  const reset = (): void => {
    client.reset();
    connectionStateStore.set('disconnected');
    stepsStore.set([]);
    responseStore.set(null);
    errorStore.set(null);
    hasPendingRequestStore.set(false);
  };

  return {
    connectionState: { subscribe: connectionStateStore.subscribe } as Readable<ConnectionState>,
    isConnected: isConnectedStore,
    isConnecting: isConnectingStore,
    steps: { subscribe: stepsStore.subscribe } as Readable<WorkflowStep[]>,
    response: { subscribe: responseStore.subscribe } as Readable<AIResponse | null>,
    error: { subscribe: errorStore.subscribe } as Readable<string | null>,
    hasPendingRequest: { subscribe: hasPendingRequestStore.subscribe } as Readable<boolean>,
    connect,
    disconnect,
    reset,
  };
}

// Re-export types for convenience
export type { ModelRiverSvelteStore } from './types';

