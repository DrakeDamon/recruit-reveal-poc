# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Recruit Reveal is a comprehensive athlete evaluation system for high school football players using machine learning with intelligent data imputation and explainable AI. The system evaluates QB, RB, and WR positions to predict college division placement (Power5, FCS, D2, D3, NAIA).

## Architecture

### Core Components
- **Backend API**: Node.js/Express (`recruit-reveal-backend/server.js`) - handles evaluation requests via Azure Synapse or ML API
- **ML API**: FastAPI service (`recruit-reveal-backend/ml-api/main.py`) - serves trained XGBoost models with versioning
- **Frontend**: Next.js React app (`recruit-reveal-frontend-next/`) - wizard-based athlete data collection
- **ML Pipeline**: Production pipeline (`recruit_reveal_production_pipeline.py`) - comprehensive feature engineering and model training
- **Database**: PostgreSQL with Prisma ORM for user/evaluation storage

### Key ML Components
- **Notebook Logic**: `gitingore-eval-logic-test.ipynb` contains the Synapse-equivalent logic with feature engineering
- **Feature Engineering**: Trajectory calculation, BMI, state talent scores, combine confidence, position-specific features
- **Target Mapping**: Power5=4, FCS=3, D2=2, D3=0, NAIA=0 (CRITICAL: D3 and NAIA map to 0)
- **Model Parameters**: XGBoost with n_estimators=300, max_depth=6, learning_rate=0.05, random_state=42
- **Train/Test Split**: 85/15 split with stratification, random_state=42

## Essential Commands

### Backend Development
```bash
cd recruit-reveal-backend

# Install dependencies
npm install

# Start backend server (port 3001)
npm start

# Run backend tests
npm run test:backend
npm run test:watch  # Watch mode

# Database operations
npx prisma migrate dev  # Run migrations
npx prisma generate     # Generate client
npx prisma studio       # GUI for database
```

### ML API Development
```bash
cd recruit-reveal-backend/ml-api

# Install Python dependencies
pip install -r requirements.txt

# Start ML API (port 8000)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# With environment variables
export MODEL_VERSION=latest MODEL_DIR=./models ALLOWED_ORIGINS="*"
uvicorn main:app --reload
```

### ML Pipeline Training
```bash
cd recruit-reveal-backend

# Train single position with evaluation
python recruit_reveal_production_pipeline.py \
  --csv data/qb.csv \
  --position qb \
  --version 1.1.0 \
  --outdir models \
  --test-size 0.15 \
  --seed 42 \
  --eval

# Train all positions
python -m scripts.train_and_export \
  --positions qb,rb,wr \
  --version 1.1.0 \
  --outdir models \
  --qb-csv data/qb.csv \
  --rb-csv data/rb.csv \
  --wr-csv data/wr.csv \
  --test-size 0.15 \
  --seed 42
```

### Frontend Development
```bash
cd recruit-reveal-frontend-next

# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build
npm start

# Run E2E tests
npm run test:e2e          # Headless
npm run test:e2e:ui       # With UI
npm run test:e2e:headed   # With browser visible
```

## Critical Implementation Details

### Feature Engineering (from notebook)
```python
# Trajectory calculation (always >= 0)
trajectory = np.maximum(senior_ypg - junior_ypg, 0)

# Core engineered features
bmi = (weight_lbs / (height_inches ** 2)) * 703
eff_ratio = senior_tds / (senior_ypg + 1e-6)
ath_power = vertical_jump * broad_jump
speed_power_ratio = ath_power / (forty_yard_dash + 1e-6)

# State talent scores (TX, FL, CA, GA = 4; other tiers = 3,2,1)
state_talent_score = {'TX': 4, 'FL': 4, 'CA': 4, 'GA': 4, ...}

# Combine confidence (1.0 if all real data, reduced by 0.2 per imputed field)
combine_confidence = 1.0 - (0.2 * num_imputed_fields)
```

### Model Evaluation Metrics
- **overall_exact_acc**: Exact match accuracy (target ~87%)
- **within_one_acc**: abs(pred - true) <= 1 (target ~99%)
- **fcs_exact_acc**: Accuracy on FCS subset (target ~69%)

### API Endpoints

#### Backend `/api/evaluate`
- Accepts athlete data, calls Azure Synapse or local pipeline
- Returns division prediction with confidence and imputation flags
- Handles position-specific field mapping

#### ML API Endpoints
- `GET /` - Health check
- `POST /predict` - Single athlete prediction
- `POST /predict/{version}` - Version-specific prediction
- `GET /models` - List loaded models with versions
- `GET /models/{position}` - Position-specific model info
- `POST /models/{position}/switch` - Switch active model version

## Security Considerations

### Never Commit to Git
- `*.pkl`, `*.joblib` - Trained models (proprietary)
- `*.csv`, `data/` - Training data (contains PII)
- `*.ipynb` - Notebooks (may contain sensitive logic)
- `.env*` - Environment variables
- `models/` directory contents

### Environment Variables
```bash
# Azure (for Synapse integration)
AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP
AZURE_SYNAPSE_WORKSPACE, AZURE_PIPELINE_NAME

# Database
PG_URL=postgresql://user:password@host:port/database

# ML API
MODEL_VERSION=latest
MODEL_DIR=./models
ALLOWED_ORIGINS="*"
PORT=8000

# Development
MOCK_SYNAPSE=true  # Use mock responses
```

## Testing Strategy

### Backend Tests (`tests/evaluate.test.js`)
- Validate `/evaluate` endpoint with QB/RB data
- Test imputation flags and warnings
- Mock Synapse pipeline responses
- Verify error handling

### Frontend E2E Tests (`tests/e2e/wizard.spec.ts`)
- Complete wizard flow for each position
- Form validation and navigation
- API response verification
- Dashboard integration

### ML Pipeline Testing
- Use `--eval` flag to compute metrics
- Compare against notebook baselines
- Validate feature engineering consistency
- Check model versioning and metadata

## Debugging Tips

### Common Issues
1. **Duplicate columns in XGBoost**: Apply `xgboost_safeguard()` function
2. **Missing combine data**: Check imputation logic and flags
3. **Low accuracy**: Verify TARGET_MAP (D3/NAIA must map to 0)
4. **API timeout**: Check Synapse pipeline status or use MOCK_SYNAPSE=true

### Model Performance Targets
- Overall exact accuracy: ~87%
- Within-one accuracy: ~99%
- FCS exact accuracy: ~69%

### Feature Importance (typical top features)
- speed_power_ratio
- ath_power
- trajectory
- state_talent_score
- combine_confidence

## Deployment

### Local Development
1. Models in `ml-api/models/` (gitignored)
2. Data in `data/` (gitignored)
3. Use `.env.local` for secrets

### Production (Render)
1. Upload models to secure cloud storage
2. Set environment variables on platform
3. Deploy with Docker or buildpacks
4. Monitor with `/health` endpoint

## Code Style Conventions
- Python: PEP 8, type hints where beneficial
- JavaScript/TypeScript: Prettier defaults, ESLint rules
- API responses: Consistent JSON structure with imputation_flags
- Error handling: Always include requestId and details
- Logging: Structured logs with context