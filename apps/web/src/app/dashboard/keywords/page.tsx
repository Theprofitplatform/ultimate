'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { keywordsApi, realTimeUpdates } from '@/services/api'
import { Keyword, KeywordRanking } from '@/types'
import { formatNumber, formatDate, cn } from '@/lib/utils'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  EyeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/24/outline'

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<keyof Keyword | 'position'>('term')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadKeywords()
    
    // Subscribe to real-time keyword updates
    const unsubscribe = realTimeUpdates.subscribe('keyword_updated', (data) => {
      setKeywords(prev => prev.map(k => k.id === data.id ? data : k))
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const loadKeywords = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await keywordsApi.getKeywords({
        page: 1,
        limit: 100,
        sortBy: 'term',
        sortOrder: 'asc'
      })

      if (response.success) {
        setKeywords(response.data)
      } else {
        setError(response.message || 'Failed to load keywords')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading keywords')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return

    try {
      const response = await keywordsApi.addKeyword({
        term: newKeyword.trim(),
        intent: 'informational' // Default intent
      })

      if (response.success) {
        setKeywords(prev => [...prev, response.data])
        setNewKeyword('')
        setShowAddModal(false)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add keyword')
    }
  }

  const handleDeleteKeywords = async () => {
    if (selectedKeywords.size === 0) return

    try {
      for (const keywordId of selectedKeywords) {
        await keywordsApi.deleteKeyword(keywordId)
      }
      
      setKeywords(prev => prev.filter(k => !selectedKeywords.has(k.id)))
      setSelectedKeywords(new Set())
    } catch (err: any) {
      setError(err.message || 'Failed to delete keywords')
    }
  }

  const handleSort = (field: keyof Keyword | 'position') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleSelectKeyword = (keywordId: string) => {
    setSelectedKeywords(prev => {
      const newSet = new Set(prev)
      if (newSet.has(keywordId)) {
        newSet.delete(keywordId)
      } else {
        newSet.add(keywordId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedKeywords.size === filteredKeywords.length) {
      setSelectedKeywords(new Set())
    } else {
      setSelectedKeywords(new Set(filteredKeywords.map(k => k.id)))
    }
  }

  const filteredKeywords = keywords.filter(keyword =>
    keyword.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    keyword.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const sortedKeywords = [...filteredKeywords].sort((a, b) => {
    let aValue: any
    let bValue: any

    if (sortField === 'position') {
      aValue = a.rankings?.[0]?.position || 999
      bValue = b.rankings?.[0]?.position || 999
    } else {
      aValue = a[sortField]
      bValue = b[sortField]
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const SortButton = ({ field, children }: { field: keyof Keyword | 'position', children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-left hover:text-foreground transition-colors"
    >
      <span>{children}</span>
      {sortField === field && (
        <ArrowsUpDownIcon className={cn(
          "h-3 w-3 transition-transform",
          sortDirection === 'desc' && "rotate-180"
        )} />
      )}
    </button>
  )

  const getRankingTrend = (keyword: Keyword) => {
    const currentRanking = keyword.rankings?.[0]
    if (!currentRanking || !currentRanking.previousPosition) return null

    const change = currentRanking.previousPosition - currentRanking.position
    if (change > 0) return { trend: 'up' as const, change }
    if (change < 0) return { trend: 'down' as const, change: Math.abs(change) }
    return { trend: 'stable' as const, change: 0 }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-muted rounded w-32 animate-pulse" />
            <div className="h-10 bg-muted rounded w-24 animate-pulse" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Keywords</h1>
            <p className="text-muted-foreground">
              Track and manage your keyword rankings
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {selectedKeywords.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteKeywords}
                size="sm"
              >
                Delete ({selectedKeywords.size})
              </Button>
            )}
            <Button onClick={() => setShowAddModal(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Keyword
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
            {error}
          </div>
        )}

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button variant="outline" size="sm">
                <FunnelIcon className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Keywords Table */}
        <Card>
          <CardHeader>
            <CardTitle>Keywords ({filteredKeywords.length})</CardTitle>
            <CardDescription>
              Monitor your keyword performance and rankings
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {sortedKeywords.length === 0 ? (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No keywords found</h3>
                <p className="mt-2 text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search terms.' : 'Add your first keyword to get started.'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowAddModal(true)} className="mt-4">
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Keyword
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="p-4 text-left">
                        <input
                          type="checkbox"
                          checked={selectedKeywords.size === filteredKeywords.length}
                          onChange={handleSelectAll}
                          className="rounded border-input"
                        />
                      </th>
                      <th className="p-4 text-left">
                        <SortButton field="term">Keyword</SortButton>
                      </th>
                      <th className="p-4 text-left">
                        <SortButton field="position">Position</SortButton>
                      </th>
                      <th className="p-4 text-left">
                        <SortButton field="searchVolume">Volume</SortButton>
                      </th>
                      <th className="p-4 text-left">
                        <SortButton field="difficulty">Difficulty</SortButton>
                      </th>
                      <th className="p-4 text-left">Intent</th>
                      <th className="p-4 text-left">Last Updated</th>
                      <th className="p-4 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedKeywords.map((keyword) => {
                      const currentRanking = keyword.rankings?.[0]
                      const trend = getRankingTrend(keyword)
                      
                      return (
                        <tr key={keyword.id} className="border-b hover:bg-muted/50">
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={selectedKeywords.has(keyword.id)}
                              onChange={() => handleSelectKeyword(keyword.id)}
                              className="rounded border-input"
                            />
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{keyword.term}</p>
                              {keyword.tags && keyword.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {keyword.tags.slice(0, 2).map((tag) => (
                                    <span
                                      key={tag}
                                      className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {keyword.tags.length > 2 && (
                                    <span className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded">
                                      +{keyword.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              {currentRanking ? (
                                <>
                                  <span className="font-medium">#{currentRanking.position}</span>
                                  {trend && trend.trend !== 'stable' && (
                                    <div className={cn(
                                      "flex items-center text-xs",
                                      trend.trend === 'up' ? "text-green-500" : "text-red-500"
                                    )}>
                                      {trend.trend === 'up' ? (
                                        <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                                      ) : (
                                        <ArrowTrendingDownIcon className="h-3 w-3 mr-1" />
                                      )}
                                      {trend.change}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">Not tracked</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-medium">{formatNumber(keyword.searchVolume)}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center">
                              <div className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium",
                                keyword.difficulty <= 30 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
                                keyword.difficulty <= 70 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" :
                                "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              )}>
                                {keyword.difficulty}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="capitalize text-sm text-muted-foreground">
                              {keyword.intent}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-muted-foreground">
                              {keyword.updatedAt ? formatDate(keyword.updatedAt) : 'Never'}
                            </span>
                          </td>
                          <td className="p-4">
                            <Button variant="ghost" size="sm">
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Keyword Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Keyword</h3>
              <div className="space-y-4">
                <Input
                  placeholder="Enter keyword..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                  autoFocus
                />
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false)
                      setNewKeyword('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddKeyword} disabled={!newKeyword.trim()}>
                    Add Keyword
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}