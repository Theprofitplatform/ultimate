# Keywords Research API

A comprehensive keyword research API for the Ultimate SEO Platform, providing powerful keyword analysis, tracking, and management capabilities.

## Features

- **Keyword Management**: Create, read, update, and delete keywords with comprehensive metadata
- **Bulk Operations**: Import and export keywords in bulk (CSV, Excel, JSON)
- **Competition Analysis**: Analyze keyword difficulty and competition metrics
- **Search Volume Data**: Track search volume trends and patterns
- **Ranking Tracking**: Monitor keyword positions over time
- **Keyword Suggestions**: Get related keyword suggestions based on seed keywords
- **Analytics Dashboard**: Comprehensive analytics and performance metrics
- **Multi-tenant Support**: Full tenant isolation for SaaS applications
- **Caching Layer**: Redis-based caching with in-memory fallback
- **Rate Limiting**: Tenant-specific rate limiting
- **Export Functionality**: Export data in multiple formats

## API Endpoints

### Keywords Management
- `GET /api/keywords` - List keywords with pagination and filtering
- `POST /api/keywords` - Create a single keyword
- `POST /api/keywords/bulk` - Bulk create keywords
- `GET /api/keywords/:id` - Get a single keyword
- `PUT /api/keywords/:id` - Update a keyword
- `DELETE /api/keywords/:id` - Soft delete a keyword

### Analysis & Intelligence
- `POST /api/keywords/analyze` - Analyze keywords for competition and opportunities
- `GET /api/keywords/suggestions` - Get keyword suggestions
- `GET /api/keywords/analytics` - Get analytics and statistics

### Ranking Tracking
- `GET /api/keywords/:id/rankings` - Get ranking history for a keyword
- `POST /api/keywords/:id/rankings` - Add ranking data

### Data Export
- `POST /api/keywords/export` - Export keywords to CSV/Excel/JSON

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis (optional, for caching)

### Setup

1. **Clone and install dependencies:**
   ```bash
   cd /home/avi/projects/ultimate/apps/api
   npm install
   ```

2. **Environment Configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your database and configuration details
   ```

3. **Database Setup:**
   ```bash
   # Create database
   createdb ultimate_seo

   # The application will automatically create tables on first run
   npm run db:init
   ```

4. **Start the server:**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Optional |
| `JWT_SECRET` | JWT signing secret | Required |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |

### Database Schema

The API uses PostgreSQL with the following main tables:

- **keywords**: Main keyword data with metadata
- **keyword_rankings**: Historical ranking data
- Automatic indexes for performance optimization
- UUID primary keys for security
- Tenant isolation built-in

## Usage Examples

### Authentication
All endpoints require authentication. Include JWT token in Authorization header:
```bash
Authorization: Bearer <your-jwt-token>
```

### Create a Keyword
```bash
curl -X POST http://localhost:3000/api/keywords \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "seo tools",
    "search_volume": 5000,
    "keyword_difficulty": 45,
    "cpc": 2.50,
    "location": "US",
    "language": "en"
  }'
```

### List Keywords with Filtering
```bash
curl "http://localhost:3000/api/keywords?search_volume_min=1000&difficulty_max=50&page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

### Bulk Import Keywords
```bash
curl -X POST http://localhost:3000/api/keywords/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": [
      {"keyword": "keyword1", "search_volume": 1000},
      {"keyword": "keyword2", "search_volume": 2000}
    ]
  }'
```

### Get Keyword Suggestions
```bash
curl "http://localhost:3000/api/keywords/suggestions?seed_keyword=seo&limit=50" \
  -H "Authorization: Bearer <token>"
```

### Analyze Keywords
```bash
curl -X POST http://localhost:3000/api/keywords/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["seo tools", "keyword research"],
    "location": "US",
    "language": "en",
    "include_serp_analysis": true
  }'
```

### Export Keywords
```bash
curl -X POST http://localhost:3000/api/keywords/export \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "filters": {"search_volume_min": 1000},
    "fields": ["keyword", "search_volume", "keyword_difficulty", "cpc"]
  }'
```

## Data Models

### Keyword Object
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "keyword": "string",
  "search_volume": "integer",
  "keyword_difficulty": "integer (0-100)",
  "cpc": "decimal",
  "competition_level": "low|medium|high|unknown",
  "trend_data": "object",
  "related_keywords": "array",
  "serp_features": "array",
  "location": "string",
  "language": "string",
  "device": "desktop|mobile|tablet",
  "current_position": "integer",
  "best_position": "integer",
  "worst_position": "integer",
  "last_analyzed": "timestamp",
  "analysis_status": "pending|analyzing|completed|failed",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

## Features

### Caching Strategy
- Redis primary cache with in-memory fallback
- Tenant-isolated cache keys
- Automatic cache invalidation on mutations
- Configurable TTL per endpoint type

### Rate Limiting
- Tenant-specific rate limits
- Configurable windows and limits
- Graceful degradation

### Error Handling
- Comprehensive error responses
- Validation error details
- Database constraint handling
- Graceful service degradation

### Security
- JWT-based authentication
- Tenant isolation
- SQL injection prevention
- Input validation and sanitization

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Performance Considerations

- Database indexes on frequently queried fields
- Connection pooling for PostgreSQL
- Redis caching layer
- Pagination for large datasets
- Bulk operations for efficiency
- Background processing for heavy analysis

## Monitoring

The API includes built-in monitoring features:
- Request/response logging
- Performance metrics
- Error tracking
- Cache hit/miss statistics
- Database query performance

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass
5. Follow semantic versioning

## License

MIT License - see LICENSE file for details.