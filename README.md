# recruit-reveal-poc

## Testing

This project includes comprehensive automated tests to ensure reliability and catch regressions during refactoring.

### Backend Unit Tests

The backend uses Jest for unit testing the API endpoints.

**Setup:**
```bash
cd recruit-reveal-backend
npm install
```

**Running Tests:**
```bash
# Run all backend tests
npm run test:backend

# Run tests in watch mode (for development)
npm run test:watch

# Run with verbose output
npm test -- --verbose
```

**Test Coverage:**
- `/evaluate` endpoint validation (QB and RB data)
- Input validation (missing Player_Name, position)
- Error handling (pipeline failures)
- Mocked Synapse pipeline integration

### Frontend E2E Tests

The frontend uses Playwright for end-to-end testing of the complete wizard flow.

**Setup:**
```bash
cd recruit-reveal-frontend-next
npm install
npx playwright install # Install browser dependencies
```

**Running Tests:**
```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run tests with UI (interactive)
npm run test:e2e:ui

# Run tests with browser visible (headed mode)
npm run test:e2e:headed
```

**Test Coverage:**
- Complete RB wizard flow (form filling → submission → dashboard)
- Complete QB wizard flow with position-specific questions  
- Form validation (required fields)
- Navigation using progress pills
- API mocking and response verification

### Test Files Structure

```
recruit-reveal-backend/
├── jest.config.js           # Jest configuration
├── tests/
│   ├── setup.js            # Test environment setup
│   └── evaluate.test.js    # API endpoint tests

recruit-reveal-frontend-next/
├── playwright.config.ts     # Playwright configuration  
└── tests/
    └── e2e/
        └── wizard.spec.ts   # End-to-end wizard tests
```

### Running All Tests

To run the complete test suite:

```bash
# Backend tests
cd recruit-reveal-backend && npm run test:backend

# Frontend E2E tests  
cd ../recruit-reveal-frontend-next && npm run test:e2e
```

### CI/CD Integration

These tests are designed to run in CI environments:
- Backend tests run in Node.js environment with mocked dependencies
- Frontend tests include retry logic and proper CI detection
- All tests use environment variables for configuration