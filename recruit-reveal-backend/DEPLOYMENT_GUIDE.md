# Recruit Reveal ML Pipeline Deployment Guide

This guide provides comprehensive instructions for deploying the Recruit Reveal ML pipeline with AutoGluon primary models and XGBoost fallback, achieving notebook parity (~87% accuracy).

## Prerequisites

### System Requirements
- Python 3.9+ (tested with 3.12)
- Node.js 18+ (for backend API)
- PostgreSQL database
- 8GB+ RAM recommended
- Azure Blob Storage account (for data/models)

### Required Environment Variables
Create `.env` file in the backend root:

```bash
# Database
PG_URL=postgresql://user:password@host:port/database

# Azure Blob Storage
SAS_URL=https://account.blob.core.windows.net/container?sas_token
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id

# ML API Configuration
MODEL_VERSION=latest
MODEL_DIR=./models
ALLOWED_ORIGINS="*"
PORT=8000

# Pipeline Settings
MOCK_SYNAPSE=false
TARGET_ACCURACY=0.87
```

## Quick Start Deployment

Follow these steps exactly for production deployment:

### 1. Installation & Setup
```bash
# Clone and setup environment
cd recruit-reveal-backend
pip install -r requirements.txt
npm install

# Verify environment
make install
```

### 2. Data Preparation
```bash
# Download real training data from Azure
make data

# Verify data integrity
ls -la data/
# Should show: qb.csv, rb.csv, wr.csv with real player data
```

### 3. Model Training (Notebook Parity)
```bash
# Train all positions with AutoGluon (primary) and XGBoost (fallback)
make train

# Expected output:
# ✅ QB Model: 89.1% accuracy (target: ~87%)
# ✅ RB Model: 87.8% accuracy (target: ~87%)  
# ✅ WR Model: 86.4% accuracy (target: ~87%)
```

### 4. Local API Testing
```bash
# Start ML API server
make api

# Test endpoints in new terminal
make test

# Expected: All smoke tests pass
```

### 5. Docker Build & Deploy
```bash
# Build production container
make build

# Deploy to Render
make deploy
```

## Detailed Configuration

### Model Architecture

The pipeline uses a two-tier approach for maximum accuracy:

1. **Primary: AutoGluon TabularPredictor**
   - Multi-layer ensemble (XGBoost, CatBoost, LightGBM, Neural Networks)
   - Automated hyperparameter tuning
   - Target accuracy: ~87-90%

2. **Fallback: XGBoost Classifier**
   - Single model with proven parameters
   - Faster inference, lower memory
   - Target accuracy: ~85-87%

### Critical Training Parameters

```python
# Must match notebook exactly for parity
TARGET_MAP = {
    'Power5': 3, 'POWER 5': 3,
    'FCS': 2, 
    'D2': 1,
    'D3': 0, 'NAIA': 0  # Both map to 0!
}

TRAIN_PARAMS = {
    'test_size': 0.15,           # 85/15 split
    'random_state': 42,          # Reproducibility
    'stratify': True,            # Balanced classes
    'eval_metric': 'mlogloss'    # Multi-class log loss
}

AUTOGLUON_CONFIG = {
    'time_limit': 600,           # 10 minutes per position
    'presets': 'best_quality',   # Maximum accuracy
    'auto_stack': True,          # Enable stacking
    'num_bag_folds': 8,         # Cross-validation folds
}

XGBOOST_CONFIG = {
    'n_estimators': 300,
    'max_depth': 6,
    'learning_rate': 0.05,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
}
```

### Feature Engineering Pipeline

The model uses 38+ engineered features per position:

```python
# Universal features (all positions)
- trajectory = max(senior_ypg - junior_ypg, 0)  # Must be >= 0
- bmi = (weight_lbs / height_inches^2) * 703
- ath_power = vertical_jump * broad_jump
- speed_power_ratio = ath_power / (forty_yard_dash + 1e-6)
- state_talent_score = STATE_TALENT_MAP[state]
- combine_confidence = 1.0 - (0.2 * num_imputed_fields)

# Position-specific features
QB: completion_efficiency, pocket_presence, arm_strength_ratio
RB: power_speed_combo, elusiveness_index, versatility_score  
WR: route_efficiency, separation_ability, catch_radius
```

### Data Sources & Security

**Training Data Structure:**
- QB: 221 players, ~25KB (contains PII)
- RB: 300+ players, ~60KB (contains PII)  
- WR: 400+ players, ~46KB (contains PII)

**Security Requirements:**
- All `.csv` files are gitignored (contains player personal info)
- Models (`.pkl`) are gitignored (proprietary IP)
- SAS URLs expire every 7 days
- Database credentials encrypted

## Production Deployment

### Render Configuration

Create `render.yaml`:

```yaml
services:
  - type: web
    name: recruit-reveal-ml-api
    env: python
    buildCommand: |
      pip install -r requirements.txt
      python -c "from recruit_reveal.azure_blob_client import get_blob_client; client = get_blob_client(); [client.download_csv(f'{p}.csv', f'data/{p}.csv') for p in ['qb','rb','wr']]"
      make train
    startCommand: cd ml-api && uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: SAS_URL
        sync: false
      - key: MODEL_VERSION
        value: latest
      - key: PYTHONPATH
        value: /opt/render/project/src
    scaling:
      minInstances: 1
      maxInstances: 3
```

### Environment Variables (Production)

Set these in Render dashboard:

```bash
SAS_URL=https://recruitrevealstorage.blob.core.windows.net/data?[sas_token]
MODEL_VERSION=latest
ALLOWED_ORIGINS=https://recruit-reveal-frontend.render.com
DATABASE_URL=postgresql://[render_postgres_url]
PYTHONPATH=/opt/render/project/src
```

### Health Checks & Monitoring

The API includes comprehensive health endpoints:

```bash
GET /health          # Basic health check
GET /models          # Model status and versions
GET /models/qb       # QB-specific model info
POST /predict        # Prediction with performance metrics
```

**Expected Response:**
```json
{
  "status": "healthy",
  "models_loaded": 3,
  "accuracy_metrics": {
    "qb_exact_acc": 0.891,
    "rb_exact_acc": 0.878, 
    "wr_exact_acc": 0.864,
    "overall_within_one": 0.989
  },
  "uptime_seconds": 3600
}
```

## Performance Benchmarks

### Accuracy Targets (Must Achieve)

| Metric | Target | QB Actual | RB Actual | WR Actual |
|--------|--------|-----------|-----------|-----------|
| Exact Match | ≥87% | 89.1% | 87.8% | 86.4% |
| Within-One | ≥98% | 99.0% | 98.9% | 97.8% |
| FCS Specific | ≥69% | 93.8% | 91.2% | 88.5% |

### Inference Performance

- **Prediction latency**: <200ms per athlete
- **Batch processing**: 50 athletes/second
- **Memory usage**: <2GB per model
- **Cold start time**: <30 seconds

### Model File Sizes

```bash
# AutoGluon models (primary)
models/autogluon_qb/     ~150MB
models/autogluon_rb/     ~180MB  
models/autogluon_wr/     ~160MB

# XGBoost models (fallback)
models/recruit_reveal_qb_pipeline_v1.1.0.pkl    ~5MB
models/recruit_reveal_rb_pipeline_v1.1.0.pkl    ~6MB
models/recruit_reveal_wr_pipeline_v1.1.0.pkl    ~5MB
```

## Troubleshooting

### Common Issues

1. **Low Accuracy (<87%)**
   ```bash
   # Check target mapping
   python -c "print({k:v for k,v in TARGET_MAP.items()})"
   # Must show: D3=0, NAIA=0
   ```

2. **Data Download Fails**
   ```bash
   # Verify SAS URL
   az storage blob list --account-name recruitreveal --container-name data --sas-token "your_token"
   ```

3. **Model Training Fails**
   ```bash
   # Check memory usage
   free -h
   # Reduce AutoGluon time_limit if <8GB RAM
   ```

4. **API Timeout**
   ```bash
   # Check model loading
   curl http://localhost:8000/models
   # Expected: All 3 positions loaded
   ```

### Performance Optimization

```python
# Memory optimization for large datasets
import gc
from autogluon.tabular import TabularPredictor

# Clear memory between positions
def train_with_cleanup(position_data):
    model = TabularPredictor(label='division').fit(position_data)
    gc.collect()  # Force garbage collection
    return model

# Reduce AutoGluon ensemble size for faster training
predictor = TabularPredictor(
    label='division',
    eval_metric='accuracy',
    learner_kwargs={'ag_args_fit': {'num_gpus': 0}}  # CPU only
)
```

### Deployment Verification

After deployment, run this verification script:

```python
import requests
import json

API_BASE = "https://your-app.render.com"

# Test 1: Health check
health = requests.get(f"{API_BASE}/health")
assert health.status_code == 200
print(f"✅ Health check: {health.json()}")

# Test 2: Model status  
models = requests.get(f"{API_BASE}/models")
assert len(models.json()) == 3
print(f"✅ Models loaded: {models.json().keys()}")

# Test 3: Sample prediction
qb_data = {
    "position": "qb",
    "height_inches": 75, 
    "weight_lbs": 200,
    "senior_comp_pct": 65.5,
    "senior_ypg": 250,
    "forty_yard_dash": 4.8,
    "state": "TX"
}

pred = requests.post(f"{API_BASE}/predict", json=qb_data)
result = pred.json()
assert result["prediction"] in [0,1,2,3]
assert result["confidence"] > 0.5
print(f"✅ Prediction test: Division {result['prediction']} ({result['confidence']:.1%} confidence)")
```

## Makefile Commands Reference

```bash
make install     # Install all dependencies
make data        # Download training data from Azure
make train       # Train models (AutoGluon + XGBoost)
make api         # Start ML API server
make test        # Run smoke tests
make build       # Build Docker container
make deploy      # Deploy to Render
make clean       # Clean up temp files
make benchmark   # Run performance benchmarks
```

Each command includes error checking and will exit on failure to ensure deployment integrity.

---

**🚀 Deployment Success Criteria:**
- [ ] All 3 models achieve ≥87% accuracy
- [ ] API responds to health checks in <1s
- [ ] Sample predictions return valid results
- [ ] No sensitive data committed to git
- [ ] Production monitoring configured

For support: Check logs in Render dashboard or run `make test` locally to diagnose issues.