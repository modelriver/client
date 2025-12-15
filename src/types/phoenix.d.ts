declare module 'phoenix' {
  export class Socket {
    constructor(endpoint: string, opts?: any);
    connect(params?: any): void;
    disconnect(code?: number, reason?: string): void;
    channel(topic: string, params?: any): Channel;
    onOpen(callback: Function): void;
    onClose(callback: Function): void;
    onError(callback: Function): void;
  }

  export class Channel {
    constructor(topic: string, params?: any);
    join(timeout?: number): any;
    leave(timeout?: number): any;
    push(event: string, payload?: any, timeout?: number): any;
    on(event: string, callback: Function): void;
  }
}
