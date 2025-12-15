/**
 * ModelRiver Vue Composable
 * 
 * Vue composable for connecting to ModelRiver's WebSocket-based AI response streaming.
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useModelRiver } from '@modelriver/client/vue';
 * 
 * const { connect, response, error, isConnected, steps } = useModelRiver({
 *   baseUrl: 'wss://api.modelriver.com/socket',
 * });
 * 
 * async function handleSend() {
 *   const { channel_id, websocket_url } = await yourBackendAPI.createRequest(message);
 *   connect({ channelId: channel_id, websocketUrl: websocket_url });
 * }
 * </script>
 * 
 * <template>
 *   <div>
 *     <button @click="handleSend">Send</button>
 *     <span v-if="isConnected">Connected</span>
 *     <pre v-if="response">{{ response }}</pre>
 *     <p v-if="error" class="error">{{ error }}</p>
 *   </div>
 * </template>
 * ```
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { ModelRiverClient } from './client';
import type {
  ModelRiverClientOptions,
  ConnectOptions,
  ConnectionState,
  WorkflowStep,
  AIResponse,
  UseModelRiverVueReturn,
} from './types';

/**
 * Vue composable for ModelRiver WebSocket client
 * 
 * @param options - Client configuration options
 * @returns Composable return value with reactive state and methods
 */
export function useModelRiver(
  options: ModelRiverClientOptions = {}
): UseModelRiverVueReturn {
  // Reactive state
  const connectionState = ref<ConnectionState>('disconnected');
  const steps = ref<WorkflowStep[]>([]);
  const response = ref<AIResponse | null>(null);
  const error = ref<string | null>(null);
  const hasPendingRequest = ref(false);
  const isConnected = ref(false);
  const isConnecting = ref(false);

  // Client instance
  let client: ModelRiverClient | null = null;
  const unsubscribers: (() => void)[] = [];

  // Initialize client
  const initClient = () => {
    client = new ModelRiverClient(options);

    // Set up event listeners
    unsubscribers.push(
      client.on('connecting', () => {
        connectionState.value = 'connecting';
        isConnecting.value = true;
        isConnected.value = false;
      })
    );

    unsubscribers.push(
      client.on('connected', () => {
        connectionState.value = 'connected';
        isConnected.value = true;
        isConnecting.value = false;
      })
    );

    unsubscribers.push(
      client.on('disconnected', () => {
        connectionState.value = 'disconnected';
        isConnected.value = false;
        isConnecting.value = false;
      })
    );

    unsubscribers.push(
      client.on('response', (data) => {
        response.value = data;
        hasPendingRequest.value = false;
      })
    );

    unsubscribers.push(
      client.on('error', (err) => {
        error.value = typeof err === 'string' ? err : err.message;
        connectionState.value = 'error';
        isConnecting.value = false;
      })
    );

    unsubscribers.push(
      client.on('step', () => {
        if (client) {
          const state = client.getState();
          steps.value = [...state.steps];
        }
      })
    );

    // Check for pending request
    if (client.hasPendingRequest()) {
      hasPendingRequest.value = true;
      client.reconnect();
    }
  };

  // Cleanup
  const cleanup = () => {
    unsubscribers.forEach((unsub) => unsub());
    unsubscribers.length = 0;
    
    if (client && !client.hasPendingRequest()) {
      client.destroy();
    }
    client = null;
  };

  // Connect method
  const connect = (connectOptions: ConnectOptions) => {
    if (!client) return;

    error.value = null;
    response.value = null;
    steps.value = [];
    hasPendingRequest.value = true;

    client.connect(connectOptions);
  };

  // Disconnect method
  const disconnect = () => {
    if (!client) return;

    client.disconnect();
    hasPendingRequest.value = false;
  };

  // Reset method
  const reset = () => {
    if (!client) return;

    client.reset();
    connectionState.value = 'disconnected';
    isConnected.value = false;
    isConnecting.value = false;
    steps.value = [];
    response.value = null;
    error.value = null;
    hasPendingRequest.value = false;
  };

  // Lifecycle hooks
  onMounted(() => {
    initClient();
  });

  onUnmounted(() => {
    cleanup();
  });

  return {
    connectionState,
    isConnected,
    isConnecting,
    steps,
    response,
    error,
    hasPendingRequest,
    connect,
    disconnect,
    reset,
  };
}

// Re-export types for convenience
export type { UseModelRiverVueReturn } from './types';

