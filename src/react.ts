/**
 * ModelRiver React Hook
 * 
 * React hook for connecting to ModelRiver's WebSocket-based AI response streaming.
 * 
 * @example
 * ```tsx
 * import { useModelRiver } from '@modelriver/client/react';
 * 
 * function App() {
 *   const { connect, response, error, isConnected, steps } = useModelRiver({
 *     baseUrl: 'wss://api.modelriver.com/socket',
 *   });
 * 
 *   const handleSend = async () => {
 *     const { ws_token } = await yourBackendAPI.createRequest(message);
 *     connect({ wsToken: ws_token });
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleSend}>Send</button>
 *       {isConnected && <span>Connected</span>}
 *       {response && <pre>{JSON.stringify(response, null, 2)}</pre>}
 *       {error && <p className="error">{error}</p>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ModelRiverClient } from './client';
import type {
  ModelRiverClientOptions,
  ConnectOptions,
  ConnectionState,
  WorkflowStep,
  AIResponse,
  UseModelRiverReturn,
} from './types';

/**
 * React hook for ModelRiver WebSocket client
 * 
 * @param options - Client configuration options
 * @returns Hook return value with state and methods
 */
export function useModelRiver(
  options: ModelRiverClientOptions = {}
): UseModelRiverReturn {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Refs
  const clientRef = useRef<ModelRiverClient | null>(null);
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Initialize client
  useEffect(() => {
    const client = new ModelRiverClient(optionsRef.current);
    clientRef.current = client;

    // Set up event listeners
    const unsubConnecting = client.on('connecting', () => {
      setConnectionState('connecting');
    });

    const unsubConnected = client.on('connected', () => {
      setConnectionState('connected');
    });

    const unsubDisconnected = client.on('disconnected', () => {
      setConnectionState('disconnected');
    });

    const unsubResponse = client.on('response', (data) => {
      setResponse(data);
      setHasPendingRequest(false);
    });

    const unsubError = client.on('error', (err) => {
      setError(typeof err === 'string' ? err : err.message);
      setConnectionState('error');
    });

    const unsubStep = client.on('step', () => {
      // Get updated steps from client state
      const state = client.getState();
      setSteps([...state.steps]);
    });

    // Check for pending request on mount
    if (client.hasPendingRequest()) {
      setHasPendingRequest(true);
      // Attempt reconnection
      client.reconnect();
    }

    // Cleanup
    return () => {
      unsubConnecting();
      unsubConnected();
      unsubDisconnected();
      unsubResponse();
      unsubError();
      unsubStep();
      
      // Only destroy if there's no pending request
      if (!client.hasPendingRequest()) {
        client.destroy();
      }
    };
  }, []); // Only run on mount/unmount

  // Connect method
  const connect = useCallback((connectOptions: ConnectOptions) => {
    if (!clientRef.current) return;

    setError(null);
    setResponse(null);
    setSteps([]);
    setHasPendingRequest(true);

    clientRef.current.connect(connectOptions);
  }, []);

  // Disconnect method
  const disconnect = useCallback(() => {
    if (!clientRef.current) return;

    clientRef.current.disconnect();
    setHasPendingRequest(false);
  }, []);

  // Reset method
  const reset = useCallback(() => {
    if (!clientRef.current) return;

    clientRef.current.reset();
    setConnectionState('disconnected');
    setSteps([]);
    setResponse(null);
    setError(null);
    setHasPendingRequest(false);
  }, []);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
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
export type { UseModelRiverReturn } from './types';
