'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { dashboardApi, realTimeUpdates } from '@/services/api'
import { DashboardMetrics } from '@/types'
import { formatNumber, formatPercentage } from '@/lib/utils'
import {
  ChartBarIcon,
  MagnifyingGlassIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  LinkIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function DashboardPage() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
    
    // Subscribe to real-time updates
    const unsubscribeMetrics = realTimeUpdates.subscribe('dashboard_metrics_updated', (data) => {
      setMetrics(data)
    })

    return () => {
      unsubscribeMetrics()
    }
  }, [])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await dashboardApi.getMetrics({
        period: '30d'
      })

      if (response.success) {
        setMetrics(response.data)
      } else {
        setError(response.message || 'Failed to load dashboard data')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3" />
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={loadDashboardData}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!metrics) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">No data available</p>
        </div>
      </DashboardLayout>
    )
  }

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    trend 
  }: { 
    title: string
    value: string | number
    change?: number
    icon: React.ElementType
    trend?: 'up' | 'down' | 'stable'
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            {trend === 'up' ? (
              <ArrowTrendingUpIcon className="h-3 w-3 text-green-500" />
            ) : trend === 'down' ? (
              <ArrowTrendingDownIcon className="h-3 w-3 text-red-500" />
            ) : null}
            <span className={
              trend === 'up' ? 'text-green-500' : 
              trend === 'down' ? 'text-red-500' : 
              'text-muted-foreground'
            }>
              {change > 0 ? '+' : ''}{formatPercentage(change)} from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const trafficChartData = metrics.trafficData?.map(item => ({
    name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    organic: item.organicTraffic,
    paid: item.paidTraffic,
    total: item.totalClicks,
  })) || []

  const rankingDistribution = [
    { name: 'Top 3', value: metrics.keywordRankings?.filter(k => k.position <= 3).length || 0, color: '#10B981' },
    { name: '4-10', value: metrics.keywordRankings?.filter(k => k.position >= 4 && k.position <= 10).length || 0, color: '#3B82F6' },
    { name: '11-20', value: metrics.keywordRankings?.filter(k => k.position >= 11 && k.position <= 20).length || 0, color: '#F59E0B' },
    { name: '21+', value: metrics.keywordRankings?.filter(k => k.position > 20).length || 0, color: '#EF4444' },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}!
            </h1>
            <p className="text-muted-foreground">
              Here&apos;s an overview of your SEO performance
            </p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Keywords"
            value={formatNumber(metrics.totalKeywords)}
            change={12.5}
            trend="up"
            icon={MagnifyingGlassIcon}
          />
          <MetricCard
            title="Average Position"
            value={metrics.avgPosition.toFixed(1)}
            change={-8.2}
            trend="up"
            icon={ChartBarIcon}
          />
          <MetricCard
            title="Organic Traffic"
            value={formatNumber(metrics.totalTraffic)}
            change={23.4}
            trend="up"
            icon={ArrowTrendingUpIcon}
          />
          <MetricCard
            title="Ranking Changes"
            value={metrics.rankingChanges > 0 ? `+${metrics.rankingChanges}` : metrics.rankingChanges}
            change={15.8}
            trend={metrics.rankingChanges > 0 ? 'up' : 'down'}
            icon={ArrowTrendingUpIcon}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Traffic Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Traffic Trend</CardTitle>
              <CardDescription>
                Organic and paid traffic over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      className="text-xs fill-muted-foreground" 
                      fontSize={12}
                    />
                    <YAxis 
                      className="text-xs fill-muted-foreground" 
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="organic"
                      stackId="1"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="paid"
                      stackId="1"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Ranking Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking Distribution</CardTitle>
              <CardDescription>
                Keywords by ranking position
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rankingDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {rankingDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {rankingDistribution.map((item) => (
                  <div key={item.name} className="flex items-center space-x-2">
                    <div 
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.name}: {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Top Keywords */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest updates and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.recentActivity?.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-2 w-2 bg-primary rounded-full mt-2" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Keywords */}
          <Card>
            <CardHeader>
              <CardTitle>Top Keywords</CardTitle>
              <CardDescription>
                Best performing keywords
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.keywordRankings?.slice(0, 5).map((keyword) => (
                  <div key={keyword.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {keyword.keyword}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(keyword.searchVolume)} searches/mo
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">#{keyword.position}</p>
                      {keyword.change && (
                        <p className={`text-xs ${
                          keyword.change > 0 
                            ? 'text-green-500' 
                            : keyword.change < 0 
                            ? 'text-red-500' 
                            : 'text-muted-foreground'
                        }`}>
                          {keyword.change > 0 ? '+' : ''}{keyword.change}
                        </p>
                      )}
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground">No keywords tracked yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}