'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { competitorsApi } from '@/services/api'
import { Competitor } from '@/types'
import { formatNumber } from '@/lib/utils'
import {
  UserGroupIcon,
  PlusIcon,
  EyeIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  LinkIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCompetitorDomain, setNewCompetitorDomain] = useState('')
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null)

  useEffect(() => {
    loadCompetitors()
  }, [])

  const loadCompetitors = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await competitorsApi.getCompetitors()

      if (response.success) {
        setCompetitors(response.data)
      } else {
        setError(response.message || 'Failed to load competitors')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading competitors')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCompetitor = async () => {
    if (!newCompetitorDomain.trim()) return

    try {
      const response = await competitorsApi.addCompetitor({
        domain: newCompetitorDomain.trim()
      })

      if (response.success) {
        setCompetitors(prev => [...prev, response.data])
        setNewCompetitorDomain('')
        setShowAddModal(false)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add competitor')
    }
  }

  const handleDeleteCompetitor = async (competitorId: string) => {
    try {
      await competitorsApi.deleteCompetitor(competitorId)
      setCompetitors(prev => prev.filter(c => c.id !== competitorId))
    } catch (err: any) {
      setError(err.message || 'Failed to delete competitor')
    }
  }

  const handleViewAnalysis = (competitor: Competitor) => {
    setSelectedCompetitor(competitor)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-muted rounded w-32 animate-pulse" />
            <div className="h-10 bg-muted rounded w-24 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded animate-pulse" />
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
            <h1 className="text-3xl font-bold tracking-tight">Competitors</h1>
            <p className="text-muted-foreground">
              Monitor and analyze your competition
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Competitor
          </Button>
        </div>

        {error && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
            {error}
          </div>
        )}

        {/* Competitors Grid */}
        {competitors.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <UserGroupIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No competitors added</h3>
              <p className="mt-2 text-muted-foreground">
                Start tracking your competitors to gain competitive insights.
              </p>
              <Button onClick={() => setShowAddModal(true)} className="mt-4">
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Your First Competitor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitors.map((competitor) => (
              <Card key={competitor.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg truncate">
                      {competitor.name || competitor.domain}
                    </CardTitle>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAnalysis(competitor)}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCompetitor(competitor.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="truncate">
                    {competitor.domain}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Domain Authority</p>
                      <p className="text-lg font-semibold">{competitor.metrics.domainAuthority}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Organic Keywords</p>
                      <p className="text-lg font-semibold">
                        {formatNumber(competitor.metrics.organicKeywords)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Est. Traffic</p>
                      <p className="text-lg font-semibold">
                        {formatNumber(competitor.metrics.estimatedTraffic)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Backlinks</p>
                      <p className="text-lg font-semibold">
                        {formatNumber(competitor.metrics.backlinks)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Common Keywords</span>
                      <span className="font-medium">{competitor.commonKeywords?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Gap Opportunities</span>
                      <span className="font-medium text-primary">{competitor.gapKeywords?.length || 0}</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => handleViewAnalysis(competitor)}
                  >
                    View Analysis
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        {competitors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <UserGroupIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Competitors</p>
                    <p className="text-xl font-bold">{competitors.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Common Keywords</p>
                    <p className="text-xl font-bold">
                      {competitors.reduce((acc, comp) => acc + (comp.commonKeywords?.length || 0), 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <ArrowTrendingUpIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Avg. DA</p>
                    <p className="text-xl font-bold">
                      {Math.round(competitors.reduce((acc, comp) => acc + comp.metrics.domainAuthority, 0) / competitors.length)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <ChartBarIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Opportunities</p>
                    <p className="text-xl font-bold text-primary">
                      {competitors.reduce((acc, comp) => acc + (comp.gapKeywords?.length || 0), 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Competitor</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Domain Name
                  </label>
                  <Input
                    placeholder="example.com"
                    value={newCompetitorDomain}
                    onChange={(e) => setNewCompetitorDomain(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCompetitor()}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the domain without https:// or www
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false)
                      setNewCompetitorDomain('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddCompetitor} disabled={!newCompetitorDomain.trim()}>
                    Add Competitor
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Competitor Analysis Modal */}
      {selectedCompetitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedCompetitor.name || selectedCompetitor.domain}
                  </h3>
                  <p className="text-muted-foreground">{selectedCompetitor.domain}</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCompetitor(null)}
                >
                  ×
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Key Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Domain Authority</p>
                        <p className="text-2xl font-bold">{selectedCompetitor.metrics.domainAuthority}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Organic Keywords</p>
                        <p className="text-2xl font-bold">
                          {formatNumber(selectedCompetitor.metrics.organicKeywords)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Est. Traffic</p>
                        <p className="text-2xl font-bold">
                          {formatNumber(selectedCompetitor.metrics.estimatedTraffic)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Backlinks</p>
                        <p className="text-2xl font-bold">
                          {formatNumber(selectedCompetitor.metrics.backlinks)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Common Keywords */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Common Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCompetitor.commonKeywords?.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedCompetitor.commonKeywords.slice(0, 10).map((keyword, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm">{keyword.term}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatNumber(keyword.searchVolume)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No common keywords found</p>
                    )}
                  </CardContent>
                </Card>

                {/* Gap Opportunities */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Gap Opportunities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCompetitor.gapKeywords?.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedCompetitor.gapKeywords.slice(0, 10).map((keyword, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm">{keyword.term}</span>
                            <span className="text-xs text-primary">
                              {formatNumber(keyword.searchVolume)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No gap opportunities found</p>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full" variant="outline">
                      <LinkIcon className="h-4 w-4 mr-2" />
                      View Full Report
                    </Button>
                    <Button className="w-full" variant="outline">
                      <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                      Export Keywords
                    </Button>
                    <Button className="w-full" variant="outline">
                      <ChartBarIcon className="h-4 w-4 mr-2" />
                      Track Changes
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}