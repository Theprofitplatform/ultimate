'use client'

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { User, AuthState, AuthTokens } from '@/types'
import { authApi, userApi, realTimeUpdates } from '@/services/api'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<void>
  refreshUserData: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_TOKENS'; payload: AuthTokens | null }
  | { type: 'LOGOUT' }

const initialState: AuthState = {
  user: null,
  tokens: null,
  isLoading: true,
  isAuthenticated: false,
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      }
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      }
    case 'SET_TOKENS':
      return {
        ...state,
        tokens: action.payload,
      }
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      }
    default:
      return state
  }
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Initialize auth state from storage
  useEffect(() => {
    initializeAuth()
  }, [])

  // Setup real-time updates when authenticated
  useEffect(() => {
    if (state.isAuthenticated) {
      realTimeUpdates.connect()
      
      // Subscribe to user updates
      const unsubscribe = realTimeUpdates.subscribe('user_updated', (userData) => {
        dispatch({ type: 'SET_USER', payload: userData })
      })

      return () => {
        unsubscribe()
        realTimeUpdates.disconnect()
      }
    }
  }, [state.isAuthenticated])

  const initializeAuth = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })

      // Check for stored tokens
      const storedTokens = getStoredTokens()
      const storedUser = getStoredUser()

      if (storedTokens && storedUser && !isTokenExpired(storedTokens.accessToken)) {
        dispatch({ type: 'SET_TOKENS', payload: storedTokens })
        dispatch({ type: 'SET_USER', payload: storedUser })
        
        // Verify token is still valid by fetching fresh user data
        try {
          await refreshUserData()
        } catch (error) {
          // Token might be invalid, clear auth state
          clearStoredAuth()
          dispatch({ type: 'LOGOUT' })
        }
      } else if (storedTokens?.refreshToken) {
        // Try to refresh the access token
        try {
          const response = await authApi.refreshToken(storedTokens.refreshToken)
          const newTokens: AuthTokens = response.data
          
          storeTokens(newTokens)
          dispatch({ type: 'SET_TOKENS', payload: newTokens })
          
          // Fetch fresh user data
          await refreshUserData()
        } catch (error) {
          clearStoredAuth()
          dispatch({ type: 'LOGOUT' })
        }
      } else {
        dispatch({ type: 'LOGOUT' })
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      dispatch({ type: 'LOGOUT' })
    }
  }

  const login = async (email: string, password: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const response = await authApi.login({ email, password })
      
      if (response.success) {
        const { user, tokens } = response.data
        
        storeTokens(tokens)
        storeUser(user)
        
        dispatch({ type: 'SET_TOKENS', payload: tokens })
        dispatch({ type: 'SET_USER', payload: user })
      } else {
        throw new Error(response.message || 'Login failed')
      }
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false })
      throw error
    }
  }

  const register = async (data: { 
    email: string; 
    password: string; 
    firstName?: string; 
    lastName?: string 
  }): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const response = await authApi.register(data)
      
      if (response.success) {
        const { user, tokens } = response.data
        
        storeTokens(tokens)
        storeUser(user)
        
        dispatch({ type: 'SET_TOKENS', payload: tokens })
        dispatch({ type: 'SET_USER', payload: user })
      } else {
        throw new Error(response.message || 'Registration failed')
      }
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false })
      throw error
    }
  }

  const logout = async (): Promise<void> => {
    try {
      // Call logout API to invalidate tokens
      if (state.tokens) {
        await authApi.logout()
      }
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      clearStoredAuth()
      realTimeUpdates.disconnect()
      dispatch({ type: 'LOGOUT' })
    }
  }

  const updateProfile = async (data: Partial<User>): Promise<void> => {
    try {
      const response = await userApi.updateProfile(data)
      
      if (response.success) {
        const updatedUser = response.data
        storeUser(updatedUser)
        dispatch({ type: 'SET_USER', payload: updatedUser })
      } else {
        throw new Error(response.message || 'Profile update failed')
      }
    } catch (error) {
      throw error
    }
  }

  const refreshUserData = async (): Promise<void> => {
    try {
      const response = await userApi.getProfile()
      
      if (response.success) {
        const userData = response.data
        storeUser(userData)
        dispatch({ type: 'SET_USER', payload: userData })
      } else {
        throw new Error('Failed to fetch user data')
      }
    } catch (error) {
      throw error
    }
  }

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    refreshUserData,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Storage utilities
function getStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem('auth_tokens')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function storeTokens(tokens: AuthTokens): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens))
  }
}

function storeUser(user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user))
  }
}

function clearStoredAuth(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_tokens')
    localStorage.removeItem('user')
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}