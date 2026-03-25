/**
 * API 客户端
 * 统一的 API 调用封装
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const token = localStorage.getItem('token')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: response.statusText || 'Request failed',
        }))
        throw new Error(error.error || error.message || 'Request failed')
      }

      return await response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Unknown error occurred')
    }
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  async download(endpoint: string, filename: string): Promise<void> {
    const url = `${this.baseUrl}${endpoint}`
    const token = localStorage.getItem('token')

    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error('Download failed')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(downloadUrl)
  }
}

export const apiClient = new ApiClient()

/**
 * Mock 相关 API
 */
export const mockApi = {
  getAll: () => apiClient.get<any[]>('/api/mocks'),
  getById: (id: string) => apiClient.get<any>(`/api/mocks/${id}`),
  create: (data: any) => apiClient.post<any>('/api/mocks', data),
  update: (id: string, data: any) => apiClient.put<any>(`/api/mocks/${id}`, data),
  delete: (id: string) => apiClient.delete<any>(`/api/mocks/${id}`),
  toggle: (id: string) => apiClient.post<any>(`/api/mocks/${id}/toggle`),
}

/**
 * 契约相关 API
 */
export const contractApi = {
  getAll: () => apiClient.get<any[]>('/api/contracts'),
  getById: (id: string) => apiClient.get<any>(`/api/contracts/${id}`),
  create: (data: any) => apiClient.post<any>('/api/contracts', data),
  delete: (id: string) => apiClient.delete<any>(`/api/contracts/${id}`),

  // 发现契约
  discover: (options: { projectPath?: string; backendUrl?: string; port?: number; swaggerPath?: string }) =>
    apiClient.post<any>('/api/contracts/discover', options),

  // 同步契约
  sync: (id: string) => apiClient.post<any>(`/api/contracts/${id}/sync`),

  // 生成 Mock 数据
  getMocks: (id: string, endpoint?: string, method?: string) =>
    apiClient.get<any>(`/api/contracts/${id}/mocks?endpoint=${endpoint || ''}&method=${method || ''}`),
  generateMock: (id: string, data: { endpoint?: string; method?: string }) =>
    apiClient.post<any>(`/api/contracts/${id}/mocks/generate`, data),

  // TypeScript 类型
  getTypes: (id: string) => apiClient.get<any>(`/api/contracts/${id}/types`),
  downloadTypes: (id: string) =>
    apiClient.download(`/api/contracts/${id}/types/download`, 'api-types.ts'),

  // 验证
  validate: (id: string, frontendPath: string) =>
    apiClient.post<any>(`/api/contracts/${id}/validate`, { frontendPath }),

  // 版本历史
  getHistory: (id: string) => apiClient.get<any>(`/api/contracts/${id}/history`),

  // 差异对比
  getDiff: (id: string, version1: number, version2: number) =>
    apiClient.get<any>(`/api/contracts/${id}/diff?version1=${version1}&version2=${version2}`),
}

/**
 * 请求日志 API
 */
export const logApi = {
  getRecent: (limit = 100) => apiClient.get<any[]>(`/api/logs?limit=${limit}`),
  clear: () => apiClient.delete<any>('/api/logs'),
}

/**
 * 系统配置 API
 */
export const configApi = {
  get: () => apiClient.get<any>('/api/config'),
  update: (data: any) => apiClient.put<any>('/api/config', data),
}

export default apiClient
