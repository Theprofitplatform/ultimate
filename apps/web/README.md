# Ultimate SEO Dashboard

A modern, responsive Next.js 14 dashboard for comprehensive SEO management and analytics.

## Features

### 🚀 Modern Technology Stack
- **Next.js 14** with App Router
- **React 19** with Server Components
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Material-UI** components integration

### 🔐 Authentication & Security
- JWT-based authentication
- Secure token refresh mechanism
- Protected routes and middleware
- Multi-tenant support

### 📊 Dashboard Features
- **Real-time Analytics** with Server-Sent Events (SSE)
- **Interactive Charts** using Recharts
- **Keywords Management** - Track and monitor keyword rankings
- **Competitors Analysis** - Monitor competition metrics
- **Backlinks Monitoring** - Track link building efforts
- **Reports Generation** - Automated SEO reports

### 🎨 User Experience
- **Dark/Light Mode** with system preference detection
- **Fully Responsive** mobile-first design
- **Accessible** components following WCAG guidelines
- **Real-time Updates** for live data synchronization

### ⚡ Performance
- **Turbopack** for faster development builds
- **Optimized Bundle** with tree shaking
- **Image Optimization** with Next.js Image
- **SEO Optimized** with proper meta tags

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm 9+
- Ultimate SEO API running (see `/apps/api`)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Start development server
npm run dev
```

The application will be available at http://localhost:3000

### Environment Variables

Create `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_NAME="Ultimate SEO"
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_THEME=system
```

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with Turbopack
npm run type-check   # Run TypeScript type checking
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues

# Production
npm run build        # Build for production
npm run start        # Start production server
npm run preview      # Build and preview locally

# Utilities
npm run clean        # Clean build artifacts
npm run analyze      # Analyze bundle size
```

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard pages
│   ├── login/            # Authentication pages
│   └── globals.css       # Global styles
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── layout/           # Layout components
│   ├── dashboard/        # Dashboard-specific components
│   └── charts/           # Chart components
├── context/              # React context providers
│   ├── AuthContext.tsx  # Authentication state
│   └── ThemeContext.tsx # Theme management
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── services/             # API client and services
├── types/                # TypeScript type definitions
└── utils/                # Helper utilities
```

## API Integration

The dashboard connects to the Ultimate SEO API with:

- **REST API** for standard CRUD operations
- **Server-Sent Events** for real-time updates
- **WebSocket** support for instant notifications
- **File Upload** for bulk data import
- **Authentication** with JWT tokens

## Browser Support

- **Chrome** 90+
- **Firefox** 88+
- **Safari** 14+
- **Edge** 90+

## License

This project is part of the Ultimate SEO Platform.
