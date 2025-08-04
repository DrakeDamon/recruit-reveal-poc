# Recruit Reveal - Athlete Evaluation System

A comprehensive system for evaluating high school football players using Azure Synapse Analytics with intelligent data imputation and explainable AI.

## Architecture Overview

- **Backend**: Node.js/Express API with Azure Synapse integration
- **Frontend**: Next.js React application with dynamic forms
- **Data Processing**: Azure Synapse Analytics with automated combine data imputation
- **Database**: PostgreSQL with Prisma ORM

## API Documentation

### POST /api/evaluate

Evaluates an athlete's potential division fit using machine learning models with automatic data imputation.

#### Request Format

The API accepts athlete data in JSON format. All combine metrics are optional and will be intelligently imputed if missing.

**Required Fields:**

- `name` or `Player_Name`: Player's name
- `position`: Must be one of QB, RB, or WR
- `state`: Player's state
- `grad_year`: Graduation year

**Optional Fields (Position-specific):**

**QB Stats:**

- `senior_ypg`: Senior year yards per game
- `senior_tds`: Senior year touchdowns
- `senior_comp_pct`: Senior year completion percentage
- `senior_yds`: Senior year total yards
- `junior_ypg`: Junior year yards per game

**RB Stats:**

- `senior_yds`: Senior year rushing yards
- `senior_avg`: Senior year yards per carry
- `senior_rec`: Senior year receptions
- `senior_td`: Senior year touchdowns
- `senior_rush_yds`: Senior rushing yards

**WR Stats:**

- `senior_yds`: Senior year receiving yards
- `senior_avg`: Senior year yards per reception
- `senior_rec`: Senior year receptions
- `senior_td`: Senior year touchdowns

**Combine Metrics (All Optional):**

- `forty_yard_dash`: 40-yard dash time
- `vertical_jump`: Vertical jump height (inches)
- `shuttle`: Shuttle time
- `broad_jump`: Broad jump distance (inches)
- `bench_press`: Bench press reps

**Physical Measurements:**

- `height_inches`: Height in inches
- `weight_lbs`: Weight in pounds

#### Example Requests

**Complete QB Data:**

```json
{
  "name": "Trevon Hall",
  "position": "QB",
  "state": "TX",
  "grad_year": 2025,
  "height_inches": 72,
  "weight_lbs": 195,
  "senior_ypg": 280,
  "senior_tds": 25,
  "senior_comp_pct": 65,
  "forty_yard_dash": 4.6,
  "vertical_jump": 32,
  "shuttle": 4.4,
  "broad_jump": 115
}
```

**Minimal WR Data (with imputation):**

```json
{
  "name": "Speed Johnson",
  "position": "WR",
  "state": "FL",
  "grad_year": 2025,
  "height_inches": 70,
  "weight_lbs": 175,
  "senior_yds": 1100,
  "senior_rec": 60,
  "senior_td": 14
  // Combine data will be auto-imputed
}
```

#### Response Format

The API returns comprehensive evaluation results with imputation tracking:

```json
{
  "score": 73.5,
  "predicted_tier": "Power5",
  "predicted_division": "Power5",
  "confidence_score": 0.735,
  "probability": 0.735,
  "performance_score": 0.78,
  "combine_score": 0.72,
  "upside_score": 0.15,
  "underdog_bonus": 0.0,
  "goals": [
    "Improve vertical jump to 38+ inches",
    "Increase yards after catch"
  ],
  "switches": "Consider slot receiver role for better matchups",
  "calendar_advice": "Priority visits during official visit weekends in December",
  "imputation_flags": {
    "forty_yard_dash_imputed": true,
    "vertical_jump_imputed": false,
    "shuttle_imputed": true,
    "broad_jump_imputed": false,
    "bench_press_imputed": true
  },
  "data_completeness_warning": true,
  "feature_importance": {
    "speed_power_ratio": 0.2096,
    "ath_power": 0.1145,
    "combine_confidence": 0.0577
  }
}
```

#### Response Fields

- `score`: Overall evaluation score (0-100)
- `predicted_tier`/`predicted_division`: Predicted division (Power5, FCS, D2, D3, NAIA)
- `confidence_score`: Model confidence (0-1, lower if data imputed)
- `performance_score`: Performance metrics score (0-1)
- `combine_score`: Athletic testing score (0-1)
- `upside_score`: Growth potential score (0-1)
- `goals`: Array of improvement recommendations
- `switches`: Position switch recommendations (if applicable)
- `calendar_advice`: Recruiting timeline guidance
- `imputation_flags`: Indicates which combine metrics were estimated
- `data_completeness_warning`: True if any data was imputed
- `feature_importance`: Key features that influenced the prediction

#### Error Responses

**400 Bad Request:**

```json
{
  "error": "Position is required for evaluation",
  "requestId": "abc123"
}
```

**503 Service Unavailable:**

```json
{
  "error": "Evaluation service temporarily unavailable",
  "details": "Pipeline timeout",
  "requestId": "abc123"
}
```

### Usage Examples

#### Using fetch (JavaScript):

```javascript
const evaluateAthlete = async (athleteData) => {
  try {
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(athleteData),
    });

    if (!response.ok) {
      throw new Error(`Evaluation failed: ${response.status}`);
    }

    const result = await response.json();

    // Check for imputation warnings
    if (result.data_completeness_warning) {
      console.warn("Evaluation may be inaccurate due to incomplete data");
      console.log(
        "Imputed fields:",
        Object.entries(result.imputation_flags)
          .filter(([_, imputed]) => imputed)
          .map(([field, _]) => field.replace("_imputed", ""))
      );
    }

    return result;
  } catch (error) {
    console.error("Evaluation error:", error);
    throw error;
  }
};
```

#### Using curl:

```bash
curl -X POST http://localhost:3001/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Player",
    "position": "RB",
    "state": "CA",
    "grad_year": 2025,
    "senior_yds": 1500,
    "senior_avg": 5.2,
    "senior_td": 18
  }'
```

## Environment Configuration

### Required Azure Environment Variables

```bash
# Azure AD Authentication
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id

# Azure Synapse Configuration
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
AZURE_SYNAPSE_WORKSPACE=your-workspace-name
AZURE_PIPELINE_NAME=your-pipeline-name
# OR
AZURE_NOTEBOOK_NAME=your-notebook-name

# Database
PG_URL=postgresql://user:password@host:port/database

# Development/Testing
MOCK_SYNAPSE=true  # Use mock responses instead of real Synapse calls
```

## Data Imputation System

The system uses intelligent benchmarks to impute missing combine data:

### Combine Benchmarks by Position/Division

| Position | Division | 40-Yard Dash | Vertical Jump | Shuttle  | Broad Jump |
| -------- | -------- | ------------ | ------------- | -------- | ---------- |
| QB       | Power 5  | 4.6-4.9s     | 30-34"        | 4.3-4.6s | 108-118"   |
| QB       | FCS      | 4.7-5.0s     | 28-32"        | 4.4-4.7s | 102-112"   |
| RB       | Power 5  | 4.2-4.4s     | 34-38"        | 4.0-4.3s | 120-130"   |
| WR       | Power 5  | 4.4-4.7s     | 34-38"        | 4.1-4.4s | 120-130"   |

### Imputation Logic

1. **Division-Aware**: Uses target division benchmarks for imputation
2. **Bayesian-Inspired**: Normal distribution centered on benchmark ranges
3. **Flagged**: All imputed values clearly marked in response
4. **Confidence Impact**: Reduces model confidence when data is imputed

## Frontend Integration

### Handling Imputation Warnings

The frontend should display warnings when imputed data affects evaluation accuracy:

```jsx
const EvaluationResults = ({ evaluation }) => {
  const hasImputedData =
    evaluation.imputation_flags &&
    Object.values(evaluation.imputation_flags).some((flag) => flag);

  const getImputedFields = () => {
    if (!evaluation.imputation_flags) return [];
    return Object.entries(evaluation.imputation_flags)
      .filter(([_, imputed]) => imputed)
      .map(([field, _]) => field.replace("_imputed", "").replace("_", " "));
  };

  return (
    <div>
      {hasImputedData && (
        <Alert type="warning">
          <strong>Evaluation Subject to Change</strong>
          <p>
            This evaluation may be inaccurate by a division due to incomplete
            data. For the most accurate results, please submit official combine
            times.
          </p>
          <p>
            <strong>Estimated data:</strong> {getImputedFields().join(", ")}
          </p>
        </Alert>
      )}

      <div>
        <h3>{evaluation.predicted_division}</h3>
        <p>Confidence: {(evaluation.confidence_score * 100).toFixed(1)}%</p>
      </div>
    </div>
  );
};
```

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
- Imputation flags and data completeness warnings
- New API format compatibility

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
