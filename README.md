# @modelriver/client

Official ModelRiver client SDK for real-time AI response streaming via WebSockets.

## Features

- **WebSocket streaming** - Receive AI responses in real-time via Phoenix Channels
- **Auto-reconnection** - Automatically reconnects on connection loss
- **Persistence** - Survives page refreshes with localStorage persistence
- **Framework adapters** - First-class support for React, Vue, Angular, and Svelte
- **CDN ready** - Use via script tag without a build step
- **TypeScript** - Full type definitions included
- **Lightweight** - ~15KB minified (including Phoenix.js)

## Installation

### npm / yarn / pnpm

```bash
npm install @modelriver/client
# or
yarn add @modelriver/client
# or
pnpm add @modelriver/client
```

### CDN

```html
<script src="https://cdn.modelriver.com/client/v1.0.0/modelriver.min.js"></script>
<!-- or latest -->
<script src="https://cdn.modelriver.com/client/latest/modelriver.min.js"></script>
```

## Quick Start

### 1. Get a token from your backend

Your backend calls the ModelRiver API and receives a WebSocket token:

```javascript
// Your backend endpoint
const response = await fetch('/api/ai/request', {
  method: 'POST',
  body: JSON.stringify({ message: 'Hello AI' }),
});
const { ws_token } = await response.json();
```

### 2. Connect to ModelRiver

```javascript
import { ModelRiverClient } from '@modelriver/client';

const client = new ModelRiverClient({
  baseUrl: 'wss://api.modelriver.com/socket',
});

client.on('response', (data) => {
  console.log('AI Response:', data);
});

client.on('error', (error) => {
  console.error('Error:', error);
});

client.connect({ wsToken: ws_token });
```

## Framework Usage

### React

```tsx
import { useModelRiver } from '@modelriver/client/react';

function ChatComponent() {
  const { 
    connect, 
    disconnect, 
    response, 
    error, 
    isConnected, 
    steps 
  } = useModelRiver({
    baseUrl: 'wss://api.modelriver.com/socket',
    persist: true,
  });

  const handleSend = async () => {
    const { ws_token } = await yourBackendAPI.createRequest(message);
    connect({ wsToken: ws_token });
  };

  return (
    <div>
      <button onClick={handleSend} disabled={isConnected}>
        Send
      </button>
      
      {/* Show workflow progress */}
      {steps.map((step) => (
        <div key={step.id} className={step.status}>
          {step.name}
        </div>
      ))}
      
      {/* Show response */}
      {response && (
        <pre>{JSON.stringify(response.data, null, 2)}</pre>
      )}
      
      {/* Show error */}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

### Vue

```vue
<script setup>
import { useModelRiver } from '@modelriver/client/vue';

const { 
  connect, 
  disconnect, 
  response, 
  error, 
  isConnected, 
  steps 
} = useModelRiver({
  baseUrl: 'wss://api.modelriver.com/socket',
});

async function handleSend() {
  const { ws_token } = await yourBackendAPI.createRequest(message);
  connect({ wsToken: ws_token });
}
</script>

<template>
  <div>
    <button @click="handleSend" :disabled="isConnected">Send</button>
    
    <div v-for="step in steps" :key="step.id" :class="step.status">
      {{ step.name }}
    </div>
    
    <pre v-if="response">{{ response.data }}</pre>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
```

### Angular

```typescript
import { Component, OnDestroy } from '@angular/core';
import { ModelRiverService } from '@modelriver/client/angular';

@Component({
  selector: 'app-chat',
  providers: [ModelRiverService],
  template: `
    <button (click)="send()" [disabled]="modelRiver.isConnected">
      Send
    </button>
    
    <div *ngFor="let step of modelRiver.steps$ | async" [class]="step.status">
      {{ step.name }}
    </div>
    
    <pre *ngIf="modelRiver.response$ | async as res">
      {{ res.data | json }}
    </pre>
    
    <p *ngIf="modelRiver.error$ | async as err" class="error">
      {{ err }}
    </p>
  `,
})
export class ChatComponent implements OnDestroy {
  constructor(public modelRiver: ModelRiverService) {
    this.modelRiver.init({ 
      baseUrl: 'wss://api.modelriver.com/socket' 
    });
  }

  async send() {
    const { ws_token } = await this.backendService.createRequest(message);
    this.modelRiver.connect({ wsToken: ws_token });
  }

  ngOnDestroy() {
    this.modelRiver.destroy();
  }
}
```

### Svelte

```svelte
<script>
  import { createModelRiver } from '@modelriver/client/svelte';
  import { onDestroy } from 'svelte';

  const modelRiver = createModelRiver({
    baseUrl: 'wss://api.modelriver.com/socket',
  });

  const { response, error, isConnected, steps, connect, disconnect } = modelRiver;

  async function send() {
    const { ws_token } = await backendAPI.createRequest(message);
    connect({ wsToken: ws_token });
  }

  onDestroy(() => disconnect());
</script>

<button on:click={send} disabled={$isConnected}>Send</button>

{#each $steps as step}
  <div class={step.status}>{step.name}</div>
{/each}

{#if $response}
  <pre>{JSON.stringify($response.data, null, 2)}</pre>
{/if}

{#if $error}
  <p class="error">{$error}</p>
{/if}
```

### Vanilla JavaScript (CDN)

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.modelriver.com/client/latest/modelriver.min.js"></script>
</head>
<body>
  <button id="send">Send</button>
  <pre id="response"></pre>

  <script>
    const client = new ModelRiver.ModelRiverClient({
      baseUrl: 'wss://api.modelriver.com/socket',
    });

    client.on('response', (data) => {
      document.getElementById('response').textContent = 
        JSON.stringify(data, null, 2);
    });

    client.on('error', (error) => {
      console.error('Error:', error);
    });

    document.getElementById('send').addEventListener('click', async () => {
      // Get token from your backend
      const res = await fetch('/api/ai/request', { method: 'POST' });
      const { ws_token } = await res.json();
      
      client.connect({ wsToken: ws_token });
    });
  </script>
</body>
</html>
```

## API Reference

### ModelRiverClient

#### Constructor Options

```typescript
interface ModelRiverClientOptions {
  baseUrl?: string;           // WebSocket URL (default: 'wss://api.modelriver.com/socket')
  debug?: boolean;            // Enable debug logging (default: false)
  persist?: boolean;          // Enable localStorage persistence (default: true)
  storageKeyPrefix?: string;  // Storage key prefix (default: 'modelriver_')
  heartbeatInterval?: number; // Heartbeat interval in ms (default: 30000)
  requestTimeout?: number;    // Request timeout in ms (default: 300000)
}
```

#### Methods

| Method | Description |
|--------|-------------|
| `connect({ wsToken })` | Connect to WebSocket with token |
| `disconnect()` | Disconnect from WebSocket |
| `reset()` | Reset state and clear stored data |
| `reconnect()` | Reconnect using stored token |
| `getState()` | Get current client state |
| `hasPendingRequest()` | Check if there's a pending request |
| `on(event, callback)` | Add event listener (returns unsubscribe function) |
| `off(event, callback)` | Remove event listener |
| `destroy()` | Clean up all resources |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `connecting` | - | Connection attempt started |
| `connected` | - | Successfully connected |
| `disconnected` | `reason?: string` | Disconnected from WebSocket |
| `response` | `AIResponse` | AI response received |
| `error` | `Error \| string` | Error occurred |
| `step` | `WorkflowStep` | Workflow step updated |
| `channel_joined` | - | Successfully joined channel |
| `channel_error` | `reason: string` | Channel join failed |

### Types

```typescript
interface AIResponse {
  status: string;
  channel_id?: string;
  data?: unknown;
  meta?: {
    workflow?: string;
    status?: string;
    duration_ms?: number;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  error?: {
    message: string;
    details?: unknown;
  };
}

interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  duration?: number;
  errorMessage?: string;
}
```

## How It Works

1. **Your backend** calls the ModelRiver API to create an AI request
2. **ModelRiver** returns a `ws_token` (JWT) containing connection details
3. **Your frontend** uses this SDK to connect to ModelRiver's WebSocket
4. **AI responses** are streamed in real-time to your frontend
5. **The SDK** handles reconnection, heartbeats, and error recovery

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Frontend   │       │ Your Backend │       │  ModelRiver  │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       │  1. Request AI       │                      │
       │─────────────────────>│                      │
       │                      │  2. Create request   │
       │                      │─────────────────────>│
       │                      │                      │
       │                      │  3. Return ws_token  │
       │                      │<─────────────────────│
       │  4. Return token     │                      │
       │<─────────────────────│                      │
       │                      │                      │
       │  5. Connect WebSocket (SDK)                 │
       │─────────────────────────────────────────────>│
       │                      │                      │
       │  6. Stream AI response                      │
       │<─────────────────────────────────────────────│
       │                      │                      │
```

## Security

The `ws_token` is a short-lived JWT that:
- Contains `project_id`, `channel_id`, and `topic`
- Is decoded client-side (signature verified server-side)
- Expires after 5 minutes
- Should never be exposed in client-side code directly

**Important**: Always obtain tokens from your backend. Never expose your ModelRiver API key in frontend code.

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

MIT

## Links

- [Documentation](https://modelriver.com/docs)
- [API Reference](https://modelriver.com/docs/api)
- [Dashboard](https://modelriver.com/dashboard)
- [GitHub Issues](https://github.com/modelriver/client/issues)
