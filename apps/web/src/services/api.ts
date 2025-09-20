import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import { ApiResponse, ApiError, AuthTokens } from '@/types'

class ApiClient {
  private client: AxiosInstance
  private baseURL: string
  private tokenRefreshPromise: Promise<void> | null = null

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (typeof window !== 'undefined') {
          const tokens = this.getStoredTokens()
          if (tokens?.accessToken && !this.isTokenExpired(tokens.accessToken)) {
            config.headers.Authorization = `Bearer ${tokens.accessToken}`
          }
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          if (this.tokenRefreshPromise) {
            await this.tokenRefreshPromise
            return this.client(originalRequest)
          }

          this.tokenRefreshPromise = this.handleTokenRefresh()
          
          try {
            await this.tokenRefreshPromise
            this.tokenRefreshPromise = null
            return this.client(originalRequest)
          } catch (refreshError) {
            this.tokenRefreshPromise = null
            this.handleAuthError()
            throw refreshError
          }
        }

        throw error
      }
    )
  }

  private async handleTokenRefresh(): Promise<void> {
    const tokens = this.getStoredTokens()
    
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await axios.post(`${this.baseURL}/auth/refresh`, {
        refreshToken: tokens.refreshToken,
      })

      const newTokens: AuthTokens = response.data.data
      this.storeTokens(newTokens)
    } catch (error) {
      this.clearTokens()
      throw error
    }
  }

  private handleAuthError(): void {
    this.clearTokens()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }

  private getStoredTokens(): AuthTokens | null {
    if (typeof window === 'undefined') return null
    
    try {
      const stored = localStorage.getItem('auth_tokens')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  private storeTokens(tokens: AuthTokens): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_tokens', JSON.stringify(tokens))
    }
  }

  private clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_tokens')
      localStorage.removeItem('user')
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp * 1000 < Date.now()
    } catch {
      return true
    }
  }

  // Generic request methods
  async get<T = any>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.get(url, { params })
    return response.data
  }

  async post<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, data)
    return response.data
  }

  async put<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.put(url, data)
    return response.data
  }

  async patch<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.patch(url, data)
    return response.data
  }

  async delete<T = any>(url: string): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.delete(url)
    return response.data
  }

  // File upload
  async uploadFile<T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<T>> {
    const formData = new FormData()
    formData.append('file', file)

    const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })

    return response.data
  }

  // Server-Sent Events
  createEventSource(endpoint: string, options?: EventSourceInit): EventSource {
    const tokens = this.getStoredTokens()
    const url = new URL(`${this.baseURL}${endpoint}`)
    
    if (tokens?.accessToken && !this.isTokenExpired(tokens.accessToken)) {
      url.searchParams.set('token', tokens.accessToken)
    }

    return new EventSource(url.toString(), options)
  }

  // WebSocket connection
  createWebSocket(endpoint: string): WebSocket {
    const tokens = this.getStoredTokens()
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = new URL(this.baseURL).host
    let url = `${protocol}//${host}${endpoint}`
    
    if (tokens?.accessToken && !this.isTokenExpired(tokens.accessToken)) {
      url += `?token=${tokens.accessToken}`
    }

    return new WebSocket(url)
  }
}

// Create singleton instance
export const apiClient = new ApiClient()

// Authentication API
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    apiClient.post('/auth/login', credentials),
  
  register: (userData: { email: string; password: string; firstName?: string; lastName?: string }) =>
    apiClient.post('/auth/register', userData),
  
  logout: () =>
    apiClient.post('/auth/logout'),
  
  refreshToken: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }),
  
  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) =>
    apiClient.post('/auth/reset-password', { token, password }),
  
  verifyEmail: (token: string) =>
    apiClient.post('/auth/verify-email', { token }),
}

// User API
export const userApi = {
  getProfile: () =>
    apiClient.get('/user/profile'),
  
  updateProfile: (data: any) =>
    apiClient.put('/user/profile', data),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/user/change-password', { currentPassword, newPassword }),
  
  uploadAvatar: (file: File) =>
    apiClient.uploadFile('/user/avatar', file),
  
  getNotifications: (params?: any) =>
    apiClient.get('/user/notifications', params),
  
  markNotificationRead: (notificationId: string) =>
    apiClient.patch(`/user/notifications/${notificationId}/read`),
}

// Dashboard API
export const dashboardApi = {
  getMetrics: (params?: any) =>
    apiClient.get('/dashboard/metrics', params),
  
  getKeywordRankings: (params?: any) =>
    apiClient.get('/dashboard/keyword-rankings', params),
  
  getTrafficData: (params?: any) =>
    apiClient.get('/dashboard/traffic-data', params),
  
  getCompetitorData: (params?: any) =>
    apiClient.get('/dashboard/competitor-data', params),
  
  getRecentActivity: (params?: any) =>
    apiClient.get('/dashboard/activity', params),
}

// Keywords API
export const keywordsApi = {
  getKeywords: (params?: any) =>
    apiClient.get('/keywords', params),
  
  addKeyword: (data: any) =>
    apiClient.post('/keywords', data),
  
  updateKeyword: (id: string, data: any) =>
    apiClient.put(`/keywords/${id}`, data),
  
  deleteKeyword: (id: string) =>
    apiClient.delete(`/keywords/${id}`),
  
  bulkImport: (file: File) =>
    apiClient.uploadFile('/keywords/bulk-import', file),
  
  getRankings: (keywordId: string, params?: any) =>
    apiClient.get(`/keywords/${keywordId}/rankings`, params),
  
  updateRankings: (keywordId: string) =>
    apiClient.post(`/keywords/${keywordId}/update-rankings`),
}

// Competitors API
export const competitorsApi = {
  getCompetitors: (params?: any) =>
    apiClient.get('/competitors', params),
  
  addCompetitor: (data: any) =>
    apiClient.post('/competitors', data),
  
  updateCompetitor: (id: string, data: any) =>
    apiClient.put(`/competitors/${id}`, data),
  
  deleteCompetitor: (id: string) =>
    apiClient.delete(`/competitors/${id}`),
  
  getAnalysis: (id: string, params?: any) =>
    apiClient.get(`/competitors/${id}/analysis`, params),
  
  getCommonKeywords: (id: string, params?: any) =>
    apiClient.get(`/competitors/${id}/common-keywords`, params),
  
  getGapKeywords: (id: string, params?: any) =>
    apiClient.get(`/competitors/${id}/gap-keywords`, params),
}

// Backlinks API
export const backlinksApi = {
  getBacklinks: (params?: any) =>
    apiClient.get('/backlinks', params),
  
  addBacklink: (data: any) =>
    apiClient.post('/backlinks', data),
  
  updateBacklink: (id: string, data: any) =>
    apiClient.put(`/backlinks/${id}`, data),
  
  deleteBacklink: (id: string) =>
    apiClient.delete(`/backlinks/${id}`),
  
  checkStatus: (id: string) =>
    apiClient.post(`/backlinks/${id}/check-status`),
  
  bulkCheck: () =>
    apiClient.post('/backlinks/bulk-check'),
}

// Reports API
export const reportsApi = {
  getReports: (params?: any) =>
    apiClient.get('/reports', params),
  
  createReport: (data: any) =>
    apiClient.post('/reports', data),
  
  getReport: (id: string) =>
    apiClient.get(`/reports/${id}`),
  
  downloadReport: (id: string, format: string) =>
    apiClient.get(`/reports/${id}/download/${format}`, { responseType: 'blob' }),
  
  deleteReport: (id: string) =>
    apiClient.delete(`/reports/${id}`),
  
  scheduleReport: (data: any) =>
    apiClient.post('/reports/schedule', data),
}

// Real-time updates using Server-Sent Events
export class RealTimeUpdates {
  private eventSource: EventSource | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  connect() {
    if (this.eventSource) {
      this.disconnect()
    }

    this.eventSource = apiClient.createEventSource('/realtime/updates')
    
    this.eventSource.onopen = () => {
      console.log('Real-time connection established')
    }

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.notifyListeners(data.type, data.payload)
      } catch (error) {
        console.error('Error parsing real-time message:', error)
      }
    }

    this.eventSource.onerror = (error) => {
      console.error('Real-time connection error:', error)
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.connect()
        }
      }, 5000)
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }

  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(eventType)
        }
      }
    }
  }

  private notifyListeners(eventType: string, data: any) {
    const callbacks = this.listeners.get(eventType)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in real-time listener for ${eventType}:`, error)
        }
      })
    }
  }
}

export const realTimeUpdates = new RealTimeUpdates()

// Error handling utilities
export function handleApiError(error: any): ApiError {
  if (error.response?.data) {
    return {
      message: error.response.data.message || 'An error occurred',
      code: error.response.data.code || 'UNKNOWN_ERROR',
      details: error.response.data.details,
    }
  }
  
  if (error.message) {
    return {
      message: error.message,
      code: 'NETWORK_ERROR',
    }
  }

  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
  }
}