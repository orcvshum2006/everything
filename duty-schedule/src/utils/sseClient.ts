/**
 * SSE (Server-Sent Events) 客户端
 * 实现跨设备的实时数据同步
 */

export interface SSEMessage {
  type: 'connected' | 'heartbeat' | 'dataUpdate' | 'scheduleUpdated' | 'recordAdded' | 'recordDeleted' | 'swapCompleted';
  timestamp: number;
  data?: any;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private onMessageCallback: ((message: SSEMessage) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1秒
  private isManuallyDisconnected = false;

  constructor(private baseUrl: string = '') {
    // 如果没有提供baseUrl，使用当前域名
    if (!baseUrl) {
      // 支持多个前端端口映射到后端8081端口
      this.baseUrl = window.location.origin
        .replace(':5173', ':8081')
        .replace(':5174', ':8081')
        .replace(':5175', ':8081')
        .replace(':5176', ':8081')
        .replace(':5177', ':8081');
    }
  }

  private parseEventData(data: string): any {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  public connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    this.isManuallyDisconnected = false;
    const url = `${this.baseUrl}/api/events`;
    
    console.log('📡 正在连接SSE服务器:', url);
    
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('✅ SSE连接已建立');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        // 处理标准的SSE消息格式（使用event.type）
        let eventType = 'message'; // 默认类型
        let messageData = event.data;
        
        // 尝试解析JSON数据
        let parsedData;
        try {
          parsedData = JSON.parse(messageData);
        } catch {
          parsedData = messageData;
        }
        
        const message: SSEMessage = {
          type: eventType as any,
          timestamp: Date.now(),
          data: parsedData
        };
        
        console.log('📨 收到SSE消息:', message);

        if (this.onMessageCallback) {
          this.onMessageCallback(message);
        }
      } catch (error) {
        console.error('❌ 解析SSE消息失败:', error);
      }
    };

    // 添加对特定事件类型的监听
    this.eventSource.addEventListener('connected', (event) => {
      const message: SSEMessage = {
        type: 'connected',
        timestamp: Date.now(),
        data: this.parseEventData(event.data)
      };
      console.log('📨 收到SSE事件 (connected):', message);
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });

    this.eventSource.addEventListener('scheduleUpdated', (event) => {
      const message: SSEMessage = {
        type: 'scheduleUpdated',
        timestamp: Date.now(),
        data: this.parseEventData(event.data)
      };
      console.log('📨 收到SSE事件 (scheduleUpdated):', message);
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });

    this.eventSource.addEventListener('recordAdded', (event) => {
      const message: SSEMessage = {
        type: 'recordAdded',
        timestamp: Date.now(),
        data: this.parseEventData(event.data)
      };
      console.log('📨 收到SSE事件 (recordAdded):', message);
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });

    this.eventSource.addEventListener('recordDeleted', (event) => {
      const message: SSEMessage = {
        type: 'recordDeleted',
        timestamp: Date.now(),
        data: this.parseEventData(event.data)
      };
      console.log('📨 收到SSE事件 (recordDeleted):', message);
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });

    this.eventSource.addEventListener('swapCompleted', (event) => {
      const message: SSEMessage = {
        type: 'swapCompleted',
        timestamp: Date.now(),
        data: this.parseEventData(event.data)
      };
      console.log('📨 收到SSE事件 (swapCompleted):', message);
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });

    this.eventSource.onerror = (error) => {
      console.error('❌ SSE连接错误:', error);
      
      // 如果不是手动断开，尝试重连
      if (!this.isManuallyDisconnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避
        
        console.log(`🔄 ${delay/1000}秒后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
          if (!this.isManuallyDisconnected) {
            this.connect();
          }
        }, delay);
      }
    };
  }

  public disconnect(): void {
    this.isManuallyDisconnected = true;
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('🔌 SSE连接已断开');
    }
  }

  public onMessage(callback: (message: SSEMessage) => void): void {
    this.onMessageCallback = callback;
  }

  public isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// 创建全局SSE客户端实例
export const sseClient = new SSEClient(); 