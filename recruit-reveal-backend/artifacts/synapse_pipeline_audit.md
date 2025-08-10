# Synapse Pipeline Audit: Production vs Notebook Reconciliation

## Executive Summary

This audit documents the reconciliation between the Synapse ML notebook (`gitingore-eval-logic-test.ipynb`) and the production pipeline (`recruit_reveal_production_pipeline.py`) to achieve exact accuracy parity of ~87% overall, ~99% within-one-division, and ~69% FCS exact.

## Target Mapping Correction ✅

### Issue Found

The original production pipeline had incorrect TARGET_MAP values:

- `"Power5": 4` (WRONG)
- `"FCS": 3` (WRONG)

### Synapse Ground Truth

From notebook lines 2073, 2397, 3007:

```python
division_map = {'POWER 5': 3, 'FCS': 2, 'D2': 1, 'D3': 0, 'NAIA': 0}
```

### Production Fix Applied

Updated `recruit_reveal/shared_preprocessing.py`:

```python
TARGET_MAP = {
    "Power5": 3,  # Fixed: was 4
    "FCS": 2,     # Fixed: was 3
    "D2": 1,      # Correct
    "D3": 0,      # Correct
    "NAIA": 0,    # Correct
}
```

## Feature Engineering Reconciliation ✅

### Synapse Features Extracted

From notebook analysis, the following critical features were identified and implemented:

1. **Intelligent Combine Imputation**

   - Division-specific distributions
   - Realistic variance by position
   - Imputation flags tracked

2. **State Embeddings**

   - Talent hotbed scoring (TX/FL/CA/GA = tier 1)
   - Binary indicators for tiers
   - `state_talent_score` feature

3. **Enhanced Interactions**

   - `bmi_ypg` (BMI × YPG)
   - `height_traj` (Height × Trajectory)
   - `state_eff` (State talent × Efficiency)
   - `speed_power_ratio` (Athletic power / 40-time)

4. **Position-Specific Features**
   - QB: `comp_ypg`, `height_comp`
   - RB: `ypc_speed`, `weight_ypc`
   - WR: `catch_radius`, `speed_yac`

## XGBoost Parameters Alignment ✅

### Synapse Parameters

```python
XGBOOST_PARAMS = {
    'n_estimators': 300,
    'max_depth': 6,
    'learning_rate': 0.05,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'reg_alpha': 0.1,
    'reg_lambda': 0.1,
    'eval_metric': 'mlogloss',
    'random_state': 42
}
```

### Production Implementation

Exact parameters implemented in `recruit_reveal/shared_preprocessing.py`.

## Train/Test Split Parity ✅

### Synapse Split

- `test_size`: 0.15 (notebook line 1078)
- `random_state`: 42 (notebook line 1080)
- `stratify`: True

### Production Implementation

Matching parameters in `TRAIN_TEST_PARAMS` constant.

## Missing Files Root Cause Analysis

### Previous Issues (Now Fixed)

1. **Missing TARGET_MAP Module**: Created `recruit_reveal/shared_preprocessing.py`
2. **Missing Featurization**: Created `recruit_reveal/featurization.py`
3. **Wrong Target Mapping**: Fixed Power5=3, FCS=2 mapping
4. **Inconsistent Parameters**: Aligned XGBoost and split parameters

### Save Call Implementation ✅

The production pipeline now includes proper model saving:

```python
# From recruit_reveal_production_pipeline.py lines 1598-1603
created_files = pipeline.save_pipeline(
    models_dir=args.outdir,
    model_version=args.version,
    changes=changelog,
    notes=f"Synapse parity {position.upper()} pipeline v{version}"
)
```

## Expected Accuracy Validation

### Synapse Benchmark Results (from notebook)

- Overall accuracy: ~87% exact division match
- Within-one-division: ~99%
- FCS class accuracy: ~69% exact

### CLI Command for Validation

```bash
python -m scripts.train_and_export \
  --csv "/Users/daviddamon/Desktop/221 QB FINAL - Sheet1.csv" \
  --position qb \
  --version 1.1.0 \
  --outdir models \
  --eval
```

## Implementation Status

| Component           | Status      | Notes                           |
| ------------------- | ----------- | ------------------------------- |
| TARGET_MAP Fix      | ✅ Complete | Power5=3, FCS=2, D3/NAIA=0      |
| Feature Engineering | ✅ Complete | All Synapse features replicated |
| XGBoost Parameters  | ✅ Complete | Exact notebook parameters       |
| Train/Test Split    | ✅ Complete | 0.15 test, seed=42, stratified  |
| CLI Interface       | ✅ Complete | `scripts/train_and_export.py`   |
| Model Saving        | ✅ Complete | Versioned with metadata         |
| API Integration     | ✅ Complete | Multi-model FastAPI             |

## Deployment Artifacts Generated

Upon successful training, the following artifacts are created:

- `models/recruit_reveal_{position}_pipeline_v{version}.pkl`
- `models/recruit_reveal_{position}_pipeline_v{version}.metadata.json`
- `models/recruit_reveal_{position}_pipeline_latest.pkl` (symlink/copy)
- `models/recruit_reveal_{position}_pipeline_latest.metadata.json`

## Conclusion

All critical discrepancies between the Synapse notebook and production pipeline have been identified and resolved. The pipeline is now configured for exact accuracy parity with the target metrics of ~87% overall, ~99% within-one, and ~69% FCS exact accuracy.
