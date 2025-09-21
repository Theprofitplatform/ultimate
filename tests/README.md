# Ultimate SEO Platform - Testing Suite

A comprehensive testing suite with 80%+ code coverage targets for the Ultimate SEO Platform.

## Overview

This testing suite provides comprehensive coverage across all application layers:

- **Unit Tests**: Testing individual components and services in isolation
- **Integration Tests**: Testing service interactions and database operations
- **End-to-End Tests**: Testing complete user workflows
- **Database Migration Tests**: Ensuring schema changes work correctly

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   └── auth.test.js        # Authentication system tests
├── integration/            # Integration tests
│   ├── keywords.test.js    # Keyword API integration tests
│   └── database-migrations.test.js # Database schema tests
├── e2e/                    # End-to-end tests
│   └── user-flow.test.js   # Complete user journey tests
├── fixtures/               # Test data
│   ├── users.js           # User-related test data
│   ├── keywords.js        # Keyword-related test data
│   └── api-responses.js   # Mock API responses
├── helpers/                # Test utilities
│   ├── setup.js           # Global test setup
│   ├── global-setup.js    # Jest global setup
│   ├── global-teardown.js # Jest global teardown
│   └── database.js        # Database test helpers
└── mocks/                  # Mock implementations
    └── external-apis.js    # External service mocks
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only

# Run specific test files
npm run test:auth          # Authentication tests
npm run test:keywords      # Keyword API tests
npm run test:migrations    # Database migration tests
npm run test:user-flow     # User flow tests
```

### Advanced Commands

```bash
# CI/CD pipeline tests
npm run test:ci

# Debug tests with Node.js debugger
npm run test:debug

# Clear Jest cache
npm run test:clear-cache
```

## Test Configuration

### Coverage Targets

The test suite enforces the following coverage thresholds:

- **Global**: 80% statements, 80% lines, 80% functions, 75% branches
- **Authentication**: 85% statements, 85% lines, 85% functions, 80% branches
- **Keywords Service**: 85% statements, 85% lines, 85% functions, 80% branches

### Environment Setup

Tests run in an isolated environment with:

- Dedicated test database with transaction rollback
- Mocked external APIs (Google OAuth, SEMrush, etc.)
- Environment variables configured for testing
- Automatic cleanup after each test

## Database Testing

### Test Database Setup

Tests use a separate PostgreSQL database for isolation:

```bash
# Set test database URL
export TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/ultimate_test"
```

### Transaction Rollback

Each test runs in a database transaction that automatically rolls back:

```javascript
beforeEach(async () => {
  await dbHelper.startTransaction();
});

afterEach(async () => {
  await dbHelper.rollbackTransaction();
});
```

### In-Memory Fallback

If PostgreSQL is not available, tests fall back to in-memory mocks:

```javascript
// Automatically detected and configured
if (!database_available) {
  global.__IN_MEMORY_TEST__ = true;
  // Mock database operations
}
```

## Custom Matchers

The test suite includes custom Jest matchers:

```javascript
// JWT validation
expect(token).toBeValidJWT();

// Email validation
expect(email).toBeValidEmail();

// UUID validation
expect(id).toBeValidUUID();

// Database ID validation
expect(result.id).toHaveValidDatabaseId();

// Timestamp validation
expect(timestamp).toBeRecentTimestamp(60); // Within 60 seconds
```

## Test Data and Fixtures

### User Fixtures

```javascript
const { users, dbUsers, organizations } = require('./fixtures/users');

// Use in tests
const userData = users.validUser;
const dbUser = await dbUsers.adminUser();
```

### Keyword Fixtures

```javascript
const { keywords, dbKeywords, analytics } = require('./fixtures/keywords');

// Use in tests
const keywordData = keywords.validKeyword;
const analyticsData = analytics.enriched;
```

### API Response Fixtures

```javascript
const apiResponses = require('./fixtures/api-responses');

// Mock external API responses
mockKeywordAPI.semrush.getKeywordData.mockResolvedValue(
  apiResponses.semrush.keywordOverview
);
```

## Mocking External Services

### Authentication Services

```javascript
// Google OAuth
jest.mock('googleapis', () => mockGoogleOAuth);

// Email service
jest.mock('nodemailer', () => mockNodemailer);
```

### SEO APIs

```javascript
// SEMrush API
const mockSemrush = mockKeywordAPI.semrush;
mockSemrush.getKeywordData.mockResolvedValue(keywordData);

// Simulate API errors
mockKeywordAPI.simulateAPIError('semrush', 'getKeywordData', new Error('Rate limited'));
```

### Storage Services

```javascript
// AWS S3
const mockS3 = mockStorageAPI.aws.s3;
mockS3.upload.mockResolvedValue({
  Location: 'https://bucket.s3.amazonaws.com/file.csv'
});
```

## Error Testing

### Authentication Errors

```javascript
test('should handle invalid credentials', async () => {
  await expect(authService.login('invalid@email.com', 'wrong'))
    .rejects.toThrow('Invalid email or password');
});
```

### Database Errors

```javascript
test('should handle database connection failure', async () => {
  mockPool.query.mockRejectedValue(new Error('Connection failed'));

  await expect(service.createUser(userData))
    .rejects.toThrow('Failed to create user');
});
```

### API Errors

```javascript
test('should handle external API failures', async () => {
  mockKeywordAPI.simulateAPIError('semrush', 'getKeywordData');

  const result = await service.analyzeKeywords(tenantId, keywords);
  expect(result.failed).toBeGreaterThan(0);
});
```

## Performance Testing

### Load Testing

```javascript
test('should handle concurrent operations', async () => {
  const promises = Array.from({ length: 100 }, () =>
    service.createKeyword(tenantId, keywordData)
  );

  const results = await Promise.all(promises);
  expect(results).toHaveLength(100);
});
```

### Timing Tests

```javascript
test('should complete within time limit', async () => {
  const startTime = Date.now();
  await service.bulkCreateKeywords(tenantId, largeDataset);
  const duration = Date.now() - startTime;

  expect(duration).toBeLessThan(5000); // 5 seconds
});
```

## Security Testing

### Input Sanitization

```javascript
test('should sanitize SQL injection attempts', async () => {
  const maliciousInput = "'; DROP TABLE users; --";

  const result = await service.createKeyword(tenantId, {
    keyword: maliciousInput
  });

  // Should create without executing injection
  expect(result.keyword).toBe(maliciousInput);
});
```

### Authentication Testing

```javascript
test('should reject unauthorized access', async () => {
  const response = await request(app)
    .get('/api/keywords')
    .expect(401);

  expect(response.body.error).toBe('Unauthorized');
});
```

## Continuous Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: ultimate_test
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
```

### Coverage Reports

Tests generate coverage reports in multiple formats:

- **HTML**: `coverage/lcov-report/index.html`
- **LCOV**: `coverage/lcov.info`
- **JSON**: `coverage/coverage-final.json`
- **Text**: Console output during test runs

## Best Practices

### Test Organization

1. **Arrange-Act-Assert**: Structure tests clearly
2. **One Assertion**: Each test should verify one behavior
3. **Descriptive Names**: Test names should explain what and why
4. **Test Data Builders**: Use factories for consistent test data

### Database Testing

1. **Transaction Isolation**: Each test runs in its own transaction
2. **Realistic Data**: Use data that matches production scenarios
3. **Foreign Key Testing**: Verify referential integrity
4. **Migration Testing**: Test both up and down migrations

### Mock Management

1. **Reset Between Tests**: Clear mocks after each test
2. **Realistic Responses**: Mock data should match real API responses
3. **Error Scenarios**: Test both success and failure cases
4. **Rate Limiting**: Simulate API rate limits and retries

### Performance Considerations

1. **Parallel Execution**: Use Jest's parallel test execution
2. **Database Cleanup**: Minimize database operations in tests
3. **Mock External Calls**: Avoid real API calls in tests
4. **Resource Management**: Properly close connections and cleanup

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is running
2. **Port Conflicts**: Check for conflicting services
3. **Memory Issues**: Increase Node.js memory limit for large test suites
4. **Timeout Errors**: Increase test timeout for slow operations

### Debug Mode

```bash
# Run tests with Node.js debugger
npm run test:debug

# Run specific test in debug mode
npm run test:debug -- --testNamePattern="should login user"
```

### Environment Variables

```bash
# Enable debug output
DEBUG=true npm test

# Set test database URL
TEST_DATABASE_URL="postgresql://localhost/test_db" npm test

# Increase timeout
JEST_TIMEOUT=60000 npm test
```

## Contributing

### Adding New Tests

1. Create test files in the appropriate directory
2. Follow existing naming conventions
3. Use provided fixtures and helpers
4. Ensure tests are independent and idempotent
5. Add new test commands to package.json if needed

### Test Coverage Goals

- Maintain 80%+ coverage for all new code
- Critical authentication code requires 85%+ coverage
- All public API endpoints must have integration tests
- Database migrations must have rollback tests

### Code Review Checklist

- [ ] Tests cover both success and error scenarios
- [ ] Database tests use transaction rollback
- [ ] External services are properly mocked
- [ ] Test names are descriptive and clear
- [ ] No hard-coded values (use fixtures)
- [ ] Performance tests have reasonable time limits
- [ ] Security tests cover input validation