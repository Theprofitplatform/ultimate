// User and Authentication Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: 'admin' | 'user' | 'member';
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'trial' | 'cancelled';
    expiresAt?: string;
  };
  preferences?: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    timezone?: string;
  };
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Dashboard and Analytics Types
export interface DashboardMetrics {
  totalKeywords: number;
  avgPosition: number;
  totalTraffic: number;
  rankingChanges: number;
  keywordRankings: KeywordRanking[];
  trafficData: TrafficData[];
  competitorData: CompetitorData[];
  recentActivity: Activity[];
}

export interface KeywordRanking {
  id: string;
  keyword: string;
  position: number;
  previousPosition?: number;
  searchVolume: number;
  difficulty: number;
  url: string;
  lastUpdated: string;
  trend: 'up' | 'down' | 'stable';
  change?: number;
}

export interface TrafficData {
  date: string;
  organicTraffic: number;
  paidTraffic: number;
  totalClicks: number;
  impressions: number;
  ctr: number;
}

export interface CompetitorData {
  id: string;
  domain: string;
  commonKeywords: number;
  avgPosition: number;
  estimatedTraffic: number;
  visibility: number;
}

export interface Activity {
  id: string;
  type: 'keyword_added' | 'ranking_change' | 'competitor_added' | 'report_generated';
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// SEO Specific Types
export interface Keyword {
  id: string;
  term: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  intent: 'informational' | 'navigational' | 'transactional' | 'commercial';
  tags: string[];
  targetUrl?: string;
  rankings?: KeywordRanking[];
  createdAt: string;
  updatedAt: string;
}

export interface Backlink {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  domainAuthority: number;
  pageAuthority: number;
  linkType: 'dofollow' | 'nofollow';
  status: 'active' | 'lost' | 'new';
  firstSeen: string;
  lastSeen?: string;
}

export interface Competitor {
  id: string;
  domain: string;
  name?: string;
  description?: string;
  metrics: {
    domainAuthority: number;
    organicKeywords: number;
    estimatedTraffic: number;
    backlinks: number;
  };
  commonKeywords: Keyword[];
  gapKeywords: Keyword[];
  addedAt: string;
}

// Reports and Analysis Types
export interface Report {
  id: string;
  name: string;
  type: 'keyword_rankings' | 'competitor_analysis' | 'backlink_audit' | 'traffic_analysis';
  status: 'generating' | 'completed' | 'failed';
  config: ReportConfig;
  data?: any;
  generatedAt?: string;
  scheduledFor?: string;
  createdAt: string;
}

export interface ReportConfig {
  dateRange: {
    from: string;
    to: string;
  };
  keywords?: string[];
  competitors?: string[];
  metrics: string[];
  format: 'pdf' | 'excel' | 'json';
  includeCharts: boolean;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, any>;
}

// UI Component Types
export interface TableColumn<T = any> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterState {
  search?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  status?: string[];
  tags?: string[];
  [key: string]: any;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

// Theme Types
export type Theme = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  theme: Theme;
  accentColor?: string;
  borderRadius?: number;
}

// Multi-tenant Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  settings: {
    allowRegistration: boolean;
    maxUsers: number;
    features: string[];
  };
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'trial';
    usersCount: number;
    maxUsers: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'date';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface FormState<T = Record<string, any>> {
  data: T;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
}