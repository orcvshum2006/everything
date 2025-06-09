import type { DutySchedule, DutyRecord } from '../types';

// 自动检测API地址
const getAPIBaseURL = () => {
  // 优先使用环境变量配置
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 开发环境自动检测（仅作为后备方案）
  if (import.meta.env.DEV) {
    const currentHost = window.location.hostname;
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      // 非localhost访问，使用当前主机的8081端口
      return `http://${currentHost}:8081`;
    }
  }
  
  // 默认本地开发地址
  return 'http://localhost:8081';
};

const API_BASE_URL = getAPIBaseURL();

// 在开发环境下显示API地址信息
if (import.meta.env.DEV) {
  console.log('🔗 API Base URL:', API_BASE_URL);
  console.log('🌐 Current hostname:', window.location.hostname);
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      
      console.log('🚀 API请求:', {
        url,
        method: options.method || 'GET',
        body: options.body
      });
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      console.log('📥 API响应:', {
        status: response.status,
        ok: response.ok,
        data
      });
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP Error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('❌ API 请求失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络请求失败'
      };
    }
  }

  // 获取值班表数据
  async getDutySchedule(): Promise<ApiResponse<DutySchedule>> {
    return this.request<DutySchedule>('/api/duty-schedule');
  }

  // 更新值班表数据
  async updateDutySchedule(schedule: DutySchedule): Promise<ApiResponse<DutySchedule>> {
    return this.request<DutySchedule>('/api/duty-schedule', {
      method: 'PUT',
      body: JSON.stringify(schedule),
    });
  }

  // 添加单个排班记录
  async addDutyRecord(record: {
    date: string;
    personId: string | null;
    personName: string | null;
    type: 'auto' | 'manual' | 'swap' | 'replacement' | 'suspended';
    reason?: string;
    originalPersonId?: string;
  }): Promise<ApiResponse<DutyRecord>> {
    return this.request<DutyRecord>('/api/duty-records', {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }

  // 换班操作
  async swapDuties(
    date1: string,
    date2: string,
    reason?: string
  ): Promise<ApiResponse<DutyRecord[]>> {
    return this.request<DutyRecord[]>('/api/swap-duties', {
      method: 'POST',
      body: JSON.stringify({ date1, date2, reason }),
    });
  }

  // 删除排班记录
  async deleteDutyRecord(date: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/duty-records/${date}`, {
      method: 'DELETE',
    });
  }

  // 批量删除排班记录
  async deleteDutyRecords(dates: string[]): Promise<ApiResponse<{
    deletedCount: number;
    totalRequested: number;
    failedDates?: string[];
  }>> {
    return this.request<{
      deletedCount: number;
      totalRequested: number;
      failedDates?: string[];
    }>('/api/duty-records', {
      method: 'DELETE',
      body: JSON.stringify({ dates }),
    });
  }

  // 清理孤立的排班记录
  async cleanupOrphanedRecords(): Promise<ApiResponse<any>> {
    return this.request('/api/cleanup-orphaned-records', {
      method: 'POST'
    });
  }

  // 生成自动排班
  async generateSchedule(
    startDate: string,
    endDate: string,
    respectExisting: boolean = true
  ): Promise<ApiResponse<DutyRecord[]>> {
    return this.request<DutyRecord[]>('/api/generate-schedule', {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate, respectExisting }),
    });
  }

  // 获取统计数据
  async getStats(): Promise<ApiResponse<{
    totalPeople: number;
    activePeople: number;
    totalRecords: number;
    swapRequests: number;
    leaveRecords: number;
    lastUpdated: string;
  }>> {
    return this.request('/api/stats');
  }

  // 健康检查
  async healthCheck(): Promise<ApiResponse<{ 
    message: string; 
    timestamp: string;
    version: string;
  }>> {
    return this.request<{ 
      message: string; 
      timestamp: string;
      version: string;
    }>('/api/health');
  }
}

export const apiService = new ApiService();
export default apiService; 