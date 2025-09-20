'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Theme, ThemeConfig } from '@/types'

interface ThemeContextType {
  theme: Theme
  actualTheme: 'light' | 'dark' // The actual resolved theme (light or dark)
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  config: ThemeConfig
  updateConfig: (config: Partial<ThemeConfig>) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system',
  storageKey = 'theme'
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light')
  const [config, setConfigState] = useState<ThemeConfig>({
    theme: defaultTheme,
  })

  // Initialize theme from localStorage
  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey) as Theme
    const storedConfig = localStorage.getItem(`${storageKey}_config`)
    
    if (storedTheme) {
      setThemeState(storedTheme)
    }
    
    if (storedConfig) {
      try {
        const parsedConfig = JSON.parse(storedConfig)
        setConfigState({ ...config, ...parsedConfig, theme: storedTheme || defaultTheme })
      } catch {
        // Invalid config, use defaults
      }
    }
  }, [])

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const applyTheme = () => {
      root.classList.remove('light', 'dark')
      
      let resolvedTheme: 'light' | 'dark'
      
      if (theme === 'system') {
        resolvedTheme = mediaQuery.matches ? 'dark' : 'light'
      } else {
        resolvedTheme = theme
      }
      
      root.classList.add(resolvedTheme)
      setActualTheme(resolvedTheme)
      
      // Apply custom CSS variables if configured
      if (config.accentColor) {
        root.style.setProperty('--color-primary', config.accentColor)
      }
      
      if (config.borderRadius !== undefined) {
        root.style.setProperty('--radius', `${config.borderRadius}rem`)
      }
    }

    applyTheme()
    
    // Listen for system theme changes when using system theme
    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme)
      return () => mediaQuery.removeEventListener('change', applyTheme)
    }
  }, [theme, config])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(storageKey, newTheme)
    
    const newConfig = { ...config, theme: newTheme }
    setConfigState(newConfig)
    localStorage.setItem(`${storageKey}_config`, JSON.stringify(newConfig))
  }

  const toggleTheme = () => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      setTheme(mediaQuery.matches ? 'light' : 'dark')
    } else {
      setTheme(theme === 'light' ? 'dark' : 'light')
    }
  }

  const updateConfig = (newConfig: Partial<ThemeConfig>) => {
    const updatedConfig = { ...config, ...newConfig }
    setConfigState(updatedConfig)
    localStorage.setItem(`${storageKey}_config`, JSON.stringify(updatedConfig))
  }

  const value: ThemeContextType = {
    theme,
    actualTheme,
    setTheme,
    toggleTheme,
    config,
    updateConfig,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Hook for components that need to respond to theme changes
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

// Utility hook for detecting system dark mode preference
export function useSystemTheme(): 'light' | 'dark' {
  const isDark = useMediaQuery('(prefers-color-scheme: dark)')
  return isDark ? 'dark' : 'light'
}