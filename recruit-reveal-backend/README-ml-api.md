# Recruit Reveal ML API

Machine Learning API for college football athlete evaluation and division prediction.

## Quick Start

### Local Development

1. **Train and Export Models** (first time only):

   ```bash
   # From recruit-reveal-backend directory
   python -m scripts.train_and_export --csv data/training.csv --position all --version 1.0.0
   ```

2. **Run the API**:

   ```bash
   cd ml-api
   pip install -r requirements.txt
   python main.py
   ```

3. **Test the API**:
   ```bash
   curl http://localhost:8000/health
   ```

### Environment Variables

| Variable          | Default       | Description                                                       |
| ----------------- | ------------- | ----------------------------------------------------------------- |
| `PORT`            | `8000`        | Server port                                                       |
| `MODEL_VERSION`   | `latest`      | Model version to load (`latest` or specific version like `1.0.0`) |
| `MODEL_DIR`       | `auto-detect` | Models directory (auto-detects `ml-api/models` then `models`)     |
| `ALLOWED_ORIGINS` | `*`           | CORS allowed origins (comma-separated)                            |
| `DATABASE_URL`    | `None`        | Database connection string (for future use)                       |

### Examples

**Load specific model version:**

```bash
export MODEL_VERSION=1.2.0
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Custom models directory:**

```bash
export MODEL_DIR=/path/to/models
export MODEL_VERSION=latest
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Production CORS setup:**

```bash
export ALLOWED_ORIGINS="https://mydomain.com,https://www.mydomain.com"
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Model Management

### Training New Models

```bash
# Train all positions with new version
python -m scripts.train_and_export --csv data/updated_training.csv --position all --version 1.1.0

# Train specific position
python -m scripts.train_and_export --csv data/qb_data.csv --position qb --version 1.1.1
```

### Switching Model Versions

**Method 1: Environment Variable (recommended for Render)**

```bash
export MODEL_VERSION=1.1.0
# Restart the API
```

**Method 2: API Endpoint (runtime switching)**

```bash
curl -X POST "http://localhost:8000/models/qb/switch?version=1.1.0"
```

### Model Rollback

```bash
# Rollback to previous version
export MODEL_VERSION=1.0.0
# Restart API

# Or use API endpoint
curl -X POST "http://localhost:8000/models/qb/switch?version=1.0.0"
```

## API Endpoints

### Health Check

```bash
GET /health
```

### Prediction

```bash
POST /predict
Content-Type: application/json

{
  "position": "qb",
  "height_inches": 72,
  "weight_lbs": 200,
  "forty_yard_dash": 4.5,
  "senior_ypg": 250,
  "senior_tds": 25
}
```

### Version-Specific Prediction

```bash
POST /predict/1.0.0
# Same payload as /predict but uses specific model version
```

### Model Information

```bash
GET /models                    # All models info
GET /models/qb                 # Specific position info
GET /models/qb/versions        # All versions for position
```

## Docker Deployment

### Build Image

```bash
cd ml-api
docker build -t recruit-reveal-ml-api .
```

### Run Container

```bash
docker run -p 8000:8000 \
  -e MODEL_VERSION=latest \
  -e ALLOWED_ORIGINS="https://yourdomain.com" \
  recruit-reveal-ml-api
```

### With Volume Mounts (for external models)

```bash
docker run -p 8000:8000 \
  -v /path/to/models:/app/models \
  -e MODEL_DIR=/app/models \
  -e MODEL_VERSION=1.0.0 \
  recruit-reveal-ml-api
```

## Render Deployment

### Environment Variables for Render

Set these in your Render dashboard:

```
PORT=8000
MODEL_VERSION=latest
ALLOWED_ORIGINS=https://your-frontend-domain.com
DATABASE_URL=your-postgres-url
```

### Build Command

```bash
pip install -r requirements.txt
```

### Start Command

```bash
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

## Troubleshooting

### No Models Found

```bash
# Check if models exist
ls models/

# If empty, train models first
python -m scripts.train_and_export --csv data/training.csv --position all --version 1.0.0
```

### Version Not Found

```bash
# List available versions
curl http://localhost:8000/models/qb/versions

# Switch to available version
export MODEL_VERSION=1.0.0
```

### Memory Issues

```bash
# Reduce model complexity in training script
# Or increase container memory allocation
```

### API Errors

```bash
# Check logs for detailed error messages
# Ensure all required features are provided in prediction requests
```

## Development

### Adding New Features

1. Update model pipeline in `recruit_reveal_production_pipeline.py`
2. Retrain models: `python -m scripts.train_and_export --csv data/training.csv --position all --version X.Y.Z`
3. Test API endpoints
4. Update API documentation

### Testing

```bash
# Run smoke tests
python scripts/smoke_test_api.py

# Manual testing
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"position": "qb", "height_inches": 72, "weight_lbs": 200}'
```

## Model Files Structure

```
models/
├── recruit_reveal_qb_pipeline_v1.0.0.pkl
├── recruit_reveal_qb_pipeline_v1.0.0.metadata.json
├── recruit_reveal_qb_pipeline_latest.pkl          # Symlink or copy
├── recruit_reveal_qb_pipeline_latest.metadata.json
├── recruit_reveal_rb_pipeline_v1.0.0.pkl
├── recruit_reveal_rb_pipeline_v1.0.0.metadata.json
├── recruit_reveal_rb_pipeline_latest.pkl
├── recruit_reveal_rb_pipeline_latest.metadata.json
├── recruit_reveal_wr_pipeline_v1.0.0.pkl
├── recruit_reveal_wr_pipeline_v1.0.0.metadata.json
├── recruit_reveal_wr_pipeline_latest.pkl
├── recruit_reveal_wr_pipeline_latest.metadata.json
├── CHANGELOG_qb.md
├── CHANGELOG_rb.md
└── CHANGELOG_wr.md
```
