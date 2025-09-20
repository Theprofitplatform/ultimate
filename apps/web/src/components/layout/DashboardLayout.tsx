'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import {
  HomeIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  LinkIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CogIcon,
  BellIcon,
  UserIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid,
  ChartBarIcon as ChartBarSolid,
  MagnifyingGlassIcon as MagnifyingGlassSolid,
  LinkIcon as LinkSolid,
  UserGroupIcon as UserGroupSolid,
  DocumentTextIcon as DocumentTextSolid,
  CogIcon as CogSolid,
} from '@heroicons/react/24/solid'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    iconActive: HomeSolid,
  },
  {
    name: 'Keywords',
    href: '/dashboard/keywords',
    icon: MagnifyingGlassIcon,
    iconActive: MagnifyingGlassSolid,
  },
  {
    name: 'Rankings',
    href: '/dashboard/rankings',
    icon: ChartBarIcon,
    iconActive: ChartBarSolid,
  },
  {
    name: 'Backlinks',
    href: '/dashboard/backlinks',
    icon: LinkIcon,
    iconActive: LinkSolid,
  },
  {
    name: 'Competitors',
    href: '/dashboard/competitors',
    icon: UserGroupIcon,
    iconActive: UserGroupSolid,
  },
  {
    name: 'Reports',
    href: '/dashboard/reports',
    icon: DocumentTextIcon,
    iconActive: DocumentTextSolid,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: CogIcon,
    iconActive: CogSolid,
  },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <SunIcon className="h-5 w-5" />
      case 'dark':
        return <MoonIcon className="h-5 w-5" />
      case 'system':
      default:
        return <ComputerDesktopIcon className="h-5 w-5" />
    }
  }

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r transition-transform duration-300 ease-in-out lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">US</span>
            </div>
            <span className="text-lg font-semibold">Ultimate SEO</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = isActive ? item.iconActive : item.icon
              
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-card border-r">
          <div className="flex h-16 items-center px-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">US</span>
              </div>
              <span className="text-lg font-semibold">Ultimate SEO</span>
            </Link>
          </div>
          <nav className="mt-8 flex-1 px-4 pb-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = isActive ? item.iconActive : item.icon
                
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navigation */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-x-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-muted-foreground lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1" />
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Theme toggle */}
              <button
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={cycleTheme}
                title={`Current theme: ${theme}`}
              >
                {getThemeIcon()}
              </button>

              {/* Notifications */}
              <button
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <BellIcon className="h-5 w-5" />
              </button>

              <div className="h-6 w-px bg-border" />

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-x-2 p-1.5 text-sm leading-6 hover:bg-accent rounded-md transition-colors"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    {user?.avatar ? (
                      <img
                        className="h-8 w-8 rounded-full"
                        src={user.avatar}
                        alt={user.firstName || user.email}
                      />
                    ) : (
                      <span className="text-primary-foreground text-sm font-medium">
                        {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                      </span>
                    )}
                  </div>
                  <span className="hidden lg:flex lg:items-center">
                    <span className="text-foreground font-medium">
                      {user?.firstName || user?.email?.split('@')[0] || 'User'}
                    </span>
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 z-10 mt-2.5 w-56 origin-top-right bg-popover border rounded-md shadow-lg">
                    <div className="px-4 py-3 border-b">
                      <p className="text-sm text-foreground font-medium">
                        {user?.firstName && user?.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user?.email?.split('@')[0] || 'User'
                        }
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <div className="py-2">
                      <Link
                        href="/dashboard/profile"
                        className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <UserIcon className="mr-3 h-4 w-4" />
                        Your Profile
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <CogIcon className="mr-3 h-4 w-4" />
                        Settings
                      </Link>
                      <div className="border-t my-2" />
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          handleLogout()
                        }}
                        className="flex w-full items-center px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Click outside to close user menu */}
      {userMenuOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </div>
  )
}